# ═════════════════════════════════════════════════════════════════════════════════
# Justfile — Infrastructure Command Runner
# ADR-009, ADR-021
#
# Three-tier modular Docker Compose:
#   Dev:     10 services (infrastructure only)
#   Staging: 20 services (infrastructure + applications + observability + security)
#   Prod:    31 services (full stack + HA + security)
#
# Secrets strategy (ADR-006):
#   Dev:        .env file
#   Staging:    HashiCorp Vault (ADR-006)
#   Production: HashiCorp Vault (ADR-006)
#
# Requirements:
#   Required:  docker (compose v2), bash
#   Optional:  jq + vault CLI (vault ops) · act (local CI) · nmap (port-scan)
#              Missing optional tools are reported by a preflight guard,
#              not a raw "command not found" mid-recipe.
#
# Usage:
#   just                  # Grouped overview (default entrypoint)
#   just --list           # All recipes with descriptions
#   just <recipe>         # Run a single recipe
#
# ══ GROUPS ════════════════════════════════════════════════════════════════════
#  1. Setup & Bootstrap          just setup-dev | setup-staging | setup-prod
#  2. Environments               just dev-up | staging-up | prod-up ...
#  3. Deployment                 just deploy-prod | rollback | deployment-status
#  4. Health Checks              just health | health-api | health-all ...
#  5. Logs & Debugging           just logs <svc> | shell <svc> | psql | redis-cli | mc
#  6. Monitoring & Diagnostics   just container-stats | diagnostics | disk-usage
#  7. Observability & Alerting   just obs-health | otel-status | signoz ...
#  8. PowerSync                  just ps-status | ps-setup | ps-compact ...
#  9. Secrets Rotation           just rotate-secrets | validate-secrets
# 10. Vault Operations           just vault-init | vault-unseal | vault-status
# 11. Backup & Restore           just backup-all | restore-postgres ...
# 12. Security                   just security-audit | firewall-install ...
# 13. Edge & Tunnel (Prod)       just tunnel-status | cert-status ...
# 14. CI/CD                      just ci-status | ci-local
# 15. Testing                    just test-suite
# ═════════════════════════════════════════════════════════════════════════════════

# Load .env into every recipe's environment (same file compose reads), so
# ports, project name and credentials resolve identically everywhere.
# Absent .env is fine — recipes fall back to the defaults below.
set dotenv-load := true

# ─── Project identity ──────────────────────────────────────────────────────────

COMPOSE_PROJECT := env_var_or_default("COMPOSE_PROJECT_NAME", "infra")
# Child scripts (health.sh, check-all-services.sh, …) derive container names
# from COMPOSE_PROJECT_NAME — export ours so they always agree.
export COMPOSE_PROJECT_NAME := COMPOSE_PROJECT

# ─── Compose file sets (modular structure under docker/compose/) ───────────────

COMMON_FILES := "-f docker/compose/networks.yml -f docker/compose/volumes.yml"

DEV_FILES := COMMON_FILES + " -f docker/compose/base.yml -f docker/compose/profiles/dev.override.yml"
STAGING_FILES := COMMON_FILES + " -f docker/compose/base.yml -f docker/compose/app.yml -f docker/compose/observability.yml -f docker/compose/security.yml -f docker/compose/profiles/staging.override.yml"
PROD_FILES := COMMON_FILES + " -f docker/compose/base.yml -f docker/compose/app.yml -f docker/compose/observability.yml -f docker/compose/edge.yml -f docker/compose/scaling.yml -f docker/compose/security.yml -f docker/compose/profiles/prod.override.yml"

DEV_COMPOSE := "docker compose --project-directory . " + DEV_FILES
STAGING_COMPOSE := "docker compose --project-directory . " + STAGING_FILES
PROD_COMPOSE := "docker compose --project-directory . " + PROD_FILES

# ─── Pinned tooling images (keep in sync with docker/compose/) ─────────────────

MC_IMAGE := "minio/mc:RELEASE.2025-04-16T18-13-26Z" # same tag as init-minio service

# ─── Vault configuration (staging + production) ────────────────────────────────

VAULT_ADDR := "https://127.0.0.1:8200"
# 1.3 Fix: Default to verifying Vault TLS (set to "1" only for local dev)
VAULT_SKIP_VERIFY := env_var_or_default("VAULT_SKIP_VERIFY", "0")
# 2.8 Fix: Absolute path derived from justfile directory
VAULT_INIT_OUTPUT := justfile_directory() + "/data/vault/init-output.json"

# ─── Port defaults (resolved from environment/.env; matches base.yml mappings) ──

API_PORT_DEFAULT := env_var_or_default("API_PORT", "3001")
DASHBOARD_PORT_DEFAULT := env_var_or_default("DASHBOARD_PORT", "8081")
MARKETING_PORT_DEFAULT := env_var_or_default("MARKETING_PORT", "8082")
MINIO_API_PORT_DEFAULT := env_var_or_default("MINIO_API_PORT", "9000")
POWERSYNC_PORT_DEFAULT := env_var_or_default("POWERSYNC_PORT", "8085")
SIGNOZ_PORT_DEFAULT := env_var_or_default("SIGNOZ_FRONTEND_PORT", "3002")

