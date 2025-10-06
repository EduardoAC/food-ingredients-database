# Contributing

Thanks for your interest in improving the Food Ingredients Database! This guide covers the workflow, coding standards, and release process used in this repository.

## Prerequisites
- Node.js version defined in [`.nvmrc`](./.nvmrc) (use `nvm use`)
- A USDA FoodData Central API key (store in `.env` as `API_KEY` when running syncs)
- An npm account with publish rights (used only when releasing)

## Local Setup
```bash
npm install
cp .env.example .env   # create this file with your API key if you want to run syncs
```

### Available Scripts
- `npm run lint` – ESLint across the repo
- `npm run test` – Vitest suite
- `npm run test:coverage` – Vitest with coverage reports (outputs to `coverage/`)
- `npm run build` – Rollup build (ESM, CJS bundles, minified)
- `npm run check:bundle` – verifies bundle size budget
- `npm run release` – semantic-release (CI only)

## Branching & PRs
- Use feature branches cut from `main`.
- Follow [Conventional Commits](https://www.conventionalcommits.org/) so semantic-release can derive versions.
- Keep PRs focused; update docs/tests alongside code changes.

### Pull Request Checklist
1. `npm run lint`
2. `npm run test:coverage`
3. `npm run build`
4. `npm run check:bundle`
5. Update README/CONTRIBUTING/CHANGELOG entries when relevant

GitHub Actions (`ci.yml`) runs the same checks on every PR.

## Release & Publishing
Releases are automated through [semantic-release](https://github.com/semantic-release/semantic-release):
- Commits merged into `main` trigger the release workflow (`release.yml`).
- Version, changelog, GitHub release notes, npm publish, and git tags are handled automatically.
- Releases rely on two secrets:
  - `NPM_AUTH_TOKEN` – npm token with `publish` permissions
  - `GITHUB_TOKEN` – provided automatically by GitHub Actions
- Locally, ensure you export `NPM_AUTH_TOKEN` (the root `.npmrc` resolves it at publish time).

## Dependency Updates
We use [Renovate](https://github.com/renovatebot/renovate) to keep dependencies fresh. Renovate PRs must pass CI and follow the same review workflow as other contributions.

## Need Help?
Open a discussion or issue on GitHub – we’re happy to help!
