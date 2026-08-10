# Abugida Backend

Educational mobile application backend — supporting TOEFL, IGCSE, high school, and college exam preparation for Ethiopian users.

## Tech Stack

| Layer           | Technology        |
| --------------- | ----------------- |
| Runtime         | Bun >= 1.3.14     |
| Package Manager | pnpm (workspaces) |
| Monorepo        | Turborepo         |
| API             | Hono              |
| ORM             | Drizzle           |
| Database        | PostgreSQL 16     |
| Queue           | BullMQ (Redis)    |
| Auth            | Better Auth       |
| Marketing       | Astro             |

## Prerequisites

- [Bun](https://bun.sh) >= 1.3.14 (runtime — dev servers, scripts, and tests)
- [pnpm](https://pnpm.io) >= 11.8 (package manager — a `packageManager` field is declared at the root)
- PostgreSQL 16
- Redis

## Quick Start

```sh
pnpm install
pnpm dev
```

## Workspaces

| Package                                   | Description                                 |
| ----------------------------------------- | ------------------------------------------- |
| `app/api` (`@abugida/api`)                | REST API server (port 3000)                 |
| `app/dashboard` (`@abugida/dashboard`)    | TanStack Start dashboard app (port 3000)    |
| `app/marketing` (`@abugida/marketing`)    | Marketing landing page (port 4321)          |
| `packages/auth` (`@abugida/auth`)         | Shared Better Auth configuration and schema |
| `packages/database` (`@abugida/database`) | Shared Drizzle schema                       |

## Scripts

| Command          | Action                         |
| ---------------- | ------------------------------ |
| `pnpm dev`       | Start all services in dev mode |
| `pnpm build`     | Build all packages             |
| `pnpm lint`      | Lint all packages              |
| `pnpm typecheck` | Type-check all packages        |
| `pnpm test`      | Run all tests                  |

## Documentation

- [API Specification](./docs/api-spec.yaml)
- [Database Schema](./docs/DB%20design.dbml)
