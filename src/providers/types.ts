import type { DataSourceAdapter } from '../sync/ports'

export interface FoodProvider<TOptions = unknown> {
  readonly id: string
  readonly label: string
  readonly description?: string
  createAdapter(options?: TOptions): DataSourceAdapter
}

export type AnyFoodProvider = FoodProvider<unknown>

export type ProviderOptionsOf<TProvider> = TProvider extends FoodProvider<infer TOptions>
  ? TOptions
  : never
