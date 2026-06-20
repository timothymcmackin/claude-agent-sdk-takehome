# Session Management Sample App

A reference implementation showing enterprise-level session management with the [Claude Agent SDK](https://code.claude.com/docs/en/agent-sdk). Demonstrates durable, multi-user sessions stored in Neon Postgres via the Neon MCP server — no direct database connection required.

## What it does

The app manages a **Recipe Manager REST API** as the target codebase. Three simulated users (Sam, Henry, Joan) can each:

- Start a new coding session tied to a git branch of the Recipe Manager repo
- Resume any of their previous sessions from any point
- Fork another user's public session (inheriting both the conversation history and the git branch)
- Mark sessions public or private

Each session the Claude Agent works on is scoped to an isolated git worktree, so concurrent sessions on different branches don't interfere with each other.

### Enterprise patterns demonstrated

| # | Pattern | Where |
|---|---|---|
| 1 | `projectKey = ownerUserId` — per-user session isolation | `src/store.ts` |
| 2 | `CLAUDE_CONFIG_DIR=/tmp` — ephemeral local writes | `Dockerfile` |
| 3 | `sessionStoreFlush: 'eager'` — near-real-time durability | `src/lib/streamSession.ts` |
| 4 | `mirror_error` handling — detect store data loss | `src/lib/streamSession.ts` |
| 5 | Full lifecycle: create / list / resume / fork / rename / tag / delete | `src/routes/sessionOps.ts` |
| 6 | Public/private visibility + access control middleware | `src/middleware/accessControl.ts` |
| 7 | MCP-based DB access — no connection string needed | `src/neonMCP.ts` |
| 8 | Session-to-branch binding + git worktrees for concurrent isolation | `src/lib/gitWorktree.ts` |

## Directory structure

```
sample-app/
├── setup-neon.ts             # One-time: discover Neon project ID → write to .env
├── src/
│   ├── index.ts              # Express entry point
│   ├── neonMCP.ts            # MCP client wrapping @neondatabase/mcp-server-neon
│   ├── NeonMCPSessionStore.ts # SDK SessionStore backed by Neon via MCP
│   ├── store.ts              # UserScopedSessionStore (projectKey = userId)
│   ├── db/metadata.ts        # session_metadata table helpers
│   ├── lib/
│   │   ├── streamSession.ts  # runQuery() + SSE EventEmitter bus
│   │   └── gitWorktree.ts    # create/ensure/remove git worktrees
│   ├── middleware/
│   │   └── accessControl.ts  # 403 enforcement for private sessions
│   └── routes/
│       ├── sessions.ts       # GET /api/sessions, visibility, branches
│       ├── query.ts          # POST /api/query, GET /api/stream/:id (SSE)
│       └── sessionOps.ts     # delete, rename, fork, tag
├── public/                   # Vanilla HTML/JS/CSS frontend (no build step)
├── workspace/
│   ├── sample-repo/          # Recipe Manager API — the repo the agent works on
│   ├── patches/              # Partial commits for each demo branch
│   └── init-repo.sh          # Docker build-time: creates all demo branches
├── Dockerfile
└── docker-compose.yml
```

## Prerequisites

- Docker and Docker Compose
- A [Neon](https://neon.tech) account with a project named `claude-example`
- An Anthropic API key

## Setup

**1. Configure `.env`**

```
ANTHROPIC_API_KEY=sk-ant-...
NEON_KEY=napi_...          # Neon management API key (from Neon console → Account → API Keys)
```

**2. Discover the Neon project ID** (one-time, idempotent)

```bash
npm install
npx tsx setup-neon.ts
```

This finds the project named `claude-example` and appends `NEON_PROJECT_ID` and `NEON_DATABASE_NAME` to `.env`.

**3. Build and start**

```bash
docker compose build
docker compose up
```

Open **http://localhost:3000**.

## Using the app

### User picker (top-left)
Click **Sam**, **Henry**, or **Joan** to switch users. This simulates authentication — the session list updates to show only that user's sessions plus any public sessions from others.

### Starting a session
1. Click **+ New** in the sidebar
2. Pick a git branch (or type a new branch name)
3. Type a prompt — e.g. *"Complete the pagination — add X-Total-Count header and handle out-of-range pages"*
4. The agent reads the Recipe Manager code, implements the feature, and commits it to the branch

### Pre-seeded demo branches

The Docker image ships with a Recipe Manager repo containing partial work on each branch, ready for the agent to complete:

| Branch | Owner | Visibility | What's left to do |
|---|---|---|---|
| `feature/add-pagination` | Sam | public | X-Total-Count header; handle page > totalPages |
| `feature/ingredient-search` | Henry | public | Case-insensitive partial match |
| `feature/dietary-filters` | Joan | private | Wire up tag filter in GET /api/recipes |
| `feature/shopping-list` | Sam | public | Scale ingredient quantities by servings |
| `feature/shopping-list-units` | Henry | public | Call unitConvert() when scaling (fork of shopping-list) |
| `bugfix/fix-duplicate-ingredients` | Henry | private | Fix PUT silently dropping duplicate ingredients |

### Session operations

- **Resume** — loads the conversation history and re-checks out the git branch so the agent picks up exactly where it left off
- **Fork** — creates your own copy of any public session, on a new branch
- **🔒 / 🌐 toggle** — (owners only) make a session private or public; private sessions disappear from other users' lists immediately
- **Rename**, **Delete** — owner only

### Running tests

```bash
npm test
```

Vitest runs visibility and access control tests without a live Neon connection (uses an in-memory mock).

---

## Recipe Manager API

The Recipe Manager is a small Express REST API that lives in `workspace/sample-repo/`. It is the **target codebase** the agent works on — each session's coding task involves adding features or fixing bugs in this API.

### Data model

```
Recipe {
  id          string
  name        string
  description string
  ingredients Ingredient[]   // { name, quantity, unit }
  tags        string[]
  servings    number
  prepTime    number         // minutes
  cookTime    number         // minutes
}
```

Data is stored in-memory (no database); it resets on process restart.

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/recipes` | Return all recipes |
| `GET` | `/api/recipes/:id` | Return a single recipe by ID; 404 if not found |
| `POST` | `/api/recipes` | Create a recipe. Body requires `name` and `ingredients`; all other fields are optional |
| `PUT` | `/api/recipes/:id` | Replace a recipe. Body requires `name` and `ingredients`; 404 if not found |
| `DELETE` | `/api/recipes/:id` | Delete a recipe; 404 if not found, 204 on success |
| `GET` | `/api/ingredients` | Return the de-duplicated list of all ingredient names across all recipes |
| `GET` | `/api/tags` | Return the de-duplicated list of all tags across all recipes |

### Running the API standalone

The API runs independently of the sample app. From `workspace/sample-repo/`:

```bash
npm install
npm start          # starts on http://localhost:4000
```

To use a different port:

```bash
PORT=5000 npm start
```

The demo branches in the Docker image each carry partial implementations of new features. To run a specific branch's code locally, check it out first:

```bash
git -C workspace/sample-repo checkout feature/add-pagination
cd workspace/sample-repo && npm start
```
