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

function normalizeFood(raw: any): LocalFoodItem {
  if (raw && typeof raw === 'object' && 'id' in raw) {
    return raw as LocalFoodItem
  }

  const provider = raw?.provider ?? 'unknown'
  const externalId = raw?.externalId ?? (raw?.fdcId !== undefined ? String(raw.fdcId) : undefined)
  const baseId = raw?.id ?? (externalId ? `${provider}:${externalId}` : `${provider}:unknown`)

  return {
    id: baseId,
    provider,
    externalId,
    description: raw?.description ?? 'Unknown food',
    dataType: raw?.dataType,
    publicationDate: raw?.publicationDate,
    foodCode: raw?.foodCode,
    tags: raw?.tags ?? [],
    foodNutrients: Array.isArray(raw?.foodNutrients)
      ? raw.foodNutrients.map((nutrient: any) => ({
          number: nutrient?.number ?? nutrient?.id ?? 'unknown',
          name: nutrient?.name ?? 'Unknown',
          amount: nutrient?.amount ?? nutrient?.value ?? 0,
          unitName: nutrient?.unitName ?? 'unit'
        }))
      : []
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
    foods.push(...shardFoods.map(normalizeFood))
  }

  return foods
}

export async function findFoodById(
  id: string,
  options: LoadLocalFoodsOptions = {}
): Promise<LocalFoodItem | undefined> {
  const foods = await loadLocalFoods(options)
  return foods.find((food) => food.id === id)
}

export async function findFoodByExternalId(
  externalId: string,
  options: LoadLocalFoodsOptions = {}
): Promise<LocalFoodItem | undefined> {
  const foods = await loadLocalFoods(options)
  return foods.find((food) => food.externalId === externalId)
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
  if (options.includeAll) {
    return sorted
  }

  const limit = options.maxResults ?? 50
  return limit > 0 ? sorted.slice(0, limit) : sorted
}
