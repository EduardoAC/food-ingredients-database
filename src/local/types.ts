import type { StoredFoodItem } from '../sync/adapters/jsonShardedDatabaseAdapter'

export type LocalFoodItem = StoredFoodItem

export interface LoadLocalFoodsOptions {
  baseDir?: string
}

export interface SearchLocalFoodsOptions extends LoadLocalFoodsOptions {
  nutrientNumber?: string
  nutrientName?: string
  maxResults?: number
}