# ─── Database identities (resolved from environment/.env; matches base.yml) ────

POSTGRES_USER_DEFAULT := env_var_or_default("POSTGRES_USER", "app")
POSTGRES_DB_DEFAULT := env_var_or_default("POSTGRES_DB", "app")

# ═══════════════════════════════════════════════════════════════════════════════
# 0. Help & Preflight Helpers
# ═══════════════════════════════════════════════════════════════════════════════

# Default entrypoint — grouped overview of what this justfile offers
@default: help

# Show grouped overview of all recipe groups (start here)
@help:
    echo "Abugida Infrastructure — Recipe Groups"
    echo "======================================="
    echo ""
    echo "  GET STARTED"
    echo "    just setup-dev            Full dev bring-up (.env + start + init)"
    echo "    just setup-staging        Full staging bring-up (+ apps, Vault)"
    echo "    just setup-prod           Full prod bring-up (full stack + HA)"
    echo ""
    echo "  EVERYDAY"
    echo "    just dev-up / dev-down    Start/stop dev infrastructure"
    echo "    just staging-build / prod-build   Build Docker images for an environment"
    echo "    just health               Probe service health endpoints (--core/--json)"
    echo "    just psql / redis-cli / mc   Database & object-store shells"
    echo "    just logs <service>       Tail a container's logs"
    echo "    just container-stats      CPU/memory per container"
    echo ""
    echo "  DEPLOY (prod)"
    echo "    just deploy-prod          Deploy via scripts/deploy/deploy.sh"
    echo "    just rollback             Roll back to previous version"
    echo "    just deployment-status    Active color, version, containers"
    echo ""
    echo "  OPERATIONS"
    echo "    just obs-health           Observability stack check"
    echo "    just ps-status            PowerSync replication lag"
    echo "    just rotate-secrets --dry-run   Preview secret rotation"
    echo "    just backup-all           Back up everything"
    echo "    just security-audit       Configs + deps + secrets audit"
    echo "    just tunnel-status        Cloudflare Tunnel state"
    echo ""
    echo "  DISCOVER MORE"
    echo "    just --list               All recipes with descriptions"
    echo "    just --summary            Recipe names only"
    echo ""

# Preflight guard: fail fast with an actionable message when an optional
# CLI is missing, instead of failing mid-recipe with "command not found".
[private]
_need cmd:
    @if ! command -v {{cmd}} > /dev/null 2>&1; then \
        echo "error: required command '{{cmd}}' not found in PATH" >&2; \
        echo "       install it first (see Requirements in the justfile header)" >&2; \
        exit 127; \
    fi

# ═══════════════════════════════════════════════════════════════════════════════
# 1. Setup & Bootstrap
# ═══════════════════════════════════════════════════════════════════════════════

# Generate development .env file with non-sensitive defaults
env-setup-dev:
    @if [ ! -f .env ]; then \
        echo "==> Copying .env.example to .env..."; \
        cp .env.example .env; \
        echo "==> .env created. Review and add sensitive values if needed."; \
    else \
        echo "==> .env already exists."; \
    fi

# Full dev environment bring-up (generate .env + start + init)
setup-dev: env-setup-dev
    @echo "==> Starting dev environment (10 services: infra only)..."
    {{DEV_COMPOSE}} up -d
    @echo "==> Waiting for core services to be healthy..."
    bash docker/init/wait-for-services.sh dev
    @echo "==> Initializing MinIO buckets (idempotent, best-effort)..."
    {{DEV_COMPOSE}} run --rm init-minio || true
    @echo "==> Dev environment ready. Next: just health"

# Full staging environment bring-up (secrets + start + init + vault)
setup-staging:
    @echo "==> Ensuring Vault TLS material exists..."
    bash docker/config/vault/scripts/init-vault-tls.sh
    @echo "==> Starting staging environment (20 services: infra + apps + observability + security)..."
    {{STAGING_COMPOSE}} up -d
    @echo "==> Waiting for core services to be healthy..."
    bash docker/init/wait-for-services.sh staging
    @echo "==> Initializing MinIO buckets (idempotent, best-effort)..."
    {{STAGING_COMPOSE}} run --rm init-minio || true
    @echo "==> Initializing Vault (if first run)..."
    just _vault-bootstrap
    @echo "==> Staging environment ready. Next: just health"

# Full prod environment bring-up (secrets + start + init + vault)
setup-prod:
    @echo "==> Ensuring Vault TLS material exists..."
    bash docker/config/vault/scripts/init-vault-tls.sh
    @echo "==> Starting prod environment (31 services: full stack)..."
    {{PROD_COMPOSE}} up -d
    @echo "==> Waiting for core services to be healthy..."
    bash docker/init/wait-for-services.sh prod
    @echo "==> Initializing MinIO buckets (with backup endpoint, idempotent)..."
    {{PROD_COMPOSE}} run --rm init-minio || true
    @echo "==> Initializing Redis cluster (best-effort)..."
    bash docker/init/init-redis.sh || true
    @echo "==> Initializing Vault (if first run)..."
    just _vault-bootstrap
    @echo "==> Prod environment ready. Next: just health"

