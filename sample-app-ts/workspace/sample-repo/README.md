# Recipe Manager API

A simple REST API for managing recipes, built with Express and TypeScript.
Data is stored in-memory (seeded with 8 recipes on startup).

## Endpoints

| Method | Path | Description |
|---|---|---|
| GET | /api/recipes | List all recipes |
| GET | /api/recipes/:id | Get one recipe |
| POST | /api/recipes | Create a recipe |
| PUT | /api/recipes/:id | Replace a recipe |
| DELETE | /api/recipes/:id | Delete a recipe |
| GET | /api/ingredients | List all distinct ingredient names |
| GET | /api/tags | List all distinct tags |

## Run

```bash
npm install
npm start   # starts on port 4000
npm test
```

## Current open tasks (for the Claude Code agent)

- [ ] Add pagination (`?page=&limit=`) to `GET /api/recipes`
- [ ] Add ingredient search (`?ingredient=`) to `GET /api/recipes`
- [ ] Add tag filtering (`?tag=`) to `GET /api/recipes`
- [ ] Add `GET /api/recipes/:id/shopping-list` endpoint
- [ ] Fix: `PUT /api/recipes` drops duplicate ingredients silently
