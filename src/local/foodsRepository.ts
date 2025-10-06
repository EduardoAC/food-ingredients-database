import fs from 'node:fs/promises'
import path from 'node:path'
import type { LocalFoodItem, LoadLocalFoodsOptions, SearchLocalFoodsOptions } from './types'

interface PersistedIndexEntry {
  shard: string
  size: number
}

interface PersistedIndex {
  shards: PersistedIndexEntry[]
  lastUpdated: string
}

const DEFAULT_BASE_DIR_NAME = 'database/fdc'
const INDEX_FILE = 'index.json'
const SHARDS_DIR = 'shards'

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export async function loadLocalFoods(
  options: LoadLocalFoodsOptions = {}
): Promise<LocalFoodItem[]> {
  const baseDirOption = options.baseDir ?? DEFAULT_BASE_DIR_NAME
  const baseDir = path.isAbsolute(baseDirOption)
    ? baseDirOption
    : path.resolve(process.cwd(), baseDirOption)
  const indexPath = path.resolve(baseDir, INDEX_FILE)
  const shardsDir = path.resolve(baseDir, SHARDS_DIR)

  const index = await readJsonFile<PersistedIndex>(indexPath, {
    shards: [],
    lastUpdated: new Date(0).toISOString()
  })

  if (index.shards.length === 0) {
    return []
  }

  const foods: LocalFoodItem[] = []
  for (const entry of index.shards) {
    const shardPath = path.resolve(shardsDir, entry.shard)
    const shardFoods = await readJsonFile<LocalFoodItem[]>(shardPath, [])
    foods.push(...shardFoods)
  }

  return foods
}

export async function findFoodByFdcId(
  fdcId: number,
  options: LoadLocalFoodsOptions = {}
): Promise<LocalFoodItem | undefined> {
  const foods = await loadLocalFoods(options)
  return foods.find((food) => food.fdcId === fdcId)
}

function matchesQuery(food: LocalFoodItem, query: string): boolean {
  if (!query) return true
  const normalized = query.toLowerCase()
  return (
    food.description.toLowerCase().includes(normalized) ||
    (food.tags ?? []).some((tag) => tag.toLowerCase().includes(normalized))
  )
}

function matchesNutrient(
  food: LocalFoodItem,
  nutrientNumber?: string,
  nutrientName?: string
): boolean {
  if (!nutrientNumber && !nutrientName) {
    return true
  }

  return food.foodNutrients.some((nutrient) => {
    const matchesNumber = nutrientNumber
      ? nutrient.number.toLowerCase() === nutrientNumber.toLowerCase()
      : true
    const matchesName = nutrientName
      ? nutrient.name.toLowerCase().includes(nutrientName.toLowerCase())
      : true
    return matchesNumber && matchesName
  })
}

export async function searchLocalFoods(
  query: string,
  options: SearchLocalFoodsOptions = {}
): Promise<LocalFoodItem[]> {
  const foods = await loadLocalFoods(options)
  const filtered = foods.filter(
    (food) => matchesQuery(food, query) && matchesNutrient(food, options.nutrientNumber, options.nutrientName)
  )

  const sorted = filtered.sort((a, b) => a.description.localeCompare(b.description))
  const limit = options.maxResults ?? 50
  return sorted.slice(0, limit)
}
