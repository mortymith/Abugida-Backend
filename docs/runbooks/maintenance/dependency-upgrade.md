# Dependency Upgrade

Update container image tags, validate in dev, security-scan, then deploy to production. All images must use pinned versions.

## Prerequisites

- Dev environment available (`just clean-dev && just setup-dev`)
- `just` CLI installed
- Approval for production change

## Steps

1. **Review pinned versions table**

   | Service        | Pinned Image                                 |
   | -------------- | -------------------------------------------- |
   | PostgreSQL     | postgres:17-alpine                           |
   | PgBouncer      | pgbouncer:1.18-alpine                        |
   | Redis          | redis:7.4-alpine                             |
   | MinIO          | minio/minio:RELEASE.2025-04-22T02-16-34Z     |
   | ClickHouse     | clickhouse/clickhouse-server:24.8-alpine     |
   | OTEL Collector | otel/opentelemetry-collector-contrib:0.113.0 |
   | SigNoz         | signoz/signoz:0.51.0                         |
   | Vault          | hashicorp/vault:1.18-alpine                  |
   | Cloudflared    | cloudflare/cloudflared:2024.12.2             |
   | Keepalived     | osixia/keepalived:2.0.20-alpine              |
   | Bun            | oven/bun:1.2.1-alpine                        |

2. **Update image tag in `compose.yml` or `.env`**

   ```bash
   vim .env
   # Update e.g. POSTGRES_IMAGE=postgres:17-alpine
   ```

3. **Test in dev environment**

   ```bash
   just clean-dev && just setup-dev
   ```

   Run full test suite and confirm all 15 services start healthy.

4. **Run security audit**

   ```bash
   just security-audit
   ```

   Review CVE reports. Block any high/critical CVEs before proceeding.

5. **Deploy to production**
   ```bash
   just restart SERVICE
   just health SERVICE
   ```
   Follow rolling-restart runbook order: infra → app → edge.

## Verification

- `just health all` passes
- `just security-audit` shows no new high/critical CVEs
- Application smoke tests pass on production
- SigNoz shows no error spike post-deploy
- `.env` version tags match running images: `docker inspect --format='{{.Config.Image}}' api-1`
