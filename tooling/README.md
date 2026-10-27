# Tooling Layer

Shared, per-tool configuration packages. **One source of truth per tool, owned by the app or package that needs it.**

- Runtime: **Bun** (>= 1.4.4, see `.bun-version`). Package manager: **pnpm** (`tooling/*` is part of the pnpm workspace).
- Tooling packages are `private: true` configuration packages — no runtime code, no app dependencies.

## Design

The tooling layer holds **only** configuration that is genuinely shared across the
repository. It covers the tools whose configuration is a **preset or a dictionary
set** that several consumers import or extend (eslint, prettier, typescript,
bun test, cspell).

Every other tool owns exactly **one** configuration file, and that file lives in
the repository root under the name the tool discovers it by convention
(`.shellcheckrc`, `knip.config.js`, `commitlint.config.js`, …). Wrapping a
single file in a workspace package would add a publish/resolve step without
adding any sharing: nothing imports it, and the tool reads it from the project
root anyway.

| Concern              | Owner                                                                                                                                                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint rules         | `tooling/eslint-config` → composed by each workspace's `eslint.config.*`                                                                                    |
| Prettier policy      | `tooling/prettier-config` → re-exported by each Prettier workspace's `prettier.config.js`; the `bun fmt` apps encode the same policy in `bunfig.toml [fmt]` |
| TypeScript presets   | `tooling/typescript-config` → `extends` in each `tsconfig.json`                                                                                             |
| Test preload         | `tooling/bun-test-config` → `bunfig.toml` (`[test] preload`)                                                                                                |
| Spelling dictionary  | `tooling/cspell-config` → root `pnpm lint:spelling` (`--config`)                                                                                            |
| Commit message rules | repository-root `commitlint.config.js` → husky `commit-msg` hook                                                                                            |
| Staged-file pipeline | repository-root `lint-staged.config.js` → husky `pre-commit` hook                                                                                           |
| Unused code analysis | repository-root `knip.config.js` → root `pnpm knip`                                                                                                         |
| Version drift        | repository-root `syncpack.config.js` → root `pnpm lint:deps`                                                                                                |
| CLI linters          | repository-root config file → root `lint:*` scripts                                                                                                         |

Everything that is _not_ shared lives with its owner: an app's framework
plugins, a package's `tsconfig` paths, a script's shell rules.

## Naming and ownership

All tooling packages use the repository's established `@abugida/*` scope. Every tool has exactly one owner; consumers depend on the package (JS modules) or reference the config file path (CLI configs consumed from root scripts).

| Package                     | Tool     | Consumed by                                       | Blocking gate               |
| --------------------------- | -------- | ------------------------------------------------- | --------------------------- |
| `tooling/typescript-config` | tsc      | `app/*`, `packages/*` (`extends`)                 | `pnpm typecheck`            |
| `tooling/eslint-config`     | eslint   | every workspace's `eslint.config.*`               | `pnpm lint`                 |
| `tooling/prettier-config`   | prettier | Prettier workspaces' `prettier.config.js`         | `pnpm format` / lint-staged |
| `tooling/bun-test-config`   | bun test | root + workspace `bunfig.toml` (`[test] preload`) | `pnpm test`                 |
| `tooling/cspell-config`     | cspell   | root `pnpm lint:spelling` (`--config`)            | yes                         |

### Repository-root tool configuration

These tools own exactly one configuration file. The file lives in the repository
root — the directory every root script runs from — and is discovered by the
tool itself, so the scripts need no `--config` flag and the result never
depends on the working directory.

| Config file             | Tool                 | Consumed by                               | Blocking gate      |
| ----------------------- | -------------------- | ----------------------------------------- | ------------------ |
| `.shellcheckrc`         | shellcheck           | `pnpm lint:shell` (`--rcfile`)            | yes                |
| `.hadolint.yaml`        | hadolint             | `pnpm lint:docker` (`-c`)                 | yes                |
| `.yamllint.yaml`        | yamllint             | `pnpm lint:yaml` (`-c`)                   | yes                |
| `.markdownlint.json`    | markdownlint         | `pnpm lint:markdown` (`-c`)               | yes                |
| `.ecrc.json`            | editorconfig-checker | `pnpm lint:editorconfig` (`-config`)      | yes                |
| `.gitleaks.toml`        | gitleaks             | `pnpm lint:secrets` (`--config`)          | yes                |
| `.dotenv-linter`        | dotenv-linter        | `pnpm lint:env` (policy + explicit flags) | yes                |
| `knip.config.js`        | knip                 | `pnpm knip`                               | advisory           |
| `syncpack.config.js`    | syncpack             | `pnpm lint:deps`                          | yes                |
| `lint-staged.config.js` | lint-staged          | husky `pre-commit` hook                   | husky `pre-commit` |
| `commitlint.config.js`  | commitlint           | husky `commit-msg` hook                   | husky `commit-msg` |

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

