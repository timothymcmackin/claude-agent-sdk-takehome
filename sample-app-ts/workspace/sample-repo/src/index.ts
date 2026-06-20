import express from 'express'
import recipesRouter from './routes/recipes.js'
import ingredientsRouter from './routes/ingredients.js'
import tagsRouter from './routes/tags.js'

const PORT = Number(process.env.PORT ?? 4000)
const app = express()
app.use(express.json())

app.use('/api/recipes', recipesRouter)
app.use('/api/ingredients', ingredientsRouter)
app.use('/api/tags', tagsRouter)

app.listen(PORT, () => console.log(`Recipe Manager API on http://localhost:${PORT}`))
