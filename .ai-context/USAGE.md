# AI Collaboration Guidelines

## Project Principles
- TypeScript-first, ESM codebase. Ensure CommonJS entry points remain via Rollup build.
- Domain model is defined via `FoodRecord`/`NutrientRecord` in `src/sync/ports.ts`; treat generated FDC types as external DTOs.
- Package must remain database-agnostic. Introduce new persistence layers via the adapter interfaces under `src/sync`.
- Local-first persistence currently uses the sharded JSON adapter (`database/fdc`). Avoid touching shard files manually; rely on the adapter helpers.

## Development Workflow
- Feature work should originate from dedicated branches. Keep commits scoped and descriptive.
- Prefer incremental pull requests that preserve backward compatibility of published exports.
- Update `.ai-context` docs when architecture decisions or workflows change.
- Run `npm run test` (Vitest) before raising PRs; use `BUILD_MINIFY=false npm run build` to avoid terser/Node 24 flakiness while we investigate.
- Do not commit `.context/` contents; use it only for scratch notes.

## Testing Strategy
- Adopt outside-in TDD using Vitest + MSW. Start with consumer-facing API expectations (CLI or public functions) before drilling into adapters.
- Provide request/response fixtures under `tests/fixtures`. Keep mocked network interactions consistent with USDA FDC schema.

## CLI Expectations
- All CLI entry points live under `src/cli` and leverage `@stricli/core` for command composition.
- Available commands: `sync init`, `sync run`, `sync status`, `search`. All accept `--dataDir` to target custom shard roots.
- Sync defaults to the FDC adapter and sharded JSON persistence; background refresh hooks are still TODO.
- `dist/cli/index.js` is shipped with a shebang; npm bin is `food-ingredients`.

## Sync Architecture
- Orchestrators coordinate `DataSourceAdapter` (third-party fetch) and `LocalDatabaseAdapter` (persistence).
- Each third-party integration lives in `src/sync/adapters/<provider>` and must export a factory returning the shared adapter interface.
- JSON shard adapter (`src/sync/adapters/jsonShardedDatabaseAdapter.ts`) is the preferred local store; keep any new persistence logic behind the interface.
- Shard files should remain small (<500 items). Adjust `shardSize` via adapter options if needed.
- Sync state is stored per-provider in `database/fdc/sync-state.json`; always write via adapter methods to keep timestamps/counters consistent.

## Local Data Layout
- `database/fdc/index.json` — array of shard metadata (`shard`, `size`, timestamp).
- `database/fdc/shards/####.json` — canonical food entries matching FDC JSON structure (see Abalone example).
- `database/fdc/sync-state.json` — provider run metadata (`lastExternalId`, `totalImported`, `lastSyncedAt`).
- The repo includes the Abalone record as a minimal seed; treat shards as fixtures for integration tests.

## Release & Distribution
- Rollup config should emit ESM + CJS bundles. Validate type declarations with `rollup-plugin-dts` before release.
- Keep exports curated via `src/index.ts`. Public surface API changes require a `CHANGELOG` entry.
