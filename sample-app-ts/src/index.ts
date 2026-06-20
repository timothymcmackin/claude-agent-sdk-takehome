import 'dotenv/config'
import express from 'express'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { neonClient } from './neonMCP.js'
import { baseStore } from './NeonMCPSessionStore.js'
import { listBranches } from './lib/gitWorktree.js'
import sessionsRouter from './routes/sessions.js'
import queryRouter from './routes/query.js'
import sessionOpsRouter from './routes/sessionOps.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 3000)

const app = express()
app.use(express.json())
app.use(express.static(join(__dirname, '../public')))

// List git branches in the managed repo — used by new-session dialog autocomplete
app.get('/api/branches', async (_req, res) => {
  const branches = await listBranches()
  res.json(branches)
})

app.use('/api/sessions', sessionsRouter)
app.use('/api', queryRouter)
app.use('/api/sessions', sessionOpsRouter)

async function start() {
  await neonClient.connect()
  await baseStore.ensureSchema()
  app.listen(PORT, () => console.log(`Listening on http://localhost:${PORT}`))
}

start().catch(err => {
  console.error('Startup failed:', err)
  process.exit(1)
})
