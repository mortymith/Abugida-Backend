# Tooling Layer

Shared, per-tool configuration packages. **One source of truth per tool, owned by the app or package that needs it.**

- Runtime: **Bun** (>= 1.4.2, see `.bun-version`). Package manager: **pnpm** (`tooling/*` is part of the pnpm workspace).
- Tooling packages are `private: true` configuration packages — no runtime code, no app dependencies.

## Design

The tooling layer holds **only** configuration that is genuinely shared across the
repository. There are no root-level tool configuration files:

| Concern              | Owner                                                                    |
| -------------------- | ------------------------------------------------------------------------ |
| ESLint rules         | `tooling/eslint-config` → composed by each workspace's `eslint.config.*` |
| Prettier policy      | `tooling/prettier-config` → re-exported by each `prettier.config.js`     |
| TypeScript presets   | `tooling/typescript-config` → `extends` in each `tsconfig.json`          |
| Commit message rules | `tooling/commitlint-config` → root `package.json#commitlint`             |
| Staged-file pipeline | `tooling/lint-staged-config` → husky `pre-commit` hook                   |
| Unused code analysis | `tooling/knip-config` → root `pnpm knip`                                 |
| Spelling             | `tooling/cspell-config` → root `pnpm lint:spelling`                      |
| CLI linters          | `tooling/<tool>-config` → root `lint:*` scripts                          |

Everything that is _not_ shared lives with its owner: an app's framework
plugins, a package's `tsconfig` paths, a script's shell rules.

## Naming and ownership

All tooling packages use the repository's established `@abugida/*` scope. Every tool has exactly one owning package; consumers depend on the package (JS modules) or reference the config file path (CLI configs consumed from root scripts).

| Package                               | Tool                 | Consumed by                                       | Blocking gate               |
| ------------------------------------- | -------------------- | ------------------------------------------------- | --------------------------- |
| `tooling/typescript-config`           | tsc                  | `app/*`, `packages/*` (`extends`)                 | `pnpm typecheck`            |
| `tooling/eslint-config`               | eslint               | every workspace's `eslint.config.*`               | `pnpm lint`                 |
| `tooling/prettier-config`             | prettier             | every workspace's `prettier.config.js`            | `pnpm format` / lint-staged |
| `tooling/bun-test-config`             | bun test             | root + workspace `bunfig.toml` (`[test] preload`) | `pnpm test`                 |
| `tooling/lint-staged-config`          | lint-staged          | husky `pre-commit` hook (`--config`)              | husky `pre-commit`          |
| `tooling/commitlint-config`           | commitlint           | root `package.json#commitlint`                    | husky `commit-msg`          |
| `tooling/cspell-config`               | cspell               | root `pnpm lint:spelling` (`--config`)            | yes                         |
| `tooling/knip-config`                 | knip                 | root `pnpm knip` (`--config`)                     | advisory                    |
| `tooling/shellcheck-config`           | shellcheck           | `pnpm lint:shell` (config path)                   | yes                         |
| `tooling/hadolint-config`             | hadolint             | `pnpm lint:docker` (config path)                  | yes                         |
| `tooling/yamllint-config`             | yamllint             | `pnpm lint:yaml` (config path)                    | yes                         |
| `tooling/markdownlint-config`         | markdownlint         | `pnpm lint:markdown` (config path)                | yes                         |
| `tooling/editorconfig-checker-config` | editorconfig-checker | `pnpm lint:editorconfig` (config path)            | yes                         |
| `tooling/gitleaks-config`             | gitleaks             | `pnpm lint:secrets` (config path)                 | yes                         |
| `tooling/dotenv-linter-config`        | dotenv-linter        | `pnpm lint:env` (policy + flags)                  | yes                         |
| `tooling/syncpack-config`             | syncpack             | `pnpm lint:deps` (config path)                    | yes                         |

## How consumption works

- **ESLint** — every workspace owns an `eslint.config.*` that composes the shared base:

  ```js
  import base, { typescriptProject } from '@abugida/eslint-config'

  export default [
    ...base,
    typescriptProject({
      files: ['src/**/*.ts'],
      project: './tsconfig.json',
      tsconfigRootDir: import.meta.dirname,
    }),
  ]
  ```

  Workspaces that build on a framework preset (`app/dashboard` with
  `@tanstack/eslint-config`) use `globalIgnores` + `sharedRulesConfig()` instead
  of the full base, and register the `@typescript-eslint` plugin only when the
  preset does not.

- **Prettier** — every workspace owns a `prettier.config.js` that re-exports the
  shared policy:

  ```js
  export { default } from '@abugida/prettier-config'
  ```

  The shared config resolves the Astro plugin to an absolute path, so the same
  config works from every workspace, from the repository root, and from
  lint-staged.

- **TypeScript** — `"extends": "@abugida/typescript-config/library.json"` (or
  `base.json` / `node.json`). Path options (`outDir`, `rootDir`, `include`)
  must stay in the consuming tsconfig — relative paths in a shared preset
  resolve against the preset file.

