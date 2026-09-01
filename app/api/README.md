# @abugida/api

REST API server for the Abugida educational platform. Built with Hono, Drizzle ORM, BullMQ, and Better Auth.

## Tech Stack

- **Framework:** Hono with Zod OpenAPI
- **Database:** PostgreSQL via Drizzle ORM (pooled through PgBouncer)
- **Queue:** BullMQ (backed by Redis)
- **Auth:** Better Auth (Google + Apple ID)
- **Validation:** Zod
- **Observability:** Pino + OpenTelemetry

## Environment Variables

All environment variables are validated up-front by `src/config/app_config.ts`. The
server fails fast at startup with a clear report if configuration is invalid —
secret values are never echoed. See `.env.example` for the full annotated list.

| Variable                                           | Required | Description                                          |
| -------------------------------------------------- | -------- | ---------------------------------------------------- |
| `ENVIRONMENT` / `NODE_ENV`                         | no       | `development` \| `staging` \| `production` \| `test` |
| `PORT` / `HOST`                                    | no       | Bind address (defaults `3000` / `0.0.0.0`)           |
| `LOG_LEVEL`                                        | no       | `fatal`…`trace` (default `info`)                     |
| `DATABASE_URL`                                     | **yes**  | PostgreSQL connection string (Postgres URL)          |
| `BETTER_AUTH_SECRET`                               | **yes**  | Auth signing secret (min 32 chars)                   |
| `BETTER_AUTH_URL`                                  | **yes**  | Public auth base URL (https in production)           |
| `GOOGLE_CLIENT_ID` + `_SECRET`                     | yes*     | Google OAuth (pair required)                         |
| `APPLE_CLIENT_ID`/`TEAM_ID`/`KEY_ID`/`PRIVATE_KEY` | yes*     | Apple ID OAuth (set all four)                        |
| `REDIS_HOST` / `REDIS_PORT`                        | no       | Queue Redis (defaults localhost:6379)                |
| `STORAGE_PROVIDER` + credentials                   | no       | S3-compatible object storage (graceful if unset)     |

\* At least one OAuth provider (Google or Apple) must be configured.

Rate limits follow API spec NFR-403 (authenticated 100 req/min, anonymous
1000 req/min) and are configurable via `RATE_LIMIT_*`. Observability is
configurable via `OTEL_*`.

## Commands

| Command         | Action                                        |
| --------------- | --------------------------------------------- |
| `pnpm dev`      | Start dev server with hot reload on port 3000 |
| `pnpm lint`     | Run ESLint                                    |
| `pnpm lint:fix` | Run ESLint with auto-fix                      |
| `pnpm test`     | Run tests                                     |

## Project Structure

```
src/
  index.ts           # Entry point: init config/observability, serve, graceful shutdown
  app.ts             # Hono app composition (auth, middleware, health)
  config/
    index.ts         # Public config entry point
    app_config.ts    # Env loading, Zod validation, defaults, normalization (source of truth)
    database.ts      # Shared pg Pool + Drizzle client
    auth.ts          # Better Auth config + instance factory
    queue.ts         # BullMQ/Redis config + producer factory
    observability.ts # Pino + OpenTelemetry init
    rate-limit.ts    # Rate limit config + limiter factories (API spec NFR-403)
```

Configuration modules consume `appConfig` and never read `process.env` directly.

## API Reference

See [API Specification](../../docs/api-spec.yaml) for the full OpenAPI documentation.