- **Prettier** — every Prettier workspace owns a `prettier.config.js` that re-exports the
  shared policy:

  ```js
  export { default } from '@abugida/prettier-config'
  ```

  The app workspaces `app/api` and `app/dashboard` are the exception: they format with
  `bun fmt`, bun's built-in formatter, and carry the same style policy in the `[fmt]`
  section of their `bunfig.toml` (`printWidth = 100`, `semi = false`, `singleQuote = true`;
  the remaining policy options are `bun fmt` defaults). The switch is byte-compatible —
  `bun fmt --check` and `prettier --check` agree on every file in both apps.

  The shared config resolves the Astro plugin to an absolute path, so the same
  config works from every workspace, from the repository root, and from
  lint-staged.

- **TypeScript** — `"extends": "@abugida/typescript-config/library.json"` (or
  `base.json` / `node.json`). Path options (`outDir`, `rootDir`, `include`)
  must stay in the consuming tsconfig — relative paths in a shared preset
  resolve against the preset file.

- **CLI configs** (cspell) — the root `package.json` script passes the config
  path explicitly, e.g. `cspell lint --config tooling/cspell-config/cspell.json`.
  The config is a dictionary set (two word lists), so it stays a package.

- **Root CLI configs** (shellcheck, hadolint, yamllint, markdownlint,
  editorconfig-checker, gitleaks, dotenv-linter) — the config file lives in the
  repository root and the root scripts pass it explicitly, e.g.
  `hadolint -c .hadolint.yaml`. The same file is picked up automatically when
  the tool is run without a config flag, so editors and ad-hoc invocations
  behave like CI.

- **Root JS configs** (knip, syncpack, lint-staged, commitlint) — the config
  file lives in the repository root under the name the tool discovers
  (`knip.config.js`, `syncpack.config.js`, `lint-staged.config.js`,
  `commitlint.config.js`). The root scripts and the husky hooks call the tools
  without a `--config` flag, so the file is always the one that is loaded.
  They are linted and formatted with the tooling layer's own ESLint and
  Prettier configs (`pnpm lint:tooling`, `pnpm format:root`).

## Commands

