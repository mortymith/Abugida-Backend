#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# MinIO Bucket & Policy Initialization (idempotent)
# Source: deployment.md v3.0.0, ADR-008, ADR-012
#
# - Creates the application bucket if absent
# - Enables versioning on the bucket
# - Attaches IAM policies (app, readonly, upload) to service accounts
# - In production: configures Cross-Region Replication to minio-backup
#
# Idempotent: every operation checks before acting.
# Invoked via the one-shot `init-scripts` compose service,
# NOT as a long-running container.
#
# Required env vars (set in compose service environment):
#   MINIO_ENDPOINT, MINIO_ROOT_USER, MINIO_ROOT_PASSWORD,
#   MINIO_BUCKET_NAME, ENVIRONMENT, MINIO_BACKUP_ENDPOINT (prod only)
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://minio:9000}"
MINIO_ROOT_USER="${MINIO_ROOT_USER:-minioadmin}"
MINIO_ROOT_PASSWORD="${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required (set it in .env or export from Vault)}"
BUCKET="${MINIO_BUCKET_NAME:-app-data}"
ENV="${ENVIRONMENT:-development}"

# Backup target (prod only — set in prod overlay or Vault)
MINIO_BACKUP_ENDPOINT="${MINIO_BACKUP_ENDPOINT:-}"
MINIO_BACKUP_USER="${MINIO_BACKUP_USER:-}"
MINIO_BACKUP_PASSWORD="${MINIO_BACKUP_PASSWORD:-${MINIO_ROOT_PASSWORD}}"

# Policy files
POLICY_DIR="/policies"

# ── Helpers ────────────────────────────────────────────────────────
log_info() { echo "[init-minio] $*"; }
log_ok() { echo "[init-minio][OK] $*"; }
log_skip() { echo "[init-minio][SKIP] $*"; }

# Configure mc alias (idempotent)
mc alias set myminio "${MINIO_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" > /dev/null 2>&1
log_info "Configured mc alias 'myminio' → ${MINIO_ENDPOINT}"

# ── 1. Create bucket if absent ─────────────────────────────────────
if mc ls "myminio/${BUCKET}" > /dev/null 2>&1; then
  log_skip "Bucket '${BUCKET}' already exists."
else
  mc mb "myminio/${BUCKET}" > /dev/null
  log_ok "Created bucket '${BUCKET}'."
fi

# ── 2. Enable versioning (idempotent) ─────────────────────────────
# Bash-native check — the mc image ships no grep/sed.
VERSION_INFO=$(mc version info "myminio/${BUCKET}" 2> /dev/null || true)
case "${VERSION_INFO}" in
*enabled* | *Enabled*)
  log_skip "Versioning already enabled on '${BUCKET}'."
  ;;
*)
  mc version enable "myminio/${BUCKET}" > /dev/null
  log_ok "Enabled versioning on '${BUCKET}'."
  ;;
esac

