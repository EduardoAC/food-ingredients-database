import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FoodRecord, NutrientRecord } from './ports'

export const ADDITIONAL_INGREDIENTS_PROVIDER_ID = 'additional-ingredients'

const DEFAULT_SOURCE_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../database/sources/additional-ingredients.json'
)

export const ADDITIONAL_INGREDIENT_NUTRIENTS = Object.freeze([
  {
    mealField: 'kcal',
    sourceField: 'caloriesPer100g',
    nutrientNumber: '208',
    nutrientName: 'Energy',
    unitName: 'KCAL'
  },
  {
    mealField: 'proteinG',
    sourceField: 'proteinPer100g',
    nutrientNumber: '203',
    nutrientName: 'Protein',
    unitName: 'G'
  },
  {
    mealField: 'carbsG',
    sourceField: 'carbsPer100g',
    nutrientNumber: '205',
    nutrientName: 'Carbohydrate, by difference',
    unitName: 'G'
  },
  {
    mealField: 'fatG',
    sourceField: 'fatPer100g',
    nutrientNumber: '204',
    nutrientName: 'Total lipid (fat)',
    unitName: 'G'
  },
  {
    mealField: 'fiberG',
    sourceField: 'fiberPer100g',
    nutrientNumber: '291',
    nutrientName: 'Fiber, total dietary',
    unitName: 'G'
  },
  {
    mealField: 'sugarG',
    sourceField: 'sugarPer100g',
    nutrientNumber: '269',
    nutrientName: 'Total Sugars',
    unitName: 'G'
  },
  {
    mealField: 'saturatedFatG',
    sourceField: 'saturatedFatPer100g',
    nutrientNumber: '606',
    nutrientName: 'Fatty acids, total saturated',
    unitName: 'G'
  },
  {
    mealField: 'sodiumMg',
    sourceField: 'sodiumPer100g',
    nutrientNumber: '307',
    nutrientName: 'Sodium, Na',
    unitName: 'MG'
  }
] as const)

export const ADDITIONAL_INGREDIENT_NUTRIENT_NUMBER_MAPPING = Object.freeze(
  Object.fromEntries(
    ADDITIONAL_INGREDIENT_NUTRIENTS.map((definition) => [
      definition.mealField,
      definition.nutrientNumber
    ])
  )
)

type AdditionalIngredientNutrientField =
  (typeof ADDITIONAL_INGREDIENT_NUTRIENTS)[number]['sourceField']

type AdditionalIngredientMealField =
  (typeof ADDITIONAL_INGREDIENT_NUTRIENTS)[number]['mealField']

export interface AdditionalIngredientSourceMeta {
  generatedAt?: string
  source?: string
  count?: number
  units?: {
    nutritionBasis?: string
  }
}

export interface AdditionalIngredientRecord {
  id: string
  name?: string
  category?: string
  caloriesPer100g: number
  proteinPer100g: number
  carbsPer100g: number
  fatPer100g: number
  fiberPer100g: number
  sugarPer100g: number
  saturatedFatPer100g: number
  sodiumPer100g: number
  vitamins?: Record<string, unknown>
  minerals?: Record<string, unknown>
  allergens?: string[]
  isCustom?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AdditionalIngredientSourceDocument {
  meta?: AdditionalIngredientSourceMeta
  ingredients?: AdditionalIngredientRecord[]
}

export interface AdditionalIngredientValidationIssue {
  code: string
  message: string
  ingredientId?: string
  ingredientIndex?: number
  invalidFields?: string[]
}

export interface AdditionalIngredientValidationResult {
  status: 'valid' | 'invalid'
  issues: AdditionalIngredientValidationIssue[]
  ingredientIndex: Map<string, AdditionalIngredientRecord>
  totalIngredientRecords: number
}

export class AdditionalIngredientSourceError extends Error {
  readonly code: string
  readonly sourcePath: string
  readonly issues: AdditionalIngredientValidationIssue[]

