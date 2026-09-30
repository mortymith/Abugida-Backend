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
#   Optional:  pnpm (db:push) · curl (HTTP probes) · jq + vault CLI (vault ops)
#              · nmap (port-scan) · sudo (firewall / cron)
#              Missing optional tools are reported by a preflight guard
#              (_need / _need-root / scripts/lib/common.sh: require_cmd),
#              not a raw "command not found" mid-recipe.
#
# Shared shell libraries (single source of truth, do not duplicate here):
#   scripts/lib/compose.sh  — tiered compose file sets + dc <tier> <args>
#   scripts/lib/common.sh   — logging, env/.env resolution, preflight guards
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
# 14. Testing                    just test-suite
# ═════════════════════════════════════════════════════════════════════════════════

# Load .env into every recipe's environment (same file compose reads), so
# ports, project name and credentials resolve identically everywhere.
# Absent .env is fine — every value below falls back to a built-in default.
set dotenv-load := true

# Recipes are bash with strict mode: unset variables, failed commands and
# broken pipes all abort instead of silently continuing.
set shell := ["bash", "-euo", "pipefail", "-c"]

# ─── Project identity ──────────────────────────────────────────────────────────

# Resolution order for every value below: exported env var → .env → default.
# `set dotenv-load := true` puts .env in the process env, so one
# env_var_or_default call covers both sources.
COMPOSE_PROJECT := env_var_or_default("COMPOSE_PROJECT_NAME", "infra")
# Child scripts (health.sh, check-all-services.sh, …) derive container names
# from COMPOSE_PROJECT_NAME — export ours so they always agree.
export COMPOSE_PROJECT_NAME := COMPOSE_PROJECT

# ─── Service identities (container_name stems declared in docker/compose/) ────
# Overridable so a deployment with different service names needs no justfile
# edit. Never hardcode these inline in a recipe.

POSTGRES_SERVICE := env_var_or_default("POSTGRES_SERVICE", "postgres-primary")
PGBOUNCER_SERVICE := env_var_or_default("PGBOUNCER_SERVICE", "pgbouncer")
REDIS_SERVICE := env_var_or_default("REDIS_SERVICE", "redis-primary")
REDIS_ACL_USER := env_var_or_default("REDIS_ACL_USER", "app")
MINIO_SERVICE := env_var_or_default("MINIO_SERVICE", "minio")
POWERSYNC_SERVICE_PREFIX := env_var_or_default("POWERSYNC_SERVICE_PREFIX", "powersync-")
OTEL_SERVICE := env_var_or_default("OTEL_SERVICE", "otel-collector")
SIGNOZ_SERVICE := env_var_or_default("SIGNOZ_SERVICE", "signoz-frontend")
CLICKHOUSE_SERVICE := env_var_or_default("CLICKHOUSE_SERVICE", "clickhouse")
CLOUDFLARED_SERVICE := env_var_or_default("CLOUDFLARED_SERVICE", "cloudflared")
CADDY_SERVICE := env_var_or_default("CADDY_SERVICE", "caddy-active")
INFRA_NETWORK := COMPOSE_PROJECT + "_infrastructure"

# ─── Pinned tooling images (keep in sync with docker/compose/) ─────────────────

MC_IMAGE := "minio/mc:RELEASE.2025-04-16T18-13-26Z" # same tag as init-minio service

# ─── Vault configuration (staging + production) ────────────────────────────────

VAULT_ADDR := env_var_or_default("VAULT_ADDR", "https://127.0.0.1:8200")
# 1.3 Fix: Default to verifying Vault TLS (set to "1" only for local dev)
VAULT_SKIP_VERIFY := env_var_or_default("VAULT_SKIP_VERIFY", "0")
# 2.8 Fix: Absolute path derived from justfile directory
VAULT_INIT_OUTPUT := env_var_or_default("VAULT_INIT_OUTPUT", justfile_directory() + "/data/vault/init-output.json")

# ─── Port defaults (resolved from environment/.env; matches base.yml mappings) ──

