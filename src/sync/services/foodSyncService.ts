import {
  DataSourceAdapter,
  FoodSyncDependencies,
  FoodSyncOptions,
  FoodSyncResult,
  LocalDatabaseAdapter,
  SyncRequest,
  SyncState
} from '../ports'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function ensureDependencies(database: LocalDatabaseAdapter) {
  await database.init()
}

function createRequest(pageSize: number, state: SyncState | null): SyncRequest {
  return {
    pageSize,
    cursor: state?.cursor,
    lastExternalId: state?.lastExternalId
  }
}

export async function runFoodSync(
  { dataSource, database }: FoodSyncDependencies,
  options: FoodSyncOptions = {}
): Promise<FoodSyncResult> {
  const { pageSize = 200, throttleMs = 0, logger = console } = options

  await ensureDependencies(database)

  const provider = dataSource.provider
  let state = await database.readSyncState(provider)
  let totalImportedDuringRun = 0
  let keepSyncing = true

  while (keepSyncing) {
    const request = createRequest(pageSize, state)
    const batch = await dataSource.fetchBatch(request)

    if (batch.foods.length > 0) {
      await database.upsertFoods(provider, batch.foods)
      totalImportedDuringRun += batch.foods.length
      logger.log(
        `[sync:${provider}] Imported ${batch.foods.length} foods (run total ${totalImportedDuringRun})`
      )
    } else {
      logger.log(`[sync:${provider}] No new foods in this batch`)
    }

    const previousTotal = state?.totalImported ?? 0
    const nextState: SyncState = {
      provider,
      cursor: batch.cursor,
      lastExternalId: batch.lastExternalId ?? state?.lastExternalId,
      lastSyncedAt: new Date().toISOString(),
      totalImported: previousTotal + totalImportedDuringRun
    }

    await database.writeSyncState(nextState)
    state = nextState

    if (!batch.hasMore || !batch.cursor) {
      keepSyncing = false
    } else if (throttleMs > 0) {
      await delay(throttleMs)
    }
  }

  return {
    provider,
    totalImported: totalImportedDuringRun,
    lastExternalId: state?.lastExternalId,
    lastSyncedAt: state?.lastSyncedAt ?? new Date().toISOString()
  }
}

export async function syncFoodsWithDefaults(
  dataSource: DataSourceAdapter,
  database: LocalDatabaseAdapter,
  options?: FoodSyncOptions
) {
  return runFoodSync({ dataSource, database }, options)
}
