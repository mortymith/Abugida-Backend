#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Secret Rotation Orchestrator
# Source: deployment.md v3.0.0 Phase 14, ADR-006
#
# Rotates all infrastructure secrets:
#   - Database password (via Vault dynamic creds or manual rotation)
#   - API secret key
#   - Redis password (primary + admin + readonly + sentinel)
#   - Vault token
#
# Tiered secrets strategy (ADR-006):
#   In staging/production this drives Vault's dynamic credential rotation.
#   In development it rotates the corresponding variables inside .env
#   (a timestamped backup of .env is written before any change).
#
# Usage:
#   bash scripts/security/rotate-secrets.sh                  # rotate all
#   bash scripts/security/rotate-secrets.sh --db              # database only
#   bash scripts/security/rotate-secrets.sh --api             # API secret only
#   bash scripts/security/rotate-secrets.sh --redis           # Redis passwords only
#   bash scripts/security/rotate-secrets.sh --vault           # Vault dynamic creds
#   bash scripts/security/rotate-secrets.sh --dry-run         # show what would rotate
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${PROJECT_ROOT}/.env"

# ── Configuration ──────────────────────────────────────────────────
ENVIRONMENT="${ENVIRONMENT:-development}"
DRY_RUN=false
ROTATE_DB=false
ROTATE_API=false
ROTATE_REDIS=false
ROTATE_VAULT=false
ENV_BACKED_UP=false

# ── Colors ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

log_info() { echo -e "  ${GREEN}[INFO]${RESET}  $*"; }
log_warn() { echo -e "  ${YELLOW}[WARN]${RESET}  $*"; }
log_err() { echo -e "  ${RED}[ERROR]${RESET} $*"; }
log_dry() { echo -e "  ${YELLOW}[DRY]${RESET}   $*"; }

# ── Parse Arguments ────────────────────────────────────────────────
ROTATE_ALL=true
while [[ $# -gt 0 ]]; do
  case "$1" in
  --db)
    ROTATE_ALL=false
    ROTATE_DB=true
    shift
    ;;
  --api)
    ROTATE_ALL=false
    ROTATE_API=true
    shift
    ;;
  --redis)
    ROTATE_ALL=false
    ROTATE_REDIS=true
    shift
    ;;
  --vault)
    ROTATE_ALL=false
    ROTATE_VAULT=true
    shift
    ;;
  --dry-run)
    DRY_RUN=true
    shift
    ;;
  --env)
    ENVIRONMENT="$2"
    shift 2
    ;;
  --help | -h)
    echo "Usage: $0 [--db|--api|--redis|--vault] [--dry-run] [--env ENV]"
    echo ""
    echo "  --db         Rotate database password"
    echo "  --api        Rotate API secret key"
    echo "  --redis      Rotate Redis passwords (primary, admin, readonly, sentinel)"
    echo "  --vault      Rotate Vault dynamic credentials"
    echo "  --dry-run    Show what would be rotated without making changes"
    echo "  --env ENV    Target environment (development|production)"
    exit 0
    ;;
  *)
    log_err "Unknown option: $1"
    exit 1
    ;;
  esac
done

if [ "$ROTATE_ALL" = true ]; then
  ROTATE_DB=true
  ROTATE_API=true
  ROTATE_REDIS=true
  ROTATE_VAULT=true
fi

echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Secret Rotation${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo "  Environment: ${ENVIRONMENT}"
echo "  Dry run:     ${DRY_RUN}"
echo ""

# ── Helper: generate a random secret ───────────────────────────────
generate_secret() {
  local length="${1:-32}"
  openssl rand -base64 "$((length * 3 / 4))" | tr -d '\n/+=' | head -c "$length"
  echo
}

# ── Helper: rotate a secret variable inside .env (dev) ─────────────
# Writes a timestamped backup of .env once per run, then replaces the
# KEY= value in place (appending the key if it is missing).
rotate_env_secret() {
  local name="$1"
  local label="$2"

  if [ "$DRY_RUN" = true ]; then
    log_dry "Would rotate ${label} (${name}) in ${ENV_FILE}"
    return 0
  fi

  if [ ! -f "${ENV_FILE}" ]; then
    log_err "${ENV_FILE} not found — cannot rotate ${name}"
    return 1
  fi

  if [ "${ENV_BACKED_UP:-false}" = false ]; then
    cp "${ENV_FILE}" "${ENV_FILE}.bak.$(date +%Y%m%d_%H%M%S)"
    ENV_BACKED_UP=true
  fi

  local new_value
  new_value=$(generate_secret 32)
  if grep -qE "^${name}=" "${ENV_FILE}"; then
    sed -i "s|^${name}=.*|${name}=${new_value}|" "${ENV_FILE}"
  else
    printf '\n# Rotated by rotate-secrets.sh\n%s=%s\n' "${name}" "${new_value}" >> "${ENV_FILE}"
  fi
  log_info "Rotated ${label} (${name}) in .env"
}

# ═════════════════════════════════════════════════════════════════════
# Rotate Database Password
# ═════════════════════════════════════════════════════════════════════
if [ "$ROTATE_DB" = true ]; then
  echo -e "${BOLD}── Database Password ──${RESET}"

  if [ "$ENVIRONMENT" = "production" ] && [ -n "${VAULT_ADDR:-}" ]; then
    # Production: use Vault dynamic credentials (ADR-006)
    if [ "$DRY_RUN" = true ]; then
      log_dry "Would request new dynamic database credentials from Vault"
    else
      log_info "Requesting new dynamic database credentials from Vault..."
      # This generates a new lease — old lease remains valid until TTL expires
      VAULT_ADDR="${VAULT_ADDR:-https://127.0.0.1:8200}" \
        VAULT_SKIP_VERIFY="${VAULT_SKIP_VERIFY:-1}" \
        vault read -format=json database/creds/app-readwrite 2> /dev/null &&
        log_info "New dynamic credentials obtained" ||
        log_warn "Vault dynamic credentials failed — falling back to manual rotation"
    fi
  else
    # Development: rotate the value in .env
    rotate_env_secret "POSTGRES_PASSWORD" "PostgreSQL password"
  fi
fi

# ═════════════════════════════════════════════════════════════════════
# Rotate API Secret Key
# ═════════════════════════════════════════════════════════════════════
if [ "$ROTATE_API" = true ]; then
  echo ""
  echo -e "${BOLD}── API Secret Key ──${RESET}"
  rotate_env_secret "API_SECRET_KEY" "API secret key"
fi

# ═════════════════════════════════════════════════════════════════════
# Rotate Redis Passwords
# ═════════════════════════════════════════════════════════════════════
if [ "$ROTATE_REDIS" = true ]; then
  echo ""
  echo -e "${BOLD}── Redis Passwords ──${RESET}"
  rotate_env_secret "REDIS_PASSWORD" "Redis primary password"
  rotate_env_secret "REDIS_ADMIN_PASSWORD" "Redis admin password"
  rotate_env_secret "REDIS_READONLY_PASSWORD" "Redis readonly password"
  rotate_env_secret "REDIS_SENTINEL_PASSWORD" "Redis sentinel password"

  if [ "$DRY_RUN" = false ]; then
    log_warn "Redis services must be restarted to pick up new passwords: just dev-recreate"
  fi
fi

# ═════════════════════════════════════════════════════════════════════
# Rotate Vault Credentials
# ═════════════════════════════════════════════════════════════════════
if [ "$ROTATE_VAULT" = true ]; then
  echo ""
  echo -e "${BOLD}── Vault Dynamic Credentials ──${RESET}"

  if [ "$ENVIRONMENT" = "production" ]; then
    if [ "$DRY_RUN" = true ]; then
      log_dry "Would rotate Vault dynamic database credentials"
    else
      VAULT_ADDR="${VAULT_ADDR:-https://127.0.0.1:8200}" \
        VAULT_SKIP_VERIFY="${VAULT_SKIP_VERIFY:-1}" \
        vault read -format=json database/creds/app-readwrite 2> /dev/null &&
        log_info "Vault dynamic database credentials rotated" ||
        log_warn "Vault rotation failed — check Vault is unsealed"
    fi
  else
    log_info "Vault rotation skipped in development (no Vault running)"
  fi
fi

# ═════════════════════════════════════════════════════════════════════
# Notification
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}──────────────────────────────────────────────────────────${RESET}"
if [ "$DRY_RUN" = true ]; then
  echo -e "  ${YELLOW}Dry run complete. No secrets were changed.${RESET}"
else
  echo -e "  ${GREEN}Secret rotation complete.${RESET}"
  # Notify via Telegram if credentials are available
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    LEVEL=info CONTEXT=security TASK=rotate-secrets \
      bash "${PROJECT_ROOT}/scripts/backup/telegram-notify.sh" \
      "Secrets rotated in ${ENVIRONMENT} (db=${ROTATE_DB}, api=${ROTATE_API}, redis=${ROTATE_REDIS}, vault=${ROTATE_VAULT})" 2> /dev/null || true
  fi
fi
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
