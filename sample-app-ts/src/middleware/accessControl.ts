import type { Request, Response, NextFunction } from 'express'
import { getMetadata, type SessionMetadata } from '../db/metadata.js'

declare module 'express-serve-static-core' {
  interface Locals {
    sessionMeta: SessionMetadata
  }
}

// operation 'read'  = resume or fork (owners + public sessions)
// operation 'write' = rename, tag, delete, visibility toggle (owner only)
export function requireAccess(operation: 'read' | 'write') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const sessionId = req.params.id
    const userId = (req.query.userId ?? req.body?.userId) as string | undefined

    if (!userId) {
      res.status(400).json({ error: 'userId required' })
      return
    }

    const meta = await getMetadata(sessionId)
    if (!meta) {
      res.status(404).json({ error: 'Session not found' })
      return
    }

    const isOwner = meta.owner_user_id === userId

    if (operation === 'write' && !isOwner) {
      res.status(403).json({ error: 'Only the session owner can perform this operation' })
      return
    }

    if (operation === 'read' && !isOwner && meta.visibility === 'private') {
      res.status(403).json({ error: 'This session is private' })
      return
    }

    res.locals.sessionMeta = meta
    next()
  }
}
