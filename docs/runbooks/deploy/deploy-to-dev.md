# Deploy to Dev

## Prerequisites

- Just CLI installed
- Docker and Docker Compose available
- Git repository cloned locally with latest changes pushed
- Ports 5432, 6379, 9000, 9001, and 8085 available on the host
- `.env` file configured with development variables

## Steps

1. **Start the dev environment.** This assembles the modular Compose files for development (networks + volumes + base + dev.override) and starts 5 infrastructure services: PostgreSQL, PgBouncer, Redis, MinIO, and PowerSync.

   ```bash
   just dev
   ```

   For subsequent starts after the initial setup, the same command works — Docker Compose handles idempotent restarts.

2. **Watch the startup output.** The recipe starts all base infrastructure services. MinIO bucket initialization runs automatically via the dev override entrypoint. No application services (API, Dashboard, Marketing) or observability services (ClickHouse, OTEL, SigNoz) are started in the dev tier.

3. **Access the development endpoints** once containers are healthy:
   - PostgreSQL: `localhost:5432`
   - PgBouncer: `localhost:6432`
   - Redis: `localhost:6379`
   - MinIO Console: `http://localhost:9001`
   - PowerSync: `http://localhost:8085`

4. **Run the health check** to confirm all services are operational.

   ```bash
   just health
   ```

## Upgrading to Staging

For a fuller environment that includes the API, Dashboard, Marketing, and the observability stack:

```bash
just staging
```

This assembles 11 services (dev + API, Dashboard, Marketing, ClickHouse, OTEL Collector, SigNoz) with published ports for debugging.

## Verification

- `just health` reports all services as healthy.
- PostgreSQL accepts connections on `localhost:5432`.
- MinIO console is accessible at `http://localhost:9001` and buckets exist.
- No container restart loops in `docker compose ps`.
- Compose validation passes: `just validate-compose`.