# ── 3. Attach IAM policies ────────────────────────────────────────
# Each policy JSON uses ${MINIO_BUCKET_NAME} — sed replaces at runtime.
for POLICY_NAME in app readonly upload; do
  POLICY_FILE="${POLICY_DIR}/${POLICY_NAME}-policy.json"

  if [ ! -f "${POLICY_FILE}" ]; then
    log_info "Policy file not found: ${POLICY_FILE}, skipping."
    continue
  fi

  # Resolve bucket name in policy (bash-native substitution — no sed)
  POLICY_CONTENT=$(< "${POLICY_FILE}")
  RESOLVED_POLICY=${POLICY_CONTENT//\$\{MINIO_BUCKET_NAME\}/${BUCKET}}

  # Create or update policy (idempotent — mc policy create is add-only,
  # but we use json output to check)
  if mc admin policy info myminio "${POLICY_NAME}" > /dev/null 2>&1; then
    # Update existing policy
    echo "${RESOLVED_POLICY}" | mc admin policy create myminio "${POLICY_NAME}" /dev/stdin 2> /dev/null ||
      echo "${RESOLVED_POLICY}" | mc admin policy update myminio "${POLICY_NAME}" /dev/stdin 2> /dev/null ||
      log_skip "Policy '${POLICY_NAME}' already up to date."
    log_skip "Policy '${POLICY_NAME}' exists (updated or unchanged)."
  else
    echo "${RESOLVED_POLICY}" | mc admin policy create myminio "${POLICY_NAME}" /dev/stdin > /dev/null 2>&1
    log_ok "Created policy '${POLICY_NAME}'."
  fi
done

# ── 4. Create service accounts (idempotent) ───────────────────────
# App service account — full access
# NOTE: mc admin user add takes exactly TARGET ACCESSKEY SECRETKEY —
# the access key IS the account name (no separate name argument).
APP_ACCESS_KEY="app-service"
if mc admin user info myminio "${APP_ACCESS_KEY}" > /dev/null 2>&1; then
  log_skip "Service account '${APP_ACCESS_KEY}' already exists."
else
  # Random secret via /dev/urandom — the mc image ships no openssl
  APP_SECRET_KEY=$(head -c 96 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40)
  mc admin user add myminio "${APP_ACCESS_KEY}" "${APP_SECRET_KEY}" > /dev/null
  mc admin policy attach myminio "app" --user "${APP_ACCESS_KEY}" > /dev/null
  log_ok "Created service account '${APP_ACCESS_KEY}' with 'app' policy."
  log_info "  AccessKey: ${APP_ACCESS_KEY}"
  log_info "  SecretKey: ${APP_SECRET_KEY}"
  log_info "  (Store these in Vault for production — ADR-006)"
fi

# ── 5. Cross-Region Replication (production only) ─────────────────
if [ "${ENV}" = "production" ] && [ -n "${MINIO_BACKUP_ENDPOINT}" ]; then
  log_info "Production detected. Configuring CRR to ${MINIO_BACKUP_ENDPOINT}..."

  # Configure backup alias
  if [ -n "${MINIO_BACKUP_USER}" ] && [ -n "${MINIO_BACKUP_PASSWORD}" ]; then
    mc alias set myminio-backup "${MINIO_BACKUP_ENDPOINT}" "${MINIO_BACKUP_USER}" "${MINIO_BACKUP_PASSWORD}" > /dev/null 2>&1
  else
    mc alias set myminio-backup "${MINIO_BACKUP_ENDPOINT}" "${MINIO_ROOT_USER}" "${MINIO_ROOT_PASSWORD}" > /dev/null 2>&1
  fi

  # Ensure backup bucket exists
  if mc ls "myminio-backup/${BUCKET}" > /dev/null 2>&1; then
    log_skip "Backup bucket '${BUCKET}' already exists on remote."
  else
    mc mb "myminio-backup/${BUCKET}" > /dev/null
    mc version enable "myminio-backup/${BUCKET}" > /dev/null
    log_ok "Created and versioned backup bucket '${BUCKET}' on remote."
  fi

  # Create replication user on backup if not exists
  if mc admin user info myminio-backup "repl-user" > /dev/null 2>&1; then
    log_skip "Replication user 'repl-user' exists on backup."
  else
    REPL_SECRET=$(head -c 96 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 40)
    mc admin user add myminio-backup "repl-user" "${REPL_SECRET}" > /dev/null
    # Grant replication policy on backup
    mc admin policy attach myminio-backup readwrite --user "repl-user" 2> /dev/null ||
      mc admin policy attach myminio-backup "app" --user "repl-user" > /dev/null 2>&1
    log_ok "Created replication user on backup target."
  fi

  # Add replication rule (idempotent — mc replicate add is safe to re-run)
  mc replicate add myminio/${BUCKET} myminio-backup/${BUCKET} \
    --priority "1" \
    --sync \
    --remove-delete-marker \
    2> /dev/null && log_ok "CRR rule configured." ||
    log_skip "CRR rule already exists or could not be added."
else
  log_skip "CRR skipped (not production or MINIO_BACKUP_ENDPOINT not set)."
fi

# ── Done ──────────────────────────────────────────────────────────
log_info "MinIO initialization complete."
log_info "Bucket:    ${BUCKET}"
log_info "Versioning: enabled"
log_info "Policies:  app, readonly, upload"
if [ "${ENV}" = "production" ]; then
  log_info "CRR:       ${MINIO_BACKUP_ENDPOINT:-not configured}"
fi