# ═══════════════════════════════════════════════════════════════════════════════
# 2. Environments (Compose Lifecycle)
# ═══════════════════════════════════════════════════════════════════════════════

# Start dev services (infrastructure only: postgres, pgbouncer, redis, minio, powersync)
dev-up:
    {{DEV_COMPOSE}} up -d

# Stop dev services
dev-down:
    {{DEV_COMPOSE}} down

# DESTRUCTIVE: stop dev services AND delete their volumes (data loss)
dev-clean:
    {{DEV_COMPOSE}} down -v
    @echo "==> Dev volumes removed."

# Recreate dev services (pick up config/Dockerfile changes)
dev-recreate:
    {{DEV_COMPOSE}} up -d --force-recreate

# Start staging services (infra + applications + observability)
staging-up:
    {{STAGING_COMPOSE}} up -d

# Stop staging services
staging-down:
    {{STAGING_COMPOSE}} down

# DESTRUCTIVE: stop staging services AND delete their volumes (data loss)
staging-clean:
    {{STAGING_COMPOSE}} down -v
    @echo "==> Staging volumes removed."

# Recreate staging services
staging-recreate:
    {{STAGING_COMPOSE}} up -d --force-recreate

# Start prod services (full stack: 31 services)
prod-up:
    {{PROD_COMPOSE}} up -d

# Stop prod services
prod-down:
    {{PROD_COMPOSE}} down

# DESTRUCTIVE: stop prod services AND delete their volumes (data loss)
prod-clean:
    {{PROD_COMPOSE}} down -v
    @echo "==> Prod volumes removed."

# Recreate prod services
prod-recreate:
    {{PROD_COMPOSE}} up -d --force-recreate

# Build all Docker images required by the staging environment (parallel)
staging-build:
    @echo "==> Building staging Docker images..."
    {{STAGING_COMPOSE}} build
    @echo "==> Staging images built successfully."

# Build all Docker images required by the production environment (parallel)
prod-build:
    @echo "==> Building production Docker images..."
    {{PROD_COMPOSE}} build
    @echo "==> Production images built successfully."

# Validate modular compose structure (all three tiers); non-zero on any failure
validate-compose:
    #!/usr/bin/env bash
    set -uo pipefail
    rc=0
    validate() {
      local tier="$1"
      shift
      printf '==> Validating %s compose... ' "${tier}"
      if "$@" config > /dev/null 2>&1; then
        echo "OK"
      else
        echo "FAILED"
        rc=1
      fi
    }
    validate dev {{DEV_COMPOSE}}
    validate staging {{STAGING_COMPOSE}}
    validate prod {{PROD_COMPOSE}}
    if [ "${rc}" -ne 0 ]; then
      echo "error: one or more compose tiers are invalid" >&2
    fi
    exit "${rc}"

# ═══════════════════════════════════════════════════════════════════════════════
# 3. Deployment
# ═══════════════════════════════════════════════════════════════════════════════

# Deploy production (blue-green or recreate per DEPLOY_STRATEGY)
deploy-prod version="":
    DEPLOY_VERSION="{{version}}" bash scripts/deploy/deploy.sh prod

# Rollback to previous deployment
rollback:
    bash scripts/deploy/rollback.sh

# Show current deployment status (active color, version, container states)
deployment-status:
    bash scripts/deploy/pre-flight.sh --status-only

# Dynamic upstream switch for blue-green deployments
dynamic-upstream *ARGS:
    bash scripts/deploy/dynamic-upstream.sh {{ARGS}}

# ═══════════════════════════════════════════════════════════════════════════════
# 4. Health Checks
# ═══════════════════════════════════════════════════════════════════════════════

# Probe service health endpoints (mirrors each compose healthcheck).
# Flags: --core (infra only), --json (TSV for scripting). Absent services → skip.
health *ARGS:
    bash scripts/monitoring/health.sh {{ARGS}}

# Run comprehensive Docker health check (all containers)
health-all:
    bash scripts/monitoring/check-all-services.sh

# Check API health (liveness + db)
health-api:
    @echo "── GET /health ──"
    @curl -sf --max-time 5 http://localhost:{{API_PORT_DEFAULT}}/health && echo || echo "(not reachable)"
    @echo ""
    @echo "── GET /db-health ──"
    @curl -sf --max-time 5 http://localhost:{{API_PORT_DEFAULT}}/db-health && echo || echo "(not reachable)"

# Check Dashboard health (liveness)
health-dashboard:
    @curl -sf --max-time 5 http://localhost:{{DASHBOARD_PORT_DEFAULT}}/health && echo || echo "(not reachable)"

# Check Marketing health (liveness)
health-marketing:
    @curl -sf --max-time 5 http://localhost:{{MARKETING_PORT_DEFAULT}}/health && echo || echo "(not reachable)"

