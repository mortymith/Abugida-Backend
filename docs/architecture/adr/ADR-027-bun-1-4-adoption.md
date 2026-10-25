# ADR-027: Bun 1.4.x upgrade — automatic runtime gains and adopted features

## Status

Accepted

## Context

The runtime was upgraded from Bun 1.4.2 to 1.4.4 (`.bun-version`, `devbox.json`, `engines`/`devEngines`, the three `app/*` images — tag and digest together per ADR-002). Bun 1.4.3 (2026-10-10) and 1.4.4 (2026-10-22) shipped changes that range from automatic performance wins to new opt-in commands. This ADR records which parts of those releases this repository adopts, which it deliberately does not, and what is on the watchlist, so future upgrades have a baseline to diff against.

Relevant project facts (see ADR-001, ADR-002, ADR-021, ADR-026):

- Bun is the **runtime and test runner**; pnpm owns the dependency graph (`bunfig.toml` sets `frozenLockfile = true`, there is deliberately no `bun.lock`).
- Production runs as digest-pinned `oven/bun:*-alpine` images; the API is a single-file `bun build --target bun` bundle served by the Hono API.
- The stack is multi-tenant (`packages/tenant`), with a TanStack Start dashboard, an Astro marketing site, and BullMQ workers on Redis.

## Decision

### 1. Adopted

| Item                                             | Where                                                     | Notes                                                                                                                                                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun check` as the typechecker                   | every `tsc --noEmit` workspace (`typecheck` task)         | TypeScript-go port with 100% tsc conformance; `turbo typecheck` 65.7 s → ~5 s. `tsc` is kept everywhere it **emits** (builds); marketing keeps `astro check`.                                                          |
| `--disallow-code-generation-from-strings=strict` | all three production container `CMD`s                     | Bun 1.4.3 makes the flag real: `eval`, `new Function`, `node:vm`, `data:` URL imports, `Worker` eval and inspector-driven generation all throw. Validated against the full test suites and smoke runs before enabling. |
| CI pipeline                                      | `.github/workflows/ci.yml`                                | lint / config-lint / secrets / typecheck / test / build jobs; toolchain resolved from `packageManager` and `.bun-version` so CI never drifts from Docker.                                                              |
| Dependabot update automation                     | `.github/dependabot.yml`                                  | npm (whole pnpm workspace), docker (all six Dockerfile directories, preserving tag+digest pinning), github-actions. `@tanstack/react-router` is excluded — it is pinned by a pnpm patch.                               |
| Dependency-health recipes                        | `just deps-audit`, `just deps-outdated`, `just typecheck` | Supply-chain gate on the npm tree, complementing the Security group's `audit-dependencies`.                                                                                                                            |
| Dependency vulnerability cleanup                 | `pnpm-workspace.yaml` overrides + package bumps           | `pnpm audit` driven; scoped overrides only rewrite vulnerable ranges.                                                                                                                                                  |

### 2. Automatic gains — no code change, verified on 1.4.4

- **Idle CPU −67–89%** while servers sleep: the Hono API and the static servers spend most of their life idle between requests; this directly cuts steady-state host cost.
- **JavaScriptCore upgrades**: router-pattern regexes ~5× faster (Hono routing), `JSON.parse` 1.2–1.5× faster on large manifests (OTLP/queue payloads), faster `Object.values`/array operations.
- **`node:http` large responses up to 2.7× faster** — relevant to any proxy-style response streaming through the API.
- **Linear `Promise.allSettled`/`catch` on many rejected promises** — queue workers and webhook fan-out paths no longer risk quadratic stalls.
- **`bun install` retries with exponential backoff** — makes the `frozenLockfile = true` guard resilient to brief registry flaps in CI.
- **Deprecated-package warnings and libc-aware installs** — hygiene for future dependency changes (informational here; pnpm performs the installs).

### 3. Deliberately not adopted (and why)

| Feature                                                                        | Reason                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun pm fetch`, `bun pm cache pack/unpack`, `--libc musl`, `minimumReleaseAge` | These are `bun install` features. pnpm owns the dependency graph (ADR-001); adopting them would require moving installs to bun, which is out of scope. Revisit only if that decision changes.                                                                                                                                            |
| `bun fmt`                                                                      | Prettier stays. `bun fmt` is Prettier-compatible but not byte-identical on every language this repo uses (YAML 95.9%, HTML 98.9% on Bun's own fixtures), and the repository's formatting is prettier-owned end to end (lint-staged, format scripts, prettier-plugin-astro). Re-evaluate when the formatter contract can be renegotiated. |
| `Bun.SQL` / `bun:sqlite` improvements                                          | The data layer is Drizzle on `pg`; no Bun-native SQL client in use.                                                                                                                                                                                                                                                                      |
| `bun build --compile` bytecode features                                        | No compiled executables in this repo; the API ships as a plain bundle.                                                                                                                                                                                                                                                                   |

### 4. Watchlist (evaluate, do not adopt yet)

- **`Bun.ModuleGraph`** (experimental in 1.4.3): many isolated instances of one app in a single process, each with fresh module state — a natural fit for per-tenant request isolation in `packages/tenant` if tenant density ever demands it. Not a security sandbox; needs an evaluation ADR before any adoption.
- **`Bun.FetchSession`**: per-session TLS/proxy/keep-alive pools — candidate for the Vault and OTLP egress paths if certificate pinning or proxy segregation becomes a requirement.
- **`bun test --check`**: type-checks test files before running them. The repo's tsconfigs currently exclude `tests/` from `tsc`, and several test files have pre-existing type errors; adopt after that cleanup.
- **Profile-guided bytecode** (`--bytecode-order`): only relevant if a CLI tool in `tooling/` grows cold-start-sensitive distribution.

## Consequences

### Positive

- Typecheck feedback drops from ~66 s to ~5 s for the whole monorepo, making `pre-push` typecheck effectively free.
- Production runtime rejects runtime code generation by default; code-injection bugs surface as loud errors instead of silent exploitation paths.
- The security posture is continuous: CI runs the full lint battery plus gitleaks on every PR, Dependabot automates dependency updates, and `pnpm audit` is a `just` recipe away.
- Idle CPU, routing regex, JSON parsing, and rejected-promise handling improve without any code change.

### Negative

- `bun check` is check-only — it does not emit declarations, so `tsc` remains a build dependency for every emitting workspace (two checker binaries in the toolchain).
- The strict code-generation ban is process-wide: a dependency that legitimately needs `eval`/`node:vm` at runtime will fail and need an explicit, reviewed escape hatch (relaxing the flag is visible in the Dockerfile diff).
- CI adds runner minutes and a new failure surface (config-lint, secrets scanning) that contributors must keep green.

### Risks

- Experimental watchlist APIs (`Bun.ModuleGraph`) may change shape between releases; they are intentionally not adopted so upgrades stay routine.
- Dependabot's npm updates do not understand pnpm `patchedDependencies` beyond the explicit ignore list; a patch rebase becomes a required manual step whenever a patched package needs a version bump. CI catches a broken `pnpm install` immediately.

## References

- Bun 1.4.3 release notes: `https://bun.com/blog/bun-v1.4.3`
- Bun 1.4.4 release notes: `https://bun.com/blog/bun-v1.4.4`
- Runtime decision and pnpm/bun split: ADR-001
- Image pinning policy: ADR-002
- Just recipes: ADR-021, `docs/development/writing-just-recipes.md`
- Devbox sandbox: ADR-026
