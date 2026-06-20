import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

export class NeonMCPClient {
  private client!: Client

  async connect(): Promise<void> {
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['node_modules/@neondatabase/mcp-server-neon/dist/index.js', 'start', process.env.NEON_KEY!],
      env: process.env as NodeJS.ProcessEnv,
    })
    this.client = new Client({ name: 'session-app', version: '1.0.0' }, { capabilities: {} })
    await this.client.connect(transport)
  }

  async runSQL<T = Record<string, unknown>>(sql: string): Promise<T[]> {
    const result = await this.client.callTool({
      name: 'run_sql',
      arguments: {
        params: {
          projectId: process.env.NEON_PROJECT_ID!,
          databaseName: process.env.NEON_DATABASE_NAME ?? 'neondb',
          sql,
        },
      },
    })
    const text = (result.content as Array<{ type: string; text: string }>)[0].text
    const parsed = JSON.parse(text) as { rows?: T[] } | T[]
    return (Array.isArray(parsed) ? parsed : (parsed.rows ?? [])) as T[]
  }

  async close(): Promise<void> {
    await this.client.close()
  }
}

export const neonClient = new NeonMCPClient()

// Escape a value for safe inline use in SQL — wraps in single quotes, doubles internal quotes.
// Used because the Neon MCP server does not support parameterized queries.
export function sqlStr(val: string | null): string {
  if (val === null) return 'NULL'
  return `'${val.replace(/'/g, "''")}'`
}
