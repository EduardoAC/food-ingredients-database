import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createJsonShardedDatabaseAdapter,
  FoodSyncResult,
  FoodSyncOptions,
  JsonShardedDatabaseAdapterOptions,
  LocalDatabaseAdapter,
  DataSourceAdapter,
  syncFoodsWithDefaults
} from './sync'
import { createDefaultProviderRegistry, ProviderRegistry } from './providers'

const DEFAULT_PAGE_SIZE = 200
const DEFAULT_THROTTLE_MS = 1500

export interface SyncFoodsOptions extends FoodSyncOptions {
  providerId?: string
  providerOptions?: unknown
  providerRegistry?: ProviderRegistry
  dataSource?: DataSourceAdapter
  database?: LocalDatabaseAdapter
  databaseOptions?: JsonShardedDatabaseAdapterOptions
}

function summariseRuns(runs: FoodSyncResult[]) {
  return {
    runs,
    totalImported: runs.reduce((total, run) => total + run.totalImported, 0)
  }
}

export async function syncFoods(options: SyncFoodsOptions = {}) {
  const registry = options.providerRegistry ?? createDefaultProviderRegistry()
  const database =
    options.database ??
    createJsonShardedDatabaseAdapter(options.databaseOptions)
  const dataSources = options.dataSource
    ? [options.dataSource]
    : options.providerId
      ? [registry.createAdapter(options.providerId, options.providerOptions)]
      : registry
          .list()
          .map((provider) =>
            registry.createAdapter(provider.id, options.providerOptions)
          )

  const runs: FoodSyncResult[] = []

  for (const dataSource of dataSources) {
    const run = await syncFoodsWithDefaults(dataSource, database, {
      pageSize: options.pageSize ?? DEFAULT_PAGE_SIZE,
      throttleMs: options.throttleMs ?? DEFAULT_THROTTLE_MS,
      logger: options.logger ?? console
    })
    runs.push(run)
  }

  return summariseRuns(runs)
}

function isExecutedDirectly() {
  if (typeof process === 'undefined' || !process.argv?.[1]) {
    return false
  }

  const currentFile = fileURLToPath(import.meta.url)
  const entryFile = path.resolve(process.argv[1])
  return currentFile === entryFile
}

if (isExecutedDirectly()) {
  syncFoods().catch((error) => {
    console.error('[sync] Failed to synchronize foods', error)
    process.exitCode = 1
  })
}
