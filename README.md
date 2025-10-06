# Food Ingredients Database

An open-source TypeScript SDK + CLI that synchronises USDA FoodData Central (FDC) data into a local-first store for nutrition and meal-planning apps.

## Features

- **Local-first sharded store**: Foods are persisted under `database/fdc/` as small shard files suitable for Git.
- **Sync pipeline**: Fetch data from FDC via generated Orval client. Run via CLI (`sync run`) or programmatically (`syncFoods`).
- **Search helpers**: Load and query local shard data with nutrient filters.
- **Pluggable providers**: Provider registry abstracts third-party APIs (default USDA FDC; more coming).
- **CLI tooling**: Sync, inspect sync status, and search without writing code.
- **Type-safe**: Strict TypeScript types covering domain, generated APIs, and CLI contracts.

## Installation

```bash
npm install food-ingredients-database
# or
pnpm add food-ingredients-database
```

## Quick Start

### 1. Configure API Key

Create a `.env` file with your USDA API key:

```dotenv
API_KEY=your_fdc_api_key
```

### 2. Sync via CLI

```bash
npx food-ingredients sync init
npx food-ingredients sync run --pageLimit 1 --throttleMs 0
npx food-ingredients sync status
npx food-ingredients search --query "abalone" --nutrientNumber 203
npx food-ingredients search --all --nutrientNumber 203
```

All commands support `--dataDir /custom/path` for alternate storage locations. Pass `--provider <id>` to target other integrations as they are added; `fdc` remains the default.

### 3. Use It in Code

```ts
import {
  syncFoods,
  createDefaultProviderRegistry,
  createJsonShardedDatabaseAdapter,
  searchLocalFoods
} from 'food-ingredients-database'

async function refreshFoods() {
  const registry = createDefaultProviderRegistry()
  const dataSource = registry.createAdapter('fdc', { pageLimit: 1 })
  const database = createJsonShardedDatabaseAdapter({
    baseDir: './database/fdc'
  })

  await syncFoods({
    providerId: 'fdc',
    providerOptions: { pageLimit: 1 },
    pageSize: 200,
    throttleMs: 0,
    logger: console,
    dataSource,
    database
  })
}

async function findProteinRichFoods() {
  const foods = await searchLocalFoods('abalone', { nutrientNumber: '203' })
  console.log(foods[0]?.foodNutrients)
}
```

### 4. Provider Registry Helpers

- `createDefaultProviderRegistry()` – returns registry seeded with `fdc`. Register additional providers (e.g., OpenFoodFacts) as they become available.
- `registry.createAdapter('fdc', { pageLimit: 1 })` – instantiate a provider-specific data source via the shared interface.

### 5. Programmatic Access Helpers

- `loadLocalFoods(options)` – load all foods from shards.
- `findFoodById(id, options)` – look up by canonical identifier (e.g. `fdc:2706337`).
- `findFoodByExternalId(externalId, options)` – look up by third-party identifier (e.g. the raw FDC id `2706337`).
- `searchLocalFoods(query, { nutrientNumber, nutrientName, maxResults, includeAll })` – text + nutrient filters (`includeAll` returns the entire result set).

### 6. Developer Scripts

- `npm run lint`
- `npm run test`
- `npm run test:coverage`
- `npm run build`
- `npm run check:bundle`
- `npm run typecheck`
- `npm run lint-staged -- --help`

## Directory Structure

```text
src/
  api/              // Orval-generated FDC client
  cli/              // Stricli-based CLI commands
  local/            // Local shard loaders and search utilities
  sync/             // Ports, adapters, and sync orchestration
  syncFoods.ts      // Default sync entry point (CLI-friendly)
database/fdc/
  index.json        // Shard index (tracked by git)
  shards/           // Per-shard food data (tracked)
  sync-state.json   // Per-provider sync metadata
```

## Roadmap

- Additional data source adapters (OpenFoodFacts, etc.).
- Alternative persistence drivers (SQLite, mobile storage).
- Background refresh helpers and scheduling APIs.
- Publish pre-generated shard snapshots for bootstrapping.

## Contributing

We welcome contributions! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for workflow details and release automation powered by semantic-release.

## License

Apache 2.0
