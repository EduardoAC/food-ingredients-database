export interface NutrientRecord {
  id: string
  name: string
  unitName: string
  value: number
}

export interface FoodRecord {
  id: string
  externalId: string
  provider: string
  name: string
  dataType?: string
  brandOwner?: string
  publicationDate?: string
  lastUpdated?: string
  nutrients: NutrientRecord[]
  tags?: string[]
}

export interface SyncCursor {
  page: number
}

export interface SyncState {
  provider: string
  lastExternalId?: string
  cursor?: SyncCursor
  lastSyncedAt?: string
  totalImported?: number
}

export interface SyncRequest {
  pageSize: number
  cursor?: SyncCursor
  lastExternalId?: string
}

export interface SyncBatch {
  foods: FoodRecord[]
  cursor?: SyncCursor
  hasMore: boolean
  lastExternalId?: string
}

export interface DataSourceAdapter {
  readonly provider: string
  fetchBatch(request: SyncRequest): Promise<SyncBatch>
}

export interface LocalDatabaseAdapter {
  init(): Promise<void>
  upsertFoods(provider: string, foods: FoodRecord[]): Promise<void>
  readSyncState(provider: string): Promise<SyncState | null>
  writeSyncState(state: SyncState): Promise<void>
}

export interface FoodSyncOptions {
  pageSize?: number
  throttleMs?: number
  logger?: Pick<Console, 'log' | 'error'>
}

export interface FoodSyncResult {
  provider: string
  totalImported: number
  lastExternalId?: string
  lastSyncedAt: string
}

export interface FoodSyncDependencies {
  dataSource: DataSourceAdapter
  database: LocalDatabaseAdapter
}
