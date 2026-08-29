# Post-Deploy Verification

## Prerequisites

- Deployment completed (blue-green switch done, containers running)
- Access to monitoring dashboards (SigNoz)
- `curl` or HTTP client for manual endpoint testing
- `just` CLI available on the deploy host

## Steps

1. **Run the core health check** to verify all services are up and responsive.

   ```bash
   just health
   ```

2. **Check database replication** to ensure replicas are caught up with the primary.

   ```bash
   just health-replication
   ```

3. **Verify OpenTelemetry pipelines** are exporting traces and metrics correctly.

   ```bash
   just otel-status
   ```

4. **Review SigNoz dashboards** for the newly deployed version. Check for:
   - Error rate spikes (should be at or below baseline)
   - P95/P99 latency regressions
   - Resource usage (CPU, memory) on new containers

5. **Test a critical API endpoint** manually to confirm correct behavior.

   ```bash
   curl -sf http://$(docker compose port caddy-active 80)/api/health | jq .
   ```

6. **Inspect container resource usage** to catch memory leaks or high CPU early.

   ```bash
   just container-stats
   ```

## Verification

- `just health` shows all services green with no degraded warnings.
- `just health-replication` reports replication lag under 1 second.
- `just otel-status` confirms trace export is active with no dropped spans.
- SigNoz shows error rates at baseline and latency within normal bounds.
- Manual API test returns expected status codes and response bodies.
- `just container-stats` shows no container exceeding 80% memory or sustained high CPU.
