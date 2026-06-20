import { Router } from 'express'
import { allTags } from '../store.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json(allTags())
})

export default router