API_PORT_DEFAULT := env_var_or_default("API_PORT", "3001")
DASHBOARD_PORT_DEFAULT := env_var_or_default("DASHBOARD_PORT", "8081")
MARKETING_PORT_DEFAULT := env_var_or_default("MARKETING_PORT", "8082")
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
    echo "    just db-generate          Author Drizzle migrations after schema changes"
    echo "    just psql / redis-cli / mc   Database & object-store shells"
    echo "    just logs <service>       Tail a container's logs"
    echo "    just container-stats      CPU/memory per container (--all for every container)"
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
    echo "    just validate-compose     Validate all three compose tiers"
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

# Internal: run a host-privileged script, prompting for sudo once.
# Already-root invocations (sudo just …) skip the sudo dance entirely.
[private]
_sudo script *ARGS:
    #!/usr/bin/env bash
    if [ "$(id -u)" -eq 0 ]; then
      exec bash {{script}} {{ARGS}}
    fi
    if ! command -v sudo > /dev/null 2>&1; then
      echo "error: '{{script}}' needs root privileges but sudo is not installed" >&2
      exit 127
    fi
    if ! sudo -v; then
      echo "error: sudo authentication failed for {{script}}" >&2
      exit 1
    fi
    exec sudo bash {{script}} {{ARGS}}

# ═══════════════════════════════════════════════════════════════════════════════
# 1. Setup & Bootstrap
# ═══════════════════════════════════════════════════════════════════════════════

# Generate development .env file with non-sensitive defaults
env-setup-dev:
    #!/usr/bin/env bash
    source scripts/lib/common.sh
    ensure_env_file

# Full dev environment bring-up (.env scaffold + start + init)
setup-dev:
    bash scripts/setup/bring-up.sh dev

# Full staging environment bring-up (secrets + start + init + vault)
setup-staging:
    bash scripts/setup/bring-up.sh staging

# Full prod environment bring-up (secrets + start + init + vault)
setup-prod:
    bash scripts/setup/bring-up.sh prod

# Author Drizzle migrations from schema changes (interactive codegen).
# Kept out of setup-* so bring-up stays unattended and non-interactive.
db-generate: (_need "pnpm")
    pnpm --filter @abugida/database db:generate

# ═══════════════════════════════════════════════════════════════════════════════
# 2. Environments (Compose Lifecycle)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Every recipe below goes through scripts/lib/compose.sh:
#   source scripts/lib/compose.sh && dc <tier> <compose args…>
# The tier → compose file set mapping lives in that library only, so adding a
# compose file is a one-line change instead of a sweep through this file.
# ═══════════════════════════════════════════════════════════════════════════════

# Start dev services (infrastructure only: postgres, pgbouncer, redis, minio, powersync)
dev-up:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    dc dev up -d

# Stop dev services
dev-down:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    dc dev down

# DESTRUCTIVE: stop dev services AND delete their volumes (data loss)
dev-clean:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    dc dev down -v
    echo "==> Dev volumes removed."

# Recreate dev services (pick up config/Dockerfile changes)
dev-recreate:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    dc dev up -d --force-recreate

# Start staging services (infra + applications + observability)
staging-up:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    dc staging up -d

# Stop staging services
staging-down:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    dc staging down

# DESTRUCTIVE: stop staging services AND delete their volumes (data loss)
staging-clean:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    dc staging down -v
    echo "==> Staging volumes removed."

# Recreate staging services
staging-recreate:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    dc staging up -d --force-recreate

# Start prod services (full stack: 31 services)
prod-up:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    dc prod up -d

# Stop prod services
prod-down:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    dc prod down

# DESTRUCTIVE: stop prod services AND delete their volumes (data loss)
prod-clean:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    dc prod down -v
    echo "==> Prod volumes removed."

# Recreate prod services
prod-recreate:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    dc prod up -d --force-recreate

# Build all Docker images required by the staging environment (parallel)
staging-build:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    echo "==> Building staging Docker images..."
    dc staging build
    echo "==> Staging images built successfully."

# Build all Docker images required by the production environment (parallel)
prod-build:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    echo "==> Building production Docker images..."
    dc prod build
    echo "==> Production images built successfully."

# Validate modular compose structure (all three tiers); non-zero on any failure
validate-compose:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    rc=0
    for tier in dev staging prod; do
      dc_validate "${tier}" || rc=1
    done
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

# Roll back to previous deployment
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

# Check API health (liveness + db); add --strict to exit non-zero on failure
health-api *ARGS:
    bash scripts/monitoring/http-health.sh api {{ARGS}}

