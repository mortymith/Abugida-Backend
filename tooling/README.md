# Tooling Layer

Shared, per-tool configuration packages. **One source of truth per tool, consumed consistently across the monorepo.**

- Runtime: **Bun** (>= 1.4.2, see `.bun-version`). Package manager: **pnpm** (`tooling/*` is part of the pnpm workspace).
- Tooling packages are `private: true` configuration packages — no runtime code, no app dependencies.

## Naming and ownership

All tooling packages use the repository's established `@abugida/*` scope. Every tool has exactly one owning package; consumers depend on the package (JS modules) or reference the config file path (CLI configs consumed from root scripts).

| Package                               | Tool                 | Consumed by                                               | Blocking gate               |
| ------------------------------------- | -------------------- | --------------------------------------------------------- | --------------------------- |
| `tooling/typescript-config`           | tsc                  | root `tsconfig.json`, `app/api`, `packages/*` (`extends`) | `pnpm typecheck`            |
| `tooling/eslint-config`               | eslint               | root `eslint.config.js`, `app/*`, `packages/*`            | `pnpm lint`                 |
| `tooling/prettier-config`             | prettier             | root `prettier.config.js` (serves all workspaces)         | `pnpm format` / lint-staged |
| `tooling/bun-test-config`             | bun test             | root + workspace `bunfig.toml` (`[test] preload`)         | `pnpm test`                 |
| `tooling/lint-staged-config`          | lint-staged          | root `lint-staged.config.js`                              | husky `pre-commit`          |
| `tooling/commitlint-config`           | commitlint           | root `commitlint.config.js`                               | husky `commit-msg`          |
| `tooling/cspell-config`               | cspell               | root `cspell.json` (`import`) + `pnpm lint:spelling`      | yes                         |
| `tooling/knip-config`                 | knip                 | root `knip.config.js` + `pnpm knip`                       | advisory                    |
| `tooling/shellcheck-config`           | shellcheck           | `pnpm lint:shell` (config path)                           | advisory                    |
| `tooling/hadolint-config`             | hadolint             | `pnpm lint:docker` (config path)                          | yes                         |
| `tooling/yamllint-config`             | yamllint             | `pnpm lint:yaml` (config path)                            | yes                         |
| `tooling/markdownlint-config`         | markdownlint         | `pnpm lint:markdown` (config path)                        | yes                         |
| `tooling/editorconfig-checker-config` | editorconfig-checker | `pnpm lint:editorconfig` (config path)                    | yes                         |
| `tooling/gitleaks-config`             | gitleaks             | `pnpm lint:secrets` (config path)                         | yes                         |
| `tooling/dotenv-linter-config`        | dotenv-linter        | `pnpm lint:env` (policy + flags)                          | yes                         |
| `tooling/syncpack-config`             | syncpack             | `pnpm lint:deps` (config path)                            | advisory                    |

"Advisory" tools run and exit non-zero on real findings that pre-date this layer (see Known limitations); they are verified working and their reports are actionable, but they are not merge-blocking yet.

## How consumption works

- **JS-module configs** (eslint, prettier, commitlint, lint-staged, knip): root config files are thin re-exports, e.g. `eslint.config.js` → `export { default } from '@abugida/eslint-config'`. Workspaces that need the package add `"@abugida/eslint-config": "workspace:*"` to `devDependencies`.
- **JSON presets** (typescript): `"extends": "@abugida/typescript-config/library.json"`. Note that _path-based_ options (`outDir`, `rootDir`, `include`) must stay in the consuming tsconfig — relative paths in a shared preset resolve against the preset file, not the consumer.
- **Config-file packages** (shellcheck, hadolint, yamllint, markdownlint, editorconfig-checker, gitleaks, dotenv-linter, syncpack): root `package.json` scripts pass the config path explicitly, e.g. `hadolint -c tooling/hadolint-config/.hadolint.yaml`. The CLI-config packages are also declared as root `devDependencies` for workspace identity and future tooling.

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

The developer fast path (only staged files) is `lint-staged` via the husky `pre-commit` hook; repository validation always uses the full-repo commands above.

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

There is no CI in this repository yet. When CI is added, the system binaries above are the documented dependency list; everything else is installed by `pnpm install`.

## Adding a new shared tooling configuration

1. Create `tooling/<tool>-config/` with the config file (and a `package.json` following the existing pattern — `@abugida/<tool>-config`, `private: true`).
2. Add `tooling/*` globs already cover the directory; run `pnpm install`.
3. Wire consumption: root thin config (JS) or root script referencing the config path (CLI).
4. Add the tool to the tables above and to the CI dependency list if it needs a system binary.
5. Keep framework-specific rules OUT of shared packages — framework extensions belong to the consuming workspace (`app/marketing` owns Astro ESLint plugins, `app/dashboard` owns `@tanstack/eslint-config`).

## Tool-specific exceptions

- **typescript-config**: `library.json` intentionally does not enable `allowImportingTsExtensions`; libraries emit JS+declarations via `tsc`, and that flag is only legal with `noEmit`/`emitDeclarationOnly` (the previously-identified conflict). Declaration-only consumers must set `emitDeclarationOnly` explicitly.
- **eslint-config**: base config is non-type-aware (it backs lint-staged across all workspaces). Type-aware workspaces add `typescriptProject(...)` blocks with their own `tsconfigRootDir`. The parser anchor (`tsconfigRootDir`) is set in every config that parses TS without a project — typescript-eslint 8.69 refuses to infer when multiple candidate roots are visible in one process.
- **bun-test-config**: the preload provides deterministic env fallbacks (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`) only when unset. Turbo strips undeclared env vars from task processes (no `globalEnv` in `turbo.json`), which is why `pnpm test` previously failed for `@abugida/api` when run through turbo while direct `bun test` passed.
- **cspell-config**: `app/dashboard/spec /` wireframes are excluded — they contain intentional UI truncations (shortened mockup labels) that are not fixable spelling.
- **markdownlint-config**: `.agents/**` vendored skill docs are excluded.
- **gitleaks-config**: `[extend] useDefault = true` is required — a custom config without it silently _replaces_ the rule set and scans nothing. The allowlist covers committed `.env.example` placeholders (ADR-006 dev-only defaults), test fixtures, and API doc examples; every entry is individually justified inline.
- **dotenv-linter-config**: dotenv-linter 3.x only discovers its config via CWD walk-up, so `lint:env` passes the skips as explicit flags; `.dotenv-linter` in the package is the canonical documented policy. Only `.env.example` files are ever scanned — real `.env` files (actual secrets) are never passed to the linter.

## Known limitations

- `pnpm lint:shell` (advisory): ~166 pre-existing shellcheck findings across the ops scripts (backup/restore/firewall) — mostly quoting idioms (`SC2086`, `SC2015`, `SC2317`). Fixing them touches production-critical scripts and should be its own reviewed PR.
- `pnpm knip` (advisory): 6 unused files + ~24 unused dependencies reported against master (dashboard deps awaiting the open dashboard PR chain, plus a handful of unreferenced config/server-function files). Triage + removal is follow-up work; unused-export triage (280+) likewise.
- `pnpm lint:deps` (advisory): syncpack reports real dev-range drift (`@types/bun`, `@types/node`, `hono`, `drizzle-orm`, TanStack packages). TypeScript is intentionally left per-workspace until each consumer is verified against ^6.0.3 (peer ceiling `<6.1.0`).
- husky `pre-commit` runs `lint-staged --concurrent false`: parallel prettier/eslint over the whole staged set OOM-killed the hook in memory-constrained environments.
