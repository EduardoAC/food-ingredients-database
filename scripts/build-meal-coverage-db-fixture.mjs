#!/usr/bin/env node

import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { createJiti } = require('jiti')

const NUTRIENT_DEFINITIONS = Object.freeze([
  [
    'caloriesPer100g',
    { id: '208', number: '208', name: 'Energy', unitName: 'KCAL' }
  ],
  [
    'proteinPer100g',
    { id: '203', number: '203', name: 'Protein', unitName: 'G' }
  ],
  [
    'carbsPer100g',
    {
      id: '205',
      number: '205',
      name: 'Carbohydrate, by difference',
      unitName: 'G'
    }
  ],
  [
    'fatPer100g',
    { id: '204', number: '204', name: 'Total lipid (fat)', unitName: 'G' }
  ],
  [
    'fiberPer100g',
    {
      id: '291',
      number: '291',
      name: 'Fiber, total dietary',
      unitName: 'G'
    }
  ],
  [
    'sugarPer100g',
    { id: '269', number: '269', name: 'Total Sugars', unitName: 'G' }
  ],
  [
    'saturatedFatPer100g',
    {
      id: '606',
      number: '606',
      name: 'Fatty acids, total saturated',
      unitName: 'G'
    }
  ],
  [
    'sodiumPer100g',
    { id: '307', number: '307', name: 'Sodium, Na', unitName: 'MG' }
  ]
])

class CliError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CliError'
  }
}

function parseArgs(argv) {
  const options = {
    ingredients: '',
    output: '',
    meals: '',
    shardSize: 500
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--ingredients' || arg === '--output' || arg === '--meals') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new CliError(`Missing value for ${arg}.`)
      }

      options[arg.slice(2)] = value
      index += 1
      continue
    }

    if (arg === '--shardSize') {
      const value = Number(argv[index + 1])
      if (!Number.isInteger(value) || value <= 0) {
        throw new CliError('--shardSize must be a positive integer.')
      }

      options.shardSize = value
      index += 1
      continue
    }

    throw new CliError(
      `Unknown argument "${arg}". Usage: node ./scripts/build-meal-coverage-db-fixture.mjs --ingredients <path> --output <dir> [--meals <path>] [--shardSize <n>]`
    )
  }

  if (!options.ingredients || !options.output) {
    throw new CliError(
      'Both --ingredients and --output are required. Usage: node ./scripts/build-meal-coverage-db-fixture.mjs --ingredients <path> --output <dir> [--meals <path>] [--shardSize <n>]'
    )
  }

  return options
}

async function readJsonFile(filePath, label) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf-8'))
  } catch (error) {
    throw new CliError(
      `Failed to read ${label} at ${filePath}: ${error.message}`
    )
  }
}

function assertFiniteNumber(value, fieldName, ingredientId) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new CliError(
      `Ingredient "${ingredientId}" is missing a valid numeric value for ${fieldName}.`
    )
  }
}

function toFoodRecord(ingredient) {
  const ingredientId =
    typeof ingredient?.id === 'string' ? ingredient.id.trim() : ''

  if (!ingredientId) {
    throw new CliError('All imported ingredients must have a non-empty id.')
  }

  const nutrientFields = NUTRIENT_DEFINITIONS.map(([fieldName]) => fieldName)
  nutrientFields.forEach((fieldName) => {
    assertFiniteNumber(ingredient[fieldName], fieldName, ingredientId)
  })

  const allergens = Array.isArray(ingredient.allergens)
    ? ingredient.allergens.map((allergen) => `allergen:${allergen}`)
    : []
  const tags = [
    ingredient.category ? `category:${ingredient.category}` : null,
    ...allergens
  ].filter(Boolean)

  return {
    id: ingredientId,
    externalId: ingredientId,
    provider: 'fixture-import',
    name:
      typeof ingredient.name === 'string' && ingredient.name.trim()
        ? ingredient.name.trim()
        : ingredientId,
    publicationDate:
      typeof ingredient.updatedAt === 'string'
        ? ingredient.updatedAt.slice(0, 10)
        : undefined,
    lastUpdated:
      typeof ingredient.updatedAt === 'string'
        ? ingredient.updatedAt
        : undefined,
    dataType: 'Fixture import',
    tags,
    nutrients: NUTRIENT_DEFINITIONS.map(([fieldName, nutrient]) => ({
      ...nutrient,
      value: ingredient[fieldName]
    }))
  }
}

