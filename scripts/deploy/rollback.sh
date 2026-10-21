#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Rollback — Instant Revert with Artifact History
# ═════════════════════════════════════════════════════════════════════
#
# Reverts to the previous deployment by:
#   1. Reading the last-known-good upstreams.conf from deploy history
#   2. Restoring it and reloading Caddy
#   3. Restarting services to the previous version
#   4. Notifying via Telegram
#
# Keeps last 3 deployment artifacts (written by scripts/deploy/blue-green.sh).
#
# 4.15 Fix: Comment now matches code (defaults to "rolling", not "green").
#
# Usage:
#   bash scripts/deploy/rollback.sh [env]
#   bash scripts/deploy/rollback.sh --version v1.1.0
#   bash scripts/deploy/rollback.sh prod --version v1.1.0
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

ENV="prod"
TARGET_VERSION=""

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
  --version)
    TARGET_VERSION="${2:-}"
    if [ -z "${TARGET_VERSION}" ]; then
      echo "[rollback][ERROR] --version needs a value" >&2
      exit 1
    fi
    shift 2
    ;;
  -h | --help)
    usage
    exit 0
    ;;
  *)
    ENV="$1"
    shift
    ;;
  esac
done

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

# Build modular compose command based on environment
BASE_COMPOSE="docker compose --project-directory . -f docker/compose/networks.yml -f docker/compose/volumes.yml -f docker/compose/base.yml"
case "${ENV}" in
dev) COMPOSE_CMD="${BASE_COMPOSE} -f docker/compose/profiles/dev.override.yml" ;;
staging) COMPOSE_CMD="${BASE_COMPOSE} -f docker/compose/app.yml -f docker/compose/observability.yml -f docker/compose/security.yml -f docker/compose/profiles/staging.override.yml" ;;
prod) COMPOSE_CMD="${BASE_COMPOSE} -f docker/compose/app.yml -f docker/compose/observability.yml -f docker/compose/edge.yml -f docker/compose/scaling.yml -f docker/compose/security.yml -f docker/compose/profiles/prod.override.yml" ;;
*)
  echo "[rollback][ERROR] Unknown environment: ${ENV}" >&2
  exit 1
  ;;
esac

DEPLOY_HISTORY_DIR="${SCRIPT_DIR}/.deploy-history"
CURRENT_COLOR_FILE="${SCRIPT_DIR}/.current-color"
VERSION_FILE="${SCRIPT_DIR}/.current-version"
UPSTREAMS_FILE="${PROJECT_ROOT}/docker/config/caddy/snippets/upstreams.conf"
TELEGRAM_SH="${PROJECT_ROOT}/scripts/backup/telegram-notify.sh"

notify() {
  local level="$1" msg="$2"
  LEVEL="${level}" CONTEXT=deploy TASK=rollback bash "${TELEGRAM_SH}" "${msg}" 2> /dev/null || true
}

log_info() { echo "[rollback] $*"; }
log_error() { echo "[rollback][ERROR] $*" >&2; }

# ── Resolve the artifact to roll back to ───────────────────────────
# Without an explicit --version, the target is the newest artifact that is
# not the version currently deployed.
resolve_target() {
  if [ -n "${TARGET_VERSION}" ]; then
    if [ ! -d "${DEPLOY_HISTORY_DIR}/${TARGET_VERSION}" ]; then
      log_error "No deployment artifact for version '${TARGET_VERSION}' in ${DEPLOY_HISTORY_DIR}"
      exit 1
    fi
    printf '%s\n' "${TARGET_VERSION}"
    return
  fi

  local current=""
  if [ -f "${VERSION_FILE}" ]; then
    current=$(cat "${VERSION_FILE}")
  fi

  local candidate
  local candidates=()
  shopt -s nullglob
  for candidate in "${DEPLOY_HISTORY_DIR}"/*/; do
    candidates+=("${candidate%/}")
  done
  shopt -u nullglob

  local sorted=()
  mapfile -t sorted < <(printf '%s\n' "${candidates[@]}" | sort -r)

  for candidate in "${sorted[@]}"; do
    candidate="${candidate##*/}"
    if [ "${candidate}" != "${current}" ]; then
      printf '%s\n' "${candidate}"
      return
    fi
  done

  log_error "No previous deployment artifact found in ${DEPLOY_HISTORY_DIR}"
  exit 1
}

# ── Restore the recorded upstream configuration and reload Caddy ───
restore_upstreams() {
  local artifact="$1"
  if [ ! -f "${DEPLOY_HISTORY_DIR}/${artifact}/upstreams.conf" ]; then
    log_info "No recorded upstreams.conf for '${artifact}' — keeping the current file"
    return 0
  fi

  cp "${DEPLOY_HISTORY_DIR}/${artifact}/upstreams.conf" "${UPSTREAMS_FILE}"
  log_info "Restored upstreams.conf from '${artifact}'"

  if docker ps --format '{{.Names}}' | grep -q "caddy"; then
    docker exec "$(docker ps --format '{{.Names}}' | grep 'caddy' | head -n 1)" \
      caddy reload --config /etc/caddy/Caddyfile > /dev/null 2>&1 ||
      log_info "Caddy reload skipped (container not reloadable)"
  fi
}

# ── Restore the deployment state files ─────────────────────────────
restore_state() {
  local artifact="$1"
  if [ -f "${DEPLOY_HISTORY_DIR}/${artifact}/.color" ]; then
    cp "${DEPLOY_HISTORY_DIR}/${artifact}/.color" "${CURRENT_COLOR_FILE}"
  fi
  if [ -f "${DEPLOY_HISTORY_DIR}/${artifact}/.version" ]; then
    cp "${DEPLOY_HISTORY_DIR}/${artifact}/.version" "${VERSION_FILE}"
  else
    printf '%s\n' "${artifact}" > "${VERSION_FILE}"
  fi
  log_info "Deployment state restored to '${artifact}'"
}

# ── Restart the application services on the restored version ───────
restart_services() {
  log_info "Recreating api, dashboard and marketing services..."
  ${COMPOSE_CMD} up -d --no-deps --force-recreate api dashboard marketing
}

# ── Health verification ────────────────────────────────────────────
verify_health() {
  log_info "Running health checks..."
  if bash "${PROJECT_ROOT}/scripts/monitoring/health.sh"; then
    return 0
  fi
  return 1
}

# ═════════════════════════════════════════════════════════════════════
# ROLLBACK FLOW
# ═════════════════════════════════════════════════════════════════════

TARGET_ARTIFACT=$(resolve_target)
log_info "Rolling back to '${TARGET_ARTIFACT}' (environment: ${ENV})"

restore_upstreams "${TARGET_ARTIFACT}"
restore_state "${TARGET_ARTIFACT}"
restart_services

if verify_health; then
  log_info "Rollback to '${TARGET_ARTIFACT}' completed — all services healthy"
  notify info "Rollback to ${TARGET_ARTIFACT} completed successfully."
  exit 0
fi

log_error "Rollback to '${TARGET_ARTIFACT}' finished but health checks failed"
notify error "Rollback to ${TARGET_ARTIFACT} finished, but health checks failed."
exit 1