- **CLI configs** (shellcheck, hadolint, yamllint, markdownlint,
  editorconfig-checker, gitleaks, dotenv-linter, syncpack, cspell, knip) —
  the root `package.json` scripts pass the config path explicitly, e.g.
  `hadolint -c tooling/hadolint-config/.hadolint.yaml`.

## Commands

```
pnpm lint               # ESLint per workspace (turbo) + the tooling layer
pnpm format             # Prettier per workspace (turbo) + repo-level files + shfmt
pnpm typecheck          # tsc per workspace (turbo)
pnpm test               # bun test per workspace (turbo) — no env exports needed
pnpm build              # tsc builds for packages, bundlers for apps

pnpm lint:tooling       # ESLint over the tooling layer itself
pnpm format:root        # Prettier over repository-level files (docs, tooling)
pnpm format:shell       # shfmt over the tracked shell scripts

pnpm lint:spelling      # cspell over tracked Markdown          (blocking)
pnpm lint:docker        # hadolint over tracked Dockerfiles     (blocking)
pnpm lint:yaml          # yamllint over tracked YAML            (blocking)
pnpm lint:markdown      # markdownlint over tracked Markdown    (blocking)
pnpm lint:editorconfig  # editorconfig-checker over the repo    (blocking)
pnpm lint:env           # dotenv-linter over .env.example files (blocking)
pnpm lint:secrets       # gitleaks over full git history        (blocking)
pnpm lint:shell         # shellcheck over tracked shell scripts (blocking)

pnpm lint:deps          # syncpack version-drift report         (advisory)
pnpm knip               # knip unused files/dependencies/exports (advisory)
```

The developer fast path (only staged files) is `lint-staged` via the husky
`pre-commit` hook; repository validation always uses the full-repo commands
above.

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
3. Wire consumption: a workspace config that composes the package, or a root script referencing the config path.
4. Add the tool to the tables above and to the CI dependency list if it needs a system binary.
5. Keep framework-specific rules OUT of shared packages — framework extensions belong to the consuming workspace (`app/marketing` owns Astro ESLint plugins, `app/dashboard` owns `@tanstack/eslint-config`).

## Tool-specific exceptions

- **typescript-config**: `library.json` intentionally does not enable `allowImportingTsExtensions`; libraries emit JS+declarations via `tsc`, and that flag is only legal with `noEmit`/`emitDeclarationOnly` (the previously-identified conflict). Declaration-only consumers must set `emitDeclarationOnly` explicitly. `node.json` turns the declaration emit off, because a project that does not emit must not declare types either.
- **eslint-config**: the base config is non-type-aware (it backs lint-staged across all workspaces). Type-aware workspaces add `typescriptProject(...)` blocks with their own `tsconfigRootDir`. `sharedRulesConfig({ plugin: false })` is used by workspaces whose framework preset already registers the `@typescript-eslint` plugin — flat config rejects a plugin that is redefined with a different instance.
- **prettier-config**: the Astro plugin is resolved with `require.resolve` to an absolute path, so the config behaves identically no matter which directory consumes it.
- **bun-test-config**: the preload provides deterministic env fallbacks (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`) only when unset. Turbo strips undeclared env vars from task processes (no `globalEnv` in `turbo.json`), which is why `pnpm test` previously failed for `@abugida/api` when run through turbo while direct `bun test` passed.
- **cspell-config**: `app/dashboard/spec /` wireframes are excluded — they contain intentional UI truncations (shortened mockup labels) that are not fixable spelling.
- **markdownlint-config**: `.agents/**` vendored skill docs are excluded.
- **gitleaks-config**: `[extend] useDefault = true` is required — a custom config without it silently _replaces_ the rule set and scans nothing. The allowlist covers committed `.env.example` placeholders (ADR-006 dev-only defaults), test fixtures, and API doc examples; every entry is individually justified inline.
- **dotenv-linter-config**: dotenv-linter 3.x only discovers its config via CWD walk-up, so `lint:env` passes the skips as explicit flags; `.dotenv-linter` in the package is the canonical documented policy. Only `.env.example` files are ever scanned — real `.env` files (actual secrets) are never passed to the linter.
- **editorconfig-checker-config**: v4 takes regular expressions in `Exclude` (not globs) and a boolean map in `Disable`. Generated migrations (`packages/database/drizzle/**`) are excluded like other generated code.
- **knip-config**: the app modules, the dashboard features and the published packages export their public surface by design, so the `exports`/`types` issue types are not reported for them. Intentional API aliases are excluded from the `duplicates` report.
- **lint-staged-config**: the workspace list is discovered from the filesystem, so a new workspace is covered by the pre-commit hook without touching the file.

## Known limitations

- `pnpm knip` (advisory): unused _exports_ are not reported for the app and
  package sources (see the exception above); the remaining checks (unused
  files, dependencies, unlisted dependencies) are clean.
- husky `pre-commit` runs `lint-staged --concurrent false`: parallel prettier/eslint over the whole staged set OOM-killed the hook in memory-constrained environments.
