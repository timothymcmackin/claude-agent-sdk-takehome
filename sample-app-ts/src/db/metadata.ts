import { neonClient, sqlStr } from '../neonMCP.js'

export interface SessionMetadata {
  session_id: string
  owner_user_id: string
  visibility: 'public' | 'private'
  branch_name: string
  created_at: string
}

export async function getMetadata(sessionId: string): Promise<SessionMetadata | null> {
  const rows = await neonClient.runSQL<SessionMetadata>(
    `SELECT * FROM session_metadata WHERE session_id = ${sqlStr(sessionId)}`,
  )
  return rows[0] ?? null
}

export async function insertMetadata(
  sessionId: string,
  ownerUserId: string,
  branchName: string,
  visibility: 'public' | 'private' = 'private',
): Promise<void> {
  await neonClient.runSQL(
    `INSERT INTO session_metadata (session_id, owner_user_id, visibility, branch_name)
     VALUES (${sqlStr(sessionId)}, ${sqlStr(ownerUserId)}, ${sqlStr(visibility)}, ${sqlStr(branchName)})
     ON CONFLICT (session_id) DO NOTHING`,
  )
}

export async function updateVisibility(
  sessionId: string,
  visibility: 'public' | 'private',
): Promise<void> {
  await neonClient.runSQL(
    `UPDATE session_metadata SET visibility = ${sqlStr(visibility)} WHERE session_id = ${sqlStr(sessionId)}`,
  )
}

export async function deleteMetadata(sessionId: string): Promise<void> {
  await neonClient.runSQL(
    `DELETE FROM session_metadata WHERE session_id = ${sqlStr(sessionId)}`,
  )
}

export async function listVisibleSessions(userId: string): Promise<SessionMetadata[]> {
  return neonClient.runSQL<SessionMetadata>(
    `SELECT * FROM session_metadata
     WHERE owner_user_id = ${sqlStr(userId)} OR visibility = 'public'
     ORDER BY created_at DESC`,
  )
}
