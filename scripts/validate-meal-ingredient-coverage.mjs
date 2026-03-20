#!/usr/bin/env node

import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { createJiti } = require('jiti')

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const jiti = createJiti(scriptDir)
const {
  ADDITIONAL_INGREDIENT_NUTRIENT_NUMBER_MAPPING,
  ADDITIONAL_INGREDIENT_NUTRIENTS,
  AdditionalIngredientSourceError,
  readAdditionalIngredientSourceDocument,
  validateAdditionalIngredientSourceDocument
} = jiti(path.resolve(scriptDir, '../src/sync/additionalIngredientsSource.ts'))

const ALLOWED_SLOTS = Object.freeze([
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'mid-morning snack',
  'afternoon snack',
  'dessert'
])

const DUPLICATE_POLICY = 'fail-on-normalised-name-collision'
const WARNING_DELTA_THRESHOLD = 0.5

const NUTRIENT_FIELDS = Object.freeze(
  ADDITIONAL_INGREDIENT_NUTRIENTS.map(({ mealField, sourceField }) => [
    mealField,
    sourceField
  ])
)

class CliExitError extends Error {
  constructor(message, exitCode, code) {
    super(message)
    this.name = 'CliExitError'
    this.exitCode = exitCode
    this.code = code
  }
}

function roundTo(value, decimals = 2) {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value)
}

function normalizeWhitespace(value) {
  return value.trim().replace(/\s+/g, ' ')
}

function normalizeMealName(value) {
  return normalizeWhitespace(value).toLowerCase()
}

function normalizeSlot(value) {
  return normalizeWhitespace(value).toLowerCase()
}

function createIssue(code, message, extra = {}) {
  return {
    code,
    message,
    ...extra
  }
}

function createEmptySummary(totalMeals = 0, totalIngredients = 0) {
  return {
    totalMeals,
    importable: 0,
    duplicateMealNames: 0,
    invalidIngredientMismatch: 0,
    invalidOther: 0,
    nutritionWarnings: 0,
    totalIngredientRecords: totalIngredients,
    uniqueIngredientIds: totalIngredients,
    usedIngredientIds: 0,
    unusedIngredientIds: [],
    duplicatePolicy: DUPLICATE_POLICY,
    allowedSlots: [...ALLOWED_SLOTS],
    nutrientNumberMapping: ADDITIONAL_INGREDIENT_NUTRIENT_NUMBER_MAPPING
  }
}

async function readJsonDocument(filePath, label) {
  let raw
  try {
    raw = await fs.readFile(filePath, 'utf-8')
  } catch (error) {
    throw new CliExitError(
      `Failed to read ${label} file at ${filePath}: ${error.message}`,
      2,
      `${label}_read_failed`
    )
  }

  try {
    return JSON.parse(raw)
  } catch (error) {
    throw new CliExitError(
      `Failed to parse ${label} JSON at ${filePath}: ${error.message}`,
      2,
      `${label}_json_parse_failed`
    )
  }
}

async function readIngredientSourceDocument(filePath) {
  try {
    const { document } = await readAdditionalIngredientSourceDocument(filePath)
    return document
  } catch (error) {
    if (!(error instanceof AdditionalIngredientSourceError)) {
      throw error
    }

    if (error.code === 'read_failed' || error.code === 'json_parse_failed') {
      throw new CliExitError(error.message, 2, `ingredients_${error.code}`)
    }

    throw error
  }
}

function parseArgs(argv) {
  const options = {
    meals: '',
    ingredients: '',
    json: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--json') {
      options.json = true
      continue
    }

    if (arg === '--meals' || arg === '--ingredients') {
      const nextValue = argv[index + 1]
      if (!nextValue || nextValue.startsWith('--')) {
        throw new CliExitError(
          `Missing value for ${arg}. Usage: node ./scripts/validate-meal-ingredient-coverage.mjs --meals <path> --ingredients <path> [--json]`,
          2,
          'invalid_arguments'
        )
      }

      options[arg.slice(2)] = nextValue
      index += 1
      continue
    }

    throw new CliExitError(
      `Unknown argument "${arg}". Usage: node ./scripts/validate-meal-ingredient-coverage.mjs --meals <path> --ingredients <path> [--json]`,
      2,
      'invalid_arguments'
    )
  }

  if (!options.meals || !options.ingredients) {
    throw new CliExitError(
      'Both --meals and --ingredients are required. Usage: node ./scripts/validate-meal-ingredient-coverage.mjs --meals <path> --ingredients <path> [--json]',
      2,
      'invalid_arguments'
    )
  }

  return options
}
function getMealIngredientRefs(meal) {
  if (!Array.isArray(meal?.ingredients)) {
    return []
  }

  return meal.ingredients.map((ingredient) => ({
    ingredientId:
      typeof ingredient?.ingredientId === 'string'
        ? ingredient.ingredientId.trim()
        : '',
    amountG: ingredient?.amountG
  }))
}