# Check Dashboard health (liveness); add --strict to exit non-zero on failure
health-dashboard *ARGS:
    bash scripts/monitoring/http-health.sh dashboard {{ARGS}}

# Check Marketing health (liveness); add --strict to exit non-zero on failure
health-marketing *ARGS:
    bash scripts/monitoring/http-health.sh marketing {{ARGS}}

# Check PostgreSQL replication lag (prod only)
health-replication:
    bash scripts/monitoring/check-replication-lag.sh

# Check Redis health (authenticated PING as the app ACL user)
health-redis: (_need "docker")
    docker exec {{COMPOSE_PROJECT}}_{{REDIS_SERVICE}} sh -c 'exec redis-cli --no-auth-warning -u "redis://{{REDIS_ACL_USER}}:$REDIS_PASSWORD@127.0.0.1:6379" ping'

# ═══════════════════════════════════════════════════════════════════════════════
# 5. Logs & Debugging
# ═══════════════════════════════════════════════════════════════════════════════

# Open shell in a running container (bash if installed, POSIX sh otherwise)
shell service=POSTGRES_SERVICE: (_need "docker")
    docker exec -it {{COMPOSE_PROJECT}}_{{service}} sh -c 'command -v bash > /dev/null 2>&1 && exec bash || exec sh'

# Open psql against postgres-primary (as $POSTGRES_USER on $POSTGRES_DB)
psql: (_need "docker")
    docker exec -it {{COMPOSE_PROJECT}}_{{POSTGRES_SERVICE}} psql -U {{POSTGRES_USER_DEFAULT}} -d {{POSTGRES_DB_DEFAULT}}

# Open redis-cli against redis-primary (authenticated as the app ACL user)
redis-cli: (_need "docker")
    docker exec -it {{COMPOSE_PROJECT}}_{{REDIS_SERVICE}} sh -c 'exec redis-cli --no-auth-warning -u "redis://{{REDIS_ACL_USER}}:$REDIS_PASSWORD@127.0.0.1:6379"'

# Run MinIO client against local MinIO — e.g. just mc ls local/ or just mc admin info local.
# Ephemeral container on the infrastructure network; credentials passed via the
# MC_HOST alias env var, so nothing is persisted to ~/.mc/config.json.
mc *ARGS: (_need "docker")
    #!/usr/bin/env bash
    source scripts/lib/common.sh
    minio_user="$(require_secret MINIO_ROOT_USER)"
    minio_pass="$(require_secret MINIO_ROOT_PASSWORD)"
    docker run --rm --network {{INFRA_NETWORK}} \
      -e MC_HOST_local="http://${minio_user}:${minio_pass}@{{MINIO_SERVICE}}:9000" \
      {{MC_IMAGE}} {{ARGS}}

# Re-run MinIO bucket/policy initialization (idempotent one-shot init-minio job)
minio-init:
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    dc dev run --rm init-minio

# Tail logs for a service
logs service: (_need "docker")
    docker logs -f --tail 100 {{COMPOSE_PROJECT}}_{{service}}

# Tail error logs for a service (stderr only; stays quiet when no matches)
logs-errors service: (_need "docker")
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

# Show resource usage for containers in this project (--all = every container)
container-stats *ARGS:
    bash scripts/monitoring/container-stats.sh {{ARGS}}

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
otel-status: (_need "docker")
    #!/usr/bin/env bash
    source scripts/lib/common.sh
    log_info "OTEL Collector"
    if docker exec {{COMPOSE_PROJECT}}_{{OTEL_SERVICE}} bash -c 'echo > /dev/tcp/127.0.0.1/13133' 2> /dev/null; then
      log_ok "health extension OK (:13133)"
    else
      log_warn "health extension not reachable (:13133)"
    fi

    log_info "SigNoz"
    if out="$(docker exec {{COMPOSE_PROJECT}}_{{SIGNOZ_SERVICE}} wget -qO- http://localhost:8080/api/v1/health 2> /dev/null)" && [ -n "${out}" ]; then
      printf '%s\n' "${out}" | head -5
    else
      log_warn "not reachable"
    fi

    log_info "ClickHouse"
    if docker exec {{COMPOSE_PROJECT}}_{{CLICKHOUSE_SERVICE}} clickhouse-client ${CLICKHOUSE_PASSWORD:+--password "$CLICKHOUSE_PASSWORD"} --query "SELECT 1" 2> /dev/null; then
      log_ok "responding"
    else
      log_warn "not reachable"
    fi

