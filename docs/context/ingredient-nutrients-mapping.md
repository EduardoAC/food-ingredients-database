# Ingredient Nutrients Mapping

## Scope and sources

- Ingestion path: `src/sync/adapters/fdc/fdcAdapter.ts` maps FDC `AbridgedFoodNutrient` into `NutrientRecord`.
- Persistence path: `src/sync/adapters/jsonShardedDatabaseAdapter.ts` writes `foodNutrients` into `database/fdc/shards/*.json`.
- Read path: `src/local/foodsRepository.ts` normalizes `foodNutrients` when loading shards.
- No `FoodIngredientsService` usage found in this repo.
- The zip file `FoodData_Central_foundation_food_json_2025-12-18.zip` is not present in this workspace; the nutrient field list below is based on the current curated shard at `database/fdc/shards/0000.json`.

## Curated nutrient fields and units (current shard snapshot)

Curation stores nutrients as:

- `foodNutrients[]` with fields: `number` (string), `name`, `amount`, `unitName`.
- `amount` defaults to `0` and `unitName` defaults to `unit` when missing in the source.

Unique nutrient numbers/names/units observed in `database/fdc/shards/0000.json`:

| Nutrient number | Name                               | Unit |
| --------------- | ---------------------------------- | ---- |
| 203             | Protein                            | G    |
| 204             | Total lipid (fat)                  | G    |
| 205             | Carbohydrate, by difference        | G    |
| 208             | Energy                             | KCAL |
| 221             | Alcohol, ethyl                     | G    |
| 255             | Water                              | G    |
| 262             | Caffeine                           | MG   |
| 263             | Theobromine                        | MG   |
| 269             | Total Sugars                       | G    |
| 291             | Fiber, total dietary               | G    |
| 301             | Calcium, Ca                        | MG   |
| 303             | Iron, Fe                           | MG   |
| 304             | Magnesium, Mg                      | MG   |
| 305             | Phosphorus, P                      | MG   |
| 306             | Potassium, K                       | MG   |
| 307             | Sodium, Na                         | MG   |
| 309             | Zinc, Zn                           | MG   |
| 312             | Copper, Cu                         | MG   |
| 317             | Selenium, Se                       | UG   |
| 319             | Retinol                            | UG   |
| 320             | Vitamin A, RAE                     | UG   |
| 321             | Carotene, beta                     | UG   |
| 322             | Carotene, alpha                    | UG   |
| 323             | Vitamin E (alpha-tocopherol)       | MG   |
| 328             | Vitamin D (D2 + D3)                | UG   |
| 334             | Cryptoxanthin, beta                | UG   |
| 337             | Lycopene                           | UG   |
| 338             | Lutein + zeaxanthin                | UG   |
| 401             | Vitamin C, total ascorbic acid     | MG   |
| 404             | Thiamin                            | MG   |
| 405             | Riboflavin                         | MG   |
| 406             | Niacin                             | MG   |
| 415             | Vitamin B-6                        | MG   |
| 417             | Folate, total                      | UG   |
| 418             | Vitamin B-12                       | UG   |
| 421             | Choline, total                     | MG   |
| 430             | Vitamin K (phylloquinone)          | UG   |
| 431             | Folic acid                         | UG   |
| 432             | Folate, food                       | UG   |
| 435             | Folate, DFE                        | UG   |
| 573             | Vitamin E, added                   | MG   |
| 578             | Vitamin B-12, added                | UG   |
| 601             | Cholesterol                        | MG   |
| 606             | Fatty acids, total saturated       | G    |
| 607             | SFA 4:0                            | G    |
| 608             | SFA 6:0                            | G    |
| 609             | SFA 8:0                            | G    |
| 610             | SFA 10:0                           | G    |
| 611             | SFA 12:0                           | G    |
| 612             | SFA 14:0                           | G    |
| 613             | SFA 16:0                           | G    |
| 614             | SFA 18:0                           | G    |
| 617             | MUFA 18:1                          | G    |
| 618             | PUFA 18:2                          | G    |
| 619             | PUFA 18:3                          | G    |
| 620             | PUFA 20:4                          | G    |
| 621             | PUFA 22:6 n-3 (DHA)                | G    |
| 626             | MUFA 16:1                          | G    |
| 627             | PUFA 18:4                          | G    |
| 628             | MUFA 20:1                          | G    |
| 629             | PUFA 20:5 n-3 (EPA)                | G    |
| 630             | MUFA 22:1                          | G    |
| 631             | PUFA 22:5 n-3 (DPA)                | G    |
| 645             | Fatty acids, total monounsaturated | G    |
| 646             | Fatty acids, total polyunsaturated | G    |

## Canonical nutrient model

Core nutrients (mandatory) map to FDC nutrient numbers:

| Core field    | FDC nutrient number | FDC name                     | Expected unit |
| ------------- | ------------------- | ---------------------------- | ------------- |
| caloriesKcal  | 208                 | Energy                       | KCAL          |
| proteinG      | 203                 | Protein                      | G             |
| carbsG        | 205                 | Carbohydrate, by difference  | G             |
| fatG          | 204                 | Total lipid (fat)            | G             |
| fibreG        | 291                 | Fiber, total dietary         | G             |
| sugarsG       | 269                 | Total Sugars                 | G             |
| saturatedFatG | 606                 | Fatty acids, total saturated | G             |
| sodiumMg      | 307                 | Sodium, Na                   | MG            |

Extensible nutrients map:

- Key by `number` when present (string form of FDC nutrient number).
- If `number` is missing, key by `name` instead; if `name` is missing, key as `unknown`.
- When building a map, if the same key appears more than once, the last entry wins.

Suggested canonical shape (app side):

```ts
type NutrientValue = {
  id: string
  number?: string
  name: string
  unitName: string
  value: number
}

type IngredientNutrients = {
  caloriesKcal: number | null
  proteinG: number | null
  carbsG: number | null
  fatG: number | null
  fibreG: number | null
  sugarsG: number | null
  saturatedFatG: number | null
  sodiumMg: number | null
  extraById: Record<string, NutrientValue>
}
```

## Per-100g basis and scaling rules

- Stored nutrient amounts are treated as per 100 g. The sync pipeline does not rescale values.
- To scale to a quantity in grams:

```txt
scaledValue = per100gValue * (grams / 100)
```

- Apply scaling to all nutrient values, including core nutrients and `extraById` entries.

## Unit conversion policy (kg, l, ml, g)

- g: use as-is.
- kg: `grams = kg * 1000`.
- ml: `grams = ml * density_g_per_ml`.
- l: `grams = l * 1000 * density_g_per_ml`.
- If density is unknown for volume inputs, do not guess; treat the conversion as unavailable and return nulls for scaled nutrients.

## Edge cases and missing values

- Missing nutrient entry: the nutrient is absent from `foodNutrients[]`; core fields should be `null` in the canonical model.
- Missing `amount` in source: curation stores `amount = 0`, so zeros can mean either true zero or missing data.
- Missing `unitName` in source: curation stores `unitName = unit`; preserve the unit string rather than converting.
- Missing nutrient number: curation uses `name` (or `unknown`) as the id; use that as the map key.
- Duplicate nutrient numbers: no dedupe happens during curation; if you build a map, last write wins.
