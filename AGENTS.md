## Tooling

- **Runtime:** bun (>= 1.3.14, pinned in `.bun-version`). Run scripts, dev servers, and tests with bun.
- **Package manager:** pnpm (>= 11, pinned in `package.json` `packageManager`). Install deps with `pnpm install` only.
- Never let bun touch the dependency graph: `bunfig.toml` sets `frozenLockfile = true` and there is intentionally no `bun.lockb`. Do not run `bun add`/`bun install` or introduce a bun lockfile — edit `package.json` + `pnpm-workspace.yaml` and reinstall with pnpm.
- `pnpm-workspace.yaml` has explicit `allowBuilds` for native deps (`@google/genai`, `esbuild`, `sharp`, etc.). Don't add new native packages without checking this list.

## Monorepo

Turborepo over pnpm workspaces (`app/*`, `packages/*`). Root `pnpm <script>` fans out to every workspace via turbo.

| Path                | Package              | What it is                                     |
| ------------------- | -------------------- | ---------------------------------------------- |
| `app/api`           | `@abugida/api`       | Hono REST API (port 3000)                      |
| `app/dashboard`     | `@abugida/dashboard` | TanStack Start dashboard (port 3000)           |
| `app/marketing`     | `@abugida/marketing` | Astro landing page (port 4321)                 |
| `packages/auth`     | `@abugida/auth`      | Shared Better Auth layer (compiled to `dist/`) |
| `packages/database` | `@abugida/database`  | Shared Drizzle schema                          |

- To scope to one workspace, run from that directory (`app/api/` scripts: `bun --watch src/index.ts`) or `pnpm --filter <name> <script>`.
- The shared packages are not yet imported by the apps; the app packages still have their own local deps (`app/dashboard` has `src/db/schema.ts` + `drizzle.config.ts`).

## Commands

- `pnpm dev` / `pnpm build` / `pnpm lint` / `pnpm typecheck` / `pnpm test` — all via turbo.
- Tests use **bun** as the runner (`bun test`), not vitest/jest. `app/api` uses `bun test --pass-with-no-tests`.
- `app/dashboard` has Drizzle scripts: `pnpm --filter @abugida/dashboard db:generate|db:migrate|db:push|db:pull|db:studio`. `drizzle.config.ts` requires `DATABASE_URL` in `app/dashboard/.env.local` or `.env`.
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
- Root tsconfig is strict with `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns`, `isolatedModules`. Match these in new code (no `a.b` without undefined handling).
- `app/dashboard`: routes are file-based; after adding/renaming routes run `pnpm --filter @abugida/dashboard generate-routes` to regenerate `src/routeTree.gen.ts`. `*.gen.ts` files are eslint-ignored.
- `packages/auth`: exports `@abugida/auth` (core) plus subpaths `/hono`, `/tanstack`, `/providers` — framework middleware is intentionally kept out of the main entry so consumers don't pull Hono/TanStack. Build with `tsc` to `dist/` before consuming.
- `packages/database`: schema is organized by domain under `schema/` (`auth`, `catalog`, `finance`, `learning`, `ops`, `shared`); `index.ts` is currently empty.

## Repo-local instruction files

- `app/marketing/AGENTS.md` — dev-server workflow (use `astro dev --background`).
- `app/dashboard/AGENTS.md` — auto-generated TanStack Intent skill guide; don't hand-edit.
- `.agents/skills/` — better-auth, hono, and tanstack-* skills available to agents.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, invoke the `skill` tool with `skill: "graphify"` before doing anything else.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
