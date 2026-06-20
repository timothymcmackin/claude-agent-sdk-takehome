# Plan: Enterprise Session Management Sample App

## Context

This sample app lives in `/Users/tim/repos/claude-agent-sdk-takehome/sample-app/` and demonstrates enterprise-level session management using the Claude Agent SDK with Neon Postgres as the session store. It's a reference implementation for the SDK docs, showing how a real multi-user, containerized deployment handles sessions durably across restarts and replicas.

The `.env` already has `ANTHROPIC_API_KEY` and `NEON_KEY` (Neon management API key — **not** a connection string). A one-time setup script will use `NEON_KEY` to provision the Neon project and write `NEON_DATABASE_URL` to `.env`.

---

## Architecture

**Stack:** TypeScript · Express · SSE streaming · Neon MCP Server · Docker  
**UI:** Vanilla HTML/JS (no build step) — single page, three panels  
**Session = conversation + git branch** — each session is tied to a git branch; resuming gives developers both the AI conversation history and the code state that went with it.  
**Git worktrees** — each session gets an isolated worktree (`/workspace/worktrees/<sessionId>/`) so multiple sessions can run concurrently without branch-checkout conflicts.

```
Browser ──POST /api/query──► Express ──► git worktree add <branch>
                                     ──► query({ cwd: worktreePath }) AsyncGenerator
        ──GET  /api/stream/:id (SSE)──► EventEmitter bus ◄── generator messages

Express ──MCP client──► @neondatabase/mcp-server-neon (stdio subprocess)
                              │── run_sql → session transcripts table
                              │── run_sql → session_metadata table (incl. branch_name)
```

**No `pg` / no `DATABASE_URL`** — all database access goes through the Neon MCP server using only `NEON_KEY` (management API key) and the project ID.

**Manual setup required**: Before using the Neon MCP server in Claude Code (for development), add to `~/.claude/settings.json`:
```json
{
  "mcpServers": {
    "neon": {
      "command": "npx",
      "args": ["-y", "@neondatabase/mcp-server-neon", "start"],
      "env": { "NEON_API_KEY": "" }
    }
  }
}

---

## Directory Structure

```
sample-app/
├── .env                         (exists: ANTHROPIC_API_KEY, NEON_KEY)
├── .gitignore                   (exists)
├── .env.example                 (add NEON_DATABASE_URL placeholder)
├── setup-neon.ts                (one-time: create Neon project → write NEON_DATABASE_URL)
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 # Express entry — mounts routes, calls initDb()
│   ├── neonMCP.ts               # NeonMCPClient — MCP client wrapping @neondatabase/mcp-server-neon
│   ├── NeonMCPSessionStore.ts   # SessionStore impl using run_sql MCP tool calls
│   ├── store.ts                 # UserScopedSessionStore wrapper (enterprise pattern #1)
│   ├── lib/
│   │   ├── streamSession.ts     # runQuery() + EventEmitter bus
│   │   └── gitWorktree.ts       # createWorktree / ensureWorktree / removeWorktree
│   ├── middleware/
│   │   └── accessControl.ts     # enforceVisibility() — 403 on private sessions
│   ├── routes/
│   │   ├── sessions.ts          # GET /sessions, GET /sessions/:id/messages, PATCH /visibility
│   │   ├── query.ts             # POST /query (start), GET /stream/:id (SSE)
│   │   └── sessionOps.ts        # DELETE, PATCH /rename, POST /fork, PATCH /tag
│   └── tests/
│       └── visibility.test.ts   # vitest + supertest; uses InMemorySessionStore
├── public/
│   ├── index.html               # App shell — user picker, session list, chat panel
│   ├── app.js                   # Vanilla JS: EventSource SSE, session CRUD
│   └── style.css
└── workspace/
    └── sample-repo/             # Recipe Manager API — the repo the agent works on
        ├── README.md
        ├── package.json         # "recipe-manager-api", express, ts-node, vitest
        ├── tsconfig.json
        ├── src/
        │   ├── index.ts         # Express entry, mounts routes, seeds in-memory store
        │   ├── store.ts         # In-memory store (no DB — self-contained)
        │   ├── types.ts         # Recipe, Ingredient, Tag interfaces
        │   └── routes/
        │       ├── recipes.ts   # GET/POST/PUT/DELETE /api/recipes
        │       ├── ingredients.ts # GET /api/ingredients
        │       └── tags.ts      # GET/POST /api/tags
        └── tests/
            └── recipes.test.ts  # vitest: basic CRUD coverage
