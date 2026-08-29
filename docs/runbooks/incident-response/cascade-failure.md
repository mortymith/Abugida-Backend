# Runbook: Cascade Failure (Multiple Services Down)

## Symptoms

- `just health` reports failures across multiple layers.
- `docker ps` shows many containers in `Exited` or `Restarting` state.
- Alerts firing for database, cache, observability, and edge services simultaneously.

## Impact

- Full or near-full system outage. All application functionality is lost. Recovery requires an ordered, layer-by-layer approach to avoid dependency deadlocks (e.g., starting the API before Postgres is ready).

## Diagnosis

1. Get a high-level view of all container states:

   ```bash
   docker ps -a --filter "name=${COMPOSE_PROJECT_NAME:-infra}_"
   ```

2. Run the full health check and note which layers are affected:

   ```bash
   just health
   ```

3. Check host-level resources (memory, CPU, disk) as cascade failures often stem from resource exhaustion:

   ```bash
   docker stats --no-stream
   df -h
   free -h
   ```

4. Identify the root cause — usually one of: host OOM, disk full, network interface down, or Docker daemon crash.

## Resolution

Recover services in strict layer order. **Do not skip layers.**

**Step 1 — Infrastructure Layer (data stores):**

```bash
just restart postgres-primary
just restart pgbouncer
just restart redis-primary
just restart redis-sentinel
just restart redis-replica
just restart minio
just restart clickhouse
```

Wait for all infrastructure health checks to pass before proceeding:

```bash
just health
```

**Step 2 — Secrets Layer:**

If Vault is sealed, unseal it:

```bash
just vault-unseal
```

**Step 3 — Application Layer:**

```bash
just restart api
just restart dashboard
just restart marketing
```

**Step 4 — Edge Layer:**

```bash
just restart caddy-active
just restart caddy-standby
just restart keepalived
```

**Step 5 — Observability Tunnel:**

```bash
just restart otel-collector
just restart signoz-frontend
just restart cloudflared
```

## Verification

1. After each layer, run `just health` to confirm that layer is stable.

2. After all layers are up, run a final comprehensive check:

   ```bash
   just health
   ```

3. Test end-to-end: curl the public endpoint through the VIP or Cloudflared tunnel:

   ```bash
   curl -s https://app.example.com/health
   ```

4. Review logs of the originally failing service to confirm normal operation:

   ```bash
   just logs api | tail -30
   ```
