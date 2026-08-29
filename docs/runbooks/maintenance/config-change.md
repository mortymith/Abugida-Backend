# Configuration Change

Modify service configuration files in `docker/config/` and reload affected services. Config files are mounted read-only into containers.

## Prerequisites

- `just` CLI installed
- Identify which service uses the target config file
- Coordinate during low-traffic window for prod restarts

## Steps

1. **Validate current configurations**

   ```bash
   just check-configs
   ```

   Lints all config files and reports syntax errors before any reload.

2. **Edit the config file**

   ```bash
   vim docker/config/postgres/postgresql.conf
   ```

   Containers read the file on restart via the read-only mount.

3. **Reload the affected service**
   For most services:

   ```bash
   just restart postgres
   just health postgres
   ```

   For Caddy (zero-downtime config reload):

   ```bash
   docker exec caddy-1 caddy reload --config /etc/caddy/Caddyfile
   ```

4. **Verify logs after reload**
   ```bash
   just logs postgres --tail 50
   ```
   Look for `FATAL`, `ERROR`, or config-rejection messages.

## Verification

```bash
just health all
just check-configs
```

Confirm the setting is active — e.g. for PostgreSQL:

```bash
docker exec postgres-1 psql -U $POSTGRES_USER -c "SHOW max_connections;"
```

Check SigNoz for error-rate changes within 5 minutes of the change.
