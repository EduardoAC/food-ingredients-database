# Contributing

Thanks for your interest in improving the Food Ingredients Database! This guide covers the workflow, coding standards, and release process used in this repository.

## Prerequisites
- Node.js 20+ and npm 10+
- A USDA FoodData Central API key (store in `.env` as `API_KEY` when running syncs)
- An npm account with publish rights (used only when releasing)

## Local Setup
```bash
npm install
cp .env.example .env   # create this file with your API key if you want to run syncs
```

### Available Scripts
- `npm run lint` – ESLint across the repo
- `npm run test` – Vitest suite (outside-in, CLI, local store)
- `npm run build` – Rollup build (ESM, CJS, CLI bundles)
- `npm run size-limit` – checks the built bundle stays within the allowed budget
- `npm run release` – semantic-release (CI only)

> During local development prefer `BUILD_MINIFY=false npm run build` to avoid terser instability on Node 24.

## Branching & PRs
- Use feature branches cut from `main`.
- Follow [Conventional Commits](https://www.conventionalcommits.org/) so semantic-release can derive versions.
- Keep PRs focused; update docs/tests alongside code changes.

### Pull Request Checklist
1. `npm run lint`
2. `npm run test`
3. `BUILD_MINIFY=false npm run build`
4. `npm run size-limit`
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