function computeMealNutrition(ingredientRefs, ingredientIndex) {
  const computed = Object.fromEntries(
    NUTRIENT_FIELDS.map(([nutritionField]) => [nutritionField, 0])
  )

  for (const ingredientRef of ingredientRefs) {
    const ingredient = ingredientIndex.get(ingredientRef.ingredientId)

    if (
      !ingredient ||
      !isFiniteNumber(ingredientRef.amountG) ||
      ingredientRef.amountG <= 0
    ) {
      continue
    }

    for (const [nutritionField, ingredientField] of NUTRIENT_FIELDS) {
      computed[nutritionField] +=
        (ingredient[ingredientField] * ingredientRef.amountG) / 100
    }
  }

  for (const [nutritionField] of NUTRIENT_FIELDS) {
    computed[nutritionField] = roundTo(computed[nutritionField])
  }

  computed.saltG = roundTo((computed.sodiumMg / 1000) * 2.5)

  return computed
}

function compareMealNutrition(sourceNutrition, computedNutrition) {
  if (
    !sourceNutrition ||
    typeof sourceNutrition !== 'object' ||
    Array.isArray(sourceNutrition)
  ) {
    return null
  }

  const deltas = {}
  const warnings = []

  for (const [nutritionField] of NUTRIENT_FIELDS) {
    if (!isFiniteNumber(sourceNutrition[nutritionField])) {
      continue
    }

    const delta = roundTo(
      sourceNutrition[nutritionField] - computedNutrition[nutritionField]
    )
    deltas[nutritionField] = delta

    if (Math.abs(delta) > WARNING_DELTA_THRESHOLD) {
      warnings.push(
        createIssue(
          'nutrition_delta_exceeds_threshold',
          `Meal nutrition differs from ingredient-derived nutrition for "${nutritionField}" by ${delta}.`,
          {
            nutritionField,
            delta,
            threshold: WARNING_DELTA_THRESHOLD
          }
        )
      )
    }
  }

  if (isFiniteNumber(sourceNutrition.saltG)) {
    deltas.saltG = roundTo(sourceNutrition.saltG - computedNutrition.saltG)
  }

  return {
    source: sourceNutrition,
    computed: computedNutrition,
    deltas,
    warnings
  }
}

function validateMealRecord(meal, ingredientIndex, seenMealNames) {
  const mealId = typeof meal?.id === 'string' ? meal.id.trim() : ''
  const name =
    typeof meal?.name === 'string' ? normalizeWhitespace(meal.name) : ''
  const normalizedName = name ? normalizeMealName(name) : ''
  const normalizedSlot =
    typeof meal?.slot === 'string' ? normalizeSlot(meal.slot) : ''
  const ingredientRefs = getMealIngredientRefs(meal)

  const result = {
    mealId,
    name,
    normalizedName,
    slot: meal?.slot,
    normalizedSlot,
    servings: meal?.servings,
    preparationInstructions: Array.isArray(meal?.preparationInstructions)
      ? meal.preparationInstructions
      : [],
    tags: Array.isArray(meal?.tags) ? meal.tags : [],
    ingredients: ingredientRefs,
    status: 'invalidOther',
    issues: [],
    nutritionComparison: null
  }

  if (!meal || typeof meal !== 'object' || Array.isArray(meal)) {
    result.issues.push(
      createIssue('meal_record_invalid', 'Meal entry must be an object.')
    )
    return result
  }

  if (!mealId) {
    result.issues.push(createIssue('meal_id_missing', 'Meal id is required.'))
  }

  if (!name) {
    result.issues.push(
      createIssue('meal_name_missing', 'Meal name is required.')
    )
  }

  if (!Array.isArray(meal.ingredients) || ingredientRefs.length === 0) {
    result.issues.push(
      createIssue(
        'meal_ingredients_missing',
        'Meal must include at least one ingredient reference.'
      )
    )
  }

  if (result.issues.length > 0) {
    return result
  }

  if (seenMealNames.has(normalizedName)) {
    result.status = 'invalidDuplicateMealName'
    result.issues.push(
      createIssue(
        'meal_duplicate_name',
        `Meal "${name}" duplicates an existing normalised meal name.`,
        {
          duplicatePolicy: DUPLICATE_POLICY
        }
      )
    )
    return result
  }

  seenMealNames.add(normalizedName)

  if (!ALLOWED_SLOTS.includes(normalizedSlot)) {
    result.issues.push(
      createIssue(
        'meal_slot_invalid',
        `Meal slot "${meal?.slot ?? ''}" is not allowed.`,
        {
          allowedSlots: [...ALLOWED_SLOTS]
        }
      )
    )
  }

  if (!Number.isInteger(meal.servings) || meal.servings <= 0) {
    result.issues.push(
      createIssue(
        'meal_servings_invalid',
        'Meal servings must be a positive integer.'
      )
    )
  }

  const ingredientResolutionIssues = []

  ingredientRefs.forEach((ingredientRef, index) => {
    if (!isFiniteNumber(ingredientRef.amountG) || ingredientRef.amountG <= 0) {
      result.issues.push(
        createIssue(
          'meal_ingredient_amount_invalid',
          `Ingredient amount at index ${index} must be a finite number greater than 0.`,
          {
            ingredientIndex: index,
            ingredientId: ingredientRef.ingredientId
          }
        )
      )
    }

    if (!ingredientRef.ingredientId) {
      ingredientResolutionIssues.push(
        createIssue(
          'meal_ingredient_id_missing',
          `Ingredient reference at index ${index} is missing ingredientId.`,
          {
            ingredientIndex: index
          }
        )
      )
      return
    }

    if (!ingredientIndex.has(ingredientRef.ingredientId)) {
      ingredientResolutionIssues.push(
        createIssue(
          'meal_ingredient_not_found',
          `Ingredient "${ingredientRef.ingredientId}" could not be resolved in the ingredient source.`,
          {
            ingredientIndex: index,
            ingredientId: ingredientRef.ingredientId
          }
        )
      )
    }
  })

  if (result.issues.length > 0) {
    result.status = 'invalidOther'
    return result
  }

  if (ingredientResolutionIssues.length > 0) {
    result.status = 'invalidIngredientMismatch'
    result.issues.push(...ingredientResolutionIssues)
    return result
  }

  const computedNutrition = computeMealNutrition(
    ingredientRefs,
    ingredientIndex
  )
  const nutritionComparison = compareMealNutrition(
    meal.nutrition,
    computedNutrition
  )

  result.status = 'importable'
  result.nutritionComparison = nutritionComparison
  return result
}

