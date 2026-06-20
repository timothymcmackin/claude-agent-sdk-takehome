import { randomUUID } from 'crypto'
import type { Recipe, Ingredient } from './types.js'

const recipes: Map<string, Recipe> = new Map()

function seed(name: string, description: string, ingredients: Ingredient[], tags: string[], servings: number, prep: number, cook: number) {
  const id = randomUUID()
  recipes.set(id, { id, name, description, ingredients, tags, servings, prepTime: prep, cookTime: cook })
}

seed(
  'Classic Margherita Pizza',
  'Simple and delicious pizza with fresh tomatoes and mozzarella.',
  [
    { name: 'pizza dough', quantity: '1', unit: 'ball' },
    { name: 'tomato sauce', quantity: '1/2', unit: 'cup' },
    { name: 'fresh mozzarella', quantity: '200', unit: 'g' },
    { name: 'fresh basil', quantity: '10', unit: 'leaves' },
    { name: 'olive oil', quantity: '2', unit: 'tbsp' },
  ],
  ['vegetarian', 'italian'],
  4, 15, 12,
)

seed(
  'Chicken Tikka Masala',
  'Tender chicken in a rich, spiced tomato cream sauce.',
  [
    { name: 'chicken breast', quantity: '500', unit: 'g' },
    { name: 'yogurt', quantity: '1/2', unit: 'cup' },
    { name: 'garam masala', quantity: '2', unit: 'tsp' },
    { name: 'tomato passata', quantity: '400', unit: 'ml' },
    { name: 'heavy cream', quantity: '1/4', unit: 'cup' },
    { name: 'garlic', quantity: '4', unit: 'cloves' },
    { name: 'ginger', quantity: '1', unit: 'inch' },
  ],
  ['indian', 'gluten-free'],
  4, 30, 25,
)

seed(
  'Avocado Toast',
  'Quick, nutritious breakfast with mashed avocado on toasted sourdough.',
  [
    { name: 'sourdough bread', quantity: '2', unit: 'slices' },
    { name: 'avocado', quantity: '1', unit: 'large' },
    { name: 'lemon juice', quantity: '1', unit: 'tsp' },
    { name: 'red pepper flakes', quantity: '1/4', unit: 'tsp' },
    { name: 'sea salt', quantity: '1/4', unit: 'tsp' },
  ],
  ['vegan', 'quick'],
  2, 5, 3,
)

seed(
  'Beef Tacos',
  'Seasoned ground beef in crispy shells with fresh toppings.',
  [
    { name: 'ground beef', quantity: '500', unit: 'g' },
    { name: 'taco shells', quantity: '12', unit: 'shells' },
    { name: 'taco seasoning', quantity: '2', unit: 'tbsp' },
    { name: 'cheddar cheese', quantity: '1', unit: 'cup' },
    { name: 'shredded lettuce', quantity: '2', unit: 'cups' },
    { name: 'tomato', quantity: '2', unit: 'medium' },
    { name: 'sour cream', quantity: '1/2', unit: 'cup' },
  ],
  ['mexican'],
  4, 10, 15,
)

seed(
  'Lemon Garlic Pasta',
  'Light and fragrant pasta with a bright lemon-garlic sauce.',
  [
    { name: 'spaghetti', quantity: '400', unit: 'g' },
    { name: 'garlic', quantity: '6', unit: 'cloves' },
    { name: 'lemon', quantity: '2', unit: 'large' },
    { name: 'parmesan', quantity: '1/2', unit: 'cup' },
    { name: 'olive oil', quantity: '4', unit: 'tbsp' },
    { name: 'fresh parsley', quantity: '1/4', unit: 'cup' },
  ],
  ['vegetarian', 'italian', 'quick'],
  4, 5, 15,
)

seed(
  'Blueberry Smoothie',
  'Thick and creamy smoothie packed with antioxidants.',
  [
    { name: 'frozen blueberries', quantity: '1', unit: 'cup' },
    { name: 'banana', quantity: '1', unit: 'medium' },
    { name: 'oat milk', quantity: '1', unit: 'cup' },
    { name: 'honey', quantity: '1', unit: 'tbsp' },
    { name: 'chia seeds', quantity: '1', unit: 'tsp' },
  ],
  ['vegan', 'gluten-free', 'quick'],
  2, 5, 0,
)

seed(
  'French Onion Soup',
  'Classic bistro soup with caramelized onions and melted gruyere.',
  [
    { name: 'yellow onions', quantity: '4', unit: 'large' },
    { name: 'beef broth', quantity: '4', unit: 'cups' },
    { name: 'dry white wine', quantity: '1/2', unit: 'cup' },
    { name: 'gruyere cheese', quantity: '200', unit: 'g' },
    { name: 'baguette', quantity: '4', unit: 'slices' },
    { name: 'butter', quantity: '3', unit: 'tbsp' },
    { name: 'thyme', quantity: '2', unit: 'sprigs' },
  ],
  ['french'],
  4, 10, 60,
)

seed(
  'Black Bean Burgers',
  'Hearty vegetarian burgers with a smoky black bean patty.',
  [
    { name: 'black beans', quantity: '400', unit: 'g' },
    { name: 'breadcrumbs', quantity: '1/2', unit: 'cup' },
    { name: 'cumin', quantity: '1', unit: 'tsp' },
    { name: 'smoked paprika', quantity: '1', unit: 'tsp' },
    { name: 'burger buns', quantity: '4', unit: 'buns' },
    { name: 'lettuce', quantity: '4', unit: 'leaves' },
    { name: 'tomato', quantity: '1', unit: 'large' },
  ],
  ['vegetarian'],
  4, 15, 10,
)

export function getAll(): Recipe[] {
  return Array.from(recipes.values())
}

export function getById(id: string): Recipe | undefined {
  return recipes.get(id)
}

export function create(data: Omit<Recipe, 'id'>): Recipe {
  const recipe: Recipe = { id: randomUUID(), ...data }
  recipes.set(recipe.id, recipe)
  return recipe
}

export function replace(id: string, data: Omit<Recipe, 'id'>): Recipe | undefined {
  if (!recipes.has(id)) return undefined
  const recipe: Recipe = { id, ...data }
  recipes.set(id, recipe)
  return recipe
}

export function remove(id: string): boolean {
  return recipes.delete(id)
}

export function allIngredients(): string[] {
  const names = new Set<string>()
  for (const r of recipes.values()) r.ingredients.forEach(i => names.add(i.name))
  return Array.from(names).sort()
}

export function allTags(): string[] {
  const tags = new Set<string>()
  for (const r of recipes.values()) r.tags.forEach(t => tags.add(t))
  return Array.from(tags).sort()
}