# Check ClickHouse health and TTL configuration
ch-health: (_need "docker")
    #!/usr/bin/env bash
    source scripts/lib/common.sh
    client=(clickhouse-client)
    if [ -n "${CLICKHOUSE_PASSWORD:-}" ]; then
      client=(clickhouse-client --password "${CLICKHOUSE_PASSWORD}")
    fi

    log_info "ClickHouse ping"
    if docker exec {{COMPOSE_PROJECT}}_{{CLICKHOUSE_SERVICE}} "${client[@]}" --query "SELECT 'OK'" 2> /dev/null; then
      log_ok "responding"
    else
      log_warn "not reachable"
    fi

    log_info "Tables with TTL"
    docker exec {{COMPOSE_PROJECT}}_{{CLICKHOUSE_SERVICE}} "${client[@]}" \
      --query "SELECT database, table, ttl_expression FROM system.tables WHERE database IN ('signoz_metrics', 'signoz_traces', 'signoz_logs') AND ttl_expression != '' FORMAT Pretty" \
      2> /dev/null || log_warn "no TTL tables yet — SigNoz may still be initializing"

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
ps-status: (_need "docker")
    #!/usr/bin/env bash
    source scripts/lib/common.sh
    log_info "PowerSync API health"
    if curl -sf --max-time 5 http://localhost:{{POWERSYNC_PORT_DEFAULT}}/probes/liveness 2> /dev/null; then
      log_ok "liveness OK"
    else
      log_warn "not reachable — is {{POWERSYNC_SERVICE_PREFIX}}api running?"
    fi

    log_info "Replication slots (logical)"
    docker exec {{COMPOSE_PROJECT}}_{{POSTGRES_SERVICE}} \
      psql -U {{POSTGRES_USER_DEFAULT}} -d {{POSTGRES_DB_DEFAULT}} -c \
      "SELECT slot_name, active, pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) AS lag_bytes FROM pg_replication_slots WHERE slot_type = 'logical';" \
      2> /dev/null || log_warn "could not query slot — PostgreSQL may not be ready"

# Check PowerSync replication slot lag in detail.
# PowerSync creates and owns its logical slot (auto-generated name).
ps-slot-lag: (_need "docker")
    #!/usr/bin/env bash
    source scripts/lib/common.sh
    docker exec {{COMPOSE_PROJECT}}_{{POSTGRES_SERVICE}} \
      psql -U {{POSTGRES_USER_DEFAULT}} -d {{POSTGRES_DB_DEFAULT}} -c \
      "SELECT slot_name, active, pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn) AS lag_bytes, pg_wal_lsn_diff(pg_current_wal_lsn(), confirmed_flush_lsn) AS flush_lag_bytes FROM pg_replication_slots WHERE slot_type = 'logical';" \
      2> /dev/null || log_warn "could not query slot"

# Tail PowerSync logs (service = api | sync | setup)
ps-logs service="api": (_need "docker")
    docker logs -f --tail 100 {{COMPOSE_PROJECT}}_{{POWERSYNC_SERVICE_PREFIX}}{{service}}

# Restart both PowerSync services
ps-restart: (_need "docker")
    docker restart {{COMPOSE_PROJECT}}_{{POWERSYNC_SERVICE_PREFIX}}api {{COMPOSE_PROJECT}}_{{POWERSYNC_SERVICE_PREFIX}}sync
    @echo "==> PowerSync restarted. Verify with: just ps-status"

# Provision PowerSync DB roles/publication (tier = dev | staging | prod).
# Runs the idempotent powersync-setup job, which also runs automatically on
# every stack start. Safe on fresh AND existing volumes.
ps-setup tier="dev":
    #!/usr/bin/env bash
    source scripts/lib/compose.sh
    dc "{{tier}}" run --rm powersync-setup

