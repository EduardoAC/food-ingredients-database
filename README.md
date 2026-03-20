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

- `loadLocalFoods(options)` – load all foods from shard files when present, otherwise fall back to the bundled snapshot.
- `findFoodById(id, options)` – look up by canonical identifier (e.g. `fdc:2706337`).
- `findFoodByExternalId(externalId, options)` – look up by third-party identifier (e.g. the raw FDC id `2706337`).
- `searchLocalFoods(query, { nutrientNumber, nutrientName, maxResults, includeAll })` – text + nutrient filters against the local shard files or bundled fallback (`includeAll` returns the entire result set).

### 6. Validation Model

Use two validation layers for ingredient coverage work:

- **Source validation**: contributor-facing guard while editing raw ingredient inputs. Run `npm run validate:meal-coverage -- --meals /path/to/meals.json --ingredients /path/to/ingredients.json` to verify raw ingredient ids, per-100g nutrient presence, and meal-source consistency before regenerating fixtures.
- **Database validation**: canonical CI confidence. The repository commits an imported sharded database snapshot under `tests/fixtures/meal-coverage/database/`, then validates it through `loadLocalFoods({ baseDir })`. Meals are the verification layer that proves the imported ingredients are usable in realistic consumption scenarios.

### 7. Worked Example

```ts
import fs from 'node:fs/promises'
import { loadLocalFoods } from 'food-ingredients-database'

const NUTRIENT_NUMBERS = {
  kcal: '208',
  proteinG: '203',
  carbsG: '205',
  fatG: '204',
  fiberG: '291',
  sugarG: '269',
  saturatedFatG: '606',
  sodiumMg: '307'
}

const TOLERANCES = {
  kcal: 1,
  proteinG: 0.5,
  carbsG: 0.5,
  fatG: 0.5,
  fiberG: 0.5,
  sugarG: 0.5,
  saturatedFatG: 0.5,
  sodiumMg: 5,
  saltG: 0.05
}

const foods = await loadLocalFoods({
  baseDir: './tests/fixtures/meal-coverage/database'
})
const mealsDocument = JSON.parse(
  await fs.readFile('./tests/fixtures/meal-coverage/meals.json', 'utf-8')
)

const foodsById = new Map(foods.map((food) => [food.id, food]))

function nutrientAmount(food, number) {
  return (
    food.foodNutrients.find((nutrient) => nutrient.number === number)?.amount ??
    0
  )
}

function computeMealNutrition(meal) {
  const totals = {
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatG: 0,
    fiberG: 0,
    sugarG: 0,
    saturatedFatG: 0,
    sodiumMg: 0
  }

  for (const ingredient of meal.ingredients) {
    const food = foodsById.get(ingredient.ingredientId)
    if (!food)
      throw new Error(`Missing imported food: ${ingredient.ingredientId}`)

    const factor = ingredient.amountG / 100
    totals.kcal += nutrientAmount(food, NUTRIENT_NUMBERS.kcal) * factor
    totals.proteinG += nutrientAmount(food, NUTRIENT_NUMBERS.proteinG) * factor
    totals.carbsG += nutrientAmount(food, NUTRIENT_NUMBERS.carbsG) * factor
    totals.fatG += nutrientAmount(food, NUTRIENT_NUMBERS.fatG) * factor
    totals.fiberG += nutrientAmount(food, NUTRIENT_NUMBERS.fiberG) * factor
    totals.sugarG += nutrientAmount(food, NUTRIENT_NUMBERS.sugarG) * factor
    totals.saturatedFatG +=
      nutrientAmount(food, NUTRIENT_NUMBERS.saturatedFatG) * factor
    totals.sodiumMg += nutrientAmount(food, NUTRIENT_NUMBERS.sodiumMg) * factor
  }

  return {
    ...totals,
    saltG: (totals.sodiumMg / 1000) * 2.5
  }
}

for (const meal of mealsDocument.meals) {
  const computed = computeMealNutrition(meal)
  for (const [field, tolerance] of Object.entries(TOLERANCES)) {
    const delta = Math.abs(meal.nutrition[field] - computed[field])
    if (delta > tolerance) {
      throw new Error(`${meal.id} exceeded ${field} tolerance: ${delta}`)
    }
  }
}
```

The integration test in `tests/local/mealCoverageDatabase.test.ts` is the canonical example of this pattern in the repository.

### 8. Developer Scripts

- `npm run lint`
- `npm run test`
- `npm run test:coverage`
- `npm run build`
- `npm run check:bundle`
- `npm run typecheck`
- `npm run validate:meal-coverage -- --meals /path/to/meals.json --ingredients /path/to/ingredients.json`
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
