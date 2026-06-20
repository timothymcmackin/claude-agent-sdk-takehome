import { Router } from 'express'
import { randomUUID } from 'crypto'
import { createWorktree, ensureWorktree } from '../lib/gitWorktree.js'
import { runQuery, streamToSSE } from '../lib/streamSession.js'
import { getMetadata, insertMetadata } from '../db/metadata.js'

const router = Router()

// POST /api/query   body: { userId, prompt, branchName?, resumeSessionId? }
router.post('/query', async (req, res) => {
  const { userId, prompt, branchName, resumeSessionId } = req.body as {
    userId?: string
    prompt?: string
    branchName?: string
    resumeSessionId?: string
  }

  if (!userId || !prompt) {
    return res.status(400).json({ error: 'userId and prompt are required' })
  }

  let sessionId: string
  let ownerUserId: string

  if (resumeSessionId) {
    const meta = await getMetadata(resumeSessionId)
    if (!meta) return res.status(404).json({ error: 'Session not found' })
    if (meta.visibility === 'private' && meta.owner_user_id !== userId) {
      return res.status(403).json({ error: 'This session is private' })
    }
    sessionId = resumeSessionId
    ownerUserId = meta.owner_user_id
    // Re-create the worktree if the container restarted and cleaned up /workspace/worktrees
    await ensureWorktree(sessionId, meta.branch_name)
  } else {
    if (!branchName) return res.status(400).json({ error: 'branchName required for new session' })
    sessionId = randomUUID()
    ownerUserId = userId
    await createWorktree(sessionId, branchName)
    await insertMetadata(sessionId, userId, branchName)
  }

  // Fire-and-forget — client subscribes via SSE
  runQuery(ownerUserId, prompt, sessionId, resumeSessionId).catch(err =>
    console.error('[runQuery]', sessionId, err),
  )

  res.json({ sessionId })
})

// GET /api/stream/:sessionId — SSE stream for a running or recently finished query
router.get('/stream/:sessionId', (req, res) => {
  streamToSSE(req.params.sessionId, res)
})

export default router
