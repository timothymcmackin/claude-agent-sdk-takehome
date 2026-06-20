"""Runnable demo: enterprise session management with the Claude Agent SDK.

Demonstrates all eight patterns from the TypeScript sample app using the
Python SDK and asyncpg instead of the Neon MCP server.

Prerequisites:
    pip install -r requirements.txt

    Add to sample-app-ts/.env (or set as env vars):
        NEON_DATABASE_URL=postgresql://user:pass@host/neondb?sslmode=require
        ANTHROPIC_API_KEY=sk-ant-...

Run:
    python example.py
"""

from __future__ import annotations

import asyncio
import os
import uuid

import asyncpg
from dotenv import load_dotenv

from claude_agent_sdk import ClaudeAgentOptions, query
from claude_agent_sdk import fork_session_via_store, delete_session_via_store
from claude_agent_sdk import AssistantMessage, SystemMessage, TextBlock

from db.metadata import delete_metadata, insert_metadata, list_visible_sessions
from neon_session_store import NeonSessionStore
from store import UserScopedSessionStore

# Load from sample-app-ts/.env (one directory up) so both apps share the same
# key file. Fall back to environment variables if already set.
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", "sample-app-ts", ".env"))


def print_assistant(msg: AssistantMessage) -> None:
    for block in msg.content:
        if isinstance(block, TextBlock):
            print(block.text)


async def main() -> None:
    pool = await asyncpg.create_pool(os.environ["NEON_DATABASE_URL"])
    base_store = NeonSessionStore(pool)
    await base_store.ensure_schema()

    # ── Enterprise Pattern #1: projectKey = userId ────────────────────────────
    sam_store = UserScopedSessionStore(base_store, "sam")

    session_id = str(uuid.uuid4())

    # ── Pattern #5: create — new session with a pinned UUID ───────────────────
    print("=== First turn (new session) ===")
    async for msg in query(
        prompt="Hello! Briefly introduce yourself in one sentence.",
        options=ClaudeAgentOptions(
            session_store=sam_store,
            session_store_flush="eager",  # Pattern #3: near-real-time durability
            session_id=session_id,        # pin our UUID so resume works
            allowed_tools=[],
        ),
    ):
        # Pattern #4: surface store data loss — never silently drop
        if isinstance(msg, SystemMessage) and msg.subtype == "mirror_error":
            print("[mirror_error]", msg)
        if isinstance(msg, AssistantMessage):
            print_assistant(msg)

    await insert_metadata(pool, session_id, "sam", "feature/demo")
    print(f"Session created: {session_id[:8]}…")

    # ── Pattern #5: resume ────────────────────────────────────────────────────
    print("\n=== Second turn (resume) ===")
    async for msg in query(
        prompt="What did you just say?",
        options=ClaudeAgentOptions(
            session_store=sam_store,
            session_store_flush="eager",
            resume=session_id,
            allowed_tools=[],
        ),
    ):
        if isinstance(msg, SystemMessage) and msg.subtype == "mirror_error":
            print("[mirror_error]", msg)
        if isinstance(msg, AssistantMessage):
            print_assistant(msg)

    # ── Pattern #5: list ──────────────────────────────────────────────────────
    entries = await sam_store.list_sessions("sam")
    print(f"\nSam's sessions in store: {len(entries)}")

    # Pattern #6: visibility — list what sam and others can see
    visible = await list_visible_sessions(pool, "sam")
    print(f"Sessions visible to sam (own + public): {len(visible)}")

    # ── Pattern #5: fork ──────────────────────────────────────────────────────
    # fork_session_via_store reads from sam_store (project_key = "sam") and
    # writes the fork back to the same store under a new UUID.
    fork_result = await fork_session_via_store(sam_store, session_id)
    fork_id = fork_result.session_id
    await insert_metadata(pool, fork_id, "sam", "feature/demo-fork")
    print(f"\nForked → {fork_id[:8]}…")

    # ── Pattern #5: delete ────────────────────────────────────────────────────
    await delete_session_via_store(sam_store, session_id)
    await delete_metadata(pool, session_id)
    print(f"Deleted original session {session_id[:8]}…")

    remaining = await sam_store.list_sessions("sam")
    print(f"Sessions remaining: {len(remaining)}")

    await pool.close()


if __name__ == "__main__":
    asyncio.run(main())
