# Contributing

Thanks for the interest. The current status is: **not open for outside contributions
yet** — the project is pre-release and we are still reworking architecture in ways that
would churn external PRs. Issues are always welcome — bug reports, endpoint gaps,
and docs bugs included — and this file documents the conventions we hold ourselves to,
so you can judge whether a proposed change would land.

Before proposing anything, skim the existing docs:

| If you want to…                 | Read first                                                                                                            |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Understand the architecture     | [`AGENTS.md`](AGENTS.md) · [`docs/architecture/overview.md`](docs/architecture/overview.md)                           |
| Run the project                 | [`README.md` Quick start](README.md#quick-start) · [`docs/onboarding/quick-start.md`](docs/onboarding/quick-start.md) |
| Follow the development workflow | [`docs/development/dev-workflow.md`](docs/development/dev-workflow.md)                                                |

## Ground rules

1. **No cross-app imports.** `app/api` and `app/dashboard` are separate runtimes and must
   never import, mount, or call each other. Share code only through `packages/*`, or talk
   over the public HTTP boundaries.
2. **Single-source packages.** Auth, database, queue, storage, observability, and tenancy
   live in `packages/`. Apps supply environment, database client, and logger — nothing more.
   Do not reimplement package logic inside an app.
3. **Sibling packages are peer dependencies.** A `@abugida/*` package must never put another
   workspace package in `dependencies` — use `peerDependencies` (version `workspace:*`) plus
   `devDependencies` so the package still builds standalone. Two runtime copies of a shared
   package is a bug, not a style choice.
4. **Environment is validated, never scattered.** Read `process.env` only inside a
   centralized config module. New variables go into that module's Zod schema and the
   relevant `.env.example` in the same commit.
5. **Framework behavior lives in the framework layer.** Auth middleware belongs in
   `@abugida/auth` subpaths (`/hono`, `/tanstack`), not in the apps.
6. **Read the app-level `AGENTS.md`** (`app/dashboard/AGENTS.md`, `app/marketing/AGENTS.md`)
   before touching those workspaces.

## Getting set up

```bash
pnpm install        # pnpm owns the dependency graph — never bun add / bun install
just setup-dev      # .env + PostgreSQL, PgBouncer, Redis, MinIO, PowerSync + health
pnpm dev            # all workspaces (API :3001, dashboard :3000, marketing :4321)
```

Before opening a change:

```bash
pnpm lint
pnpm typecheck
pnpm test           # bun test — Vitest/Jest are not used in this repo
```

Infra touched? Validate the compose tiers too:

```bash
just validate-compose
```

Dashboard routes added or renamed? Regenerate them:

```bash
pnpm --filter @abugida/dashboard generate-routes
```

## Commit convention

Conventional Commits, enforced by commitlint on `commit-msg`:

```
type(scope): description

feat(api): add bundle search endpoint
fix(redis): correct sentinel quorum calculation
docs(runbooks): add vault-sealed incident response
```

- **Types:** `feat`, `fix`, `chore`, `docs`, `refactor`, `security`, `test`, `ci`
- **Scope:** service or component (`api`, `dashboard`, `vault`, `compose`, …)

Husky hooks are enforced — do not bypass them. `pre-commit` runs eslint `--fix` and
prettier on staged files; `pre-push` runs `pnpm typecheck` across all workspaces.

## Style

- Prettier: no semicolons, single quotes, trailing commas, `printWidth` 100.
- TypeScript strict, including `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`.
- Keep API modules self-contained — routes, schemas, service, repository, handlers — and
  register them in `app/api/src/app.ts`.

## Branches and changes

- Branch from and target `dev`; promote to `main` only for production-bound merges.
  Small self-contained change > sprawling change.
- Architecture decisions belong in an ADR under `docs/architecture/adr/` — if you had to
  ask "why is it built this way?", the next person will too.
- Same-commit rule: schema change ⇒ `db:generate` migration; new env var ⇒ Zod schema +
  `.env.example`; framework middleware ⇒ `packages/`, not the app.
- Runbooks accompany operational changes: new service or procedure in Compose means a
  paired update under `docs/runbooks/` and `docs/services/`.

## Reporting a security issue

**Do not open an issue for security vulnerabilities** — follow
[`SECURITY.md`](SECURITY.md) instead.
