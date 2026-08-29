# Runbook: ClickHouse Degraded

## Symptoms

- `clickhouse-client` returns `SELECT 1` errors or hangs.
- SigNoz dashboard shows missing traces or metrics.
- OTEL Collector logs contain ClickHouse connection or write errors.

## Impact

- Observability data (traces, metrics, logs) is lost or delayed. Historical queries may time out. Dashboards render incomplete or stale data.

## Diagnosis

1. Check ClickHouse container status:

   ```bash
   docker ps -a --filter "name=infra_clickhouse"
   ```

2. Review ClickHouse logs for merge errors, OOM events, or corruption:

   ```bash
   just logs clickhouse
   ```

3. Check available disk space on the ClickHouse data volume:

   ```bash
   docker exec infra_clickhouse-1 df -h /var/lib/clickhouse
   ```

4. Test basic connectivity from the ClickHouse client:

   ```bash
   docker exec infra_clickhouse-1 clickhouse-client --query "SELECT 1"
   ```

5. Verify TTL settings on high-volume tables have not expired prematurely:

   ```bash
   docker exec infra_clickhouse-1 clickhouse-client --query "SELECT name, engine, ttl FROM system.tables WHERE database='signoz_traces'"
   ```

6. Check if SigNoz frontend can reach ClickHouse:

   ```bash
   just logs signoz-frontend | tail -30
   ```

7. Check OTEL Collector for export errors targeting ClickHouse:

   ```bash
   just logs otel-collector | rg -i "clickhouse|exporter.*error"
   ```

## Resolution

1. If disk space is exhausted, clear old partitions or expand the volume:

   ```bash
   docker exec infra_clickhouse-1 clickhouse-client --query "ALTER TABLE signoz_traces.distributed_signoz_index_v2 DROP PARTITION 20240101"
   ```

2. If ClickHouse is in a crash loop, restart it:

   ```bash
   just restart clickhouse
   ```

3. If the OTEL Collector has stale connections, restart it to re-establish the ClickHouse exporter:

   ```bash
   just restart otel-collector
   ```

4. After restarting, allow time for background merges to complete before declaring healthy.

## Verification

1. Confirm the client query succeeds:

   ```bash
   docker exec infra_clickhouse-1 clickhouse-client --query "SELECT 1"
   ```

2. Verify the SigNoz frontend loads trace data:

   ```bash
   curl -s -o /dev/null -w '%{http_code}' http://localhost:3301/health
   ```

3. Run full health:

   ```bash
   just health
   ```
