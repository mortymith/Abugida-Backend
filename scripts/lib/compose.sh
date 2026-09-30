#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# Tiered Docker Compose — Single Source of Truth
# ADR-009, ADR-021
#
# Library file — source it, never execute it:
#   source scripts/lib/compose.sh
#
# The compose file set of every tier lives here and ONLY here, so the
# justfile, setup scripts and validation all agree by construction.
#
# Tiers:
#   dev      10 services  infrastructure only
#   staging  20 services  infrastructure + apps + observability + security
#   prod     31 services  full stack + HA + security
#
# API:
#   require_tier <tier>          Validate a tier name (exit 64 if unknown)
#   compose_files <tier>         Print the tier's -f file list
#   dc <tier> <compose args...>  Run `docker compose` against that tier
#
# Examples:
#   dc dev up -d
#   dc prod run --rm init-minio
#   dc staging build
# ════════════════════════════════════════════════════════════════════════

# Resolve repo root from this file's location (works from any cwd).
COMPOSE_LIB_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${COMPOSE_LIB_DIR}/../.." && pwd)"

# shellcheck source=scripts/lib/common.sh
source "${COMPOSE_LIB_DIR}/common.sh"

# ─── Tiers ───────────────────────────────────────────────────────────
COMPOSE_TIERS="${COMPOSE_TIERS:-dev staging prod}"

# Variables compose interpolates with `:?` (required). In staging/prod they
# are injected by Vault, so they are simply absent on a workstation.
COMPOSE_REQUIRED_VARS="${COMPOSE_REQUIRED_VARS:-API_SECRET_KEY CLICKHOUSE_PASSWORD MINIO_ROOT_PASSWORD POSTGRES_PASSWORD PS_REPLICATION_PASSWORD PS_STORAGE_PASSWORD REDIS_ADMIN_PASSWORD REDIS_PASSWORD REDIS_READONLY_PASSWORD REDIS_SENTINEL_PASSWORD SIGNOZ_DB_PASSWORD SIGNOZ_JWT_SECRET STORAGE_PUBLIC_ENDPOINT}"

# Fill in placeholders for absent required variables (config validation only).
validate_env() {
  local var
  for var in ${COMPOSE_REQUIRED_VARS}; do
    if [ -z "${!var:-}" ]; then
      case "${var}" in
      *_ENDPOINT) export "${var}=https://placeholder.invalid" ;;
      *) export "${var}=placeholder" ;;
      esac
    fi
  done
}

require_tier() {
  local tier="${1:-}"
  case " ${COMPOSE_TIERS} " in
  *" ${tier} "*) ;;
  *)
    log_err "unknown compose tier: '${tier}' (expected one of: ${COMPOSE_TIERS})"
    exit 64
    ;;
  esac
}

# Print the -f file list for a tier (space separated, unquoted).
compose_files() {
  local tier="$1"
  require_tier "${tier}"

  local common="-f docker/compose/networks.yml -f docker/compose/volumes.yml"
  local base="-f docker/compose/base.yml"

  case "${tier}" in
  dev)
    printf '%s' "${common} ${base} -f docker/compose/profiles/dev.override.yml"
    ;;
  staging)
    printf '%s' "${common} ${base} -f docker/compose/app.yml \
      -f docker/compose/observability.yml -f docker/compose/security.yml \
      -f docker/compose/profiles/staging.override.yml"
    ;;
  prod)
    printf '%s' "${common} ${base} -f docker/compose/app.yml \
      -f docker/compose/observability.yml -f docker/compose/edge.yml \
      -f docker/compose/scaling.yml -f docker/compose/security.yml \
      -f docker/compose/profiles/prod.override.yml"
    ;;
  esac
}

# Run docker compose for a tier. Word splitting of the file list is
# intentional — compose expects each -f as a separate argument.
# shellcheck disable=SC2046
dc() {
  local tier="$1"
  shift
  require_tier "${tier}"
  require_cmd docker "install Docker Engine + the compose v2 plugin (see scripts/setup/prerequisites.sh)"
  cd "${PROJECT_ROOT}"
  # shellcheck disable=SC2046
  docker compose --project-directory . $(compose_files "${tier}") "$@"
}

# Validate a tier's merged compose config (non-zero exit on failure).
# Placeholders stand in for the secrets Vault injects in staging/prod, so
# validation works on a machine that has no Vault material: real values
# always win because validate_env only fills what is missing.
dc_validate() {
  require_tier "$1"
  validate_env
  if dc "$1" config > /dev/null 2>&1; then
    log_ok "$1 compose config valid"
  else
    log_err "$1 compose config is invalid"
    return 1
  fi
}
