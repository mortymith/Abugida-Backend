# Runbook: Generic Service Down

## Symptoms

- One or more containers exit or report unhealthy status.
- `just health` returns `FAIL` for one or more services.
- Application errors referencing connection timeouts or 5xx responses.
- Alerting fires a "service down" notification.

## Impact

- Degraded functionality proportional to the affected service. Data-layer outages (Postgres, Redis, MinIO, ClickHouse) affect all upstream applications. Edge-layer outages (Caddy, Keepalived) affect external access. Vault being down prevents secrets delivery on dependent service restarts.

## Diagnosis

1. Run the global health check to identify which services are failing:

   ```bash
   just health
   ```

2. List all containers and note the status (`Up`, `Restarting`, `Exited`) of the failing service:

   ```bash
   docker ps -a --filter "name=${COMPOSE_PROJECT_NAME:-infra}_"
   ```

3. Pull the last 100 log lines for the failing service:

   ```bash
   just logs <SERVICE>
   ```

   Replace `<SERVICE>` with the service name (e.g., `postgres-primary`, `api`).

4. Check live resource usage to rule out OOM kills or CPU starvation:

   ```bash
   docker stats --no-stream
   ```

5. Inspect the container's restart count and last exit code:

   ```bash
   docker inspect --format '{{.RestartCount}} {{.State.ExitCode}}' infra_<SERVICE>-1
   ```

## Resolution

1. If the container exited with a non-zero code, attempt a graceful restart:

   ```bash
   just restart <SERVICE>
   ```

2. If the service repeatedly crashes, check for configuration drift — compare the running config against the Compose overlay:

   ```bash
   docker compose -f compose.yml -f compose.prod.yml config | rg <SERVICE>
   ```

3. If OOM is the cause, increase the memory limit in the Compose file or the host, then restart.

4. If disk pressure is the cause, free space on the affected volume mount before restarting.

## Verification

1. Confirm the container is running and healthy:

   ```bash
   docker ps --filter "name=${COMPOSE_PROJECT_NAME:-infra}_<SERVICE>" --format '{{.Status}}'
   ```

2. Run the full health suite to ensure no downstream effects:

   ```bash
   just health
   ```
