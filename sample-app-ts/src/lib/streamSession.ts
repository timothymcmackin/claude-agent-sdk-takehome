import { query } from '@anthropic-ai/claude-agent-sdk'
import { EventEmitter } from 'events'
import type { Response } from 'express'
import { UserScopedSessionStore } from '../store.js'
import { worktreePath } from './gitWorktree.js'

// One EventEmitter per active session. Enterprise Pattern #6 note:
// In a multi-host deployment, replace this Map with Redis pub/sub so all
// replicas can subscribe to any session's stream.
const buses = new Map<string, EventEmitter>()

interface ReplayBuffer {
  messages: unknown[]
  done: boolean
}
// Buffered messages per session so SSE clients that connect after a query starts
// still receive everything. Cleared 30 seconds after the query finishes.
const replays = new Map<string, ReplayBuffer>()

function getOrCreateBus(sessionId: string): EventEmitter {
  if (!buses.has(sessionId)) buses.set(sessionId, new EventEmitter().setMaxListeners(50))
  return buses.get(sessionId)!
}

export async function runQuery(
  ownerUserId: string,
  prompt: string,
  sessionId: string,
  resumeSessionId?: string,
): Promise<void> {
  // Enterprise Pattern #1: scope store to session owner so load() finds the right rows
  const store = new UserScopedSessionStore(ownerUserId)
  const bus = getOrCreateBus(sessionId)
  const buffer: ReplayBuffer = { messages: [], done: false }
  replays.set(sessionId, buffer)

  const emit = (msg: unknown) => {
    buffer.messages.push(msg)
    bus.emit('message', msg)
  }

  try {
    const gen = query({
      prompt,
      options: {
        sessionStore: store,
        sessionStoreFlush: 'eager', // Enterprise Pattern #3: near-real-time durability
        resume: resumeSessionId,
        // For new sessions, pin the SDK's internal session ID to our UUID so
        // that subsequent resume: calls can find it in the store.
        ...(resumeSessionId ? {} : { sessionId }),
        cwd: worktreePath(sessionId),
        env: { ...process.env, CLAUDE_CONFIG_DIR: '/tmp' } as NodeJS.ProcessEnv, // Pattern #2
        permissionMode: 'acceptEdits',
        allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
      },
    })

    for await (const msg of gen) {
      // Enterprise Pattern #4: surface store data loss — never silently drop
      if (
        msg.type === 'system' &&
        (msg as { subtype?: string }).subtype === 'mirror_error'
      ) {
        console.error('[mirror_error]', { sessionId, msg })
      }
      emit(msg)
    }
  } catch (err) {
    emit({ type: 'error', error: String(err) })
  } finally {
    buffer.done = true
    bus.emit('done')
    setTimeout(() => {
      buses.delete(sessionId)
      replays.delete(sessionId)
    }, 30_000)
  }
}

export function streamToSSE(sessionId: string, res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`)

  // Drain any messages that arrived before this client connected
  const buffer = replays.get(sessionId)
  if (buffer) {
    for (const msg of buffer.messages) send(msg)
    if (buffer.done) {
      send({ type: 'done' })
      res.end()
      return
    }
  }

  const bus = getOrCreateBus(sessionId)

  const onMessage = (msg: unknown) => send(msg)
  const onDone = () => {
    send({ type: 'done' })
    res.end()
    cleanup()
  }
  const cleanup = () => {
    bus.off('message', onMessage)
    bus.off('done', onDone)
  }

  bus.on('message', onMessage)
  bus.on('done', onDone)
  res.on('close', cleanup)
}
