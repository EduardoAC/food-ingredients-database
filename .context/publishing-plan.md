# Publishing & Automation Setup (2025-10-06)

## Goals

- Establish release automation with semantic-release (semver compliant) and changelog management.
- Provide CI workflows for PR validation (lint/test/bundle size) and automated publishing to npm.
- Document contribution guidelines, release process, and tooling expectations.
- Configure Renovate for dependency maintenance.
- Ensure local developers (with `NPM_AUTH_TOKEN`) and GitHub Actions (via secrets) can publish.

## Task Breakdown

1. **Branch Setup**
   - Checkout `main`, create `chore/publishing-setup` ✅
2. **Tooling Dependencies**
   - Added semantic-release core + plugins, size-limit preset, vitest script updates ✅
3. **Configs & Scripts**
   - `.npmrc` uses `${NPM_AUTH_TOKEN}` ✅
   - `.releaserc.json`, `size-limit.config.cjs`, `CHANGELOG.md`, `CONTRIBUTING.md` ✅
4. **GitHub Workflows**
   - `ci.yml` (lint/test/build/size check) ✅
   - `release.yml` (semantic-release) ✅
5. **Renovate**
   - `.github/renovate.json` added ✅
6. **Documentation**
   - README stays consumer-focused; CONTRIBUTING explains workflow ✅
7. **Local tooling**
   - Added Husky pre-commit hook (lint-staged + typecheck) ✅
8. **Testing**
   - Completed: `npm run lint`, `npm run test:coverage`, `npm run build`, `npm run check:bundle`
9. **Release Prep**
   - Ensure secrets (`NPM_AUTH_TOKEN`) exist before enabling release workflow (follow-up).

## Outstanding Questions

- Determine target bundle size (initial cap 150 KB gzip?).
- Confirm Node version for workflows (use 20.x LTS?).
- Ensure secrets: `NPM_AUTH_TOKEN` (npm) and default `GITHUB_TOKEN` used by semantic-release.
