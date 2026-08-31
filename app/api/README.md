# @abugida/api

REST API server for the Abugida educational platform. Built with Hono, Drizzle ORM, and BullMQ.

## Tech Stack

- **Framework:** Hono with Zod OpenAPI
- **Database:** PostgreSQL via Drizzle ORM
- **Queue:** BullMQ (backed by Redis)
- **Validation:** Zod
- **Logging:** Pino

## Environment Variables

| Variable       | Description                  |
| -------------- | ---------------------------- |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL`    | Redis connection string      |

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
  index.ts      # App entry point
```

## API Reference

See [API Specification](../../docs/api-spec.yaml) for the full OpenAPI documentation.
