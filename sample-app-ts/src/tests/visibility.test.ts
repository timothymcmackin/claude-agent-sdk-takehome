import { describe, it, expect, beforeEach, vi } from 'vitest'
import request from 'supertest'
import express from 'express'

// ── Hoisted shared state ─────────────────────────────────────────────────────
// vi.mock() factories run before module-level code, so shared state must be
// created with vi.hoisted() to be accessible inside factory closures.

interface Meta {
  session_id: string
  owner_user_id: string
  visibility: 'public' | 'private'
  branch_name: string
  created_at: string
}

const { metaMap } = vi.hoisted(() => ({
  metaMap: new Map<string, Meta>(),
}))

// Simple in-memory session store (avoids importing InMemorySessionStore before mocks register)
const { sessionsByOwner } = vi.hoisted(() => ({
  sessionsByOwner: new Map<string, Map<string, unknown[]>>(),
}))

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('../db/metadata.js', () => ({
  getMetadata: (id: string) => Promise.resolve(metaMap.get(id) ?? null),
  listVisibleSessions: (userId: string) =>
    Promise.resolve(
      [...metaMap.values()].filter(
        m => m.owner_user_id === userId || m.visibility === 'public',
      ),
    ),
  updateVisibility: (id: string, visibility: 'public' | 'private') => {
    const m = metaMap.get(id)
    if (m) metaMap.set(id, { ...m, visibility })
    return Promise.resolve()
  },
  insertMetadata: (
    id: string,
    owner: string,
    branch: string,
    vis: 'public' | 'private' = 'private',
  ) => {
    metaMap.set(id, {
      session_id: id,
      owner_user_id: owner,
      visibility: vis,
      branch_name: branch,
      created_at: new Date().toISOString(),
    })
    return Promise.resolve()
  },
  deleteMetadata: (id: string) => {
    metaMap.delete(id)
    return Promise.resolve()
  },
}))

vi.mock('../store.js', () => ({
  UserScopedSessionStore: class {
    userId: string
    constructor(userId: string) {
      this.userId = userId
    }
    listSessions() {
      const ownerMap = sessionsByOwner.get(this.userId) ?? new Map()
      return Promise.resolve(
        [...ownerMap.keys()].map(sid => ({ sessionId: sid, mtime: Date.now() })),
      )
    }
    load() {
      return Promise.resolve(null)
    }
    append() {
      return Promise.resolve()
    }
    delete() {
      return Promise.resolve()
    }
    listSubkeys() {
      return Promise.resolve([])
    }
  },
}))

vi.mock('@anthropic-ai/claude-agent-sdk', async importOriginal => {
  const actual = await importOriginal<typeof import('@anthropic-ai/claude-agent-sdk')>()
  return {
    ...actual,
    getSessionMessages: async () => [],
    deleteSession: async () => {},
    renameSession: async () => {},
    forkSession: async () => ({
      sessionId: 'fork-' + Math.random().toString(36).slice(2, 10),
    }),
    tagSession: async () => {},
  }
})

vi.mock('../lib/gitWorktree.js', () => ({
  worktreePath: (id: string) => `/tmp/worktrees/${id}`,
  createWorktree: async () => {},
  ensureWorktree: async () => {},
  removeWorktree: async () => {},
  listBranches: async () => ['main', 'feature/add-pagination', 'feature/shopping-list'],
}))

// ── App factory (imports after mocks are registered) ─────────────────────────

import sessionsRouter from '../routes/sessions.js'
import sessionOpsRouter from '../routes/sessionOps.js'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/sessions', sessionsRouter)
  app.use('/api/sessions', sessionOpsRouter)
  return app
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SESSION_A = 'aaaaaaaa-0000-0000-0000-000000000000' // Sam — private
const SESSION_B = 'bbbbbbbb-0000-0000-0000-000000000000' // Sam — public
const SESSION_C = 'cccccccc-0000-0000-0000-000000000000' // Joan — private

beforeEach(() => {
  metaMap.clear()
  sessionsByOwner.clear()
  metaMap.set(SESSION_A, { session_id: SESSION_A, owner_user_id: 'sam', visibility: 'private', branch_name: 'feature/add-pagination', created_at: new Date().toISOString() })
  metaMap.set(SESSION_B, { session_id: SESSION_B, owner_user_id: 'sam', visibility: 'public', branch_name: 'feature/shopping-list', created_at: new Date().toISOString() })
  metaMap.set(SESSION_C, { session_id: SESSION_C, owner_user_id: 'joan', visibility: 'private', branch_name: 'feature/dietary-filters', created_at: new Date().toISOString() })
})

// ── Session listing ──────────────────────────────────────────────────────────

