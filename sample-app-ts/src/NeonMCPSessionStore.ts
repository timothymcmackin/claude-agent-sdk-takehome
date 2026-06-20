import type { SessionKey, SessionStore, SessionStoreEntry } from '@anthropic-ai/claude-agent-sdk'
import { neonClient, sqlStr } from './neonMCP.js'

const TABLE = 'claude_session_entries'

export class NeonMCPSessionStore implements SessionStore {
  async ensureSchema(): Promise<void> {
    await neonClient.runSQL(`
      CREATE TABLE IF NOT EXISTS ${TABLE} (
        id          BIGSERIAL PRIMARY KEY,
        project_key TEXT NOT NULL,
        session_id  TEXT NOT NULL,
        subpath     TEXT,
        entry       JSONB NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
    await neonClient.runSQL(`
      CREATE INDEX IF NOT EXISTS ${TABLE}_key_idx
        ON ${TABLE} (project_key, session_id, subpath, id)
    `)
    await neonClient.runSQL(`
      CREATE TABLE IF NOT EXISTS session_metadata (
        session_id    TEXT PRIMARY KEY,
        owner_user_id TEXT NOT NULL,
        visibility    TEXT NOT NULL DEFAULT 'private',
        branch_name   TEXT NOT NULL,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)
  }

  async append(key: SessionKey, entries: SessionStoreEntry[]): Promise<void> {
    if (entries.length === 0) return
    for (const entry of entries) {
      const subpathExpr = key.subpath != null ? sqlStr(key.subpath) : 'NULL'
      await neonClient.runSQL(
        `INSERT INTO ${TABLE} (project_key, session_id, subpath, entry)
         VALUES (${sqlStr(key.projectKey)}, ${sqlStr(key.sessionId)}, ${subpathExpr}, ${sqlStr(JSON.stringify(entry))}::jsonb)`,
      )
    }
  }

  async load(key: SessionKey): Promise<SessionStoreEntry[] | null> {
    const subpathClause =
      key.subpath != null
        ? `AND subpath = ${sqlStr(key.subpath)}`
        : 'AND subpath IS NULL'
    const rows = await neonClient.runSQL<{ entry: SessionStoreEntry }>(
      `SELECT entry FROM ${TABLE}
       WHERE project_key = ${sqlStr(key.projectKey)} AND session_id = ${sqlStr(key.sessionId)} ${subpathClause}
       ORDER BY id`,
    )
    return rows.length > 0 ? rows.map(r => r.entry) : null
  }

  async listSessions(projectKey: string): Promise<Array<{ sessionId: string; mtime: number }>> {
    const rows = await neonClient.runSQL<{ session_id: string; mtime: string }>(
      `SELECT session_id, MAX(created_at) AS mtime FROM ${TABLE}
       WHERE project_key = ${sqlStr(projectKey)} AND subpath IS NULL
       GROUP BY session_id
       ORDER BY mtime DESC`,
    )
    return rows.map(r => ({ sessionId: r.session_id, mtime: new Date(r.mtime).getTime() }))
  }

  async delete(key: SessionKey): Promise<void> {
    if (key.subpath === undefined) {
      await neonClient.runSQL(
        `DELETE FROM ${TABLE} WHERE project_key = ${sqlStr(key.projectKey)} AND session_id = ${sqlStr(key.sessionId)}`,
      )
    } else {
      await neonClient.runSQL(
        `DELETE FROM ${TABLE} WHERE project_key = ${sqlStr(key.projectKey)} AND session_id = ${sqlStr(key.sessionId)} AND subpath = ${sqlStr(key.subpath)}`,
      )
    }
  }

  async listSubkeys(key: { projectKey: string; sessionId: string }): Promise<string[]> {
    const rows = await neonClient.runSQL<{ subpath: string }>(
      `SELECT DISTINCT subpath FROM ${TABLE}
       WHERE project_key = ${sqlStr(key.projectKey)} AND session_id = ${sqlStr(key.sessionId)} AND subpath IS NOT NULL`,
    )
    return rows.map(r => r.subpath)
  }
}

export const baseStore = new NeonMCPSessionStore()
