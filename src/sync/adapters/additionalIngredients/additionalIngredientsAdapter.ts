import {
  ADDITIONAL_INGREDIENTS_PROVIDER_ID,
  createAdditionalIngredientFoodRecords,
  loadValidatedAdditionalIngredientSource
} from '../../additionalIngredientsSource'
import type { DataSourceAdapter, SyncBatch, SyncRequest } from '../../ports'

export interface AdditionalIngredientsAdapterOptions {
  sourcePath?: string
}

export class AdditionalIngredientsDataSourceAdapter
  implements DataSourceAdapter
{
  readonly provider = ADDITIONAL_INGREDIENTS_PROVIDER_ID
  private readonly sourcePath?: string

  constructor(options: AdditionalIngredientsAdapterOptions = {}) {
    this.sourcePath = options.sourcePath
  }

  async fetchBatch(request: SyncRequest): Promise<SyncBatch> {
    const source = await loadValidatedAdditionalIngredientSource({
      sourcePath: this.sourcePath
    })

    if (request.lastExternalId === source.sourceHash) {
      return {
        foods: [],
        hasMore: false,
        lastExternalId: source.sourceHash
      }
    }

    return {
      foods: createAdditionalIngredientFoodRecords(
        source.validation.ingredientIndex.values()
      ),
      hasMore: false,
      lastExternalId: source.sourceHash
    }
  }
}

export function createAdditionalIngredientsDataSourceAdapter(
  options: AdditionalIngredientsAdapterOptions = {}
): DataSourceAdapter {
  return new AdditionalIngredientsDataSourceAdapter(options)
}
