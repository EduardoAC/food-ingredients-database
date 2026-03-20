export * from './types'
export * from './registry'
export * from './fdcProvider'

import { ProviderRegistry } from './registry'
import { additionalIngredientsProvider } from './additionalIngredientsProvider'
import { fdcProvider } from './fdcProvider'

export function createDefaultProviderRegistry() {
  return new ProviderRegistry([fdcProvider, additionalIngredientsProvider])
}
