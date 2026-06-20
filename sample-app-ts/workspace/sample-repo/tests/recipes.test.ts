import { describe, it, expect, beforeEach } from 'vitest'
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

describe('GET /api/recipes', () => {
  it('returns all seeded recipes', async () => {
    const res = await request(makeApp()).get('/api/recipes')
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThanOrEqual(8)
  })
})

describe('POST /api/recipes', () => {
  it('creates a new recipe', async () => {
    const res = await request(makeApp())
      .post('/api/recipes')
      .send({ name: 'Test Recipe', ingredients: [{ name: 'flour', quantity: '1', unit: 'cup' }], tags: [] })
    expect(res.status).toBe(201)
    expect(res.body.name).toBe('Test Recipe')
    expect(res.body.id).toBeTruthy()
  })
})

describe('PUT /api/recipes/:id', () => {
  it('replaces an existing recipe', async () => {
    const [first] = getAll()
    const res = await request(makeApp())
      .put(`/api/recipes/${first.id}`)
      .send({ ...first, name: 'Renamed Recipe' })
    expect(res.status).toBe(200)
    expect(res.body.name).toBe('Renamed Recipe')
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(makeApp())
      .put('/api/recipes/nonexistent')
      .send({ name: 'x', ingredients: [] })
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/recipes/:id', () => {
  it('removes the recipe', async () => {
    const [first] = getAll()
    const res = await request(makeApp()).delete(`/api/recipes/${first.id}`)
    expect(res.status).toBe(204)
  })
})
