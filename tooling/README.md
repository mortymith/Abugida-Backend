# Tooling Layer

Shared, multi-consumer tool configuration packages. **One source of truth per tool: shared bases live here, single-consumer configs live at the repo root.**

- Runtime: **Bun** (>= 1.4.2, see `.bun-version`). Package manager: **pnpm** (`tooling/*` is part of the pnpm workspace).
- Tooling packages are `private: true` configuration packages — no runtime code, no app dependencies.

## Ownership rule

A tool configuration belongs in `tooling/` only when more than one workspace consumes it. Tools consumed from exactly one place (almost always the repo root — git hooks and repo-wide CLI scripts) live at the repo root instead of being wrapped in a single-consumer package:

| Config at root                                                        | Tool                 | Consumed by                       | Blocking gate               |
| --------------------------------------------------------------------- | -------------------- | --------------------------------- | --------------------------- |
| `commitlint.config.js`                                                | commitlint           | husky `commit-msg` hook           | yes                         |
| `cspell.json` + `.cspell/dictionaries/`                               | cspell               | `pnpm lint:spelling`              | yes                         |
| `knip.config.js`                                                      | knip                 | `pnpm knip`                       | advisory                    |
| `syncpack.config.js`                                                  | syncpack             | `pnpm lint:deps`                  | advisory                    |
| `.shellcheckrc`                                                       | shellcheck           | `pnpm lint:shell`                 | advisory                    |
| `.hadolint.yaml`                                                      | hadolint             | `pnpm lint:docker`                | yes                         |
| `.yamllint.yaml`                                                      | yamllint             | `pnpm lint:yaml`                  | yes                         |
| `.markdownlint.json`                                                  | markdownlint         | `pnpm lint:markdown`              | yes                         |
| `.ecrc.json`                                                          | editorconfig-checker | `pnpm lint:editorconfig`          | yes                         |
| `.gitleaks.toml`                                                      | gitleaks             | `pnpm lint:secrets`               | yes                         |
| `.dotenv-linter` (documented policy; flags passed by `pnpm lint:env`) | dotenv-linter        | `pnpm lint:env`                   | yes                         |
| `.lintstagedrc.json`                                                  | lint-staged          | husky `pre-commit` hook           | yes                         |
| `.prettierignore` + root `prettier.config.js` (re-export)             | prettier             | root lint-staged + config walk-up | `pnpm format` / lint-staged |
| `.editorconfig`                                                       | editorconfig         | editors + editorconfig-checker    | yes                         |

## Shared packages (`tooling/`)

| Package                     | Tool     | Consumed by                                                                                  | Blocking gate    |
| --------------------------- | -------- | -------------------------------------------------------------------------------------------- | ---------------- |
| `tooling/typescript-config` | tsc      | `app/api` (`extends` `base.json`), `packages/*` (`extends` `library.json`)                   | `pnpm typecheck` |
| `tooling/eslint-config`     | eslint   | root-less: `app/api` + `packages/*` import the base and their `typescriptProject(...)` block | `pnpm lint`      |
| `tooling/prettier-config`   | prettier | root `prettier.config.js` (serves all workspaces via config walk-up and lint-staged)         | lint-staged      |
| `tooling/bun-test-config`   | bun test | root + workspace `bunfig.toml` (`[test] preload`)                                            | `pnpm test`      |

Framework-specific ESLint configs stay in the owning workspace and intentionally do **not** consume the shared base: `app/marketing` owns the Astro plugins/parsers, `app/dashboard` owns `@tanstack/eslint-config`.

## How consumption works

