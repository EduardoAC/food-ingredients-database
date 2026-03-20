# Meal Coverage Fixtures

This folder contains the proof-layer fixtures for meal coverage validation:

- **Source validation fixtures**: small synthetic files used by `tests/scripts/validateMealIngredientCoverage.test.ts` to exercise the developer-only raw source validator.
- **Meal proof fixture**: the checked-in `meals.json` file used by `tests/local/mealCoverageDatabase.test.ts` to prove that the canonical imported database works through the real loader APIs.

## Source provenance

- Meal source file used for the canonical fixture: `meals.json`
- Tracked ingredient source: `database/sources/additional-ingredients.json`
- Canonical imported database: `database/fdc/`
- Source metadata date: `2026-01-04T00:00:00+00:00`
- Total meals: `31`
- Total tracked meal-linked ingredient ids: `46`

Tracked newly added ingredient ids:

- `ing_antelope_burger`
- `ing_bbq_meat_mix`
- `ing_nandos_chicken`
- `ing_vegan_rashers`
- `ing_lemon_pie`

## Canonical confidence fixture

`meals.json` is the realistic proof layer only. The canonical confidence path is:

1. import `database/sources/additional-ingredients.json` through the normal sync flow,
2. write the merged dataset into `database/fdc`,
3. load `database/fdc` through `loadLocalFoods({ baseDir })`,
4. validate meal coverage and nutrition recomputation against `meals.json`.

## Refreshing the fixture

1. Run the developer-only source validator against the raw inputs:

   ```bash
   npm run validate:meal-coverage -- --meals /path/to/meals.json --ingredients /path/to/ingredients.json
   ```

2. Refresh the canonical database through the normal sync flow:

   ```bash
   npm run sync:foods -- --pageLimit 1 --throttleMs 0
   ```

3. Run the confidence tests:

   ```bash
   npm test -- tests/scripts/validateMealIngredientCoverage.test.ts
   npm test -- tests/local/mealCoverageDatabase.test.ts
   npm test -- tests/sync/additionalIngredientsImport.test.ts
   ```