# Check PostgreSQL replication lag (prod only)
health-replication:
    bash scripts/monitoring/check-replication-lag.sh

# Check Redis health (authenticated PING as the app ACL user)
health-redis:
    @docker exec {{COMPOSE_PROJECT}}_redis-primary sh -c 'exec redis-cli --no-auth-warning -u "redis://app:$REDIS_PASSWORD@127.0.0.1:6379" ping'

# ═══════════════════════════════════════════════════════════════════════════════
# 5. Logs & Debugging
# ═══════════════════════════════════════════════════════════════════════════════

# Open shell in a running container (bash if installed, POSIX sh otherwise)
shell service="postgres-primary":
    docker exec -it {{COMPOSE_PROJECT}}_{{service}} sh -c 'command -v bash > /dev/null 2>&1 && exec bash || exec sh'

# Open psql against postgres-primary (as $POSTGRES_USER on $POSTGRES_DB)
psql:
    docker exec -it {{COMPOSE_PROJECT}}_postgres-primary psql -U {{POSTGRES_USER_DEFAULT}} -d {{POSTGRES_DB_DEFAULT}}

# Open redis-cli against redis-primary (authenticated as the app ACL user)
redis-cli:
    docker exec -it {{COMPOSE_PROJECT}}_redis-primary sh -c 'exec redis-cli --no-auth-warning -u "redis://app:$REDIS_PASSWORD@127.0.0.1:6379"'

# Run MinIO client against local MinIO — e.g. just mc ls local/ or just mc admin info local.
# Ephemeral container on the infrastructure network; credentials passed via the
# MC_HOST alias env var, so nothing is persisted to ~/.mc/config.json.
mc *ARGS:
    docker run --rm --network {{COMPOSE_PROJECT}}_infrastructure \
        -e MC_HOST_local="http://$MINIO_ROOT_USER:$MINIO_ROOT_PASSWORD@minio:9000" \
        {{MC_IMAGE}} {{ARGS}}

# Re-run MinIO bucket/policy initialization (idempotent one-shot init-minio job)
minio-init:
    {{DEV_COMPOSE}} run --rm init-minio

# Tail logs for a service
logs service:
    docker logs -f --tail 100 {{COMPOSE_PROJECT}}_{{service}}

# Tail error logs for a service (stderr only; stays quiet when no matches)
logs-errors service:
    docker logs -f --tail 100 {{COMPOSE_PROJECT}}_{{service}} 2>&1 | grep -iE 'error|fatal|panic|warn|critical' --color=always || true

# ═══════════════════════════════════════════════════════════════════════════════
# 6. Monitoring & Diagnostics
# ═══════════════════════════════════════════════════════════════════════════════

# Run full system health check + diagnostics
diagnostics:
    bash scripts/monitoring/diagnostics.sh

# Check disk usage for all volumes
disk-usage:
    bash scripts/monitoring/disk-usage.sh

# Show resource usage for all containers
container-stats:
    # quadruple braces escape to literal double braces for docker's Go template
    docker stats --no-stream --format "table {{{{.Name}}\t{{{{.CPUPerc}}\t{{{{.MemUsage}}\t{{{{.NetIO}}\t{{{{.BlockIO}}"

# ═══════════════════════════════════════════════════════════════════════════════
# 7. Observability & Alerting
# ═══════════════════════════════════════════════════════════════════════════════

# Open a SigNoz page in the browser (dashboard | metrics | alerts).
# In production these are reached via the Cloudflare Tunnel domain instead.
signoz target="dashboard":
    @path=""; case "{{target}}" in \
        dashboard) path="" ;; \
        metrics)   path="/metrics" ;; \
        alerts)    path="/alerts" ;; \
        *) echo "error: target must be dashboard | metrics | alerts (got '{{target}}')" >&2; exit 64 ;; \
    esac; \
    echo "SigNoz {{target}}: http://localhost:{{SIGNOZ_PORT_DEFAULT}}${path}"; \
    echo "(In production, access via Cloudflare Tunnel domain)"

