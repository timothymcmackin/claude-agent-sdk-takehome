import { exec as execCb } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'

const exec = promisify(execCb)

const REPO_DIR = process.env.REPO_DIR ?? '/workspace/sample-repo'
const WORKTREE_BASE = process.env.WORKTREE_BASE ?? '/workspace/worktrees'

export function worktreePath(sessionId: string): string {
  return `${WORKTREE_BASE}/${sessionId}`
}

export async function listBranches(): Promise<string[]> {
  const { stdout } = await exec(
    `git -C "${REPO_DIR}" branch --format='%(refname:short)'`,
  )
  return stdout.trim().split('\n').filter(Boolean)
}

// Called when a new session is created. -B resets the branch to HEAD if it already exists.
export async function createWorktree(sessionId: string, branchName: string): Promise<void> {
  const path = worktreePath(sessionId)
  await exec(`git -C "${REPO_DIR}" worktree add -B "${branchName}" "${path}" HEAD`)
}

// Called when resuming a session whose worktree may have been cleaned up (e.g. after restart).
export async function ensureWorktree(sessionId: string, branchName: string): Promise<void> {
  const path = worktreePath(sessionId)
  if (!existsSync(path)) {
    await exec(`git -C "${REPO_DIR}" worktree add "${path}" "${branchName}"`)
  }
}

export async function removeWorktree(sessionId: string): Promise<void> {
  const path = worktreePath(sessionId)
  if (existsSync(path)) {
    await exec(`git -C "${REPO_DIR}" worktree remove --force "${path}"`)
  }
}
