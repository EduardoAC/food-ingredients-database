import fs from 'node:fs/promises'
import path from 'node:path'
import {
  FoodRecord,
  LocalDatabaseAdapter,
  NutrientRecord,
  SyncState
} from '../ports'

export interface JsonShardedDatabaseAdapterOptions {
  baseDir?: string
  shardSize?: number
  stateFileName?: string
  indexFileName?: string
}

interface StoredNutrient {
  number: string
  name: string
  amount: number
  unitName: string
}

export interface StoredFoodItem {
  fdcId: number
  provider: string
  description: string
  dataType?: string
  publicationDate?: string
  foodCode?: string
  tags?: string[]
  foodNutrients: StoredNutrient[]
}

interface PersistedIndexEntry {
  shard: string
  size: number
}

interface PersistedIndex {
  shards: PersistedIndexEntry[]
  lastUpdated: string
}

interface PersistedSyncStateMap {
  [provider: string]: SyncState
}

const DEFAULT_BASE_DIR_NAME = 'database/fdc'
const DEFAULT_STATE_FILE = 'sync-state.json'
const DEFAULT_INDEX_FILE = 'index.json'
const DEFAULT_SHARD_SIZE = 500
const SHARDS_FOLDER = 'shards'

async function ensureDirectory(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true })
}

async function ensureFile(filePath: string, defaultValue: string) {
  try {
    await fs.access(filePath)
  } catch {
    await ensureDirectory(path.dirname(filePath))
    await fs.writeFile(filePath, defaultValue, 'utf-8')
  }
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

async function writeJsonFile<T>(filePath: string, data: T) {
  await ensureDirectory(path.dirname(filePath))
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

function toStoredFood(food: FoodRecord): StoredFoodItem {
  const fdcId = Number(food.externalId ?? food.id.split(':')[1])
  const nutrients = food.nutrients.map((nutrient: NutrientRecord): StoredNutrient => ({
    number: nutrient.number ?? nutrient.id,
    name: nutrient.name,
    amount: nutrient.value,
    unitName: nutrient.unitName
  }))

  return {
    fdcId,
    provider: food.provider,
    description: food.name,
    dataType: food.dataType,
    publicationDate: food.publicationDate,
    foodCode: food.foodCode,
    tags: food.tags,
    foodNutrients: nutrients
  }
}

class JsonShardedDatabaseAdapter implements LocalDatabaseAdapter {
  private readonly baseDir: string
  private readonly shardSize: number
  private readonly stateFile: string
  private readonly indexFile: string
  private readonly shardsDir: string

  constructor(options: JsonShardedDatabaseAdapterOptions = {}) {
    const baseDirOption = options.baseDir ?? DEFAULT_BASE_DIR_NAME
    this.baseDir = path.isAbsolute(baseDirOption)
      ? baseDirOption
      : path.resolve(process.cwd(), baseDirOption)
    this.shardSize = options.shardSize ?? DEFAULT_SHARD_SIZE
    const stateFileName = options.stateFileName ?? DEFAULT_STATE_FILE
    const indexFileName = options.indexFileName ?? DEFAULT_INDEX_FILE
    this.stateFile = path.resolve(this.baseDir, stateFileName)
    this.indexFile = path.resolve(this.baseDir, indexFileName)
    this.shardsDir = path.resolve(this.baseDir, SHARDS_FOLDER)
  }

  async init(): Promise<void> {
    await ensureDirectory(this.baseDir)
    await ensureDirectory(this.shardsDir)
    await ensureFile(this.indexFile, JSON.stringify({ shards: [], lastUpdated: new Date().toISOString() }, null, 2))
    await ensureFile(this.stateFile, '{}')
  }

  async upsertFoods(provider: string, foods: FoodRecord[]): Promise<void> {
    if (foods.length === 0) return

    await this.init()
    const storedFoods = await this.readAllFoods()
    const merged = new Map<string, StoredFoodItem>()

    for (const item of storedFoods) {
      merged.set(this.getFoodKey(item), item)
    }

    for (const food of foods) {
      const stored = toStoredFood(food)
      merged.set(this.getFoodKey(stored), stored)
    }

    const sorted = Array.from(merged.values()).sort((a, b) => a.fdcId - b.fdcId)
    await this.writeShards(sorted)
  }

  async readSyncState(provider: string): Promise<SyncState | null> {
    await this.init()
    const states = await readJsonFile<PersistedSyncStateMap>(this.stateFile, {})
    return states[provider] ?? null
  }

  async writeSyncState(state: SyncState): Promise<void> {
    await this.init()
    const states = await readJsonFile<PersistedSyncStateMap>(this.stateFile, {})
    const nextState: SyncState = {
      ...states[state.provider],
      ...state,
      provider: state.provider,
      lastSyncedAt: state.lastSyncedAt ?? new Date().toISOString()
    }
    states[state.provider] = nextState
    await writeJsonFile(this.stateFile, states)
  }

  private async readIndex(): Promise<PersistedIndex> {
    return readJsonFile<PersistedIndex>(this.indexFile, {
      shards: [],
      lastUpdated: new Date(0).toISOString()
    })
  }

  private async writeIndex(entries: PersistedIndexEntry[]) {
    const payload: PersistedIndex = {
      shards: entries,
      lastUpdated: new Date().toISOString()
    }
    await writeJsonFile(this.indexFile, payload)
  }

  private async readAllFoods(): Promise<StoredFoodItem[]> {
    const index = await this.readIndex()
    if (index.shards.length === 0) {
      return []
    }

    const results: StoredFoodItem[] = []
    for (const entry of index.shards) {
      const shardPath = path.resolve(this.shardsDir, entry.shard)
      const shardFoods = await readJsonFile<StoredFoodItem[]>(shardPath, [])
      results.push(...shardFoods)
    }
    return results
  }

  private getFoodKey(food: StoredFoodItem): string {
    return `${food.provider}:${food.fdcId}`
  }

  private async writeShards(foods: StoredFoodItem[]) {
    await ensureDirectory(this.shardsDir)

    const shardEntries: PersistedIndexEntry[] = []
    const existingFiles = new Set(await fs.readdir(this.shardsDir))

    for (let i = 0; i < foods.length; i += this.shardSize) {
      const shardFoods = foods.slice(i, i + this.shardSize)
      const shardIndex = Math.floor(i / this.shardSize)
      const shardName = `${String(shardIndex).padStart(4, '0')}.json`
      const shardPath = path.resolve(this.shardsDir, shardName)
      await writeJsonFile(shardPath, shardFoods)
      shardEntries.push({ shard: shardName, size: shardFoods.length })
      existingFiles.delete(shardName)
    }

    // remove old shard files not used anymore
    for (const obsolete of existingFiles) {
      const obsoletePath = path.resolve(this.shardsDir, obsolete)
      await fs.rm(obsoletePath, { force: true })
    }

    await this.writeIndex(shardEntries)
  }
}

export function createJsonShardedDatabaseAdapter(
  options: JsonShardedDatabaseAdapterOptions = {}
): LocalDatabaseAdapter {
  return new JsonShardedDatabaseAdapter(options)
}