# Run bucket compaction now (PowerSync storage grows as append-only op-log;
# schedule via cron in prod — see docs/services/powersync.md)
ps-compact: (_need "docker")
    docker exec {{COMPOSE_PROJECT}}_{{POWERSYNC_SERVICE_PREFIX}}api compact

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
pgbouncer-reload: (_need "docker")
    docker exec {{COMPOSE_PROJECT}}_{{PGBOUNCER_SERVICE}} kill -HUP 1
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

# Idempotent Vault bootstrap (unseal vs re-init decided from live state).
# Called by scripts/setup/bring-up.sh for staging and prod.
vault-bootstrap: (_need "vault") (_need "jq")
    bash scripts/setup/vault-bootstrap.sh

# Populate Vault with secrets (requires VAULT_TOKEN)
vault-populate-secrets: (_need "jq")
    @echo "Set VAULT_TOKEN first:"
    @echo "  export VAULT_TOKEN=\$(jq -r '.root_token' {{VAULT_INIT_OUTPUT}})"
    @echo "  just vault-populate-secrets-run"
    @exit 1

# Internal: actually run vault-secrets.sh (called by scripts/setup/vault-bootstrap.sh)
vault-populate-secrets-run: (_need "jq")
    #!/usr/bin/env bash
    if [ -z "${VAULT_TOKEN:-}" ]; then
      export VAULT_TOKEN="$(jq -r '.root_token' {{VAULT_INIT_OUTPUT}})"
    fi
    VAULT_ADDR={{VAULT_ADDR}} \
    VAULT_SKIP_VERIFY={{VAULT_SKIP_VERIFY}} \
    bash docker/config/vault/scripts/vault-secrets.sh

# Issue dynamic PostgreSQL credentials from the Vault database engine.
# Prints username/lease only — the password is never echoed to the terminal.
vault-rotate-db-password: (_need "vault") (_need "jq")
    #!/usr/bin/env bash
    source scripts/lib/common.sh
    log_info "Issuing dynamic database credentials (database/creds/app-readwrite)..."
    VAULT_ADDR={{VAULT_ADDR}} VAULT_SKIP_VERIFY={{VAULT_SKIP_VERIFY}} \
      vault read -format=json database/creds/app-readwrite \
      | jq -r '.data | "  username: \(.username)\n  lease_duration: \(.lease_duration)s\n  lease_id: \(.lease_id)"'
    echo "  password withheld — retrieve it with: vault read -field=password database/creds/app-readwrite"

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
    #!/usr/bin/env bash
    source scripts/lib/common.sh
    log_info "Last backup timestamps"
    for bt in postgres redis config monitoring minio; do
      ts_file="data/backups/${bt}/.last-backup"
      if [ -f "${ts_file}" ]; then
        echo "  ${bt}: $(cat "${ts_file}")"
      else
        echo "  ${bt}: (never)"
      fi
    done

# Verify backup integrity (checksums + pg_restore + redis-check-rdb)
verify-backup:
    bash scripts/backup/verify-backup.sh

# Prune old backups beyond retention window
backup-prune:
    bash scripts/backup/backup-prune.sh

# Install/uninstall/status backup cron schedule (prod only, needs root)
backup-schedule action="status": (_sudo "scripts/backup/backup-schedule.sh" action)

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
firewall-install: (_sudo "scripts/security/firewall-install-all.sh" "install")

# Teardown ALL host-level iptables firewall rules
firewall-teardown: (_sudo "scripts/security/firewall-install-all.sh" "teardown")

# Show ALL firewall rule status
firewall-status: (_sudo "scripts/security/firewall-install-all.sh" "status")

# Apply Redis host firewall rules (prod, needs root)
redis-firewall-install: (_sudo "scripts/security/redis-firewall.sh" "install")

# Remove Redis host firewall rules
redis-firewall-teardown: (_sudo "scripts/security/redis-firewall.sh" "teardown")

# Show Redis firewall status
redis-firewall-status: (_sudo "scripts/security/redis-firewall.sh" "status")

# Apply PostgreSQL firewall rules (prod, needs root)
postgres-firewall-install: (_sudo "scripts/security/postgres-firewall.sh" "install")

# Remove PostgreSQL firewall rules
postgres-firewall-teardown: (_sudo "scripts/security/postgres-firewall.sh" "teardown")

# Show PostgreSQL firewall status
postgres-firewall-status: (_sudo "scripts/security/postgres-firewall.sh" "status")