function validateMealsDocument(document, ingredientIndex) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return {
      summary: createEmptySummary(0, ingredientIndex.size),
      mealStatuses: [],
      fatalIssues: [
        createIssue(
          'meal_source_invalid',
          'Meal source must be a JSON object with a "meals" array.'
        )
      ]
    }
  }

  if (!Array.isArray(document.meals)) {
    return {
      summary: createEmptySummary(0, ingredientIndex.size),
      mealStatuses: [],
      fatalIssues: [
        createIssue(
          'meal_source_shape_invalid',
          'Meal source must include a "meals" array.'
        )
      ]
    }
  }

  const mealStatuses = []
  const seenMealNames = new Set()
  const summary = createEmptySummary(
    document.meals.length,
    ingredientIndex.size
  )
  const usedIngredientIds = new Set()

  document.meals.forEach((meal) => {
    if (Array.isArray(meal?.ingredients)) {
      meal.ingredients.forEach((ingredient) => {
        if (
          typeof ingredient?.ingredientId === 'string' &&
          ingredient.ingredientId.trim()
        ) {
          usedIngredientIds.add(ingredient.ingredientId.trim())
        }
      })
    }

    const mealStatus = validateMealRecord(meal, ingredientIndex, seenMealNames)
    mealStatuses.push(mealStatus)

    if (mealStatus.status === 'importable') {
      summary.importable += 1
      summary.nutritionWarnings +=
        mealStatus.nutritionComparison?.warnings.length ?? 0
      return
    }

    if (mealStatus.status === 'invalidDuplicateMealName') {
      summary.duplicateMealNames += 1
      return
    }

    if (mealStatus.status === 'invalidIngredientMismatch') {
      summary.invalidIngredientMismatch += 1
      return
    }

    summary.invalidOther += 1
  })

  summary.usedIngredientIds = usedIngredientIds.size
  summary.unusedIngredientIds = Array.from(ingredientIndex.keys())
    .filter((ingredientId) => !usedIngredientIds.has(ingredientId))
    .sort((left, right) => left.localeCompare(right))

  return {
    summary,
    mealStatuses,
    fatalIssues: []
  }
}

