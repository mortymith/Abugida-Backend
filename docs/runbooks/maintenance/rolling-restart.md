# Rolling Restart

Restart all 16 services across 3 hosts without downtime. Follow layer order: infra → app → edge. Each layer must be fully healthy before proceeding.

## Prerequisites

- SSH access to all prod hosts
- `just` CLI installed
- Active Keepalived VIP confirmed reachable
- No active deployments in progress

## Steps

1. **Restart infrastructure layer — PostgreSQL (2 replicas)**

   ```bash
   just restart postgres
   just health postgres
   ```

   Wait until both PG replicas report `healthy`. PgBouncer maintains connection pooling during restart.

2. **Restart infrastructure layer — Redis (2 replicas + 3 sentinels)**

   ```bash
   just restart redis
   just health redis
   ```

   Confirm sentinels re-elect master correctly:

   ```bash
   docker exec redis-sentinel-1 redis-cli -p 26379 sentinel master mymaster
   ```

3. **Restart infrastructure layer — MinIO and ClickHouse**

   ```bash
   just restart minio
   just health minio
   just restart clickhouse
   just health clickhouse
   ```

4. **Restart application layer — API, Dashboard, and Marketing**

   ```bash
   just restart api
   just health api
   just restart dashboard
   just health dashboard
   just restart marketing
   just health marketing
   ```

   Caddy continues routing traffic to healthy replicas during restart.

5. **Restart edge layer — Caddy (2 replicas) and Keepalived**
   ```bash
   just restart caddy
   just health caddy
   just restart keepalived
   just health keepalived
   ```
   Only one Caddy restarts at a time; the other serves via VIP. Keepalived fails over gracefully.

## Verification

```bash
just health all
just container-stats
```

Confirm VIP responds on the API, dashboard, and marketing domains. All 16 containers must show `healthy`. Review SigNoz dashboard for no 5xx spike during the restart window.
