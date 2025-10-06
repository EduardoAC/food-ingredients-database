export * from './types'
export * from './registry'
export * from './fdcProvider'

import { ProviderRegistry } from './registry'
import { fdcProvider } from './fdcProvider'

export function createDefaultProviderRegistry() {
  return new ProviderRegistry([fdcProvider])
}