export async function validateMealIngredientCoverage(options) {
  const mealsPath = path.resolve(options.meals)
  const ingredientsPath = path.resolve(options.ingredients)

  const mealsDocument = await readJsonDocument(mealsPath, 'meals')
  const ingredientsDocument =
    await readIngredientSourceDocument(ingredientsPath)

  const ingredientValidation =
    validateAdditionalIngredientSourceDocument(ingredientsDocument)
  const mealValidation =
    ingredientValidation.status === 'valid'
      ? validateMealsDocument(
          mealsDocument,
          ingredientValidation.ingredientIndex
        )
      : {
          summary: createEmptySummary(
            Array.isArray(mealsDocument?.meals)
              ? mealsDocument.meals.length
              : 0,
            ingredientValidation.totalIngredientRecords
          ),
          mealStatuses: [],
          fatalIssues: ingredientValidation.issues
        }

  return {
    summary: {
      ...mealValidation.summary,
      totalIngredientRecords: ingredientValidation.totalIngredientRecords,
      uniqueIngredientIds: ingredientValidation.ingredientIndex.size
    },
    ingredientSource: {
      status: ingredientValidation.status,
      issues: ingredientValidation.issues
    },
    mealStatuses: mealValidation.mealStatuses,
    fatalIssues: mealValidation.fatalIssues,
    sourceFiles: {
      meals: mealsPath,
      ingredients: ingredientsPath
    }
  }
}

function getExitCode(result) {
  if (result.fatalIssues.length > 0) {
    return 1
  }

  const { duplicateMealNames, invalidIngredientMismatch, invalidOther } =
    result.summary
  return duplicateMealNames > 0 ||
    invalidIngredientMismatch > 0 ||
    invalidOther > 0
    ? 1
    : 0
}

function formatHumanOutput(result) {
  const lines = [
    '[meal-coverage] Source validation summary',
    `[meal-coverage] Meal source: ${result.sourceFiles.meals}`,
    `[meal-coverage] Ingredient source: ${result.sourceFiles.ingredients}`,
    `[meal-coverage] Importable: ${result.summary.importable}`,
    `[meal-coverage] Duplicate meal names: ${result.summary.duplicateMealNames}`,
    `[meal-coverage] Invalid ingredient mismatches: ${result.summary.invalidIngredientMismatch}`,
    `[meal-coverage] Invalid other: ${result.summary.invalidOther}`,
    `[meal-coverage] Nutrition warnings: ${result.summary.nutritionWarnings}`,
    `[meal-coverage] Ingredient records: ${result.summary.totalIngredientRecords}`,
    `[meal-coverage] Unique ingredient ids: ${result.summary.uniqueIngredientIds}`,
    `[meal-coverage] Used ingredient ids: ${result.summary.usedIngredientIds}`,
    `[meal-coverage] Unused ingredient ids: ${result.summary.unusedIngredientIds.length}`,
    `[meal-coverage] Duplicate policy: ${result.summary.duplicatePolicy}`
  ]

  if (result.fatalIssues.length > 0) {
    lines.push('[meal-coverage] Fatal validation issues:')
    result.fatalIssues.forEach((issue) => {
      lines.push(`[meal-coverage] - ${issue.message}`)
    })
  }

  const flaggedMeals = result.mealStatuses.filter(
    (mealStatus) => mealStatus.status !== 'importable'
  )
  if (flaggedMeals.length > 0) {
    lines.push('[meal-coverage] Flagged meals:')
    flaggedMeals.forEach((mealStatus) => {
      const label = mealStatus.name || mealStatus.mealId || '<unknown meal>'
      lines.push(`[meal-coverage] - ${label}: ${mealStatus.status}`)
    })
  }

  const warnedMeals = result.mealStatuses.filter(
    (mealStatus) => (mealStatus.nutritionComparison?.warnings.length ?? 0) > 0
  )
  if (warnedMeals.length > 0) {
    lines.push('[meal-coverage] Nutrition deltas above threshold:')
    warnedMeals.forEach((mealStatus) => {
      const label = mealStatus.name || mealStatus.mealId || '<unknown meal>'
      const fields = mealStatus.nutritionComparison.warnings
        .map((warning) => warning.nutritionField)
        .join(', ')
      lines.push(`[meal-coverage] - ${label}: ${fields}`)
    })
  }

  return lines.join('\n')
}

function formatJsonOutput(result) {
  return JSON.stringify(result, null, 2)
}

export async function run(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv)
    const result = await validateMealIngredientCoverage(options)
    const output = options.json
      ? formatJsonOutput(result)
      : formatHumanOutput(result)
    console.log(output)
    process.exitCode = getExitCode(result)
    return result
  } catch (error) {
    if (!(error instanceof CliExitError)) {
      throw error
    }

    const payload = {
      error: {
        code: error.code,
        message: error.message
      }
    }

    const wantsJson = argv.includes('--json')
    console.log(
      wantsJson
        ? JSON.stringify(payload, null, 2)
        : `[meal-coverage] ${error.message}`
    )
    process.exitCode = error.exitCode
    return payload
  }
}

const currentFile = fileURLToPath(import.meta.url)
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : ''

if (currentFile === entryFile) {
  run().catch((error) => {
    console.error('[meal-coverage] Unexpected failure', error)
    process.exitCode = 1
  })
}
