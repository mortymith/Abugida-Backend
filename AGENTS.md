## Tooling

- **Runtime:** bun (>= 1.3.14, pinned in `.bun-version`). Run scripts, dev servers, and tests with bun.
- **Package manager:** pnpm (>= 11, pinned in `package.json` `packageManager`). Install deps with `pnpm install` only.
- Never let bun touch the dependency graph: `bunfig.toml` sets `frozenLockfile = true` and there is intentionally no `bun.lockb`. Do not run `bun add`/`bun install` or introduce a bun lockfile — edit `package.json` + `pnpm-workspace.yaml` and reinstall with pnpm.

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
- `docs/api-spec.yaml` and `docs/DB design.dbml` are the API and DB design references.
