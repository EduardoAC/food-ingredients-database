import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createFdcDataSourceAdapter,
  createJsonDatabaseAdapter,
  FoodSyncOptions,
  syncFoodsWithDefaults
} from './sync'

const DEFAULT_PAGE_SIZE = 200
const DEFAULT_THROTTLE_MS = 1_500

export async function syncFoods(options: FoodSyncOptions = {}) {
  const dataSource = createFdcDataSourceAdapter()
  const database = createJsonDatabaseAdapter()

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
