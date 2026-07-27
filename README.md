# Abugida Backend

Educational mobile application backend — supporting TOEFL, IGCSE, high school, and college exam preparation for Ethiopian users.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Bun |
| Package Manager | pnpm (workspaces) |
| Monorepo | Turborepo |
| API | Hono |
| ORM | Drizzle |
| Database | PostgreSQL 16 |
| Queue | BullMQ (Redis) |
| Auth | Better Auth |
| Marketing | Astro |

## Prerequisites

- [Bun](https://bun.sh) >= 1.3.14
- [pnpm](https://pnpm.io) >= 11.8
- PostgreSQL 16
- Redis

## Quick Start

```sh
pnpm install
pnpm dev
```

## Workspaces

| Package | Description |
|---------|-------------|
| `app/api` (`@abugida/api`) | REST API server (port 3000) |
| `app/marketing` (`@abugida/marketing`) | Marketing landing page (port 4321) |
| `packages/*` | Shared libraries |

## Scripts

| Command | Action |
|---------|--------|
| `pnpm dev` | Start all services in dev mode |
| `pnpm build` | Build all packages |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run all tests |

## Documentation

- [API Specification](./docs/api-spec.yaml)
- [Database Schema](./docs/DB%20design.dbml)
- [Client DB Design](./docs/client-db-design.dbml)