async function normaliseSnapshotMetadata(baseDir, generatedAt, totalImported) {
  const indexPath = path.resolve(baseDir, 'index.json')
  const syncStatePath = path.resolve(baseDir, 'sync-state.json')

  const index = JSON.parse(await fs.readFile(indexPath, 'utf-8'))
  index.lastUpdated = generatedAt
  await fs.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`, 'utf-8')

  const syncState = {
    'fixture-import': {
      provider: 'fixture-import',
      totalImported,
      lastSyncedAt: generatedAt
    }
  }
  await fs.writeFile(
    syncStatePath,
    `${JSON.stringify(syncState, null, 2)}\n`,
    'utf-8'
  )
}

async function copyMealsFixture(mealsPath, outputDir) {
  const mealsOutputPath = path.resolve(path.dirname(outputDir), 'meals.json')
  await fs.mkdir(path.dirname(mealsOutputPath), { recursive: true })
  await fs.copyFile(mealsPath, mealsOutputPath)
  return mealsOutputPath
}

export async function buildMealCoverageDatabaseFixture(options) {
  const ingredientsPath = path.resolve(options.ingredients)
  const outputDir = path.resolve(options.output)
  const mealsPath = options.meals ? path.resolve(options.meals) : ''
  const ingredientsDocument = await readJsonFile(
    ingredientsPath,
    'ingredient source'
  )

  if (!Array.isArray(ingredientsDocument.ingredients)) {
    throw new CliError('Ingredient source must contain an "ingredients" array.')
  }

  const foodRecords = ingredientsDocument.ingredients.map(toFoodRecord)
  const generatedAt =
    typeof ingredientsDocument.meta?.generatedAt === 'string'
      ? ingredientsDocument.meta.generatedAt
      : '1970-01-01T00:00:00.000Z'

  await fs.rm(outputDir, { recursive: true, force: true })

  const scriptDir = path.dirname(fileURLToPath(import.meta.url))
  const jiti = createJiti(scriptDir)
  const { createJsonShardedDatabaseAdapter } = jiti(
    path.resolve(scriptDir, '../src/sync/index.ts')
  )
  const database = createJsonShardedDatabaseAdapter({
    baseDir: outputDir,
    shardSize: options.shardSize
  })

  await database.upsertFoods('fixture-import', foodRecords)
  await normaliseSnapshotMetadata(outputDir, generatedAt, foodRecords.length)

  let copiedMealsPath = ''
  if (mealsPath) {
    copiedMealsPath = await copyMealsFixture(mealsPath, outputDir)
  }

  return {
    outputDir,
    copiedMealsPath,
    totalImported: foodRecords.length,
    generatedAt
  }
}

export async function run(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv)
    const result = await buildMealCoverageDatabaseFixture(options)
    console.log(
      JSON.stringify(
        {
          outputDir: result.outputDir,
          copiedMealsPath: result.copiedMealsPath || undefined,
          totalImported: result.totalImported,
          generatedAt: result.generatedAt
        },
        null,
        2
      )
    )
  } catch (error) {
    if (error instanceof CliError) {
      console.error(`[meal-coverage-fixture] ${error.message}`)
      process.exitCode = 1
      return
    }

    throw error
  }
}

const currentFile = fileURLToPath(import.meta.url)
const entryFile = process.argv[1] ? path.resolve(process.argv[1]) : ''

if (currentFile === entryFile) {
  run().catch((error) => {
    console.error('[meal-coverage-fixture] Unexpected failure', error)
    process.exitCode = 1
  })
}
