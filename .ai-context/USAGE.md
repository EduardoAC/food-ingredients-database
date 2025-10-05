# AI Collaboration Guidelines

## Project Principles
- TypeScript-first, ESM codebase. Ensure CommonJS entry points remain via Rollup build.
- Domain model centers on `FoodItem` and `NutrientProfile` abstractions. Treat generated FDC types as external DTOs.
- Package must remain database-agnostic. Introduce new persistence layers via the adapter interfaces under `src/sync`.

## Development Workflow
- Feature work should originate from dedicated branches. Keep commits scoped and descriptive.
- Prefer incremental pull requests that preserve backward compatibility of published exports.
- Update `.ai-context` docs when architecture decisions or workflows change.

## Testing Strategy
- Adopt outside-in TDD using Vitest + MSW. Start with consumer-facing API expectations (CLI or public functions) before drilling into adapters.
- Provide request/response fixtures under `tests/fixtures`. Keep mocked network interactions consistent with USDA FDC schema.

## CLI Expectations
- All CLI entry points live under `src/cli` and leverage `stricli` for command composition.
- Sync commands must offer interactive prompts and background refresh options.

## Sync Architecture
- Orchestrators coordinate `DataSourceAdapter` (third-party fetch) and `LocalDatabaseAdapter` (persistence).
- Each third-party integration belongs in `src/sync/adapters/<provider>` and must export a factory returning the shared adapter interface.
- Do not access `fs` directly outside persistence adapters.

## Release & Distribution
- Rollup config should emit ESM + CJS bundles. Validate type declarations with `rollup-plugin-dts` before release.
- Keep exports curated via `src/index.ts`. Public surface API changes require a `CHANGELOG` entry.

