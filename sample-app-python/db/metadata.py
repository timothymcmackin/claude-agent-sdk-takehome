"""Helpers for the ``session_metadata`` table.

Tracks per-session ownership and visibility independently of the SDK's
session transcript store. This lets the app enforce access control
(Enterprise Pattern #6) without touching transcript data.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    import asyncpg

Visibility = Literal["public", "private"]


@dataclass
class SessionMetadata:
    session_id: str
    owner_user_id: str
    visibility: Visibility
    branch_name: str
    created_at: str


async def insert_metadata(
    pool: asyncpg.Pool,
    session_id: str,
    owner_user_id: str,
    branch_name: str,
    visibility: Visibility = "private",
) -> None:
    await pool.execute(
        """
        INSERT INTO session_metadata (session_id, owner_user_id, visibility, branch_name)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (session_id) DO NOTHING
        """,
        session_id,
        owner_user_id,
        visibility,
        branch_name,
    )


async def get_metadata(pool: asyncpg.Pool, session_id: str) -> SessionMetadata | None:
    row = await pool.fetchrow(
        "SELECT * FROM session_metadata WHERE session_id = $1",
        session_id,
    )
    if row is None:
        return None
    return SessionMetadata(**dict(row))


async def list_visible_sessions(pool: asyncpg.Pool, user_id: str) -> list[SessionMetadata]:
    rows = await pool.fetch(
        """
        SELECT * FROM session_metadata
        WHERE owner_user_id = $1 OR visibility = 'public'
        ORDER BY created_at DESC
        """,
        user_id,
    )
    return [SessionMetadata(**dict(r)) for r in rows]


async def update_visibility(
    pool: asyncpg.Pool,
    session_id: str,
    visibility: Visibility,
) -> None:
    await pool.execute(
        "UPDATE session_metadata SET visibility = $1 WHERE session_id = $2",
        visibility,
        session_id,
    )


async def delete_metadata(pool: asyncpg.Pool, session_id: str) -> None:
    await pool.execute(
        "DELETE FROM session_metadata WHERE session_id = $1",
        session_id,
    )
