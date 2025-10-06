import { AnyFoodProvider } from './types'

export class ProviderRegistry {
  private providers = new Map<string, AnyFoodProvider>()
  private defaultProviderId?: string

  constructor(initialProviders: AnyFoodProvider[] = []) {
    initialProviders.forEach((provider, index) => {
      this.register(provider)
      if (index === 0 && !this.defaultProviderId) {
        this.defaultProviderId = provider.id
      }
    })
  }

  register(provider: AnyFoodProvider) {
    if (this.providers.has(provider.id)) {
      throw new Error(`Provider with id "${provider.id}" already registered`)
    }
    this.providers.set(provider.id, provider)
    if (!this.defaultProviderId) {
      this.defaultProviderId = provider.id
    }
    return this
  }

  setDefaultProvider(id: string) {
    if (!this.providers.has(id)) {
      throw new Error(`Cannot set default provider to unknown id "${id}"`)
    }
    this.defaultProviderId = id
  }

  getDefaultProviderId() {
    if (!this.defaultProviderId) {
      throw new Error('Provider registry has no default provider')
    }
    return this.defaultProviderId
  }

  has(id: string) {
    return this.providers.has(id)
  }

  get(id: string) {
    const provider = this.providers.get(id)
    if (!provider) {
      const known = Array.from(this.providers.keys()).join(', ') || '<none>'
      throw new Error(`Unknown provider "${id}" (known: ${known})`)
    }
    return provider
  }

  list() {
    return Array.from(this.providers.values())
  }

  createAdapter(id: string, options?: unknown) {
    const provider = this.get(id)
    return provider.createAdapter(options)
  }
}
