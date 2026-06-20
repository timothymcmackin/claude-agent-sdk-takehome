import 'dotenv/config'
import * as fs from 'fs'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = join(__dirname, '.env')

const NEON_KEY = process.env.NEON_KEY
if (!NEON_KEY) {
  console.error('NEON_KEY not set in .env')
  process.exit(1)
}

const envContent = fs.readFileSync(envPath, 'utf8')
const alreadySet = /^NEON_PROJECT_ID=.+/m.test(envContent)
if (alreadySet) {
  console.log('NEON_PROJECT_ID already set, skipping setup')
  process.exit(0)
}

console.log('Fetching Neon projects...')
const resp = await fetch('https://console.neon.tech/api/v2/projects', {
  headers: {
    Authorization: `Bearer ${NEON_KEY}`,
    'Content-Type': 'application/json',
  },
})
if (!resp.ok) {
  console.error(`Neon API error: ${resp.status}`, await resp.text())
  process.exit(1)
}

const data = (await resp.json()) as { projects: Array<{ id: string; name: string }> }
const project = data.projects.find(p => p.name === 'claude-example')
if (!project) {
  console.error(
    'No Neon project named "claude-example" found. Available:',
    data.projects.map(p => p.name).join(', '),
  )
  process.exit(1)
}

console.log(`Found project: ${project.id}`)
fs.appendFileSync(envPath, `\nNEON_PROJECT_ID=${project.id}\nNEON_DATABASE_NAME=neondb\n`)
console.log('NEON_PROJECT_ID written to .env — ready for docker compose up')
