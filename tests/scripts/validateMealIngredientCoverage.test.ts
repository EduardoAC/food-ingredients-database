import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

const testsDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(testsDir, '../..')
const fixturesDir = path.resolve(testsDir, '..', 'fixtures', 'meal-coverage')
const scriptPath = path.join(
  repoRoot,
  'scripts',
  'validate-meal-ingredient-coverage.mjs'
)

function fixturePath(fileName: string) {
  return path.join(fixturesDir, fileName)
}

function runValidator(args: string[]) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    encoding: 'utf-8'
  })

  if (result.error) {
    throw result.error
  }

  return result
}

function parseJsonOutput(stdout: string) {
  return JSON.parse(stdout)
}

describe('validate-meal-ingredient-coverage script', () => {
  test('reports importable meals in human-readable mode', () => {
    const result = runValidator([
      '--meals',
      fixturePath('valid.meals.json'),
      '--ingredients',
      fixturePath('valid.ingredients.json')
    ])

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('[meal-coverage] Importable: 2')
    expect(result.stdout).toContain('[meal-coverage] Skipped duplicates: 0')
    expect(result.stdout).toContain(
      '[meal-coverage] Invalid ingredient mismatches: 0'
    )
    expect(result.stdout).toContain('[meal-coverage] Invalid other: 0')
    expect(result.stdout).toContain('[meal-coverage] Used ingredient ids: 3')
  })

  test('skips duplicates by normalized meal name and preserves ingredient references', () => {
    const result = runValidator([
      '--meals',
      fixturePath('duplicate-name.meals.json'),
      '--ingredients',
      fixturePath('valid.ingredients.json'),
      '--json'
    ])

    expect(result.status).toBe(1)

    const payload = parseJsonOutput(result.stdout)
    expect(payload.summary.importable).toBe(1)
    expect(payload.summary.skippedDuplicates).toBe(1)
    expect(payload.summary.invalidIngredientMismatch).toBe(0)
    expect(payload.mealStatuses[0].status).toBe('importable')
    expect(payload.mealStatuses[1].status).toBe('skippedDuplicate')
    expect(payload.mealStatuses[0].ingredients).toEqual([
      { ingredientId: 'ing_avocado', amountG: 100 },
      { ingredientId: 'ing_egg_whole', amountG: 100 }
    ])
    expect(
      payload.mealStatuses[0].ingredients.every(
        (ingredient: { ingredientId: string; amountG: number }) =>
          Object.keys(ingredient).sort().join(',') === 'amountG,ingredientId'
      )
    ).toBe(true)
  })

  test('classifies missing ingredient references as ingredient mismatches', () => {
    const result = runValidator([
      '--meals',
      fixturePath('missing-ingredient.meals.json'),
      '--ingredients',
      fixturePath('valid.ingredients.json'),
      '--json'
    ])

    expect(result.status).toBe(1)

    const payload = parseJsonOutput(result.stdout)
    expect(payload.summary.importable).toBe(1)
    expect(payload.summary.invalidIngredientMismatch).toBe(1)
    expect(payload.summary.invalidOther).toBe(0)

    const invalidMeal = payload.mealStatuses.find(
      (mealStatus: { name: string }) => mealStatus.name === 'Mystery Bowl'
    )
    expect(invalidMeal.status).toBe('invalidIngredientMismatch')
    expect(invalidMeal.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'meal_ingredient_not_found',
          ingredientId: 'ing_missing'
        })
      ])
    )
  })

  test('fails before meal validation when the ingredient source is invalid', () => {
    const result = runValidator([
      '--meals',
      fixturePath('valid.meals.json'),
      '--ingredients',
      fixturePath('invalid.ingredients.duplicate-id.json'),
      '--json'
    ])

    expect(result.status).toBe(1)

    const payload = parseJsonOutput(result.stdout)
    expect(payload.ingredientSource.status).toBe('invalid')
    expect(payload.mealStatuses).toEqual([])
    expect(payload.fatalIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'ingredient_id_duplicate',
          ingredientId: 'ing_avocado'
        })
      ])
    )
  })

  test('returns exit code 2 for malformed JSON input', () => {
    const result = runValidator([
      '--meals',
      fixturePath('invalid-json.meals.txt'),
      '--ingredients',
      fixturePath('valid.ingredients.json'),
      '--json'
    ])

    expect(result.status).toBe(2)

    const payload = parseJsonOutput(result.stdout)
    expect(payload.error).toEqual(
      expect.objectContaining({
        code: 'meals_json_parse_failed'
      })
    )
  })
})
