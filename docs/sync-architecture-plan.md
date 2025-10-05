# Sync & Local-First Architecture Plan

## Current Observations
- `src/syncFoods.ts` talks directly to the USDA FDC API and writes raw JSON to `database/foods.json` without abstractions.
- No persistence metadata exists, which prevents incremental syncs or conflict handling.
- Consumers importing `syncFoods` would trigger a sync immediately, which is surprising behaviour for a library.
- Testing setup is missing; there is no Vitest/MSW harness to validate consumer flows.

## Target Vision
- Local-first data layer with pluggable persistence drivers (JSON, SQLite, eventually platform-specific stores).
- Sync orchestrator decoupled from third-party APIs through adapter interfaces.
- CLI powered by [`stricli`](https://bloomberg.github.io/stricli/) to manage interactive/manual syncs.
- Outside-in test suite using Vitest + MSW to lock down user-facing APIs and CLI flows.

## Architecture Outline
1. **Ports & Adapters**
   - `DataSourceAdapter`: wraps third-party providers (FDC, OpenFoodFacts, etc.).
   - `LocalDatabaseAdapter`: hides persistence (JSON files, SQLite, AsyncStorage).
   - `FoodSyncService`: orchestrates sync cycles, progress reporting, throttling, and state persistence.
2. **Domain Model**
   - Canonical `FoodRecord` and `NutrientRecord` objects that normalise provider payloads.
   - Sync state persisted per provider, supporting resumable/background refreshes.
3. **CLI Surface**
   - `src/cli` namespace exports `stricli` commands for init (`sync:init`), manual `sync:run`, and background refresh scheduling hooks.
4. **Packaging**
   - ESM-first TypeScript sources compiled to ESM + CJS bundles via Rollup.
   - Generate `.d.ts` bundles with `rollup-plugin-dts` and expose curated exports through `src/index.ts`.

## Action Plan
### Phase 1 – Foundations (in progress)
1. Introduce sync ports/adapters and migrate the existing USDA FDC integration to the pattern ✅.
2. Add JSON-backed persistence adapter with sync state tracking ✅.
3. Stop auto-running sync on import; provide explicit `syncFoods()` API with run guard (deferred to follow-up to avoid breaking change).
4. Document the architecture principles and branching strategy in `.ai-context` ✅.
5. Create `.context/` scratch space for future iteration notes ✅.

### Phase 2 – Tooling & Tests
1. Add Vitest + MSW dev dependencies, configure global test setup, and add first outside-in test covering `syncFoods()` happy path.
2. Provide fixtures under `tests/fixtures/fdc` for deterministic sync runs.
3. Wire CI script (`npm test`) to run Vitest and linting.

### Phase 3 – CLI Experience
1. Introduce `stricli` and scaffold `src/cli/index.ts` with `sync` commands (init, run, status, refresh-now).
2. Add configuration loader (respect `.env`, `sync.config.json`, CLI flags).
3. Support background refresh scheduling hooks for host apps (expose `scheduleSync` helper).

### Phase 4 – Expanded Data Sources & Persistence
1. Implement OpenFoodFacts and other provider adapters following the same contract.
2. Add SQLite-based persistence driver (Node + React Native via Expo SQLite) with migrations.
3. Provide in-memory adapter for testing and ephemeral use cases.

### Phase 5 – Developer Experience & Release
1. Generate type declarations via dedicated Rollup build step and ensure `exports` map is curated.
2. Write high-level README guides for React Native integration and CLI usage.
3. Establish semantic-release or Changesets for automated versioning once API stabilises.

## Testing Strategy
- Outside-in tests for public API/CLI flows using Vitest + MSW.
- Contract tests per adapter to assert transformation correctness against recorded fixtures.
- Smoke tests for persistence adapters (JSON, SQLite) to catch regression in merge/dedup logic.