# Apply Vault firewall rules (prod, needs root)
vault-firewall-install: (_sudo "scripts/security/vault-firewall.sh" "install")

# Remove Vault firewall rules
vault-firewall-teardown: (_sudo "scripts/security/vault-firewall.sh" "teardown")

# Show Vault firewall status
vault-firewall-status: (_sudo "scripts/security/vault-firewall.sh" "status")

# Run port scan (nmap) to verify only expected ports are open
port-scan target="": (_need "nmap")
    bash docker/tests/security/nmap/scan-ports.sh {{ if target != "" { "--target " + target } else { "" } }}

# ═══════════════════════════════════════════════════════════════════════════════
# 13. Edge & Tunnel (Production Only, ADR-020)
# ═══════════════════════════════════════════════════════════════════════════════

# Check Cloudflare Tunnel status
tunnel-status: (_need "docker")
    @docker exec {{COMPOSE_PROJECT}}_{{CLOUDFLARED_SERVICE}} cloudflared tunnel list 2>/dev/null || echo "  (cloudflared not running)"

# Restart Cloudflare Tunnel
tunnel-restart: (_need "docker")
    @docker restart {{COMPOSE_PROJECT}}_{{CLOUDFLARED_SERVICE}}
    @echo "==> Tunnel restarted."

# Tail Cloudflare Tunnel logs
tunnel-logs: (_need "docker")
    @docker logs -f --tail 50 {{COMPOSE_PROJECT}}_{{CLOUDFLARED_SERVICE}}

# Validate tunnel access (SigNoz tunneled, Vault never exposed)
tunnel-test *ARGS:
    bash docker/tests/security/tunnel-access-test.sh {{ARGS}}

# Check certificate status (via Caddy admin API locally, ADR-001/ADR-011)
cert-status: (_need "curl")
    @curl -sf https://localhost/health 2>/dev/null && echo "TLS OK" || echo "Certificate check failed (dev: use http://localhost)"

# Reload Caddy config; certificates re-obtained automatically when due
cert-force-renewal: (_need "docker")
    @docker exec {{COMPOSE_PROJECT}}_{{CADDY_SERVICE}} caddy reload --config /etc/caddy/Caddyfile
    @echo "==> Caddy reloaded (certificates will be re-obtained if needed)."

# ═══════════════════════════════════════════════════════════════════════════════
# 14. Testing
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
#      - This file is a thin dispatcher: multi-step logic belongs in
#        scripts/<domain>/<name>.sh, and shared logic in scripts/lib/
#      - Compose access always goes through scripts/lib/compose.sh
#        (`source scripts/lib/compose.sh && dc <tier> <args>`) — never inline
#        a `-f docker/compose/...` list
#      - Container/service names come from the vars in "Service identities"
#        (POSTGRES_SERVICE, REDIS_SERVICE, …), never hardcoded per recipe
#      - Config values resolve as env var → .env → default via
#        env_var_or_default; secrets go through require_secret in
#        scripts/lib/common.sh so a missing value fails loudly
#      - Never call `just <recipe>` from a recipe or script: call the
#        underlying script directly (no re-parse, no re-loaded .env)
#      - "{{ }}" interpolates just values; "$" passes through to the shell
#        unchanged: write $(...) and ${var} directly — never "$$", which the
#        shell reads as its PID
#      - Destructive commands belong behind an explicit action arg (install/
#        teardown), never as bare side effects; prefix descriptions of
#        data-losing recipes with "DESTRUCTIVE:"
#      - Output style: actions as "==> …", results indented two spaces,
#        absence as "(not reachable)", failures as "error: …" on stderr —
#        log_info/log_ok/log_warn/log_err from scripts/lib/common.sh
#      - Recipes needing optional host CLIs declare them via : (_need "<cmd>")
#      - Recipes mutating host state delegate via (_sudo "<script>" <args>)
#      - Anything gating a pipeline passes an explicit exit code (e.g.
#        --strict) instead of always exiting 0
#
# Template:
#
#   # One-line description shown by `just --list`
#   my-recipe arg="default": (_need "jq")
#       bash scripts/my-domain/my-script.sh {{arg}}
#
# ═══════════════════════════════════════════════════════════════════════════════
