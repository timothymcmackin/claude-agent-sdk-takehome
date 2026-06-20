"""Neon-Postgres-backed SessionStore for the Claude Agent SDK.

Connects directly to Neon via asyncpg (``NEON_DATABASE_URL`` env var).
Schema matches the TypeScript sample app so both implementations share the
same Neon tables.

Usage::

    import asyncpg
    from neon_session_store import NeonSessionStore

    pool = await asyncpg.create_pool(os.environ["NEON_DATABASE_URL"])
    store = NeonSessionStore(pool)
    await store.ensure_schema()   # one-time, idempotent

Schema::

    CREATE TABLE claude_session_entries (
        id          BIGSERIAL PRIMARY KEY,
        project_key TEXT NOT NULL,
        session_id  TEXT NOT NULL,
        subpath     TEXT,            -- NULL = main transcript
        entry       JSONB NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE session_metadata (
        session_id    TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        visibility    TEXT NOT NULL DEFAULT 'private',
        branch_name   TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING

from claude_agent_sdk import (
    SessionKey,
    SessionListSubkeysKey,
    SessionStore,
    SessionStoreEntry,
    SessionStoreListEntry,
)

if TYPE_CHECKING:
    import asyncpg

TABLE = "claude_session_entries"


class NeonSessionStore(SessionStore):
    """asyncpg-backed ``SessionStore`` writing to Neon Postgres.

    Args:
        pool: Pre-configured ``asyncpg.Pool``. Caller controls DSN, TLS, and
            pool sizing. Create via ``asyncpg.create_pool(NEON_DATABASE_URL)``.
    """

    def __init__(self, pool: asyncpg.Pool) -> None:
        self._pool = pool

    async def ensure_schema(self) -> None:
        """Create tables and indexes if absent. Idempotent — safe to call on
        every startup."""
        await self._pool.execute(f"""
            CREATE TABLE IF NOT EXISTS {TABLE} (
                id          BIGSERIAL PRIMARY KEY,
                project_key TEXT NOT NULL,
                session_id  TEXT NOT NULL,
                subpath     TEXT,
                entry       JSONB NOT NULL,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS {TABLE}_key_idx
                ON {TABLE} (project_key, session_id, subpath, id);
            CREATE TABLE IF NOT EXISTS session_metadata (
                session_id    TEXT PRIMARY KEY,
                owner_user_id TEXT NOT NULL,
                visibility    TEXT NOT NULL DEFAULT 'private',
                branch_name   TEXT NOT NULL,
                created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
        """)

    # ------------------------------------------------------------------
    # SessionStore protocol
    # ------------------------------------------------------------------

    async def append(self, key: SessionKey, entries: list[SessionStoreEntry]) -> None:
        if not entries:
            return
        subpath = key.get("subpath")
        for entry in entries:
            await self._pool.execute(
                f"""
                INSERT INTO {TABLE} (project_key, session_id, subpath, entry)
                VALUES ($1, $2, $3, $4::jsonb)
                """,
                key["project_key"],
                key["session_id"],
                subpath,  # None → NULL
                json.dumps(entry),
            )

    async def load(self, key: SessionKey) -> list[SessionStoreEntry] | None:
        subpath = key.get("subpath")
        if subpath is not None:
            rows = await self._pool.fetch(
                f"""
                SELECT entry FROM {TABLE}
                WHERE project_key = $1 AND session_id = $2 AND subpath = $3
                ORDER BY id
                """,
                key["project_key"],
                key["session_id"],
                subpath,
            )
        else:
            rows = await self._pool.fetch(
                f"""
                SELECT entry FROM {TABLE}
                WHERE project_key = $1 AND session_id = $2 AND subpath IS NULL
                ORDER BY id
                """,
                key["project_key"],
                key["session_id"],
            )
        if not rows:
            return None
        out: list[SessionStoreEntry] = []
        for row in rows:
            v = row["entry"]
            out.append(json.loads(v) if isinstance(v, (str, bytes)) else v)
        return out

    async def list_sessions(self, project_key: str) -> list[SessionStoreListEntry]:
        rows = await self._pool.fetch(
            f"""
            SELECT session_id, MAX(EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS mtime
            FROM {TABLE}
            WHERE project_key = $1 AND subpath IS NULL
            GROUP BY session_id
            ORDER BY mtime DESC
            """,
            project_key,
        )
        return [{"session_id": r["session_id"], "mtime": int(r["mtime"])} for r in rows]

    async def delete(self, key: SessionKey) -> None:
        subpath = key.get("subpath")
        if subpath is not None:
            await self._pool.execute(
                f"""
                DELETE FROM {TABLE}
                WHERE project_key = $1 AND session_id = $2 AND subpath = $3
                """,
                key["project_key"],
                key["session_id"],
                subpath,
            )
        else:
            # Cascade: remove main transcript and all subagent subpaths.
            await self._pool.execute(
                f"""
                DELETE FROM {TABLE}
                WHERE project_key = $1 AND session_id = $2
                """,
                key["project_key"],
                key["session_id"],
            )

    async def list_subkeys(self, key: SessionListSubkeysKey) -> list[str]:
        rows = await self._pool.fetch(
            f"""
            SELECT DISTINCT subpath FROM {TABLE}
            WHERE project_key = $1 AND session_id = $2 AND subpath IS NOT NULL
            """,
            key["project_key"],
            key["session_id"],
        )
        return [r["subpath"] for r in rows]