- **typescript**: workspaces add `"@abugida/typescript-config": "workspace:*"` and use `"extends": "@abugida/typescript-config/library.json"` (or `base.json`). Path-based options (`outDir`, `rootDir`, `include`) stay in the consuming tsconfig — relative paths in a shared preset resolve against the preset file, not the consumer.
- **eslint**: workspaces add `"@abugida/eslint-config": "workspace:*"` and compose `import base, { typescriptProject } from '@abugida/eslint-config'`. The base is non-type-aware; type-aware workspaces add a `typescriptProject(...)` block with their own `tsconfigRootDir` (usually `import.meta.dirname`). The package re-exports `tseslint` so consumers never declare their own (drifting) copy — typescript-eslint is pinned here once.
- **prettier**: the root `prettier.config.js` is a thin re-export of `@abugida/prettier-config`. Workspaces do not carry their own prettier configs; prettier's config walk-up finds the root policy for every workspace.
- **bun test preload**: `bunfig.toml` (root and per-workspace) wires `preload = ["@abugida/bun-test-config/preload"]` via the package import.
- **CLI linters**: root `package.json` scripts pass the config path explicitly, e.g. `hadolint -c .hadolint.yaml`.

## Commands

```
pnpm lint               # ESLint per workspace (turbo, type-aware in apps/packages)
pnpm format             # Prettier per workspace (turbo) + shfmt on shell scripts
pnpm typecheck          # tsc per workspace (turbo)
pnpm test               # bun test per workspace (turbo) — no env exports needed
pnpm build              # tsc builds for packages, bundlers for apps

pnpm lint:spelling      # cspell over tracked Markdown          (blocking)
pnpm lint:docker        # hadolint over tracked Dockerfiles     (blocking)
pnpm lint:yaml          # yamllint over tracked YAML            (blocking)
pnpm lint:markdown      # markdownlint over tracked Markdown    (blocking)
pnpm lint:editorconfig  # editorconfig-checker over the repo    (blocking)
pnpm lint:env           # dotenv-linter over .env.example files (blocking)
pnpm lint:secrets       # gitleaks over full git history        (blocking)

pnpm lint:shell         # shellcheck over tracked shell scripts (advisory)
pnpm lint:deps          # syncpack version-drift report         (advisory)
pnpm knip               # knip unused files/dependencies/exports (advisory)
```

The developer fast path (only staged files) is `lint-staged` via the husky `pre-commit` hook; repository validation always uses the full-repo commands above. CI (`.github/workflows/ci.yml`) runs lint, typecheck, build, test and the npm-only gates (`lint:spelling`, `lint:markdown`, `lint:deps`) under Bun.

## Formatting ownership

| Files                                                   | Formatter                                               |
| ------------------------------------------------------- | ------------------------------------------------------- |
| JS/TS/TSX/JSX, JSON, CSS, HTML, GraphQL, YAML, Markdown | Prettier (single policy from `tooling/prettier-config`) |
| Shell scripts                                           | shfmt (`shfmt -w -i 2 -sr -ln bash`)                    |
| Everything else                                         | `.editorconfig` (checked by editorconfig-checker)       |

## System binaries

