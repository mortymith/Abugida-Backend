## Tooling

- **Runtime:** bun (>= 1.3.14, pinned in `.bun-version`). Run scripts, dev servers, and tests with bun.
- **Package manager:** pnpm (>= 11, pinned in `package.json` `packageManager`). Install deps with `pnpm install` only.
- Never let bun touch the dependency graph: `bunfig.toml` sets `frozenLockfile = true` and there is intentionally no `bun.lockb`. Do not run `bun add`/`bun install` or introduce a bun lockfile — edit `package.json` + `pnpm-workspace.yaml` and reinstall with pnpm.
- `pnpm-workspace.yaml` has explicit `allowBuilds` for native deps (`@google/genai`, `esbuild`, `sharp`, etc.). Don't add new native packages without checking this list.

## Monorepo

Turborepo over pnpm workspaces (`app/*`, `packages/*`). Root `pnpm <script>` fans out to every workspace via turbo.

### Apps

| Path            | Package              | What it is                           |
| --------------- | -------------------- | ------------------------------------ |
| `app/api`       | `@abugida/api`       | Hono REST API (port 3001)            |
| `app/dashboard` | `@abugida/dashboard` | TanStack Start dashboard (port 3000) |
| `app/marketing` | `@abugida/marketing` | Astro landing page (port 4321)       |

### Shared packages

| Path                     | Package                  | What it is                                                                                            |
| ------------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------- |
| `packages/auth`          | `@abugida/auth`          | Better Auth layer — exports core + `/hono`, `/tanstack`, `/providers` subpaths                        |
| `packages/database`      | `@abugida/database`      | Drizzle schema by domain (`auth`, `catalog`, `finance`, `learning`, `ops`, `shared`) + `createClient` |
| `packages/observability` | `@abugida/observability` | Pino logging + OpenTelemetry tracing/metrics — exports `/hono`, `/tanstack`, `/astro` subpaths        |
| `packages/queue`         | `@abugida/queue`         | BullMQ queue management — exports `/tanstack` subpath                                                 |
| `packages/storage`       | `@abugida/storage`       | S3-compatible object storage — exports `/tanstack` subpath                                            |

- All apps import from the shared packages via `workspace:*`. Do not reimplement auth, database, queue, storage, or observability logic locally.
- To scope to one workspace, run from that directory or `pnpm --filter <name> <script>`.
- Shared packages must be built (`tsc` → `dist/`) before consuming apps can import them. Turbo handles this via `^build` dependencies.

## Commands

- `pnpm dev` / `pnpm build` / `pnpm lint` / `pnpm typecheck` / `pnpm test` — all via turbo.
- Tests use **bun** as the runner (`bun test`), not vitest/jest. `app/api` uses `bun test --pass-with-no-tests`.
- Database scripts live in `packages/database`: `pnpm --filter @abugida/database db:generate|db:migrate|db:push|db:pull|db:studio`.
- Env is per-app and git-ignored; examples live at `app/*/.env.example`.
- The root `format` script also runs `shfmt` on shell scripts.

## Infrastructure (just command runner)

The `justfile` manages Docker Compose infrastructure across three tiers (dev/staging/prod). Run `just --list` to see all recipes.

```bash
just setup-dev          # Bootstrap: .env + start + init (5 services)
just dev-up / dev-down  # Start/stop dev infrastructure
just health             # Probe all service health endpoints
just logs <service>     # Tail a container's logs
just shell <service>    # Shell into a running container
just psql               # psql shell against postgres-primary
just redis-cli          # redis-cli against redis-primary
just mc ls local/       # MinIO client (ephemeral container, no host install)
just down               # Stop all services
just validate-compose   # Validate all three compose tiers
```

- Three-tier modular Compose: `docker/compose/{base,app,edge,scaling,security,observability,networks,volumes}.yml` + `profiles/{dev,staging,prod}.override.yml`.
- Secrets: dev uses `.env`, staging/prod use HashiCorp Vault.
- Dev environment infra: PostgreSQL, PgBouncer, Redis (Sentinel), MinIO, PowerSync.

## Git workflow (enforced by husky hooks — don't bypass)

- `commit-msg`: Conventional Commits via commitlint (e.g. `feat(scope): ...`). `body-max-line-length`/`footer-max-line-length` are disabled.
- `pre-commit`: lint-staged → eslint `--fix` + prettier `--write` on staged files.
- `pre-push`: runs `pnpm typecheck` across all workspaces — must pass before pushing.

## Conventions

- Code style is prettier + eslint: no semicolons, single quotes, trailing commas, printWidth 100.
- Root tsconfig is strict with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `isolatedModules`. Match these in new code.
- `packages/auth`: Build with `tsc` to `dist/` before consuming. Framework middleware is intentionally kept in subpaths (`/hono`, `/tanstack`) so consumers don't pull unnecessary deps.
- `packages/database`: Schema is organized by domain under `schema/` (`auth`, `catalog`, `finance`, `learning`, `ops`, `shared`). The barrel `index.ts` re-exports everything.
- `app/dashboard`: File-based routing via TanStack Router. After adding/renaming routes run `pnpm --filter @abugida/dashboard generate-routes`. `*.gen.ts` files are eslint-ignored. See `app/dashboard/AGENTS.md` for dashboard-specific conventions.
- `app/api`: Hono REST API with Zod OpenAPI. See `app/api/` for module structure.
- `app/marketing`: Astro site. Use `astro dev --background` for dev server. See `app/marketing/AGENTS.md`.

## Repo-local instruction files

- `app/dashboard/AGENTS.md` — Dashboard app architecture, naming conventions, and agent instructions.
- `app/marketing/AGENTS.md` — Dev-server workflow (use `astro dev --background`).
- `.agents/skills/` — 17 installable skills: better-auth, hono, shadcn, tanstack-* (ai, cli, config, db, devtools, query, router, start, virtual), design-doc-mermaid, commit-master, create-auth, organization-best-practices.
