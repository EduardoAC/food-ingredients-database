# Meal Coverage Fixtures

This folder contains two distinct validation layers:

- **Source validation fixtures**: small synthetic files used by `tests/scripts/validateMealIngredientCoverage.test.ts` to exercise the developer-only raw source validator.
- **Database confidence fixtures**: the checked-in `meals.json` file plus the imported sharded database snapshot in `database/`. This is the canonical confidence artefact used by `tests/local/mealCoverageDatabase.test.ts`.

## Source provenance

- Meal source file used for the canonical fixture: `meals.json`
- Ingredient source file used to build the database snapshot: `ingredients(1).json`
- Source metadata date: `2026-01-04T00:00:00+00:00`
- Total meals: `31`
- Total imported foods: `46`

Tracked newly added ingredient ids:

- `ing_antelope_burger`
- `ing_bbq_meat_mix`
- `ing_nandos_chicken`
- `ing_vegan_rashers`
- `ing_lemon_pie`

The database confidence test also asserts that every imported food id is exercised by at least one meal, so there are no unused imported records in this snapshot.

## Canonical confidence fixture

The `database/` folder is the canonical confidence fixture. It mirrors the repository's real sharded local database shape:

- `index.json`
- `shards/*.json`
- `sync-state.json`

Raw `ingredients.json` is intentionally not checked in as the canonical confidence artefact. The confidence path is to validate the imported database representation through `loadLocalFoods({ baseDir })`, then use meals to prove the data works in real consumption scenarios.

## Refreshing the fixture

1. Run the developer-only source validator against the raw inputs:

   ```bash
   npm run validate:meal-coverage -- --meals /path/to/meals.json --ingredients /path/to/ingredients.json
   ```

2. Regenerate the imported database snapshot and refresh the canonical `meals.json` fixture:

   ```bash
   node ./scripts/build-meal-coverage-db-fixture.mjs \
     --ingredients /path/to/ingredients.json \
     --meals /path/to/meals.json \
     --output ./tests/fixtures/meal-coverage/database
   ```

3. Run the confidence tests:

   ```bash
   npm test -- tests/scripts/validateMealIngredientCoverage.test.ts
   npm test -- tests/local/mealCoverageDatabase.test.ts
   ```
