import { Router } from 'express'
import * as store from '../store.js'

const router = Router()

// GET /api/recipes?page=1&limit=10
router.get('/', (req, res) => {
  const page = parseInt(req.query.page as string) || 1
  const limit = parseInt(req.query.limit as string) || 10
  const offset = (page - 1) * limit

  const all = store.getAll()
  const results = all.slice(offset, offset + limit)

  // TODO: add X-Total-Count header; handle page > totalPages gracefully
  res.json(results)
})

// GET /api/recipes/:id
router.get('/:id', (req, res) => {
  const recipe = store.getById(req.params.id)
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' })
  res.json(recipe)
})

// POST /api/recipes
router.post('/', (req, res) => {
  const { name, description, ingredients, tags, servings, prepTime, cookTime } = req.body
  if (!name || !ingredients) return res.status(400).json({ error: 'name and ingredients are required' })
  const recipe = store.create({
    name,
    description: description ?? '',
    ingredients: ingredients ?? [],
    tags: tags ?? [],
    servings: servings ?? 4,
    prepTime: prepTime ?? 0,
    cookTime: cookTime ?? 0,
  })
  res.status(201).json(recipe)
})

// PUT /api/recipes/:id
router.put('/:id', (req, res) => {
  const { name, description, ingredients, tags, servings, prepTime, cookTime } = req.body
  if (!name || !ingredients) return res.status(400).json({ error: 'name and ingredients are required' })
  const recipe = store.replace(req.params.id, {
    name,
    description: description ?? '',
    ingredients: ingredients ?? [],
    tags: tags ?? [],
    servings: servings ?? 4,
    prepTime: prepTime ?? 0,
    cookTime: cookTime ?? 0,
  })
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' })
  res.json(recipe)
})

// DELETE /api/recipes/:id
router.delete('/:id', (req, res) => {
  const ok = store.remove(req.params.id)
  if (!ok) return res.status(404).json({ error: 'Recipe not found' })
  res.status(204).end()
})

export default router