```
pnpm lint               # ESLint per workspace (turbo) + the tooling layer
pnpm format             # bun fmt (apps) + Prettier per workspace (turbo) + repo-level files + shfmt
pnpm format:check       # verify formatting without writing (bun fmt + Prettier + shfmt -d)
pnpm typecheck          # tsc per workspace (turbo)
pnpm test               # bun test per workspace (turbo) — no env exports needed
pnpm build              # tsc builds for packages, bundlers for apps

pnpm lint:tooling       # ESLint over the tooling layer + the root tool configs
pnpm format:root        # Prettier over repository-level files (docs, tooling, root configs)
pnpm format:check:root  # Prettier --check over repository-level files
pnpm format:shell       # shfmt over the tracked shell scripts
pnpm format:check:shell # shfmt -d over the tracked shell scripts

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

| Files                                                                     | Formatter                                               |
| ------------------------------------------------------------------------- | ------------------------------------------------------- |
| `app/api`, `app/dashboard` (JS/TS/TSX, JSON, CSS, MD, …)                  | `bun fmt` (policy in each app's `bunfig.toml [fmt]`)    |
| Everything else (JS/TS/TSX/JSX, JSON, CSS, HTML, GraphQL, YAML, Markdown) | Prettier (single policy from `tooling/prettier-config`) |
| Shell scripts                                                             | shfmt (`shfmt -w -i 2 -sr -ln bash`)                    |
| Everything else                                                           | `.editorconfig` (checked by editorconfig-checker)       |

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

**In the sandbox these are installed for you.** The [Devbox sandbox](../docs/development/devbox-sandbox.md) pins each of them (ADR-026), so `just sandbox-setup` provisions the whole list above and `just sandbox-doctor` verifies it. The manual install paths remain the fallback for hosts that do not use the sandbox.

`pnpm lint` / `format` / `typecheck` / `test` / `build` / `lint:spelling` / `lint:markdown` / `lint:deps` / `knip` need no system binaries beyond Node/pnpm/Bun.

There is no CI in this repository yet. When CI is added, the Devbox sandbox (`devbox.json` + `devbox.lock`) is the dependency list — it already covers every binary above, plus Bun, pnpm, Node and just.

## Adding a new shared tooling configuration

First decide where the configuration belongs:

- **A single file that no other tool imports** (shellcheck, hadolint,
  yamllint, markdownlint, editorconfig-checker, gitleaks, dotenv-linter,
  knip, syncpack, lint-staged, commitlint) → put it in the repository root,
  named exactly as the tool discovers it (`.shellcheckrc`, `knip.config.js`,
  …). No package, no workspace entry.
- **A preset or dictionary set that several consumers import or extend**
  (eslint, prettier, typescript, bun test, cspell) → create a
  `tooling/<tool>-config/` package.

For a tooling package:

1. Create `tooling/<tool>-config/` with the config file (and a `package.json` following the existing pattern — `@abugida/<tool>-config`, `private: true`).
2. Add `tooling/*` globs already cover the directory; run `pnpm install`.
3. Wire consumption: a workspace config that composes the package, or a root script referencing the config path.
4. Add the tool to the tables above and to the CI dependency list if it needs a system binary.
5. Keep framework-specific rules OUT of shared packages — framework extensions belong to the consuming workspace (`app/marketing` owns Astro ESLint plugins, `app/dashboard` owns `@tanstack/eslint-config`).

For a root-level config file:

1. Name the file exactly as the tool discovers it, and place it in the repository root.
2. Call the tool without a `--config` flag, so the discovered file is the one that is loaded.
3. Add the file to the "Repository-root tool configuration" table above.
4. If the tool needs a system binary, add it to the system-binary table below.
5. Lint and format it with the tooling layer's configs: add it to the `lint:tooling` and `format:root` scripts.

## Tool-specific exceptions

- **typescript-config**: `library.json` intentionally does not enable `allowImportingTsExtensions`; libraries emit JS+declarations via `tsc`, and that flag is only legal with `noEmit`/`emitDeclarationOnly` (the previously-identified conflict). Declaration-only consumers must set `emitDeclarationOnly` explicitly. `node.json` turns the declaration emit off, because a project that does not emit must not declare types either.
- **eslint-config**: the base config is non-type-aware (it backs lint-staged across all workspaces). Type-aware workspaces add `typescriptProject(...)` blocks with their own `tsconfigRootDir`. `sharedRulesConfig({ plugin: false })` is used by workspaces whose framework preset already registers the `@typescript-eslint` plugin — flat config rejects a plugin that is redefined with a different instance.
- **prettier-config**: the Astro plugin is resolved with `require.resolve` to an absolute path, so the config behaves identically no matter which directory consumes it.
- **bun-test-config**: the preload provides deterministic env fallbacks (`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `DATABASE_URL`) only when unset. Turbo strips undeclared env vars from task processes (no `globalEnv` in `turbo.json`), which is why `pnpm test` previously failed for `@abugida/api` when run through turbo while direct `bun test` passed.
- **markdownlint** (`.markdownlint.json`): `.agents/**` vendored skill docs are excluded.
- **gitleaks** (`.gitleaks.toml`): `[extend] useDefault = true` is required — a custom config without it silently _replaces_ the rule set and scans nothing. The allowlist covers committed `.env.example` placeholders (ADR-006 dev-only defaults), test fixtures, and API doc examples; every entry is individually justified inline.
- **dotenv-linter** (`.dotenv-linter`): dotenv-linter 3.x discovers its config via CWD walk-up, so the file lives in the repository root and `lint:env` additionally passes the skips as explicit flags — the result is identical either way. Only `.env.example` files are ever scanned — real `.env` files (actual secrets) are never passed to the linter.
- **editorconfig-checker** (`.ecrc.json`): v4 takes regular expressions in `Exclude` (not globs) and a boolean map in `Disable`. Generated migrations (`packages/database/drizzle/**`) are excluded like other generated code.
- **knip** (`knip.config.js`): the app modules, the dashboard features and the published packages export their public surface by design, so the `exports`/`types` issue types are not reported for them. Intentional API aliases are excluded from the `duplicates` report.
- **lint-staged** (`lint-staged.config.js`): the workspace list is discovered from the filesystem, so a new workspace is covered by the pre-commit hook without touching the file.
- **commitlint** (`commitlint.config.js`): `body-max-line-length` / `footer-max-line-length` stay disabled because generated PR/issue footers legitimately exceed 100 characters. `@commitlint/config-conventional` and `@commitlint/types` are direct dependencies of the root package so the `extends` resolution and the type annotation resolve next to the config file.
- **syncpack** (`syncpack.config.js`): the repo-wide `versionGroups` entry ignores `peer` ranges, because peers intentionally declare flexible ranges. Without it, syncpack reports every peer range as drift.

## Known limitations

- `pnpm knip` (advisory): unused _exports_ are not reported for the app and
  package sources (see the exception above); the remaining checks (unused
  files, dependencies, unlisted dependencies) are clean.
- husky `pre-commit` runs `lint-staged --concurrent false`: parallel prettier/eslint over the whole staged set OOM-killed the hook in memory-constrained environments.
