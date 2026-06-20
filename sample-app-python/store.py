"""Enterprise Pattern #1: per-user session isolation via projectKey = userId.

``UserScopedSessionStore`` wraps any ``SessionStore`` and rewrites every
``project_key`` to the owner's user ID before delegating. This ensures that
``load()`` and ``list_sessions()`` never cross user boundaries even when all
users share the same underlying Neon table.
"""

from __future__ import annotations

from claude_agent_sdk import (
    SessionKey,
    SessionListSubkeysKey,
    SessionStore,
    SessionStoreEntry,
    SessionStoreListEntry,
)

from neon_session_store import NeonSessionStore


class UserScopedSessionStore(SessionStore):
    """Wraps a ``NeonSessionStore`` and pins ``project_key`` to ``owner_user_id``.

    Args:
        base: The shared underlying store.
        owner_user_id: The user whose data this store is scoped to.
    """

    def __init__(self, base: NeonSessionStore, owner_user_id: str) -> None:
        self._base = base
        self._owner_user_id = owner_user_id

    def _scoped(self, key: SessionKey) -> SessionKey:
        return {**key, "project_key": self._owner_user_id}

    def _scoped_subkeys(self, key: SessionListSubkeysKey) -> SessionListSubkeysKey:
        return {**key, "project_key": self._owner_user_id}

    async def append(self, key: SessionKey, entries: list[SessionStoreEntry]) -> None:
        await self._base.append(self._scoped(key), entries)

    async def load(self, key: SessionKey) -> list[SessionStoreEntry] | None:
        return await self._base.load(self._scoped(key))

    async def list_sessions(self, project_key: str) -> list[SessionStoreListEntry]:
        # Ignore the incoming project_key — always scope to owner_user_id.
        return await self._base.list_sessions(self._owner_user_id)

    async def delete(self, key: SessionKey) -> None:
        await self._base.delete(self._scoped(key))

    async def list_subkeys(self, key: SessionListSubkeysKey) -> list[str]:
        return await self._base.list_subkeys(self._scoped_subkeys(key))
