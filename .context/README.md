# Internal Context (Ignored)

These notes capture working thoughts for ongoing architecture changes. Do not commit.

## Snapshot (2025-10-06)

### Architecture & Domain

- **Sharded storage**: `createJsonShardedDatabaseAdapter` replaced the original flat JSON writer. Invoking `adapter.init()` prepares:
  - `database/fdc/index.json` – records shard filenames + counts.
  - `database/fdc/shards/####.json` – each shard is ≤500 foods; content matches FDC schema (see Abalone seed).
  - `database/fdc/sync-state.json` – provider state (`lastExternalId`, `totalImported`, `lastSyncedAt`).
    To reproduce: instantiate the adapter with `{ baseDir: '/desired/path', shardSize?: number }`, call `init()`, then `upsertFoods(provider, foods)`.
- **Canonical IDs**: Shard entries now store `id`, `provider`, and optional `externalId` instead of raw `fdcId`. Consumer APIs use `findFoodById('provider:external')`, keeping third-party identifiers internal.
- **Domain typing**: `FoodRecord`/`NutrientRecord` in `src/sync/ports.ts` now include nutrient `number`, `foodCode`, `brandOwner`, `publicationDate`. When adding new providers ensure adapters populate these fields.
- **Local API**: `src/local/foodsRepository.ts` exposes `loadLocalFoods`, `findFoodById`, `findFoodByExternalId`, `searchLocalFoods`. All accept `{ baseDir }` so tests/consumers can point to temp dirs.

### Sync & Adapters

- `syncFoods.ts` now consumes a `ProviderRegistry`. By default `createDefaultProviderRegistry()` registers the `fdc` provider and is used whenever `syncFoods()` or the CLI is invoked with no override. Provide `providerId`, `providerOptions`, `providerRegistry`, `dataSource`, or `database` to customise behaviour.
- `ProviderRegistry` lives in `src/providers/registry.ts`; providers implement `FoodProvider` (`id`, `label`, `createAdapter`). Additional providers should register themselves via `register()` or provide custom registries.
- Exports: `src/index.ts` re-exports provider utilities, adapters, sync services, CLI runner, and local helpers. Any new surface area should be funnelled through this barrel to keep bundle outputs aligned.
- To simulate incremental sync locally: delete `database/fdc`, ensure `.env` has `API_KEY`, run `BUILD_MINIFY=false npm run build`, then execute `node dist/syncFoods.esm.js` (optional `--provider` via CLI or `syncFoods({ providerId })` in code).

### CLI Surface (Stricli)

- Commands (all under `food-ingredients` binary):
  1. `sync init [--dataDir path] [--stateFile name]` – prepares shard/index/state files.
  2. `sync run [--pageSize N] [--pageLimit N] [--throttleMs N] [--dataDir path] [--stateFile name] [--provider id]` – executes sync.
  3. `sync status [--json] [--dataDir path] [--stateFile name]` – prints state summary.
  4. `search [--query text] [--nutrientNumber id] [--nutrientName text] [--limit N] [--all] [--json] [--dataDir path]` – searches shards (`--all` bypasses limit).
- CLI tests (`tests/cli/sync.test.ts`) demonstrate the exact invocation order to seed a fresh temp dir. Follow that pattern to reproduce behaviour or add new command tests.
- Build pipeline includes CLI bundle (`rollup.config.ts` third config). `bin` entry in `package.json` points to `dist/cli/index.js`.

### Testing & Verification

- Commands run during development:
  - `npm run test` – runs Vitest suite.
  - `BUILD_MINIFY=false npm run build` – rollup build without terser, avoiding Node 24 deadlock.
- Test coverage currently includes:
  - Outside-in sync (uses MSW stub) ensuring sharded adapter writes expected structure.
  - CLI integration verifying init/run/status/search interplay + log outputs.
  - Local repository functions verifying Abalone shard seed.
- To add new fixtures: place JSON under `tests/msw/handlers` or add new shards under `database/fdc/shards`. Keep shard counts small for diff sanity.

### Documentation & Knowledge Base

- `README.md` provides consumer-focused instructions (installation, CLI, code samples, roadmap). Keep in sync with CLI changes.
- `.ai-context/USAGE.md` describes expectations for collaborators (branching, commands, layout). Update when adding major subsystems.
- This `.context/README.md` should detail **what** changed, **why**, and **how to recreate**. When delivering new features, append sections covering steps taken (commands run, files touched, test strategy) so future agents can follow the trail.
- Internal build commands/reminders:
  - `npm run test:coverage` + `npm run build` + `npm run check:bundle` prior to releases.
  - Build output is minified by default (Rollup + terser).
  - Keep shard size ≤500 items (adapter default) to minimise Git diffs.
- Husky pre-commit hook runs `lint-staged` (prettier + eslint + vitest related) and `npm run typecheck` to keep commits clean.
- CI now runs `npm run test:coverage`, `npm run build`, and bundle checks via custom script; coverage artifacts are uploaded for every workflow run.

## Publishing Prep Checklist

1. Ensure README highlights consumer usage only; internal recipes live here.
2. Run `npm run test` and `BUILD_MINIFY=false npm run build`.
3. Verify `dist/` outputs contain ESM, CJS, and CLI bundles; confirm bin entry (`food-ingredients`) works via `node dist/cli/index.js --help`.
4. Update version & changelog (pending release automation setup).
5. Publish with `npm publish --access public` once artifacts are validated and API keys removed from environment.

## Open follow-ups / Ideas

- Add additional `DataSourceAdapter`s (OpenFoodFacts, branded datasets) and persistence drivers (SQLite/AsyncStorage) once interfaces stabilise.
- Provide a pre-generated shard bundle (or fixture-driven generator) for quick bootstrap / CI verification.
- Investigate background refresh helpers (scheduling hooks) for CLI/API parity.
- Resolve terser incompatibility with Node 24 or pin a known-good version.

Remember not to store secrets here; use secure vaults.
