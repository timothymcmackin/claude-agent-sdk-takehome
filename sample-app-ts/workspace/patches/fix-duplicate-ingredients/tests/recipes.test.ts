import { describe, it, expect } from 'vitest'
import request from 'supertest'
import express from 'express'
import recipesRouter from '../src/routes/recipes.js'
import { getAll } from '../src/store.js'

function makeApp() {
  const app = express()
  app.use(express.json())
  app.use('/api/recipes', recipesRouter)
  return app
}

describe('PUT /api/recipes — duplicate ingredient bug', () => {
  it('preserves duplicate ingredients with different quantities', async () => {
    const [first] = getAll()

    // A recipe that legitimately has the same ingredient twice (e.g. chocolate in two steps)
    const payload = {
      ...first,
      ingredients: [
        { name: 'chocolate', quantity: '100', unit: 'g' },
        { name: 'chocolate', quantity: '50', unit: 'g' },
        { name: 'butter', quantity: '2', unit: 'tbsp' },
      ],
    }

    const res = await request(makeApp())
      .put(`/api/recipes/${first.id}`)
      .send(payload)

    expect(res.status).toBe(200)
    // BUG: currently returns 2 ingredients instead of 3 (duplicates are silently dropped)
    expect(res.body.ingredients).toHaveLength(3)
    expect(res.body.ingredients.filter((i: { name: string }) => i.name === 'chocolate')).toHaveLength(2)
  })
})

// Existing tests to ensure no regressions
describe('GET /api/recipes', () => {
  it('returns all seeded recipes', async () => {
    const res = await request(makeApp()).get('/api/recipes')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThanOrEqual(8)
  })
})
