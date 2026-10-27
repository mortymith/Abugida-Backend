#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════════════
# devbox-doctor.sh — verify the sandboxed development environment
# ADR-026, ADR-009
#
# Checks that every tool the repository declares is present inside the Devbox
# sandbox and at the version the repository expects. Run it with:
#
#   devbox run doctor        # full report
#   devbox run doctor --quiet  # only failures (used by the shell init hook)
#
# Exit codes: 0 = all checks passed, 1 = at least one required check failed.
# ══════════════════════════════════════════════════════════════════════════════

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT" || exit 1

QUIET=0
[[ "${1:-}" == "--quiet" ]] && QUIET=1

FAILURES=0
WARNINGS=0

if [[ -t 1 && "${NO_COLOR:-}" == "" ]]; then
  C_OK=$'\033[32m'
  C_WARN=$'\033[33m'
  C_FAIL=$'\033[31m'
  C_DIM=$'\033[2m'
  C_OFF=$'\033[0m'
else
  C_OK=""
  C_WARN=""
  C_FAIL=""
  C_DIM=""
  C_OFF=""
fi

pass() { [[ $QUIET -eq 1 ]] || printf '  %sOK%s   %s\n' "$C_OK" "$C_OFF" "$1"; }
warn() {
  WARNINGS=$((WARNINGS + 1))
  [[ $QUIET -eq 1 ]] || printf '  %sWARN%s %s\n' "$C_WARN" "$C_OFF" "$1"
}
fail() {
  FAILURES=$((FAILURES + 1))
  [[ $QUIET -eq 1 ]] || printf '  %sFAIL%s %s\n' "$C_FAIL" "$C_OFF" "$1"
}
section() { [[ $QUIET -eq 1 ]] || printf '\n%s%s%s\n' "$C_DIM" "$1" "$C_OFF"; }

# check <label> <expected> <command...>
check_version() {
  local label="$1" expected="$2"
  shift 2
  local actual
  if ! actual="$("$@" 2> /dev/null | head -n1)"; then
    fail "$label — command not found: ${*: -1}"
    return
  fi
  if [[ "$expected" == "*" ]]; then
    pass "$label — $actual"
    return
  fi
  if [[ "$actual" == "$expected" ]]; then
    pass "$label — $actual"
  else
    warn "$label — expected $expected, found $actual"
  fi
}

# check_present <label> <command>
check_present() {
  local label="$1" cmd="$2"
  if command -v "$cmd" > /dev/null 2>&1; then
    pass "$label — $(command -v "$cmd")"
  else
    fail "$label — '$cmd' not on PATH"
  fi
}

printf '%sDevbox sandbox doctor%s — %s\n' "${C_DIM:-}" "${C_OFF:-}" "$REPO_ROOT"

# ─── Runtime & package manager ───────────────────────────────────────────────
section "Runtime"

BUN_VERSION="$(tr -d '[:space:]' < .bun-version 2> /dev/null || echo '')"
if [[ -n "$BUN_VERSION" ]]; then
  check_version "bun" "$BUN_VERSION" bun --version
else
  warn "bun — .bun-version is missing, cannot verify the pinned version"
fi

PNPM_DECLARED="$(sed -n 's/.*"packageManager"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' package.json | head -n1)"
PNPM_EXPECTED="${PNPM_DECLARED#pnpm@}"
if [[ -n "$PNPM_EXPECTED" ]]; then
  check_version "pnpm" "$PNPM_EXPECTED" pnpm --version
else
  check_present "pnpm" pnpm
fi

# ─── Task runner & containers ────────────────────────────────────────────────
section "Task runner & containers"

check_present "just" just
check_present "docker" docker
check_present "docker compose" docker-compose

if docker compose version > /dev/null 2>&1; then
  pass "docker compose plugin — $(docker compose version --short 2> /dev/null || echo available)"
elif docker-compose version > /dev/null 2>&1; then
  warn "docker compose plugin — not on the CLI plugin path, using 'docker-compose' directly"
else
  fail "docker compose — neither the plugin nor the standalone binary works"
fi

if docker info > /dev/null 2>&1; then
  pass "docker daemon — reachable"
else
  warn "docker daemon — not reachable; 'just dev-up' needs a running Docker daemon"
fi

# ─── Repository linters (system binaries per tooling/README.md) ──────────────
section "Repository linters"

check_present "shellcheck" shellcheck
check_present "hadolint" hadolint
check_present "yamllint" yamllint
check_present "gitleaks" gitleaks
check_present "dotenv-linter" dotenv-linter
check_present "editorconfig-checker" editorconfig-checker
check_present "shfmt" shfmt

# ─── Operations tooling ─────────────────────────────────────────────────────
section "Operations tooling"

check_present "jq" jq
check_present "curl" curl
check_present "vault" vault
check_present "mc (MinIO client)" mc

# ─── Workspace state ─────────────────────────────────────────────────────────
section "Workspace"

if [[ -d node_modules ]]; then
  pass "node_modules — installed"
else
  warn "node_modules — missing; run 'devbox run setup' (pnpm install)"
fi

if [[ -f devbox.lock ]]; then
  pass "devbox.lock — committed, sandbox versions are reproducible"
else
  warn "devbox.lock — missing; run 'devbox install' and commit the lock file"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
if [[ $QUIET -eq 1 ]]; then
  if ((FAILURES > 0)); then
    printf '%sdevbox-doctor: %d failure(s)%s\n' "$C_FAIL" "$FAILURES" "$C_OFF"
    exit 1
  fi
  exit 0
fi

printf '\n'
if ((FAILURES > 0)); then
  printf '%s%d failure(s), %d warning(s)%s\n' "$C_FAIL" "$FAILURES" "$WARNINGS" "$C_OFF"
  exit 1
fi
if ((WARNINGS > 0)); then
  printf '%sall checks passed with %d warning(s)%s\n' "$C_WARN" "$WARNINGS" "$C_OFF"
  exit 0
fi
printf '%sall checks passed%s\n' "$C_OK" "$C_OFF"