The infrastructure linters are system packages (no npm wrappers — the wrappers either don't exist or download binaries at runtime):

| Tool                 | Install                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| shellcheck           | `apt install shellcheck` / `brew install shellcheck` (v0.10+ tested)                                                                        |
| hadolint             | [github.com/hadolint/hadolint](https://github.com/hadolint/hadolint/releases) (v2.12 tested)                                                |
| yamllint             | `pip install yamllint` (v1.38 tested)                                                                                                       |
| gitleaks             | [github.com/gitleaks/gitleaks](https://github.com/gitleaks/gitleaks/releases) (v8.24 tested)                                                |
| dotenv-linter        | [github.com/dotenv-linter/dotenv-linter](https://github.com/dotenv-linter/dotenv-linter/releases) (v3.3 tested)                             |
| editorconfig-checker | [github.com/editorconfig-checker/editorconfig-checker](https://github.com/editorconfig-checker/editorconfig-checker/releases) (v4.0 tested) |
| shfmt                | [github.com/mvdan/sh](https://github.com/mvdan/sh/releases) (v3.11 tested)                                                                  |

`pnpm lint` / `format` / `typecheck` / `test` / `build` / `lint:spelling` / `lint:markdown` / `lint:deps` / `knip` need no system binaries beyond Node/pnpm/Bun.

## Adding a new shared tooling configuration

1. Ask first: is it consumed by **more than one** workspace? If not, put the config at the repo root instead of creating a `tooling/` package.
2. Create `tooling/<tool>-config/` with the config file (and a `package.json` following the existing pattern — `@abugida/<tool>-config`, `private: true`).
3. Add `tooling/*` globs already cover the directory; run `pnpm install`.
4. Wire consumption: consumers add the package to `devDependencies` (workspace `extends`/import) or the root script references the config path (CLI).
5. Add the tool to the tables above and to the CI dependency list if it needs a system binary.
6. Keep framework-specific rules OUT of shared packages — framework extensions belong to the consuming workspace (`app/marketing` owns Astro ESLint plugins, `app/dashboard` owns `@tanstack/eslint-config`).

## Tool-specific exceptions

- **typescript-config**: `library.json` intentionally does not enable `allowImportingTsExtensions`; libraries emit JS+declarations via `tsc`, and that flag is only legal with `noEmit`/`emitDeclarationOnly` (the previously-identified conflict). Declaration-only consumers must set `emitDeclarationOnly` explicitly.
- **eslint-config**: base config is non-type-aware (it is composed by every TS workspace). Type-aware workspaces add `typescriptProject(...)` blocks with their own `tsconfigRootDir`. The parser anchor (`tsconfigRootDir`) is set in the base config and replaced by type-aware blocks — typescript-eslint 8.69 refuses to infer when multiple candidate roots are visible in one process.
- **bun-test-config**: the preload provides deterministic env fallbacks (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`) only when unset. Turbo strips undeclared env vars from task processes (no `globalEnv` in `turbo.json`), which is why `pnpm test` previously failed for `@abugida/api` when run through turbo while direct `bun test` passed.
- **cspell** (root `cspell.json`): `app/dashboard/spec /` wireframes are excluded — they contain intentional UI truncations (shortened mockup labels) that are not fixable spelling.
- **markdownlint** (root `.markdownlint.json`): `.agents/**` vendored skill docs are excluded.
- **gitleaks** (root `.gitleaks.toml`): `[extend] useDefault = true` is required — a custom config without it silently _replaces_ the rule set and scans nothing. The allowlist covers committed `.env.example` placeholders (ADR-006 dev-only defaults), test fixtures, and API doc examples; every entry is individually justified inline.
- **dotenv-linter** (root `.dotenv-linter`): dotenv-linter 3.x only discovers its config via CWD walk-up, so `lint:env` passes the skips as explicit flags; `.dotenv-linter` is the canonical documented policy. Only `.env.example` files are ever scanned — real `.env` files (actual secrets) are never passed to the linter.

## Known limitations

- `pnpm lint:shell` (advisory): ~166 pre-existing shellcheck findings across the ops scripts (backup/restore/firewall) — mostly quoting idioms (`SC2086`, `SC2015`, `SC2317`). Fixing them touches production-critical scripts and should be its own reviewed PR.
- `pnpm knip` (advisory): 12 unused files + 13 unused dependencies reported (dashboard deps awaiting the open dashboard PR chain, plus a handful of unreferenced config/server-function files — all pre-existing on master). Triage + removal is follow-up work; unused-export triage (280+) likewise.
- `pnpm lint:deps` (advisory): syncpack reports the remaining runtime-range drift — `hono` (^4.6–^4.7 vs ^4.12.32 across packages), `react`/`react-dom`/`zod`/`dotenv` (pinned vs caret in dashboard/auth/tenant) and `@tanstack/react-*` in packages/auth. Runtime dependency bumps need their own verified PR. The types/tooling ranges were unified in this layer: `typescript` → 6.0.3 everywhere (verified by typecheck + build), `@types/bun` → ^1.4.2 (no more `latest`), `eslint` → ^10.8.1, and `typescript-eslint` pinned once in `tooling/eslint-config`.
- husky `pre-commit` runs `lint-staged --concurrent false`: parallel prettier/eslint over the whole staged set OOM-killed the hook in memory-constrained environments.
- Pre-existing master issues, out of scope for the tooling layer: `@abugida/dashboard` build fails (TanStack Start import-protection: client bundle imports a `.server.ts` module) and `@abugida/api` has failing tests (middleware barrel exports / auth module).
