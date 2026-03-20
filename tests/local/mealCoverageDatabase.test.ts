import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { loadLocalFoods } from '../../src/local'

const testDir = path.dirname(fileURLToPath(import.meta.url))
const fixtureDir = path.resolve(testDir, '..', 'fixtures', 'meal-coverage')
const fixtureDatabaseDir = path.resolve(fixtureDir, 'database')
const mealsFixturePath = path.resolve(fixtureDir, 'meals.json')

const NUTRIENT_NUMBERS = Object.freeze({
  kcal: '208',
  proteinG: '203',
  carbsG: '205',
  fatG: '204',
  fiberG: '291',
  sugarG: '269',
  saturatedFatG: '606',
  sodiumMg: '307'
})

const TOLERANCES = Object.freeze({
  kcal: 1,
  proteinG: 0.5,
  carbsG: 0.5,
  fatG: 0.5,
  fiberG: 0.5,
  sugarG: 0.5,
  saturatedFatG: 0.5,
  sodiumMg: 5,
  saltG: 0.05
})

const TRACKED_NEW_INGREDIENT_IDS = Object.freeze([
  'ing_antelope_burger',
  'ing_bbq_meat_mix',
  'ing_nandos_chicken',
  'ing_vegan_rashers',
  'ing_lemon_pie'
])

type MealIngredientRef = {
  ingredientId: string
  amountG: number
}

type MealFixture = {
  id: string
  name: string
  nutrition: Record<string, number>
  ingredients: MealIngredientRef[]
}

function roundTo(value: number, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

async function loadMealFixtures() {
  const document = JSON.parse(await fs.readFile(mealsFixturePath, 'utf-8'))
  return document.meals as MealFixture[]
}

function getNutrientAmount(
  food: Awaited<ReturnType<typeof loadLocalFoods>>[number],
  nutrientNumber: string
) {
  return (
    food.foodNutrients.find((nutrient) => nutrient.number === nutrientNumber)
      ?.amount ?? 0
  )
}

function computeMealNutrition(
  meal: MealFixture,
  foodsById: Map<string, Awaited<ReturnType<typeof loadLocalFoods>>[number]>
) {
  const computed = {
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    sugarG: 0,
    saturatedFatG: 0,
    sodiumMg: 0
  }

  for (const ingredient of meal.ingredients) {
    const food = foodsById.get(ingredient.ingredientId)
    if (!food) {
      throw new Error(`Missing food record for ${ingredient.ingredientId}`)
    }

    const factor = ingredient.amountG / 100

    computed.kcal += getNutrientAmount(food, NUTRIENT_NUMBERS.kcal) * factor
    computed.proteinG +=
      getNutrientAmount(food, NUTRIENT_NUMBERS.proteinG) * factor
    computed.carbsG += getNutrientAmount(food, NUTRIENT_NUMBERS.carbsG) * factor
    computed.fatG += getNutrientAmount(food, NUTRIENT_NUMBERS.fatG) * factor
    computed.fiberG += getNutrientAmount(food, NUTRIENT_NUMBERS.fiberG) * factor
    computed.sugarG += getNutrientAmount(food, NUTRIENT_NUMBERS.sugarG) * factor
    computed.saturatedFatG +=
      getNutrientAmount(food, NUTRIENT_NUMBERS.saturatedFatG) * factor
    computed.sodiumMg +=
      getNutrientAmount(food, NUTRIENT_NUMBERS.sodiumMg) * factor
  }

  return {
    kcal: roundTo(computed.kcal),
    proteinG: roundTo(computed.proteinG),
    carbsG: roundTo(computed.carbsG),
    fatG: roundTo(computed.fatG),
    fiberG: roundTo(computed.fiberG),
    sugarG: roundTo(computed.sugarG),
    saturatedFatG: roundTo(computed.saturatedFatG),
    sodiumMg: roundTo(computed.sodiumMg),
    saltG: roundTo((computed.sodiumMg / 1000) * 2.5)
  }
}

describe('meal coverage database confidence', () => {
  test('loads the imported fixture database and resolves all meals through local DB APIs', async () => {
    const foods = await loadLocalFoods({ baseDir: fixtureDatabaseDir })
    const meals = await loadMealFixtures()
    const foodsById = new Map(foods.map((food) => [food.id, food]))

    expect(foods).toHaveLength(46)
    expect(meals).toHaveLength(31)

    const usedIngredientIds = new Set(
      meals.flatMap((meal) =>
        meal.ingredients.map((ingredient) => ingredient.ingredientId)
      )
    )
    const databaseIds = new Set(foods.map((food) => food.id))

    expect([...databaseIds].sort()).toEqual([...usedIngredientIds].sort())

    for (const ingredientId of TRACKED_NEW_INGREDIENT_IDS) {
      expect(databaseIds.has(ingredientId)).toBe(true)
      expect(usedIngredientIds.has(ingredientId)).toBe(true)
    }

    const missingRefs = meals.flatMap((meal) =>
      meal.ingredients
        .filter((ingredient) => !foodsById.has(ingredient.ingredientId))
        .map((ingredient) => ({
          mealId: meal.id,
          mealName: meal.name,
          ingredientId: ingredient.ingredientId
        }))
    )

    expect(missingRefs).toEqual([])

    const nutritionMismatches = meals.flatMap((meal) => {
      const computed = computeMealNutrition(meal, foodsById)

      return Object.entries(TOLERANCES).flatMap(([fieldName, tolerance]) => {
        const sourceValue = meal.nutrition[fieldName]
        const computedValue = computed[fieldName as keyof typeof computed]

        if (typeof sourceValue !== 'number') {
          return []
        }

        const delta = roundTo(Math.abs(sourceValue - computedValue))
        if (delta <= tolerance) {
          return []
        }

        return [
          {
            mealId: meal.id,
            mealName: meal.name,
            fieldName,
            sourceValue,
            computedValue,
            delta,
            tolerance
          }
        ]
      })
    })

    expect(nutritionMismatches).toEqual([])
  })
})