describe('Session listing — visibility', () => {
  it('Sam sees own private (A) and own public (B), not Joan private (C)', async () => {
    const res = await request(makeApp()).get('/api/sessions?userId=sam')
    expect(res.status).toBe(200)
    const ids: string[] = res.body.map((s: { sessionId: string }) => s.sessionId)
    expect(ids).toContain(SESSION_A)
    expect(ids).toContain(SESSION_B)
    expect(ids).not.toContain(SESSION_C)
  })

  it('Joan sees own private (C) and Sam public (B), not Sam private (A)', async () => {
    const res = await request(makeApp()).get('/api/sessions?userId=joan')
    expect(res.status).toBe(200)
    const ids: string[] = res.body.map((s: { sessionId: string }) => s.sessionId)
    expect(ids).toContain(SESSION_C)
    expect(ids).toContain(SESSION_B)
    expect(ids).not.toContain(SESSION_A)
  })

  it('Henry sees Sam public (B) only, not private A or C', async () => {
    const res = await request(makeApp()).get('/api/sessions?userId=henry')
    expect(res.status).toBe(200)
    const ids: string[] = res.body.map((s: { sessionId: string }) => s.sessionId)
    expect(ids).toContain(SESSION_B)
    expect(ids).not.toContain(SESSION_A)
    expect(ids).not.toContain(SESSION_C)
  })

  it('isOwner is true for owner, false for others', async () => {
    const res = await request(makeApp()).get('/api/sessions?userId=joan')
    const b = res.body.find((s: { sessionId: string }) => s.sessionId === SESSION_B)
    const c = res.body.find((s: { sessionId: string }) => s.sessionId === SESSION_C)
    expect(b.isOwner).toBe(false) // B belongs to Sam
    expect(c.isOwner).toBe(true)  // C belongs to Joan
  })
})

// ── Session messages — access control ────────────────────────────────────────

describe('Session messages — access control', () => {
  it('Sam can read own private session A', async () => {
    const res = await request(makeApp()).get(`/api/sessions/${SESSION_A}/messages?userId=sam`)
    expect(res.status).toBe(200)
  })

  it('Joan can read Sam public session B', async () => {
    const res = await request(makeApp()).get(`/api/sessions/${SESSION_B}/messages?userId=joan`)
    expect(res.status).toBe(200)
  })

  it('Joan cannot read Sam private session A → 403', async () => {
    const res = await request(makeApp()).get(`/api/sessions/${SESSION_A}/messages?userId=joan`)
    expect(res.status).toBe(403)
  })

  it('Henry cannot read Joan private session C → 403', async () => {
    const res = await request(makeApp()).get(`/api/sessions/${SESSION_C}/messages?userId=henry`)
    expect(res.status).toBe(403)
  })
})

// ── Visibility toggle ────────────────────────────────────────────────────────

describe('Visibility toggle', () => {
  it('Sam can toggle session A to public', async () => {
    const res = await request(makeApp())
      .patch(`/api/sessions/${SESSION_A}/visibility`)
      .send({ userId: 'sam', visibility: 'public' })
    expect(res.status).toBe(200)
    expect(res.body.visibility).toBe('public')
  })

  it('Joan cannot toggle Sam session A → 403', async () => {
    const res = await request(makeApp())
      .patch(`/api/sessions/${SESSION_A}/visibility`)
      .send({ userId: 'joan', visibility: 'public' })
    expect(res.status).toBe(403)
  })

  it('after Sam makes A public, Joan can see it', async () => {
    const app = makeApp()
    await request(app)
      .patch(`/api/sessions/${SESSION_A}/visibility`)
      .send({ userId: 'sam', visibility: 'public' })

    const res = await request(app).get('/api/sessions?userId=joan')
    const ids: string[] = res.body.map((s: { sessionId: string }) => s.sessionId)
    expect(ids).toContain(SESSION_A)
  })

  it('after Sam makes B private, Joan can no longer see it', async () => {
    const app = makeApp()
    await request(app)
      .patch(`/api/sessions/${SESSION_B}/visibility`)
      .send({ userId: 'sam', visibility: 'private' })

    const res = await request(app).get('/api/sessions?userId=joan')
    const ids: string[] = res.body.map((s: { sessionId: string }) => s.sessionId)
    expect(ids).not.toContain(SESSION_B)
  })
})

// ── Session operations — ownership ──────────────────────────────────────────

describe('Session operations — ownership', () => {
  it('Sam can delete own session A', async () => {
    const res = await request(makeApp()).delete(`/api/sessions/${SESSION_A}?userId=sam`)
    expect(res.status).toBe(200)
  })

  it('Joan cannot delete Sam session A → 403', async () => {
    const res = await request(makeApp()).delete(`/api/sessions/${SESSION_A}?userId=joan`)
    expect(res.status).toBe(403)
  })

  it('Sam can rename own session B', async () => {
    const res = await request(makeApp())
      .patch(`/api/sessions/${SESSION_B}/rename`)
      .send({ userId: 'sam', title: 'New Title' })
    expect(res.status).toBe(200)
  })

  it('Joan cannot rename Sam session B → 403', async () => {
    const res = await request(makeApp())
      .patch(`/api/sessions/${SESSION_B}/rename`)
      .send({ userId: 'joan', title: 'Hijack' })
    expect(res.status).toBe(403)
  })

  it('Joan can fork Sam public session B', async () => {
    const res = await request(makeApp())
      .post(`/api/sessions/${SESSION_B}/fork`)
      .send({ userId: 'joan', newBranchName: 'feature/shopping-list-fork' })
    expect(res.status).toBe(200)
    expect(res.body.sessionId).toBeTruthy()
    expect(res.body.branchName).toBe('feature/shopping-list-fork')

    // Fork is now in Joan's metadata as private
    const forkMeta = metaMap.get(res.body.sessionId)
    expect(forkMeta?.owner_user_id).toBe('joan')
    expect(forkMeta?.visibility).toBe('private')
  })

  it('Henry cannot fork Sam private session A → 403', async () => {
    const res = await request(makeApp())
      .post(`/api/sessions/${SESSION_A}/fork`)
      .send({ userId: 'henry', newBranchName: 'feature/stolen' })
    expect(res.status).toBe(403)
  })
})
