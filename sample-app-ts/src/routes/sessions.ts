import { Router } from 'express'
import { getSessionMessages } from '@anthropic-ai/claude-agent-sdk'
import { listVisibleSessions, updateVisibility } from '../db/metadata.js'
import { UserScopedSessionStore } from '../store.js'
import { requireAccess } from '../middleware/accessControl.js'

const router = Router()

// GET /api/sessions?userId=X
router.get('/', async (req, res) => {
  const userId = req.query.userId as string | undefined
  if (!userId) return res.status(400).json({ error: 'userId required' })

  const metaList = await listVisibleSessions(userId)

  const sessions = await Promise.all(
    metaList.map(async meta => {
      // Use the owner's store to get mtime (summary data lives under owner's projectKey)
      const store = new UserScopedSessionStore(meta.owner_user_id)
      const ownerSessions = await store.listSessions()
      const storeEntry = ownerSessions.find(s => s.sessionId === meta.session_id)
      return {
        sessionId: meta.session_id,
        ownerUserId: meta.owner_user_id,
        visibility: meta.visibility,
        branchName: meta.branch_name,
        createdAt: meta.created_at,
        lastModified: storeEntry?.mtime ?? new Date(meta.created_at).getTime(),
        isOwner: meta.owner_user_id === userId,
      }
    }),
  )

  res.json(sessions)
})

// GET /api/sessions/:id/messages?userId=X
router.get('/:id/messages', requireAccess('read'), async (req, res) => {
  const meta = res.locals.sessionMeta
  const messages = await getSessionMessages(req.params.id, {
    sessionStore: new UserScopedSessionStore(meta.owner_user_id),
  })
  res.json(messages)
})

// PATCH /api/sessions/:id/visibility   body: { userId, visibility }
router.patch('/:id/visibility', requireAccess('write'), async (req, res) => {
  const { visibility } = req.body as { visibility?: string }
  if (visibility !== 'public' && visibility !== 'private') {
    return res.status(400).json({ error: 'visibility must be "public" or "private"' })
  }
  await updateVisibility(req.params.id, visibility)
  res.json({ sessionId: req.params.id, visibility })
})

export default router
