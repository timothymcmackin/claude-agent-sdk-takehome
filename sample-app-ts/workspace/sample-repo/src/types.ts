export interface Ingredient {
  name: string
  quantity: string
  unit: string
}

export interface Recipe {
  id: string
  name: string
  description: string
  ingredients: Ingredient[]
  tags: string[]
  servings: number
  prepTime: number
  cookTime: number
}
