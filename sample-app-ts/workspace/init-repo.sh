#!/bin/sh
# Runs once at Docker build time to initialize the Recipe Manager git repo with all demo branches.
# Idempotent: exits immediately if the repo is already initialized.
set -e

INIT_DIR=/workspace-init
REPO=/workspace/sample-repo

if [ -d "$REPO/.git" ]; then
  echo "Repo already initialized."
  exit 0
fi

mkdir -p "$REPO" /workspace/worktrees
cp -r "$INIT_DIR/sample-repo/." "$REPO/"

cd "$REPO"
git init -b main
git config user.email "demo@example.com"
git config user.name "Demo"
git add -A
git commit -m "Initial Recipe Manager API"

# feature/add-pagination — Sam's public session
git checkout -b feature/add-pagination
cp "$INIT_DIR/patches/add-pagination/src/routes/recipes.ts" src/routes/recipes.ts
git commit -am "feat: add pagination params (page, limit) to recipe list"

# feature/ingredient-search — Henry's public session
git checkout main
git checkout -b feature/ingredient-search
cp "$INIT_DIR/patches/ingredient-search/src/routes/recipes.ts" src/routes/recipes.ts
git commit -am "feat: filter recipes by ingredient (exact match only)"

# feature/dietary-filters — Joan's private session
git checkout main
git checkout -b feature/dietary-filters
cp "$INIT_DIR/patches/dietary-filters/src/routes/recipes.ts" src/routes/recipes.ts
git commit -am "feat: add tag filter stub to GET /api/recipes"

# feature/shopping-list — Sam's second public session
git checkout main
git checkout -b feature/shopping-list
cp "$INIT_DIR/patches/shopping-list/src/routes/recipes.ts" src/routes/recipes.ts
git commit -am "feat: add shopping-list endpoint stub"

# feature/shopping-list-units — Henry's fork of shopping-list (public)
git checkout feature/shopping-list
git checkout -b feature/shopping-list-units
cp "$INIT_DIR/patches/shopping-list-units/src/units.ts" src/units.ts
git add src/units.ts
git commit -m "feat: add unit conversion stub for shopping list"

# bugfix/fix-duplicate-ingredients — Henry's private bugfix session
git checkout main
git checkout -b bugfix/fix-duplicate-ingredients
cp "$INIT_DIR/patches/fix-duplicate-ingredients/tests/recipes.test.ts" tests/recipes.test.ts
git commit -am "test: add failing test reproducing duplicate ingredient bug in PUT /api/recipes"

git checkout main
echo "Recipe Manager repository initialized with all demo branches."
