# Food Ingredients Database

An open-source TypeScript SDK + CLI that synchronises USDA FoodData Central (FDC) data into a local-first store for nutrition and meal-planning apps.

## Features
- **Local-first sharded store**: Foods are persisted under `database/fdc/` as small shard files suitable for Git.
- **Sync pipeline**: Fetch data from FDC via generated Orval client. Run via CLI (`sync run`) or programmatically (`syncFoods`).
- **Search helpers**: Load and query local shard data with nutrient filters.
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
```

All commands support `--dataDir /custom/path` for alternate storage locations.

### 3. Use It in Code
```ts
import { syncFoods, createFdcDataSourceAdapter, createJsonShardedDatabaseAdapter, searchLocalFoods } from 'food-ingredients-database'

async function refreshFoods() {
  const dataSource = createFdcDataSourceAdapter({ pageLimit: 1 })
  const database = createJsonShardedDatabaseAdapter({ baseDir: './database/fdc' })
  await syncFoods({ pageSize: 200, throttleMs: 0, logger: console, dataSource, database })
}

async function findProteinRichFoods() {
  const foods = await searchLocalFoods('abalone', { nutrientNumber: '203' })
  console.log(foods[0]?.foodNutrients)
}
```

### 4. Programmatic Access Helpers
- `loadLocalFoods(options)` – load all foods from shards.
- `findFoodByFdcId(fdcId, options)` – look up by numeric ID.
- `searchLocalFoods(query, { nutrientNumber, nutrientName, maxResults })` – text + nutrient filters.

### 5. Testing
```bash
npm run test
```
Vitest + MSW power outside-in tests covering sync service, local search, and CLI interactions.

## Directory Structure
```
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

## Development Notes
- Rollup builds ESM + CJS bundles plus a runnable CLI binary (`food-ingredients`).
- `BUILD_MINIFY=false npm run build` avoids terser issues during local builds.
- Keep shard size manageable (default 500 items) to minimise diff noise.

## Roadmap
- Additional data source adapters (OpenFoodFacts, etc.).
- Alternative persistence drivers (SQLite, mobile storage).
- Background refresh helpers and scheduling APIs.
- Publish pre-generated shard snapshots for bootstrapping.

## License
Apache 2.0

