import { Router } from 'express'
import { allIngredients } from '../store.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(allIngredients())
})

export default router
