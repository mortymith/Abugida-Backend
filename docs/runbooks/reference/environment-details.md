# Environment Details Cheat Sheet

Services sorted by environment tier. Production-only services are marked with †.

## Development Environment (5 services)

| Service          | Container Name           | Internal Port(s) | Network(s) | Dev Host Port(s) | Health Check Command                                                                  | Data Volume                              |
| ---------------- | ------------------------ | ---------------- | ---------- | ---------------- | ------------------------------------------------------------------------------------- | ---------------------------------------- |
| postgres-primary | `infra_postgres-primary` | 5432             | infra      | 5432             | `docker exec infra_postgres-primary pg_isready -U app`                                | `postgres_data:/var/lib/postgresql/data` |
| pgbouncer        | `infra_pgbouncer`        | 6432             | infra      | 6432             | `docker exec infra_pgbouncer psql -h localhost -p 6432 -U pgbouncer -c 'SHOW POOLS;'` | `pgbouncer-data:/etc/pgbouncer`          |
| redis-primary    | `infra_redis-primary`    | 6379             | infra      | 6379             | `docker exec infra_redis-primary redis-cli ping`                                      | `redis_primary_data:/data`               |
| minio            | `infra_minio`            | 9000, 9001       | infra      | 9000, 9001       | `docker exec infra_minio mc admin info local`                                         | `minio_data:/data`                       |
| powersync-api    | `infra_powersync-api`    | 8085, 9090       | infra      | 8085, 9090       | `curl -sf http://localhost:8085/probes/liveness`                                      | none                                     |
| powersync-sync   | `infra_powersync-sync`   | 9090 (metrics)   | infra      | 9091             | `docker inspect --format '{{.State.Health.Status}}' infra_powersync-sync`             | none                                     |

## Staging Environment (20 services)

All 5 dev services plus:

| Service         | Container Name          | Internal Port(s)  | Network(s)    | Staging Host Port(s) | Health Check Command                                                | Data Volume                           |
| --------------- | ----------------------- | ----------------- | ------------- | -------------------- | ------------------------------------------------------------------- | ------------------------------------- |
| clickhouse      | `infra_clickhouse`      | 8123              | infra         | 8123                 | `docker exec infra_clickhouse clickhouse-client --query 'SELECT 1'` | `clickhouse_data:/var/lib/clickhouse` |
| api             | `infra-api-1`           | 3000              | backend+infra | 3001                 | `curl -sf http://localhost:3001/health`                             | none                                  |
| dashboard       | `infra-dashboard-1`     | 8080              | backend+infra | 8081                 | `curl -sf http://localhost:8081/health`                             | none                                  |
| marketing       | `infra-marketing-1`     | 8080              | backend+infra | 8082                 | `curl -sf http://localhost:8082/`                                   | none                                  |
| otel-collector  | `infra_otel-collector`  | 4317, 4318, 13133 | infra         | 4317, 4318           | `curl -sf http://localhost:13133/healthcheck`                       | none                                  |
| signoz-frontend | `infra_signoz-frontend` | 3001              | infra         | 3002                 | `curl -sf http://localhost:3002/health`                             | none                                  |

## Additional Production Services (14 more)

| Service              | Container Name             | Internal Port(s) | Network(s)   | Host Port | Health Check Command                                                             | Data Volume                                        |
| -------------------- | -------------------------- | ---------------- | ------------ | --------- | -------------------------------------------------------------------------------- | -------------------------------------------------- |
| caddy-active         | `infra_caddy-active`       | 80, 443          | edge+backend | -         | `docker exec infra_caddy-active caddy validate --config /etc/caddy/Caddyfile`    | `caddy-data:/data`, `caddy-config:/config`         |
| caddy-standby        | `infra_caddy-standby`      | 80, 443          | edge+backend | -         | `docker exec infra_caddy-standby caddy validate --config /etc/caddy/Caddyfile`   | `caddy-standby-data:/data`                         |
| keepalived †         | `infra_keepalived`         | host network     | host         | -         | `docker exec infra_keepalived keepalived -t`                                     | none (config-only)                                 |
| vault †              | `infra_vault`              | 8200             | infra        | -         | `docker exec infra_vault vault status`                                           | `vault-data:/vault/file`                           |
| postgres-replica-1 † | `infra_postgres-replica-1` | 5432             | infra        | -         | `docker exec infra_postgres-replica-1 pg_isready -U app`                         | `postgres_replica_1_data:/var/lib/postgresql/data` |
| postgres-replica-2 † | `infra_postgres-replica-2` | 5432             | infra        | -         | `docker exec infra_postgres-replica-2 pg_isready -U app`                         | `postgres_replica_2_data:/var/lib/postgresql/data` |
| redis-replica-1 †    | `infra_redis-replica-1`    | 6379             | infra        | -         | `docker exec infra_redis-replica-1 redis-cli ping`                               | `redis_replica_1_data:/data`                       |
| redis-replica-2 †    | `infra_redis-replica-2`    | 6379             | infra        | -         | `docker exec infra_redis-replica-2 redis-cli ping`                               | `redis_replica_2_data:/data`                       |
| redis-sentinel-1 †   | `infra_redis-sentinel-1`   | 26379            | infra        | -         | `docker exec infra_redis-sentinel-1 redis-cli -p 26379 sentinel master mymaster` | sentinel-config only                               |
| redis-sentinel-2 †   | `infra_redis-sentinel-2`   | 26379            | infra        | -         | `docker exec infra_redis-sentinel-2 redis-cli -p 26379 sentinel master mymaster` | sentinel-config only                               |
| redis-sentinel-3 †   | `infra_redis-sentinel-3`   | 26379            | infra        | -         | `docker exec infra_redis-sentinel-3 redis-cli -p 26379 sentinel master mymaster` | sentinel-config only                               |
| minio-backup †       | `infra_minio-backup`       | 9000, 9001       | infra        | -         | `docker exec infra_minio-backup mc admin info local`                             | `minio_backup_data:/data`                          |
| cloudflared †        | `infra_cloudflared`        | none             | infra        | -         | `just tunnel-test`                                                               | none (stateless)                                   |

## Quick Port Summary

| Context                | API  | Dashboard | Marketing | Postgres | PgBouncer | Redis | MinIO API/Console | SigNoz | ClickHouse | OTEL                |
| ---------------------- | ---- | --------- | --------- | -------- | --------- | ----- | ----------------- | ------ | ---------- | ------------------- |
| **Dev host**           | -    | -         | -         | 5432     | 6432      | 6379  | 9000 / 9001       | -      | -          | -                   |
| **Staging host**       | 3001 | 8081      | 8082      | 5432     | 6432      | 6379  | 9000 / 9001       | 3002   | 8123       | 4317 / 4318         |
| **Prod host**          | -    | -         | -         | -        | -         | -     | -                 | -      | -          | -                   |
| **Container internal** | 3000 | 8080      | 8080      | 5432     | 6432      | 6379  | 9000 / 9001       | 3001   | 8123       | 4317 / 4318 / 13133 |