```

---

## Step 1: Neon Setup Script (`setup-neon.ts`)

Runs once before first `docker compose up`. Uses `NEON_KEY` (Neon management API) to:
1. Call `GET https://console.neon.tech/api/v2/projects` to list projects
2. Find the project named `"claude-example"` (already exists)
3. Append `NEON_PROJECT_ID=<id>` and `NEON_DATABASE_NAME=neondb` to `.env`

```bash
npx tsx setup-neon.ts
```

**No connection string needed** — the MCP server authenticates with `NEON_KEY` and targets the project by ID. If `NEON_PROJECT_ID` is already in `.env`, the script exits early (idempotent).

---

## Step 2: Session Visibility — `session_metadata` Table

Sessions can be **public** (visible and resumable by any user) or **private** (visible and resumable only by the owner). *(Your message says "private sessions can be opened by any user" — assuming that's a typo and you meant **public**.)*

Visibility and creator are stored in a `session_metadata` table managed by the app (separate from the SDK's `claude_session_entries` table):

```sql
CREATE TABLE IF NOT EXISTS session_metadata (
  session_id    TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL,                    -- user who created the session
  visibility    TEXT NOT NULL DEFAULT 'private',  -- 'public' | 'private'
  branch_name   TEXT NOT NULL,                    -- git branch this session works on
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**When is this row written?** In `POST /api/query` when creating a new session. The client supplies `branch_name` (new or existing branch). The server runs `git worktree add /workspace/worktrees/<sessionId> <branch_name>` (creating the branch if it doesn't exist), then inserts:

```sql
INSERT INTO session_metadata (session_id, owner_user_id, visibility, branch_name)
VALUES ($1, $2, 'private', $3)
ON CONFLICT (session_id) DO NOTHING;
```

Forked sessions get their own row. The fork inherits the source branch name by default; the user can supply a new branch name to fork both the conversation and the branch:
```sql
INSERT INTO session_metadata (session_id, owner_user_id, visibility, branch_name)
VALUES (<fork_id>, <currentUserId>, 'private', <branch_name>);
```

**What `GET /api/sessions` returns** — every session object carries full provenance including the branch:

```json
{
  "sessionId": "abc-123",
  "summary": "Refactor utils.ts",
  "lastModified": 1750000000000,
  "ownerUserId": "sam",
  "visibility": "private",
  "branchName": "feature/refactor-utils",
  "isOwner": true
}
```

The `isOwner` field (computed server-side as `ownerUserId === requestingUserId`) tells the frontend which controls to render without additional round-trips.

**Query for listing sessions visible to a user (`userId = 'joan'`):**

```sql
SELECT sm.session_id, sm.owner_user_id, sm.visibility, sm.created_at
FROM session_metadata sm
WHERE sm.owner_user_id = $1            -- joan's own sessions (any visibility)
   OR sm.visibility = 'public'         -- everyone's public sessions
ORDER BY sm.created_at DESC;
```

Then enrich with `summary` and `lastModified` from `store.listSessions(ownerUserId)` for each session.

**Access rules enforced in middleware (`src/middleware/accessControl.ts`):**

| Operation | Owner | Other user (public session) | Other user (private session) |
|---|---|---|---|
| View in list | ✅ | ✅ | ❌ |
| Resume / send message | ✅ | ✅ | 403 |
| Fork | ✅ | ✅ | 403 |
| Rename / Tag | ✅ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ |
| Toggle visibility | ✅ | ❌ | ❌ |

**`projectKey` for cross-user resume:** We keep `projectKey = ownerUserId`. When Joan resumes Sam's *public* session, the `UserScopedSessionStore` is constructed with the *owner's* userId (`"sam"`) — not Joan's — so `load()` finds the correct rows. The access control middleware validates Joan is allowed before the store call happens.

---

## Step 3: Neon MCP Client (`src/neonMCP.ts`)

The Express app spawns the Neon MCP server as a stdio subprocess and connects to it as an MCP client. All SQL goes through `run_sql` tool calls — no `pg.Pool`, no connection string.

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

export class NeonMCPClient {
  private client: Client

  async connect() {
    const transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@neondatabase/mcp-server-neon', 'start'],
      env: { ...process.env, NEON_API_KEY: process.env.NEON_KEY },
    })
    this.client = new Client({ name: 'session-app', version: '1.0.0' }, { capabilities: {} })
    await this.client.connect(transport)
  }

  async runSQL<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
    const result = await this.client.callTool({
      name: 'run_sql',
      arguments: {
        project_id: process.env.NEON_PROJECT_ID,
        database_name: process.env.NEON_DATABASE_NAME ?? 'neondb',
        sql,
        params,
      },
    })
    return JSON.parse((result.content as Array<{ text: string }>)[0].text).rows as T[]
  }

  async close() { await this.client.close() }
}

export const neonClient = new NeonMCPClient()
```

`neonClient.connect()` is called once at app startup in `src/index.ts`.

---

## Step 4: NeonMCPSessionStore (`src/NeonMCPSessionStore.ts`)

Implements the SDK `SessionStore` interface using `run_sql` calls instead of `pg.Pool`. Same schema as the reference `PostgresSessionStore` — only the query execution layer changes.

```sql
-- ensureSchema() runs these via run_sql at startup
CREATE TABLE IF NOT EXISTS claude_session_entries (
  id          BIGSERIAL PRIMARY KEY,
  project_key TEXT NOT NULL,   -- ownerUserId for per-user isolation
  session_id  TEXT NOT NULL,
  subpath     TEXT,
  entry       JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS claude_session_entries_key_idx
  ON claude_session_entries (project_key, session_id, subpath, id);
```

Key method shape (replaces `pool.query` with `neonClient.runSQL`):

```typescript
async append(key: SessionKey, entries: SessionStoreEntry[]): Promise<void> {
  // Build parameterized INSERT via run_sql
  for (const entry of entries) {
    await neonClient.runSQL(
      `INSERT INTO claude_session_entries (project_key, session_id, subpath, entry)
       VALUES ($1, $2, $3, $4::jsonb)`,
      [key.projectKey, key.sessionId, key.subpath ?? null, JSON.stringify(entry)]
    )
  }
}
```

All five methods (`append`, `load`, `listSessions`, `delete`, `listSubkeys`) follow the same pattern.

---

## Step 5: Git Worktree Manager (`src/lib/gitWorktree.ts`)

Each session gets an isolated git worktree so concurrent sessions on different branches don't conflict.

```typescript
const REPO_DIR = '/workspace/sample-repo'
const WORKTREE_BASE = '/workspace/worktrees'

export function worktreePath(sessionId: string) {
  return `${WORKTREE_BASE}/${sessionId}`
}

// Called when a new session is created
export async function createWorktree(sessionId: string, branchName: string): Promise<void> {
  const path = worktreePath(sessionId)
  // Create the branch if it doesn't exist, then add the worktree
  await exec(`git -C ${REPO_DIR} worktree add -B ${branchName} ${path} HEAD`)
}

// Called when resuming an existing session (worktree may already exist)
export async function ensureWorktree(sessionId: string, branchName: string): Promise<void> {
  const path = worktreePath(sessionId)
  if (!existsSync(path)) {
    await exec(`git -C ${REPO_DIR} worktree add ${path} ${branchName}`)
  }
}

// Optional cleanup — can be deferred; worktrees survive container restarts
export async function removeWorktree(sessionId: string): Promise<void> {
  await exec(`git -C ${REPO_DIR} worktree remove --force ${worktreePath(sessionId)}`)
}
```

**`cwd` in `query()`** is set to `worktreePath(sessionId)` — the agent operates in the session's isolated branch checkout. Any commits the agent makes go to that branch automatically.

---

## Step 6: UserScopedSessionStore (`src/store.ts`)

**Enterprise Pattern #1: Per-user session isolation via projectKey = userId**

Wraps `PostgresSessionStore` and rewrites `projectKey` on every call to `userId`. Needed because all users share the same `cwd` (`/workspace/sample-repo`), so the SDK would derive the same `projectKey` for everyone.

```typescript
class UserScopedSessionStore implements SessionStore {
  constructor(private inner: PostgresSessionStore, private userId: string) {}
  append(key, entries) { return this.inner.append({ ...key, projectKey: this.userId }, entries) }
  load(key)           { return this.inner.load({ ...key, projectKey: this.userId }) }
  listSessions()      { return this.inner.listSessions(this.userId) }
  delete(key)         { return this.inner.delete({ ...key, projectKey: this.userId }) }
  listSubkeys(key)    { return this.inner.listSubkeys({ ...key, projectKey: this.userId }) }
}
```

The `ownerUserId` passed to `UserScopedSessionStore` is always the **session owner's** userId, not the currently-logged-in user. Fetch owner from `session_metadata` when resuming someone else's public session.

Create one per request in each route handler.

---

## Step 7: runQuery() + SSE Bus (`src/lib/streamSession.ts`)

**Enterprise Patterns #2, #3, #4 live here.**

```typescript
export async function runQuery(userId, prompt, resumeSessionId?) {
  const store = new UserScopedSessionStore(baseStore, userId)
  const bus = getOrCreateBus(sessionId)   // EventEmitter per sessionId

  const gen = query({
    prompt,
    options: {
      sessionStore: store,
      sessionStoreFlush: 'eager',           // Pattern #3: near-real-time durability
      resume: resumeSessionId,
      cwd: worktreePath(sessionId),  // agent works in session's isolated branch checkout
      env: { ...process.env, CLAUDE_CONFIG_DIR: '/tmp' }, // Pattern #2: ephemeral local
      permissionMode: 'acceptEdits',
      allowedTools: ['Read', 'Edit', 'Bash', 'Glob', 'Grep'],
    },
  })

  for await (const msg of gen) {
    if (msg.type === 'system' && msg.subtype === 'mirror_error') {
      // Pattern #4: mirror errors must be logged; they indicate store data loss
      console.error('[mirror_error]', { sessionId, key: msg.key, error: msg.error })
    }
    bus.emit('message', msg)
  }
  bus.emit('done')
}
```

The `GET /api/stream/:sessionId` SSE handler subscribes to the bus and writes `text/event-stream` frames. Includes a 30-second replay buffer so clients that connect after the query completes still get the final result.

---

## Step 8: API Routes

### `src/routes/sessions.ts`
| Route | Action |
|---|---|
| `GET /api/sessions?userId=X` | Own sessions + public sessions from others (JOIN `session_metadata`); includes `branchName` |
| `GET /api/sessions/:id/messages?userId=X` | `getSessionMessages` — 403 if private and not owner |
| `PATCH /api/sessions/:id/visibility` | `{ visibility: 'public'\|'private' }` — 403 if not owner |
| `GET /api/branches` | List git branches in the repo (`git branch -a`) for the new-session dialog |

### `src/routes/query.ts`
| Route | Action |
|---|---|
| `POST /api/query` | Body includes `branchName` (new session) or `sessionId` (resume). Creates/ensures worktree, starts `runQuery()`, returns `{ sessionId }` immediately |
| `GET /api/stream/:sessionId` | SSE — stream bus events as `data: {...}` frames |

### `src/routes/sessionOps.ts`
| Route | Access | Action |
|---|---|---|
| `DELETE /api/sessions/:id` | Owner only | `deleteSession` + remove from `session_metadata` + `git worktree remove` |
| `PATCH /api/sessions/:id/rename` | Owner only | `renameSession` |
| `POST /api/sessions/:id/fork` | Owner or public | `forkSession`; body may include `newBranchName` (defaults to `<source-branch>-fork`). Creates new branch from source, inserts fork into `session_metadata` with own `branch_name` |
| `PATCH /api/sessions/:id/tag` | Owner only | `tagSession` |

---

## Step 9: Frontend (`public/`)

Three-panel layout:
- **Left-top**: User picker (Sam / Henry / Joan) — switching calls `GET /api/sessions`
- **Left-bottom**: Session list — each card shows title, branch badge (e.g. `⎇ feature/refactor-utils`), relative time, owner attribution (for others' public sessions); per-row actions:
  - **Owner's own sessions**: 🔒/🌐 visibility toggle, Resume, Fork, Rename, Delete
  - **Other user's public session**: 🌐 badge, Resume, Fork (fork becomes current user's private session on a new branch)
  - Private sessions from other users: **not shown**
- **Right**: Chat panel — messages + live SSE stream + prompt input; branch name shown in the panel header

**New session dialog**: Branch name field — text input with autocomplete from `GET /api/branches`. User can type a new branch name (created from `HEAD`) or select an existing one.

**Fork dialog**: Branch name field — defaults to `<source-branch>-fork`, editable.

**Visibility toggle UI**: `🔒 Private` / `🌐 Public` button per card (owner only) — calls `PATCH /api/sessions/:id/visibility`.

JS uses `fetch` + `EventSource`. No framework, no build step.

---

## Sample Repository: Recipe Manager

The agent manages a small, self-contained Recipe Manager REST API at `workspace/sample-repo/`. No external database — recipes live in an in-memory store seeded at startup — so the demo container is fully self-contained.

### Entities

```typescript
interface Ingredient { name: string; quantity: string; unit: string }
interface Recipe {
  id: string; name: string; description: string
  ingredients: Ingredient[]
  tags: string[]      // e.g. 'vegan', 'gluten-free', 'quick'
  servings: number; prepTime: number; cookTime: number  // minutes
}
```

### Endpoints on `main`

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/recipes` | List all recipes |
| `GET` | `/api/recipes/:id` | Get one recipe |
| `POST` | `/api/recipes` | Create a recipe |
| `PUT` | `/api/recipes/:id` | Replace a recipe |
| `DELETE` | `/api/recipes/:id` | Delete a recipe |
| `GET` | `/api/ingredients` | List all distinct ingredients |
| `GET` | `/api/tags` | List all distinct tags |

`main` ships with 8 seed recipes. No pagination, no search, no filtering — those are what the demo sessions tackle.

### Branch Tree and Pre-Seeded Sessions

Each branch has **partial work already committed** — enough to show what the developer was building, with obvious TODOs left for the agent. Resuming a session is meaningful: developers see real in-progress code, not a blank slate.

```
main  ── complete CRUD + 8 seed recipes
│
├── feature/add-pagination            owner: Sam   visibility: public
│     Adds ?page=&limit= to GET /api/recipes.
│     Committed: param parsing + array slice; X-Total-Count header missing.
│     TODO: "// TODO: add X-Total-Count header; handle page > totalPages"
│
├── feature/ingredient-search         owner: Henry  visibility: public
│     Adds ?ingredient= filtering to GET /api/recipes.
│     Committed: exact-match string filter only.
│     TODO: "// TODO: case-insensitive partial match"
│
├── feature/dietary-filters           owner: Joan   visibility: private
│     Adds ?tag= filtering + POST /api/tags.
│     Committed: tag field on Recipe type, seed data has tags, filter not wired up yet.
│     TODO: "// TODO: apply tag filter in GET /api/recipes handler"
│
├── feature/shopping-list             owner: Sam    visibility: public
│     Adds GET /api/recipes/:id/shopping-list to aggregate scaled ingredients.
│     Committed: route stub returning [].
│     TODO: "// TODO: scale ingredient quantities by servings multiplier"
│
│   └── feature/shopping-list-units   owner: Henry  visibility: public
│         Forked from Sam's branch to layer in unit conversion.
│         Committed: src/units.ts with unitConvert() stub.
│         TODO: "// TODO: call unitConvert() when scaling"
│
└── bugfix/fix-duplicate-ingredients  owner: Henry  visibility: private
      Fixes PUT /api/recipes silently dropping duplicate ingredients.
      Committed: a failing vitest test that reproduces the bug; no fix yet.
```

This branch topology demonstrates:
- Concurrent sessions on different branches (worktrees)
- A forked session (`shopping-list-units` ← `shopping-list`)
- Public sessions (Sam/Henry's) that Joan and Henry can resume or fork
- Private sessions (Joan/Henry's bugfix) not visible to others

### Docker Initialization: `workspace/init-repo.sh`

Runs at Docker build time (via a `RUN` step in the `Dockerfile`). Sets up the repo and creates all branches with partial commits:

```bash
#!/bin/sh
set -e
REPO=/workspace/sample-repo
[ -d "$REPO/.git" ] && exit 0   # idempotent — skip if already initialized

git init "$REPO"
git -C "$REPO" config user.email "demo@example.com"
git -C "$REPO" config user.name "Demo"

# Copy main-branch source files (embedded in the Docker image under workspace/src/)
cp -r /workspace/src/. "$REPO/"
git -C "$REPO" add -A
git -C "$REPO" commit -m "Initial Recipe Manager API"

# feature/add-pagination — Sam's partial work
git -C "$REPO" checkout -b feature/add-pagination
# patch recipes.ts: add page/limit params + TODO comment, overwrite file
cp /workspace/patches/add-pagination/routes-recipes.ts "$REPO/src/routes/recipes.ts"
git -C "$REPO" commit -am "feat: add pagination params to recipe list (incomplete)"

# feature/ingredient-search — Henry's partial work
git -C "$REPO" checkout main
git -C "$REPO" checkout -b feature/ingredient-search
cp /workspace/patches/ingredient-search/routes-recipes.ts "$REPO/src/routes/recipes.ts"
git -C "$REPO" commit -am "feat: filter by ingredient exact match (partial)"

# ... repeat for dietary-filters, shopping-list, shopping-list-units, bugfix branches

git -C "$REPO" checkout main
```

Patch files live under `workspace/patches/<branch-name>/` in the sample-app image — each one is the full modified file for that branch state. This avoids sed/heredoc fragility while keeping the diff reviewable.

---

## Step 10: Docker

**`Dockerfile`**:
- Base: `node:20-alpine` + `git`
- `ENV CLAUDE_CONFIG_DIR=/tmp` — **Enterprise Pattern #2**: container-ephemeral local writes
- Copies `workspace/src/` (main branch Recipe Manager source) and `workspace/patches/` into image
- `RUN sh /workspace/init-repo.sh` — creates the sample repo with all branches at build time

**`docker-compose.yml`**:
- Single `app` service; no local Postgres (Neon is external)
- `env_file: .env` (reads `ANTHROPIC_API_KEY`, `NEON_KEY`, `NEON_PROJECT_ID`)

---

## Enterprise Patterns Summary

| # | Pattern | File |
|---|---|---|
| 1 | `projectKey = ownerUserId` for session data isolation | `src/store.ts` |
| 2 | `CLAUDE_CONFIG_DIR=/tmp` — ephemeral local writes | `Dockerfile` + `runQuery()` |
| 3 | `sessionStoreFlush: 'eager'` — near-real-time durability | `src/lib/streamSession.ts` |
| 4 | `mirror_error` handling — detect store data loss | `src/lib/streamSession.ts` |
| 5 | Full session lifecycle (create/list/resume/fork/rename/tag/delete) | `src/routes/sessionOps.ts` |
| 6 | Multi-host note: swap EventEmitter for Redis pub/sub | Comment in `streamSession.ts` |
| 7 | Public/private visibility + access control middleware | `src/middleware/accessControl.ts` |
| 8 | MCP-based DB access via `NeonMCPClient` — no connection string required | `src/neonMCP.ts` |
| 9 | Session-to-branch binding + git worktrees for concurrent isolation | `src/lib/gitWorktree.ts` |

---

## Step 11: Tests (`src/tests/`)

**Framework**: `vitest` + `supertest` (in-process Express, no real Neon needed — use `InMemorySessionStore` from the SDK and an in-memory mock of `session_metadata`).

### Test file: `src/tests/visibility.test.ts`

**Setup**: Before each test, seed `session_metadata` (in-memory map) with:
- Sam owns session `A` (private) and session `B` (public)
- Joan owns session `C` (private)

**Tests:**

```
describe('Session listing — visibility')
  ✓ Sam sees session A (own private), B (own public) but not C (joan's private)
  ✓ Joan sees session C (own private) and B (sam's public) but not A (sam's private)
  ✓ Henry sees B (sam's public) but not A or C (both private, neither owned by henry)

describe('Session resume — access control')
  ✓ Sam can resume session A (own private)
  ✓ Joan can resume session B (sam's public)
  ✓ Joan cannot resume session A (sam's private) → 403
  ✓ Henry cannot resume session C (joan's private) → 403

describe('Session operations — ownership')
  ✓ Sam can toggle session A from private → public
  ✓ Joan cannot toggle session A (not owner) → 403
  ✓ Sam can delete session A
  ✓ Joan cannot delete session A → 403
  ✓ Joan can fork session B (sam's public); fork is joan's private session

describe('Visibility toggle')
  ✓ After sam toggles A to public, joan can see it in her list
  ✓ After sam toggles B back to private, joan can no longer see it
```

These tests do **not** require a live Neon connection. They mock the `session_metadata` layer and use `InMemorySessionStore` from `@anthropic-ai/claude-agent-sdk` for the SDK side.

---

## Packages

```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "latest",
    "express": "^4.19.0",
    "@modelcontextprotocol/sdk": "latest",
    "dotenv": "^16.0.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0",
    "tsx": "^4.0.0",
    "vitest": "^2.0.0",
    "supertest": "^7.0.0",
    "@types/supertest": "^6.0.0"
  }
}
```

**Removed**: `pg`, `@types/pg` — no direct Postgres connection needed.  
**Added**: `@modelcontextprotocol/sdk` — MCP client to connect to `@neondatabase/mcp-server-neon`.  
The MCP server itself (`@neondatabase/mcp-server-neon`) is invoked via `npx` at runtime; no explicit install needed.

---

## Verification

**Automated tests:**
```bash
npm test   # runs vitest — all visibility tests pass without live Neon
```

**Manual / integration (Recipe Manager demo flow):**
1. Run `npx tsx setup-neon.ts` — verify `NEON_PROJECT_ID` written to `.env`
2. `docker compose build && docker compose up` — init script creates `main` + all feature branches in sample-repo
3. Open `http://localhost:3000`

**Demo path A — Resume a pre-seeded branch (Sam):**
4. Select "Sam" → session list is empty (pre-seeded branches exist but no sessions yet)
5. Click **New Session** → pick existing branch `feature/add-pagination` from autocomplete
6. Ask agent: *"Complete the pagination — add X-Total-Count header and handle out-of-range pages"*
7. Agent reads `src/routes/recipes.ts`, sees the TODO, implements and commits the fix
8. Session card shows `⎇ feature/add-pagination` — conversation + branch state are now linked

**Demo path B — Visibility and cross-user access (Henry/Joan):**
9. Switch to "Henry" → Sam's session is visible (public) with branch badge; Joan's `dietary-filters` session is not (private)
10. Henry clicks **Resume** on Sam's pagination session → agent continues from Sam's conversation history in Sam's branch worktree
11. Henry clicks **Fork** on Sam's `shopping-list` session → dialog defaults branch to `feature/shopping-list-units` → creates Henry's own session on the fork branch
12. Switch to "Joan" → only sees her own private sessions and Sam/Henry's public ones; Sam's private session (`dietary-filters` if toggled private) is absent

**Demo path C — Visibility toggle:**
13. As Sam, toggle `feature/shopping-list` session to 🔒 Private → disappears from Henry's list
14. Toggle back to 🌐 Public → reappears

**Demo path D — Resilience:**
15. Kill container → `docker compose up` again → sessions reload from Neon; worktrees are re-checked-out on first resume (no data loss)

