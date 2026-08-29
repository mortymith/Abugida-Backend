# Useful Commands Quick Reference

## Docker Compose Commands

| Command                                       | Description                                         |
| --------------------------------------------- | --------------------------------------------------- |
| `docker compose ps`                           | List all containers, their status, and mapped ports |
| `docker compose ps -a`                        | Include stopped containers                          |
| `docker compose logs -f --tail=100 <service>` | Follow logs (last 100 lines) for a service          |
| `docker compose logs -f --since=30m`          | Logs from all services in the last 30 minutes       |
| `docker compose exec <service> sh`            | Open a shell inside a running container             |
| `docker compose exec <service> <cmd>`         | Run a single command in a container                 |
| `docker compose restart <service>`            | Restart a single service                            |
| `docker compose up -d <service>`              | Start (or recreate) a service in background         |
| `docker compose down`                         | Stop and remove all containers, networks            |
| `docker compose up -d --scale <service>=3`    | Scale a service to N replicas                       |
| `docker compose pull`                         | Pull latest images for all services                 |

## Compose Validation

| Command                 | Description                                                                                      |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| `just validate-compose` | Validate all compose files using `docker compose config` for correctness and service consistency |

## Per-Service Exec Commands

| Service        | Command                                                                                | Purpose                                    |
| -------------- | -------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Postgres**   | `docker exec infra_postgres-primary pg_isready -U app`                                 | Check if Postgres is accepting connections |
| **Postgres**   | `docker exec infra_postgres-primary psql -U app -c '\l'`                               | List databases                             |
| **Postgres**   | `docker exec infra_postgres-primary psql -U app -c 'SELECT pg_current_wal_lsn();'`     | WAL position (for PITR)                    |
| **PgBouncer**  | `docker exec infra_pgbouncer psql -h localhost -p 6432 -U pgbouncer -c 'SHOW POOLS;'`  | Show connection pool stats                 |
| **Redis**      | `docker exec infra_redis-primary redis-cli ping`                                       | Verify Redis is responsive                 |
| **Redis**      | `docker exec infra_redis-primary redis-cli INFO replication`                           | Check replication status                   |
| **Redis**      | `docker exec infra_redis-sentinel-1 redis-cli -p 26379 SENTINEL master mymaster`       | Query sentinel for master info             |
| **MinIO**      | `docker exec infra_minio mc admin info local`                                          | Server info and health                     |
| **MinIO**      | `docker exec infra_minio mc ls local/`                                                 | List buckets                               |
| **ClickHouse** | `docker exec infra_clickhouse clickhouse-client --query 'SELECT 1'`                    | Basic connectivity check                   |
| **ClickHouse** | `docker exec infra_clickhouse clickhouse-client --query 'SELECT * FROM system.merges'` | Check active merges                        |
| **Vault**      | `docker exec infra_vault vault status`                                                 | Check sealed/unsealed state                |
| **Vault**      | `docker exec infra_vault vault kv list secret/`                                        | List secrets (prod + staging)              |
| **Caddy**      | `docker exec infra_caddy-active caddy validate --config /etc/caddy/Caddyfile`          | Validate Caddyfile config                  |

## Just Recipe Quick Reference

### Setup & Lifecycle

| Recipe         | Description                                                                                         |
| -------------- | --------------------------------------------------------------------------------------------------- |
| `just dev`     | Start dev environment (6 infrastructure services)                                                   |
| `just staging` | Start staging environment (10 services)                                                             |
| `just stop`    | Stop all services without removing volumes                                                          |
| `just down`    | Stop and remove containers, networks                                                                |
| _(manual)_     | Install required tools: Docker CE, Compose plugin, Just, Bun, Trivy — see each tool's official docs |

### Health & Observability

| Recipe                                                                       | Description                                               |
| ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| `just health`                                                                | Run all health checks                                     |
| `just health-api` / `health-dashboard` / `health-marketing` / `health-redis` | Individual service health                                 |
| `just health-replication`                                                    | Verify Redis replication status                           |
| `just obs-health`                                                            | Check observability pipeline (OTEL → ClickHouse → SigNoz) |
| `just diagnostics`                                                           | Collect full diagnostic bundle                            |
| `just logs <service>`                                                        | Tail logs for a specific service                          |
| `just logs-errors`                                                           | Show only error-level logs across all services            |

### Backup & Restore

| Recipe               | Description                                |
| -------------------- | ------------------------------------------ |
| `just backup-all`    | Backup Postgres, Redis, MinIO, and configs |
| `just backup-status` | Show last backup timestamps and sizes      |
| `just verify-backup` | Validate backup integrity                  |
| `just restore-test`  | Dry-run restore to a temp location         |
| `just restore-pitr`  | Point-in-time recovery for Postgres        |
| `just backup-prune`  | Remove backups older than retention policy |

### Deploy & Security

| Recipe                  | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `just deploy prod`      | Deploy updated images to production              |
| `just rollback`         | Roll back to previous deployment                 |
| `just rotate-secrets`   | Rotate all application secrets (Vault)           |
| `just validate-secrets` | Verify all secrets are present and valid         |
| `just port-scan`        | Scan for unexpected open ports                   |
| `just security-audit`   | Full security audit (secrets, configs, firewall) |

### Vault Operations

| Recipe                        | Description                                                    |
| ----------------------------- | -------------------------------------------------------------- |
| `just vault-init`             | Bootstrap Vault (init, unseal, configure PKI, create policies) |
| `just vault-unseal`           | Unseal Vault after restart                                     |
| `just vault-populate-secrets` | Seed secrets from CI environment into Vault                    |

## Common Troubleshooting

| Command                                       | Description                                    |
| --------------------------------------------- | ---------------------------------------------- |
| `docker system df`                            | Show disk usage by images, containers, volumes |
| `docker system df -v`                         | Detailed breakdown per object                  |
| `docker volume ls`                            | List all Docker volumes                        |
| `docker volume inspect <vol>`                 | Show volume mount path and driver              |
| `docker network inspect infra_infrastructure` | List containers on the infra network           |
| `docker compose top`                          | Show running processes inside each container   |
| `docker stats --no-stream`                    | One-shot CPU/memory usage per container        |
| `just disk-usage`                             | Disk usage summary for data volumes            |
| `just otel-status`                            | OTEL collector pipeline health                 |
| `just ch-health`                              | ClickHouse storage and query health            |
