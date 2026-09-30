#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# Shared Shell Helpers (logging, config resolution, preflight)
# ADR-009
#
# Library file — source it, never execute it:
#   source scripts/lib/common.sh
#
# Provides:
#   log_info / log_ok / log_warn / log_err   Colored single-line logging
#   die <msg...>                              Error to stderr + exit 1
#   require_cmd <cmd> [hint]                  Preflight guard for a CLI
#   require_root [hint]                       Preflight guard for EUID 0
#   env_or_dotenv <KEY> [default]             Process env → .env → default
#   dotenv_require <KEY...>                   Fail if a .env key is missing/empty
#
# Config precedence matches docker compose and the rest of scripts/:
#   explicit environment variable  >  .env file  >  built-in default
# ════════════════════════════════════════════════════════════════════════

# ─── Colors ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ─── Logging ────────────────────────────────────────────────────────
log_info() { echo -e "${CYAN}==>${NC} $*"; }
log_ok() { echo -e "  ${GREEN}OK${NC} $*"; }
log_warn() { echo -e "  ${YELLOW}!${NC} $*" >&2; }
log_err() { echo -e "  ${RED}error${NC} $*" >&2; }

# Abort with an actionable message.
die() {
  log_err "$*"
  exit 1
}

# ─── Preflight guards ───────────────────────────────────────────────
# Fail fast with an actionable message when a CLI is missing, instead of
# failing mid-recipe with "command not found".
require_cmd() {
  local cmd="$1" hint="${2:-}"
  if ! command -v "${cmd}" > /dev/null 2>&1; then
    log_err "required command '${cmd}' not found in PATH"
    if [ -n "${hint}" ]; then
      log_err "${hint}"
    fi
    exit 127
  fi
}

# Guard for recipes/scripts that mutate host-level state (firewall, cron).
require_root() {
  local hint="${1:-re-run with sudo}"
  if [ "$(id -u)" -ne 0 ]; then
    log_err "this operation requires root privileges"
    log_err "${hint}"
    exit 1
  fi
}

# Scaffold a local .env from the committed template (idempotent).
ensure_env_file() {
  if [ -f "${ENV_FILE}" ]; then
    log_info ".env already exists."
    return
  fi
  if [ ! -f .env.example ]; then
    die ".env is missing and .env.example was not found — cannot scaffold"
  fi
  log_info "Copying .env.example to .env..."
  cp .env.example .env
  log_ok ".env created. Review and add sensitive values if needed."
}

# ─── Config resolution ──────────────────────────────────────────────
ENV_FILE="${ENV_FILE:-.env}"

# Resolve a config value: exported env var → .env file → caller default.
# Quotes around .env values are stripped (compose-compatible).
env_or_dotenv() {
  local key="$1" default="${2:-}"
  local val
  val="$(printenv "${key}" 2> /dev/null || true)"
  if [ -z "${val}" ] && [ -f "${ENV_FILE}" ]; then
    val="$(grep -E "^${key}=" "${ENV_FILE}" 2> /dev/null | head -1 | cut -d'=' -f2- || true)"
    val="${val%\"}"
    val="${val#\"}"
  fi
  printf '%s' "${val:-${default}}"
}

# Resolve a secret that has no acceptable default: fail with a clear
# message when neither the environment nor .env supplies a value.
require_secret() {
  local key="$1" val
  val="$(env_or_dotenv "${key}")"
  if [ -z "${val}" ]; then
    die "${key} is not set — export it or add it to ${ENV_FILE}"
  fi
  printf '%s' "${val}"
}
