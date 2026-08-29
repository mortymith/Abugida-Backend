# Log Rotation & Cleanup

Prevent disk exhaustion from Docker logs, Caddy access logs, and OTEL pipeline output across all 16 services.

## Prerequisites

- `just` CLI installed
- At least 10% disk free before starting (run `just disk-usage`)
- No active incident requiring log retention

## Steps

1. **Check current disk usage**

   ```bash
   just disk-usage
   ```

   Identify which service logs are consuming the most space.

2. **Truncate large Docker container logs**

   ```bash
   truncate -s 0 $(docker inspect --format='{{.LogPath}}' postgres-1)
   truncate -s 0 $(docker inspect --format='{{.LogPath}}' infra-api-1)
   truncate -s 0 $(docker inspect --format='{{.LogPath}}' infra-dashboard-1)
   truncate -s 0 $(docker inspect --format='{{.LogPath}}' infra-marketing-1)
   ```

   Repeat for all replicas showing large log files.

3. **Clean Caddy access log volume**

   ```bash
   docker run --rm -v caddy_logs:/data alpine sh -c "cd /data && ls -lhS && find . -name '*.log' -mtime +30 -delete"
   ```

   Deletes Caddy access logs older than 30 days from the named volume.

4. **Verify OTEL pipeline is not backlogged**

   ```bash
   just logs otel --tail 50
   ```

   Confirm no send queue buildup. OTEL ships logs to SigNoz; if backlogged, reduce log verbosity temporarily.

5. **Set Docker log rotation globally** (if not already configured)
   ```bash
   cat /etc/docker/daemon.json
   # Ensure: {"log-driver":"json-file","log-opts":{"max-size":"50m","max-file":"3"}}
   ```
   Apply with `sudo systemctl restart docker` during a maintenance window.

## Verification

- `just disk-usage` shows reclaimed space
- `docker logs` commands still work for all services
- SigNoz continues receiving telemetry (no gap in metrics)
- No OTEL send errors in `just logs otel`
