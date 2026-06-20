import type { SessionKey, SessionStore, SessionStoreEntry } from '@anthropic-ai/claude-agent-sdk'
import { baseStore } from './NeonMCPSessionStore.js'

// Enterprise Pattern #1: Rewrites projectKey to ownerUserId on every store call.
// All users share the same cwd so we must scope sessions to their owner explicitly.
// When resuming another user's public session, construct this with the *owner's* userId.
export class UserScopedSessionStore implements SessionStore {
  constructor(private readonly userId: string) {}

  append(key: SessionKey, entries: SessionStoreEntry[]) {
    return baseStore.append({ ...key, projectKey: this.userId }, entries)
  }
  load(key: SessionKey) {
    return baseStore.load({ ...key, projectKey: this.userId })
  }
  listSessions() {
    return baseStore.listSessions(this.userId)
  }
  delete(key: SessionKey) {
    return baseStore.delete({ ...key, projectKey: this.userId })
  }
  listSubkeys(key: { projectKey: string; sessionId: string }) {
    return baseStore.listSubkeys({ ...key, projectKey: this.userId })
  }
}