  constructor(
    code: string,
    message: string,
    sourcePath: string,
    issues: AdditionalIngredientValidationIssue[] = []
  ) {
    super(message)
    this.name = 'AdditionalIngredientSourceError'
    this.code = code
    this.sourcePath = sourcePath
    this.issues = issues
  }
}

function createIssue(
  code: string,
  message: string,
  extra: Partial<AdditionalIngredientValidationIssue> = {}
): AdditionalIngredientValidationIssue {
  return {
    code,
    message,
    ...extra
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function normaliseSourcePath(sourcePath?: string) {
  return sourcePath ? path.resolve(sourcePath) : DEFAULT_SOURCE_PATH
}

function validateIngredientRecord(
  ingredient: unknown,
  ingredientIndex: Map<string, AdditionalIngredientRecord>,
  index: number
) {
  if (
    !ingredient ||
    typeof ingredient !== 'object' ||
    Array.isArray(ingredient)
  ) {
    return [
      createIssue(
        'ingredient_record_invalid',
        'Ingredient entry must be an object.',
        {
          ingredientIndex: index
        }
      )
    ]
  }

  const issues: AdditionalIngredientValidationIssue[] = []
  const typedIngredient = ingredient as Record<string, unknown>
  const ingredientId =
    typeof typedIngredient.id === 'string' ? typedIngredient.id.trim() : ''

  if (!ingredientId) {
    issues.push(
      createIssue('ingredient_id_missing', 'Ingredient id is required.', {
        ingredientIndex: index
      })
    )
    return issues
  }

  if (ingredientIndex.has(ingredientId)) {
    issues.push(
      createIssue(
        'ingredient_id_duplicate',
        `Ingredient id "${ingredientId}" appears more than once in the ingredient source.`,
        {
          ingredientId,
          ingredientIndex: index
        }
      )
    )
    return issues
  }

  const invalidFields = ADDITIONAL_INGREDIENT_NUTRIENTS.map(
    ({ sourceField }) => sourceField
  ).filter((fieldName) => !isFiniteNumber(typedIngredient[fieldName]))

  if (invalidFields.length > 0) {
    issues.push(
      createIssue(
        'ingredient_nutrition_invalid',
        `Ingredient "${ingredientId}" is missing valid per-100g numeric values for: ${invalidFields.join(', ')}.`,
        {
          ingredientId,
          ingredientIndex: index,
          invalidFields: [...invalidFields]
        }
      )
    )
    return issues
  }

  ingredientIndex.set(ingredientId, {
    ...(ingredient as AdditionalIngredientRecord),
    id: ingredientId
  })

  return issues
}

export function resolveAdditionalIngredientSourcePath(sourcePath?: string) {
  return normaliseSourcePath(sourcePath)
}

export async function readAdditionalIngredientSourceDocument(
  sourcePath?: string
) {
  const resolvedPath = normaliseSourcePath(sourcePath)

  let raw: string
  try {
    raw = await fs.readFile(resolvedPath, 'utf-8')
  } catch (error) {
    throw new AdditionalIngredientSourceError(
      'read_failed',
      `Failed to read ingredient source file at ${resolvedPath}: ${
        (error as Error).message
      }`,
      resolvedPath
    )
  }

  try {
    return {
      sourcePath: resolvedPath,
      document: JSON.parse(raw) as AdditionalIngredientSourceDocument
    }
  } catch (error) {
    throw new AdditionalIngredientSourceError(
      'json_parse_failed',
      `Failed to parse ingredient source JSON at ${resolvedPath}: ${
        (error as Error).message
      }`,
      resolvedPath
    )
  }
}

export function validateAdditionalIngredientSourceDocument(
  document: unknown
): AdditionalIngredientValidationResult {
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return {
      status: 'invalid',
      issues: [
        createIssue(
          'ingredient_source_invalid',
          'Ingredient source must be a JSON object with an "ingredients" array.'
        )
      ],
      ingredientIndex: new Map(),
      totalIngredientRecords: 0
    }
  }

  const typedDocument = document as AdditionalIngredientSourceDocument

  if (!Array.isArray(typedDocument.ingredients)) {
    return {
      status: 'invalid',
      issues: [
        createIssue(
          'ingredient_source_invalid',
          'Ingredient source must contain an "ingredients" array.'
        )
      ],
      ingredientIndex: new Map(),
      totalIngredientRecords: 0
    }
  }

  const ingredientIndex = new Map<string, AdditionalIngredientRecord>()
  const issues = typedDocument.ingredients.flatMap((ingredient, index) =>
    validateIngredientRecord(ingredient, ingredientIndex, index)
  )

  return {
    status: issues.length > 0 ? 'invalid' : 'valid',
    issues,
    ingredientIndex,
    totalIngredientRecords: typedDocument.ingredients.length
  }
}

function createNutrients(
  ingredient: AdditionalIngredientRecord
): NutrientRecord[] {
  return ADDITIONAL_INGREDIENT_NUTRIENTS.map((definition) => ({
    id: definition.nutrientNumber,
    number: definition.nutrientNumber,
    name: definition.nutrientName,
    unitName: definition.unitName,
    value: ingredient[definition.sourceField]
  }))
}

export function createAdditionalIngredientFoodRecord(
  ingredient: AdditionalIngredientRecord
): FoodRecord {
  const allergens = Array.isArray(ingredient.allergens)
    ? ingredient.allergens.map((allergen) => `allergen:${allergen}`)
    : []
  const tags = [
    ingredient.category ? `category:${ingredient.category}` : null,
    ...allergens
  ].filter((tag): tag is string => Boolean(tag))

  return {
    id: ingredient.id,
    externalId: ingredient.id,
    provider: ADDITIONAL_INGREDIENTS_PROVIDER_ID,
    name:
      typeof ingredient.name === 'string' && ingredient.name.trim().length > 0
        ? ingredient.name.trim()
        : ingredient.id,
    dataType: 'Additional ingredient',
    publicationDate:
      typeof ingredient.updatedAt === 'string'
        ? ingredient.updatedAt.slice(0, 10)
        : undefined,
    lastUpdated:
      typeof ingredient.updatedAt === 'string'
        ? ingredient.updatedAt
        : undefined,
    nutrients: createNutrients(ingredient),
    tags
  }
}

export function createAdditionalIngredientFoodRecords(
  ingredients: Iterable<AdditionalIngredientRecord>
) {
  return Array.from(ingredients, (ingredient) =>
    createAdditionalIngredientFoodRecord(ingredient)
  )
}

export function createAdditionalIngredientSourceHash(
  document: AdditionalIngredientSourceDocument
) {
  return createHash('sha256').update(JSON.stringify(document)).digest('hex')
}

export async function loadValidatedAdditionalIngredientSource(
  options: {
    sourcePath?: string
  } = {}
) {
  const { sourcePath, document } = await readAdditionalIngredientSourceDocument(
    options.sourcePath
  )
  const validation = validateAdditionalIngredientSourceDocument(document)

  if (validation.status !== 'valid') {
    throw new AdditionalIngredientSourceError(
      'invalid_source',
      `Ingredient source at ${sourcePath} is invalid: ${validation.issues
        .map((issue) => issue.message)
        .join(' ')}`,
      sourcePath,
      validation.issues
    )
  }

  return {
    sourcePath,
    document,
    validation,
    sourceHash: createAdditionalIngredientSourceHash(document)
  }
}

export function getAdditionalIngredientSourceFieldForMealField(
  mealField: AdditionalIngredientMealField
) {
  const match = ADDITIONAL_INGREDIENT_NUTRIENTS.find(
    (definition) => definition.mealField === mealField
  )
  return match?.sourceField
}

export function getAdditionalIngredientNutrientNumberForMealField(
  mealField: AdditionalIngredientMealField
) {
  return ADDITIONAL_INGREDIENT_NUTRIENT_NUMBER_MAPPING[mealField]
}

export type { AdditionalIngredientMealField, AdditionalIngredientNutrientField }
