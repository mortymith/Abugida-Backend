# Scale Services Up or Down

Adjust replica counts for stateless services. Production defaults: 3 API, 3 dashboard, 3 marketing, 2 Caddy, 3 sentinels. Stateful services (PostgreSQL, Redis, MinIO, ClickHouse) require migration and are not scaled this way.

## Prerequisites

- `just` CLI installed
- For scaling down: confirm current load supports fewer replicas
- Review `just container-stats` before scaling

## Steps

1. **Check current replica status**

   ```bash
   just container-stats
   ```

   Note the current running count per service.

2. **Scale a stateless service**

   ```bash
   just scale api 5
   ```

   Internally runs `docker compose up --scale api=5 -d`. Scale other services as needed:

   ```bash
   just scale dashboard 4
   just scale marketing 3
   just scale caddy 3
   ```

3. **Persist the new count in `.env`**

   ```bash
   API_REPLICAS=5
   DASHBOARD_REPLICAS=4
   MARKETING_REPLICAS=3
   CADDY_REPLICAS=3
   ```

   This ensures future `just setup-prod` deploys use the correct count.

4. **Verify resource headroom**
   ```bash
   just container-stats
   ```
   Confirm each container is within prod limits (4 CPU / 8 GB). Check host-level resources:
   ```bash
   docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
   ```

## Verification

- All new replicas appear in `just container-stats` with status `healthy`
- `curl -s https://$DOMAIN_API/health` returns 200
- `curl -s https://$DOMAIN_DASHBOARD/` and `curl -s https://$DOMAIN_MARKETING/` return 200
- Caddy upstream reflects new replica count
- No error spikes in SigNoz after scaling
