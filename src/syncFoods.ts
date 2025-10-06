import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createJsonShardedDatabaseAdapter,
  FoodSyncOptions,
  JsonShardedDatabaseAdapterOptions,
  LocalDatabaseAdapter,
  DataSourceAdapter,
  syncFoodsWithDefaults
} from './sync'
import {
  createDefaultProviderRegistry,
  ProviderRegistry
} from './providers'

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

export async function syncFoods(options: SyncFoodsOptions = {}) {
  const registry = options.providerRegistry ?? createDefaultProviderRegistry()
  const providerId = options.providerId ?? registry.getDefaultProviderId()

  const dataSource =
    options.dataSource ?? registry.createAdapter(providerId, options.providerOptions)

  const database = options.database ?? createJsonShardedDatabaseAdapter(options.databaseOptions)

  return syncFoodsWithDefaults(dataSource, database, {
    pageSize: options.pageSize ?? DEFAULT_PAGE_SIZE,
    throttleMs: options.throttleMs ?? DEFAULT_THROTTLE_MS,
    logger: options.logger ?? console
  })
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
