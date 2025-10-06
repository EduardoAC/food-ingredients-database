import fs from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import path from 'node:path'
import {
  FoodRecord,
  LocalDatabaseAdapter,
  SyncState
} from '../ports'

interface JsonDatabaseAdapterOptions {
  dataFile?: string
  stateFile?: string
  cwd?: string
}

interface PersistedSyncStateMap {
  [provider: string]: SyncState
}

const DEFAULT_DATA_FILE = 'database/foods.json'
const DEFAULT_STATE_FILE = 'database/sync-state.json'

async function ensureFile(filePath: string, defaultValue: string) {
  try {
    await fs.access(filePath, fsConstants.F_OK)
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
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
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}

class JsonDatabaseAdapter implements LocalDatabaseAdapter {
  private readonly dataFile: string
  private readonly stateFile: string

  constructor(options: JsonDatabaseAdapterOptions = {}) {
    const cwd = options.cwd ?? process.cwd()
    this.dataFile = path.resolve(cwd, options.dataFile ?? DEFAULT_DATA_FILE)
    this.stateFile = path.resolve(cwd, options.stateFile ?? DEFAULT_STATE_FILE)
  }

  async init() {
    await ensureFile(this.dataFile, '[]')
    await ensureFile(this.stateFile, '{}')
  }

  async upsertFoods(provider: string, foods: FoodRecord[]): Promise<void> {
    if (foods.length === 0) return

    const existing = await readJsonFile<FoodRecord[]>(this.dataFile, [])
    const merged = new Map(existing.map((record) => [record.id, record]))

    const timestamp = new Date().toISOString()

    for (const food of foods) {
      const current = merged.get(food.id) ?? null
      const next: FoodRecord = {
        ...current,
        ...food,
        provider,
        lastUpdated: food.lastUpdated ?? timestamp
      }
      merged.set(food.id, next)
    }

    await writeJsonFile(this.dataFile, Array.from(merged.values()))
  }

  async readSyncState(provider: string): Promise<SyncState | null> {
    const states = await readJsonFile<PersistedSyncStateMap>(this.stateFile, {})
    return states[provider] ?? null
  }

  async writeSyncState(state: SyncState): Promise<void> {
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
}

export function createJsonDatabaseAdapter(
  options: JsonDatabaseAdapterOptions = {}
): LocalDatabaseAdapter {
  return new JsonDatabaseAdapter(options)
}