# Check OTEL collector pipeline status
otel-status:
    @echo "==> OTEL Collector"
    @if docker exec {{COMPOSE_PROJECT}}_otel-collector bash -c 'echo > /dev/tcp/127.0.0.1/13133' 2> /dev/null; then \
        echo "  health extension OK (:13133)"; else echo "  (not reachable)"; fi
    @echo "==> SigNoz"
    @out=$(docker exec {{COMPOSE_PROJECT}}_signoz-frontend wget -qO- http://localhost:8080/api/v1/health 2>/dev/null); \
        if [ -n "$out" ]; then printf '%s\n' "$out" | head -5; else echo "  (not reachable)"; fi
    @echo "==> ClickHouse"
    @if [ -n "${CLICKHOUSE_PASSWORD:-}" ]; then \
        docker exec {{COMPOSE_PROJECT}}_clickhouse clickhouse-client --password "$CLICKHOUSE_PASSWORD" --query "SELECT 1" 2>/dev/null && echo "  OK" || echo "  (not reachable)"; \
    else \
        docker exec {{COMPOSE_PROJECT}}_clickhouse clickhouse-client --query "SELECT 1" 2>/dev/null && echo "  OK" || echo "  (not reachable)"; \
    fi

# Check ClickHouse health and TTL configuration
ch-health:
    @echo "==> ClickHouse ping"
    @if [ -n "${CLICKHOUSE_PASSWORD:-}" ]; then \
        CH_CLIENT="clickhouse-client --password $CLICKHOUSE_PASSWORD"; else CH_CLIENT="clickhouse-client"; fi
    @docker exec {{COMPOSE_PROJECT}}_clickhouse $$CH_CLIENT --query "SELECT 'OK'" 2>/dev/null || echo "  (not reachable)"
    @echo "==> Tables with TTL"
    @docker exec {{COMPOSE_PROJECT}}_clickhouse $$CH_CLIENT --query "SELECT database, table, ttl_expression FROM system.tables WHERE database IN ('signoz_metrics', 'signoz_traces', 'signoz_logs') AND ttl_expression != '' FORMAT Pretty" 2>/dev/null || echo "  (no TTL tables yet — SigNoz may still be initializing)"

# Full observability stack health check
obs-health: otel-status ch-health
    @echo "==> Full observability stack checked."

# Send a test alert to Telegram via shared notifier (ADR-018)
telegram-test-alert message="Test alert from infrastructure":
    LEVEL=test CONTEXT=ops TASK=justfile bash scripts/backup/telegram-notify.sh "{{message}}"

# ═══════════════════════════════════════════════════════════════════════════════
# 8. PowerSync Operations (Logical Replication)
# ═══════════════════════════════════════════════════════════════════════════════

# Check PowerSync API health and replication slot status
ps-status:
    @echo "==> PowerSync API health"
    @curl -sf http://localhost:{{POWERSYNC_PORT_DEFAULT}}/probes/liveness 2>/dev/null && echo "  OK" || echo "  (not reachable — is powersync-api running?)"
    @echo "==> Replication slots (logical)"
    @docker exec {{COMPOSE_PROJECT}}_postgres-primary psql -U app -d app -c "SELECT slot_name, active, pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) AS lag_bytes FROM pg_replication_slots WHERE slot_type = 'logical';" 2>/dev/null || echo "  (could not query slot — PostgreSQL may not be ready)"

# Tail PowerSync logs (service = api | sync | setup)
ps-logs service="api":
    just logs powersync-{{service}}

# Restart both PowerSync services
ps-restart:
    docker restart {{COMPOSE_PROJECT}}_powersync-api {{COMPOSE_PROJECT}}_powersync-sync
    @echo "==> PowerSync restarted. Verify with: just ps-status"

# Check PowerSync replication slot lag in detail.
# PowerSync creates and owns its logical slot (auto-generated name).
ps-slot-lag:
    @docker exec {{COMPOSE_PROJECT}}_postgres-primary psql -U app -d app -c "SELECT slot_name, active, pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) AS lag_bytes, pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) AS flush_lag_bytes FROM pg_replication_slots WHERE slot_type = 'logical';" 2>/dev/null || echo "  (could not query slot)"

# Run the idempotent PowerSync DB provisioning job (roles, grants, publication).
# Also runs automatically on every stack start, before powersync-sync/api.
# Safe on fresh AND existing volumes. env = dev | staging | prod
[private]
_ps-run-setup COMPOSE_CMD:
    {{COMPOSE_CMD}} run --rm powersync-setup

# Provision PowerSync DB roles/publication (env = dev | staging | prod)
ps-setup env="dev":
    @if [ "{{env}}" != "dev" ] && [ "{{env}}" != "staging" ] && [ "{{env}}" != "prod" ]; then \
        echo "error: env must be one of: dev | staging | prod (got '{{env}}')" >&2; \
        exit 64; \
    fi
    @just _ps-run-setup "{{ if env == 'dev' { DEV_COMPOSE } else if env == 'staging' { STAGING_COMPOSE } else { PROD_COMPOSE } }}"

# Run bucket compaction now (PowerSync storage grows as append-only op-log;
# schedule via cron in prod — see docs/services/powersync.md)
ps-compact:
    docker exec {{COMPOSE_PROJECT}}_powersync-api compact

# ═══════════════════════════════════════════════════════════════════════════════
# 9. Secrets Rotation
# ═══════════════════════════════════════════════════════════════════════════════

# Validate all secrets against NIST SP 800-63B
validate-secrets:
    bash scripts/security/validate-secrets.sh

# Rotate all secrets (db, api, redis) via Vault — use --dry-run to preview
rotate-secrets *ARGS:
    bash scripts/security/rotate-secrets.sh {{ARGS}}

# Rotate database password only (via Vault dynamic credentials)
rotate-db-password:
    bash scripts/security/rotate-secrets.sh --db

# Rotate API secret key only (via Vault)
rotate-api-secret:
    bash scripts/security/rotate-secrets.sh --api

# Rotate Redis passwords only (via Vault)
rotate-redis-password:
    bash scripts/security/rotate-secrets.sh --redis

# Reload PgBouncer's auth cache (SIGHUP) — required after any init job
# rotated a pooler-exposed role's password (app/signoz): a live PgBouncer
# keeps SCRAM verifiers in memory and rejects clients until reloaded.
pgbouncer-reload:
    docker exec {{COMPOSE_PROJECT}}_pgbouncer kill -HUP 1
    @echo "==> PgBouncer auth reloaded."

# ═══════════════════════════════════════════════════════════════════════════════
# 10. Vault Operations (Staging + Production Only)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Tiered strategy (ADR-006):
#   Dev:        Environment variables from .env file
#   Staging:    HashiCorp Vault (dynamic secrets + PKI)
#   Production: HashiCorp Vault (dynamic secrets + PKI)
#
# Docker secrets have been removed entirely; sensitive values reach
# containers as environment variables in every environment.
# ═══════════════════════════════════════════════════════════════════════════════

# Show Vault status (sealed/unsealed, initialized)
vault-status: (_need "vault")
    VAULT_ADDR={{VAULT_ADDR}} VAULT_SKIP_VERIFY={{VAULT_SKIP_VERIFY}} vault status

# Idempotent Vault bootstrap for setup-staging / setup-prod.
# Decides between unseal and re-init by inspecting the ACTUAL Vault
# initialization state, not merely the presence of init-output.json.
# init-output.json lives on the host, so `*-clean` (which removes the
# Vault storage volume) leaves it stale — in that case we re-initialize.
[private]
_vault-bootstrap:
    @export VAULT_ADDR={{VAULT_ADDR}}; \
     export VAULT_SKIP_VERIFY={{VAULT_SKIP_VERIFY}}; \
     if [ ! -f {{VAULT_INIT_OUTPUT}} ]; then \
         echo "==> No Vault init output found — initializing..."; \
         just vault-init; \
         just vault-unseal; \
         just vault-populate-secrets-run; \
         exit 0; \
     fi; \
     INITIALIZED=$(vault status -format=json 2>/dev/null | jq -r '.initialized // "false"'); \
     if [ "${INITIALIZED}" = "true" ]; then \
         echo "==> Vault already initialized (storage intact) — unsealing..."; \
         just vault-unseal; \
     else \
         echo "==> Vault init output is stale (storage wiped by clean) — re-initializing..."; \
         rm -f {{VAULT_INIT_OUTPUT}}; \
         just vault-init; \
         just vault-unseal; \
         just vault-populate-secrets-run; \
     fi

# Initialize Vault (run ONCE) — saves keys to gitignored file
vault-init:
    VAULT_ADDR={{VAULT_ADDR}} \
    VAULT_SKIP_VERIFY={{VAULT_SKIP_VERIFY}} \
    INIT_OUTPUT_FILE={{VAULT_INIT_OUTPUT}} \
    bash docker/config/vault/scripts/vault-init.sh

# Unseal Vault (reads keys from init-output.json)
vault-unseal:
    VAULT_ADDR={{VAULT_ADDR}} \
    VAULT_SKIP_VERIFY={{VAULT_SKIP_VERIFY}} \
    INIT_OUTPUT_FILE={{VAULT_INIT_OUTPUT}} \
    bash docker/config/vault/scripts/vault-unseal.sh

# Populate Vault with secrets (requires VAULT_TOKEN)
vault-populate-secrets: (_need "jq")
    @echo "Set VAULT_TOKEN first:"
    @echo "  export VAULT_TOKEN=$(jq -r .root_token {{VAULT_INIT_OUTPUT}})"
    @echo "  just vault-populate-secrets-run"
    @exit 1

# Internal: actually run vault-secrets.sh (called by setup-prod / setup-staging)
vault-populate-secrets-run: (_need "jq")
    @if [ -z "${VAULT_TOKEN:-}" ]; then \
        export VAULT_TOKEN=$(jq -r .root_token {{VAULT_INIT_OUTPUT}}); \
    fi; \
    VAULT_ADDR={{VAULT_ADDR}} \
    VAULT_SKIP_VERIFY={{VAULT_SKIP_VERIFY}} \
    bash docker/config/vault/scripts/vault-secrets.sh

# Rotate PostgreSQL password via Vault database engine
vault-rotate-db-password: (_need "vault") (_need "jq")
    @echo "==> Rotating dynamic database credentials..."
    VAULT_ADDR={{VAULT_ADDR}} \
    VAULT_SKIP_VERIFY={{VAULT_SKIP_VERIFY}} \
    vault read -format=json database/creds/app-readwrite | jq -r '.data'

# ═══════════════════════════════════════════════════════════════════════════════
# 11. Backup & Restore
# ═══════════════════════════════════════════════════════════════════════════════

# Backup PostgreSQL database (full dump + WAL upload)
backup-postgres:
    bash scripts/backup/backup-postgres.sh

# Backup Redis data (SAVE on replica, integrity check, S3)
backup-redis:
    bash scripts/backup/backup-redis.sh

# Backup MinIO data
backup-minio:
    bash scripts/backup/backup-minio.sh

# Backup configuration files (docker/config/, docker/dockerfiles/, justfile)
backup-config:
    bash scripts/backup/backup-config.sh

# Backup observability data (ClickHouse + SigNoz)
backup-monitoring:
    bash scripts/backup/backup-monitoring.sh

# Create all backups (PostgreSQL + Redis + MinIO + Config + Monitoring)
backup-all: backup-postgres backup-redis backup-minio backup-config backup-monitoring
    @echo "==> All backups complete."

# Show backup status (last-run timestamps per type)
backup-status:
    @echo "==> Last backup timestamps:"
    @for bt in postgres redis config monitoring minio; do \
        ts_file="data/backups/$bt/.last-backup"; \
        if [ -f "$ts_file" ]; then \
            echo "  $bt: $(cat $ts_file)"; \
        else \
            echo "  $bt: (never)"; \
        fi; \
    done

# Verify backup integrity (checksums + pg_restore + redis-check-rdb)
verify-backup:
    bash scripts/backup/verify-backup.sh

# Prune old backups beyond retention window
backup-prune:
    bash scripts/backup/backup-prune.sh

# Install/uninstall/status backup cron schedule (prod only)
backup-schedule action="status":
    sudo bash scripts/backup/backup-schedule.sh {{action}}

# Apply S3 lifecycle policy (storage tiering)
s3-lifecycle:
    bash scripts/backup/apply-s3-lifecycle.sh

# Weekly automated restore test
restore-test:
    bash scripts/backup/verify-backup.sh --restore-test

# Point-in-time recovery (PITR) for PostgreSQL
restore-pitr timestamp="":
    bash scripts/restore/restore-point-in-time.sh "{{timestamp}}"

# Restore configuration from backup
restore-config:
    bash scripts/restore/restore-config.sh

# Restore PostgreSQL from latest or specified backup
restore-postgres file="":
    bash scripts/restore/restore-postgres.sh "{{file}}"

# Restore Redis from latest or specified backup
restore-redis file="":
    bash scripts/restore/restore-redis.sh "{{file}}"

# Restore MinIO from latest or specified backup
restore-minio file="":
    bash scripts/restore/restore-minio.sh "{{file}}"

# ═══════════════════════════════════════════════════════════════════════════════
# 12. Security
# ═══════════════════════════════════════════════════════════════════════════════

# Run full security audit (configs + deps + secrets)
security-audit: check-configs audit-dependencies validate-secrets
    @echo "==> Full security audit complete."

# Audit Dockerfiles, lockfiles, and dependencies for vulnerabilities
audit-dependencies:
    bash scripts/security/audit-dependencies.sh

# Scan all config files for insecure defaults (Caddy, Vault, Redis, Pg, CH)
check-configs:
    bash scripts/security/check-configs.sh

# Install ALL host-level iptables firewall rules (Redis + Pg + Vault + cross-tier)
firewall-install:
    sudo bash scripts/security/firewall-install-all.sh install

# Teardown ALL host-level iptables firewall rules
firewall-teardown:
    sudo bash scripts/security/firewall-install-all.sh teardown

# Show ALL firewall rule status
firewall-status:
    sudo bash scripts/security/firewall-install-all.sh status

# Apply Redis host firewall rules (prod, run as root)
redis-firewall-install:
    sudo bash scripts/security/redis-firewall.sh install

# Remove Redis host firewall rules
redis-firewall-teardown:
    sudo bash scripts/security/redis-firewall.sh teardown

# Show Redis firewall status
redis-firewall-status:
    sudo bash scripts/security/redis-firewall.sh status

# Apply PostgreSQL firewall rules (prod, run as root)
postgres-firewall-install:
    sudo bash scripts/security/postgres-firewall.sh install

# Remove PostgreSQL firewall rules
postgres-firewall-teardown:
    sudo bash scripts/security/postgres-firewall.sh teardown

# Apply Vault firewall rules (prod, run as root)
vault-firewall-install:
    sudo bash scripts/security/vault-firewall.sh install

# Remove Vault firewall rules
vault-firewall-teardown:
    sudo bash scripts/security/vault-firewall.sh teardown

# Run port scan (nmap) to verify only expected ports are open
port-scan target="": (_need "nmap")
    bash docker/tests/security/nmap/scan-ports.sh {{ if target != "" { "--target " + target } else { "" } }}

# ═══════════════════════════════════════════════════════════════════════════════
# 13. Edge & Tunnel (Production Only, ADR-020)
# ═══════════════════════════════════════════════════════════════════════════════

# Check Cloudflare Tunnel status
tunnel-status:
    @docker exec {{COMPOSE_PROJECT}}_cloudflared cloudflared tunnel list 2>/dev/null || echo "  (cloudflared not running)"

# Restart Cloudflare Tunnel
tunnel-restart:
    @docker restart {{COMPOSE_PROJECT}}_cloudflared
    @echo "==> Tunnel restarted."

# Tail Cloudflare Tunnel logs
tunnel-logs:
    @docker logs -f --tail 50 {{COMPOSE_PROJECT}}_cloudflared

# Validate tunnel access (SigNoz tunneled, Vault never exposed)
tunnel-test *ARGS:
    bash docker/tests/security/tunnel-access-test.sh {{ARGS}}

# Check certificate status (via Caddy admin API locally, ADR-001/ADR-011)
cert-status:
    @curl -sf https://localhost/health 2>/dev/null && echo "TLS OK" || echo "Certificate check failed (dev: use http://localhost)"

# Reload Caddy config; certificates re-obtained automatically when due
cert-force-renewal:
    @docker exec {{COMPOSE_PROJECT}}_caddy-active caddy reload --config /etc/caddy/Caddyfile
    @echo "==> Caddy reloaded (certificates will be re-obtained if needed)."

# ═══════════════════════════════════════════════════════════════════════════════
# 14. CI/CD
# ═══════════════════════════════════════════════════════════════════════════════
#
# Workflow architecture (see .github/workflows/):
#   ci.yml              — lint, typecheck, test, build, integration test, publish artifact
#   security.yml        — dependency audit, config check, container scanning (Trivy)
#   deploy-staging.yml  — consume CI artifact, deploy to staging, health check
#   deploy-prod.yml     — consume CI artifact, approval gate, deploy to prod, health check, rollback
#
# Artifact flow:
#   CI builds images tagged with immutable git SHA ->
#   Security scans those images ->
#   deploy-staging / deploy-prod consume the exact same artifact
#
# act compatibility:
#   act -W .github/workflows/ci.yml            # Full CI (lint, build, test)
#   act -W .github/workflows/security.yml       # Full security scan
#   # deploy-staging and deploy-prod require self-hosted runner + GitHub Environments
# ═══════════════════════════════════════════════════════════════════════════════

# Show CI/CD workflow status and architecture
ci-status:
    @echo "========================================"
    @echo "  CI/CD Workflow Architecture"
    @echo "========================================"
    @echo ""
    @echo "  1. ci.yml              lint -> typecheck -> unit test -> build -> integration test"
    @echo "  2. security.yml        dependency audit -> config check -> compose validation -> image scan"
    @echo "  3. deploy-staging.yml  verify CI/Security -> deploy artifact -> health check"
    @echo "  4. deploy-prod.yml     verify CI/Security -> approval gate -> deploy artifact -> health check"
    @echo ""
    @echo "  Artifact: images-<git-sha-short> (immutable, built once by CI)"
    @echo ""
    @echo "  Local testing (act):"
    @echo "    act -W .github/workflows/ci.yml"
    @echo "    act -W .github/workflows/security.yml"
    @echo ""
    @echo "  Production deploy (manual, requires approval):"
    @echo "    GitHub Actions -> Deploy to Production -> enter SHA tag"
    @echo ""

# Run CI locally via act (lint, build, test — no deploy)
ci-local: (_need "act")
    @echo "==> Running CI workflow locally via act..."
    act -W .github/workflows/ci.yml

# Run security scan locally via act
ci-security-local: (_need "act")
    @echo "==> Running Security workflow locally via act..."
    act -W .github/workflows/security.yml

# Run security scan locally (mirrors .github/workflows/security.yml)
ci-security-scan: check-configs audit-dependencies
    @echo "==> CI security scan complete (image scan requires Docker + Trivy)."

# ═══════════════════════════════════════════════════════════════════════════════
# 15. Testing
# ═══════════════════════════════════════════════════════════════════════════════

# Run integration test suite (smoke > API > cache > DB)
test-suite group="all":
    bash docker/tests/integration/test-suite.sh --group {{group}}

# ═══════════════════════════════════════════════════════════════════════════════
# EXTENDING THIS FILE
# ═══════════════════════════════════════════════════════════════════════════════
#
# 1. Pick the numbered group above that matches your recipe's domain and add it
#    there. Do not create a new group unless the domain is genuinely new.
# 2. New group checklist:
#      - Add a numbered banner section (═══ style, matching existing ones)
#      - Register it in the GROUPS table in the header comment
#      - Add one representative line to the `help` recipe
# 3. Recipe conventions:
#      - First line after the name = description (shown by `just --list`)
#      - Wrap long shell pipelines in a scripts/ helper instead of inline
#      - "$" passes through to the shell unchanged: write $(...) and ${var}
#        directly — never "$$", which the shell reads as its PID
#      - Destructive commands belong behind an explicit action arg (install/
#        teardown), never as bare side effects; prefix descriptions of
#        data-losing recipes with "DESTRUCTIVE:"
#      - Output style: actions as "==> …", results indented two spaces,
#        absence as "(not reachable)", failures as "error: …" on stderr
#      - Recipes needing optional host CLIs declare them via : (_need "<cmd>")
#      - Prefer delegating multi-step logic to scripts/<domain>/<name>.sh
#
# Template:
#
#   # One-line description shown by `just --list`
#   my-recipe arg="default":
#       bash scripts/my-domain/my-script.sh {{arg}}
#
# ═══════════════════════════════════════════════════════════════════════════════
