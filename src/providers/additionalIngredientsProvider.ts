import { createAdditionalIngredientsDataSourceAdapter } from '../sync/adapters/additionalIngredients/additionalIngredientsAdapter'
import { ADDITIONAL_INGREDIENTS_PROVIDER_ID } from '../sync/additionalIngredientsSource'
import type { FoodProvider } from './types'

export interface AdditionalIngredientsProviderOptions {
  sourcePath?: string
}

export const additionalIngredientsProvider: FoodProvider<AdditionalIngredientsProviderOptions> =
  {
    id: ADDITIONAL_INGREDIENTS_PROVIDER_ID,
    label: 'Tracked additional ingredients',
    description:
      'Repository-tracked meal coverage ingredients imported into the canonical local database.',
    createAdapter(options) {
      return createAdditionalIngredientsDataSourceAdapter({
        sourcePath: options?.sourcePath
      })
    }
  }
