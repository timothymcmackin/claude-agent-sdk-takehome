import { Router } from 'express'
import { deleteSession, renameSession, forkSession, tagSession } from '@anthropic-ai/claude-agent-sdk'
import { requireAccess } from '../middleware/accessControl.js'
import { deleteMetadata, insertMetadata } from '../db/metadata.js'
import { UserScopedSessionStore } from '../store.js'
import { removeWorktree, createWorktree } from '../lib/gitWorktree.js'

const router = Router()

// DELETE /api/sessions/:id?userId=X
router.delete('/:id', requireAccess('write'), async (req, res) => {
  const meta = res.locals.sessionMeta
  const store = new UserScopedSessionStore(meta.owner_user_id)
  await deleteSession(req.params.id, { sessionStore: store })
  await deleteMetadata(req.params.id)
  await removeWorktree(req.params.id)
  res.json({ deleted: req.params.id })
})

// PATCH /api/sessions/:id/rename   body: { userId, title }
router.patch('/:id/rename', requireAccess('write'), async (req, res) => {
  const meta = res.locals.sessionMeta
  const { title } = req.body as { title?: string }
  if (!title) return res.status(400).json({ error: 'title required' })
  const store = new UserScopedSessionStore(meta.owner_user_id)
  await renameSession(req.params.id, title, { sessionStore: store })
  res.json({ sessionId: req.params.id, title })
})

// POST /api/sessions/:id/fork   body: { userId, newBranchName? }
router.post('/:id/fork', requireAccess('read'), async (req, res) => {
  const meta = res.locals.sessionMeta
  const userId = (req.body?.userId ?? req.query.userId) as string
  const newBranchName = (req.body?.newBranchName as string | undefined) ?? `${meta.branch_name}-fork`

  const store = new UserScopedSessionStore(meta.owner_user_id)
  const { sessionId: forkId } = await forkSession(req.params.id, { sessionStore: store })

  await createWorktree(forkId, newBranchName)
  await insertMetadata(forkId, userId, newBranchName)

  res.json({ sessionId: forkId, branchName: newBranchName })
})

// PATCH /api/sessions/:id/tag   body: { userId, tag }
router.patch('/:id/tag', requireAccess('write'), async (req, res) => {
  const meta = res.locals.sessionMeta
  const { tag } = req.body as { tag?: string | null }
  const store = new UserScopedSessionStore(meta.owner_user_id)
  await tagSession(req.params.id, tag ?? null, { sessionStore: store })
  res.json({ sessionId: req.params.id, tag: tag ?? null })
})

export default router
