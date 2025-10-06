import { createFdcDataSourceAdapter } from '../sync'
import type { FoodProvider } from './types'

export interface FdcProviderOptions {
  pageLimit?: number
}

export const fdcProvider: FoodProvider<FdcProviderOptions> = {
  id: 'fdc',
  label: 'USDA FoodData Central',
  description:
    'US Department of Agriculture FoodData Central. Requires API key via process.env.API_KEY.',
  createAdapter(options) {
    return createFdcDataSourceAdapter({
      pageLimit: options?.pageLimit
    })
  }
}
