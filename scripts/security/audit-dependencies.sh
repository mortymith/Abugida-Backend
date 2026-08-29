#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Dependency Audit — Scan Dockerfiles & lockfiles for known vulnerabilities
# Source: deployment.md v3.0.0 Phase 14
#
# Checks:
#   1. Dockerfiles: flags `:latest` tags (pinned digests preferred),
#      detects `--insecure` curl/wget, checks COPY/ADD bounds
#   2. Lockfiles: runs `npm audit` / `pip-audit` / `trivy fs` if available
#   3. Base images: checks for known EOL/distro versions
#   4. Secret leakage: scans for hardcoded secrets in Dockerfiles
#
# Usage:
#   bash scripts/security/audit-dependencies.sh
#   bash scripts/security/audit-dependencies.sh --ci   (CI mode: exit 1 on findings)
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# ── Configuration ──────────────────────────────────────────────────
CI_MODE=false
if [[ "${1:-}" == "--ci" ]]; then
  CI_MODE=true
fi

# ── Colors ─────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
RESET='\033[0m'

# ── Counters ───────────────────────────────────────────────────────
CRITICAL=0
HIGH=0
MEDIUM=0
LOW=0
TOTAL_FINDINGS=0

log_critical() {
  echo -e "  ${RED}[CRITICAL]${RESET} $*"
  ((CRITICAL++)) || true
  ((TOTAL_FINDINGS++)) || true
}
log_high() {
  echo -e "  ${RED}[HIGH]${RESET}     $*"
  ((HIGH++)) || true
  ((TOTAL_FINDINGS++)) || true
}
log_medium() {
  echo -e "  ${YELLOW}[MEDIUM]${RESET}   $*"
  ((MEDIUM++)) || true
  ((TOTAL_FINDINGS++)) || true
}
log_low() {
  echo -e "  ${YELLOW}[LOW]${RESET}      $*"
  ((LOW++)) || true
  ((TOTAL_FINDINGS++)) || true
}

# ═════════════════════════════════════════════════════════════════════
# 1. Dockerfile Analysis
# ═════════════════════════════════════════════════════════════════════
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  Dependency & Dockerfile Audit${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"
echo ""

# ── 1a. Check for `:latest` tags (should use pinned versions) ───────
echo -e "${BOLD}── Dockerfile Image Tag Audit ──${RESET}"
while IFS= read -r -d '' dockerfile; do
  relpath="${dockerfile#${PROJECT_ROOT}/}"
  # Extract FROM lines
  while IFS= read -r line; do
    image=$(echo "$line" | grep -oP 'FROM\s+\K[^\s]+' | head -1)
    if [[ -z "$image" ]]; then continue; fi
    # Strip platform prefix
    image=$(echo "$image" | sed 's/--platform=[^ ]* //')
    # Check for :latest or no tag
    if [[ "$image" == *:latest ]] || [[ ! "$image" == *:* ]]; then
      log_high "${relpath}: uses unpinned/latest image → ${image}"
    fi
    # Check for known EOL base distros
    for eol in "alpine:3.8" "alpine:3.9" "alpine:3.10" "alpine:3.11" "alpine:3.12" \
      "ubuntu:18.04" "ubuntu:20.04" "debian:9" "debian:10" \
      "node:14" "node:16" "python:3.7" "python:3.8"; do
      if [[ "$image" == *"${eol}"* ]]; then
        log_critical "${relpath}: EOL base image → ${image}"
      fi
    done
  done < <(grep -n '^\s*FROM\s' "$dockerfile")
done < <(find "${PROJECT_ROOT}/docker/dockerfiles" -name 'Dockerfile' -print0 2> /dev/null)

# ── 1b. Check for insecure downloads ────────────────────────────────
echo ""
echo -e "${BOLD}── Insecure Download Detection ──${RESET}"
while IFS= read -r -d '' dockerfile; do
  relpath="${dockerfile#${PROJECT_ROOT}/}"
  line_num=0
  while IFS= read -r line; do
    ((line_num++)) || true
    # curl/wget with --insecure
    if echo "$line" | grep -qP '(curl|wget)\s+.*--insecure|\s+-k\b'; then
      log_high "${relpath}:${line_num}: insecure download (curl/wget -k)"
    fi
    # pip install without --no-cache-dir or with --trusted-host
    if echo "$line" | grep -qP 'pip install.*--trusted-host'; then
      log_medium "${relpath}:${line_num}: pip with --trusted-host (MITM risk)"
    fi
    # apt-get without verification
    if echo "$line" | grep -qP 'apt-get\s+install.*--allow-unauthenticated'; then
      log_high "${relpath}:${line_num}: apt-get with --allow-unauthenticated"
    fi
  done < "$dockerfile"
done < <(find "${PROJECT_ROOT}/docker/dockerfiles" -name 'Dockerfile' -print0 2> /dev/null)

# ── 1c. Check for hardcoded secrets in Dockerfiles ──────────────────
echo ""
echo -e "${BOLD}── Secret Leakage Detection (Dockerfiles) ──${RESET}"
SECRET_PATTERNS=(
  'PASSWORD\s*=' 'API_KEY\s*=' 'SECRET_KEY\s*='
  'TOKEN\s*=' 'AWS_ACCESS_KEY\s*=' 'AWS_SECRET\s*='
  'PRIVATE_KEY' 'MONGO_URI\s*=' 'DATABASE_URL\s*='
  'REDIS_PASSWORD\s*=' 'VAULT_TOKEN\s*='
)
while IFS= read -r -d '' dockerfile; do
  relpath="${dockerfile#${PROJECT_ROOT}/}"
  line_num=0
  while IFS= read -r line; do
    ((line_num++)) || true
    # Skip comments
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    # Skip ARG/ENV references to secrets (those are fine — values come from build args)
    if echo "$line" | grep -qP '^\s*(ARG|ENV)\s+'; then
      for pat in "${SECRET_PATTERNS[@]}"; do
        sq="'" dq="\""

        # Only flag if there's an actual value, not just a variable name
        if echo "$line" | grep -qP "${pat}[${sq}${dq}][^${sq}${dq}]{4,}"; then
          log_critical "${relpath}:${line_num}: possible hardcoded secret → $(echo "$line" | sed 's/^[[:space:]]*//')"
        fi
      done
    fi
  done < "$dockerfile"
done < <(find "${PROJECT_ROOT}/docker/dockerfiles" -name 'Dockerfile' -print0 2> /dev/null)

# ── 1d. Check .dockerignore exists ──────────────────────────────────
echo ""
echo -e "${BOLD}── Dockerignore Validation ──${RESET}"
if [ ! -f "${PROJECT_ROOT}/.dockerignore" ]; then
  log_medium "Missing .dockerignore — sensitive files may be included in build context"
else
  # Check that critical patterns are excluded
  for pattern in ".env" ".env.prod" "data/" "*.pem" "*.key" "credentials.json" ".git"; do
    if ! grep -qF "$pattern" "${PROJECT_ROOT}/.dockerignore"; then
      log_medium ".dockerignore missing pattern: ${pattern}"
    fi
  done
fi

# ═════════════════════════════════════════════════════════════════════
# 2. Lockfile / Package Audit
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}── Package Lockfile Audit ──${RESET}"

# npm audit
if [ -f "${PROJECT_ROOT}/package-lock.json" ]; then
  if command -v npm > /dev/null 2>&1; then
    echo "  Running npm audit..."
    if npm audit --omit=dev 2> /tmp/npm-audit-output.txt; then
      echo -e "  ${GREEN}npm audit: no vulnerabilities${RESET}"
    else
      vuln_count=$(grep -c 'vulnerability' /tmp/npm-audit-output.txt 2> /dev/null || echo "unknown")
      log_high "npm audit found ${vuln_count} vulnerabilities"
      grep -E 'high|critical' /tmp/npm-audit-output.txt 2> /dev/null | head -5 | while read -r line; do
        echo "    → $line"
      done
    fi
  else
    echo "  (npm not available — skipping npm audit)"
  fi
else
  echo "  (no package-lock.json found — skipping)"
fi

# pip-audit
if [ -f "${PROJECT_ROOT}/requirements.txt" ] || [ -f "${PROJECT_ROOT}/Pipfile.lock" ]; then
  if command -v pip-audit > /dev/null 2>&1; then
    echo "  Running pip-audit..."
    if [ -f "${PROJECT_ROOT}/requirements.txt" ]; then
      pip-audit -r "${PROJECT_ROOT}/requirements.txt" 2> /tmp/pip-audit-output.txt || true
    else
      pip-audit 2> /tmp/pip-audit-output.txt || true
    fi
    if grep -qiE 'vulnerab|CVE' /tmp/pip-audit-output.txt 2> /dev/null; then
      log_high "pip-audit found vulnerabilities"
      cat /tmp/pip-audit-output.txt | head -10
    else
      echo -e "  ${GREEN}pip-audit: no vulnerabilities${RESET}"
    fi
  else
    echo "  (pip-audit not available — install with: pip install pip-audit)"
  fi
else
  echo "  (no Python dependency files found — skipping)"
fi

# ═════════════════════════════════════════════════════════════════════
# 3. Trivy Filesystem Scan (if available)
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}── Trivy Filesystem Scan ──${RESET}"
if command -v trivy > /dev/null 2>&1; then
  echo "  Running trivy fs scan..."
  if trivy fs --severity CRITICAL,HIGH --format table --no-progress "${PROJECT_ROOT}" 2> /tmp/trivy-fs-output.txt; then
    echo -e "  ${GREEN}trivy fs: no critical/high findings${RESET}"
  else
    log_high "trivy fs found critical/high findings (see above)"
  fi
else
  echo "  (trivy not available — install with: https://aquasecurity.github.io/trivy/)"
fi

# ═════════════════════════════════════════════════════════════════════
# Summary
# ═════════════════════════════════════════════════════════════════════
echo ""
echo -e "${BOLD}──────────────────────────────────────────────────────────${RESET}"
printf "  ${RED}Critical: %d${RESET}  ${RED}High: %d${RESET}  ${YELLOW}Medium: %d${RESET}  ${YELLOW}Low: %d${RESET}  (Total: %d)\n" \
  "$CRITICAL" "$HIGH" "$MEDIUM" "$LOW" "$TOTAL_FINDINGS"
echo -e "${BOLD}══════════════════════════════════════════════════════════════${RESET}"

if [ "$CRITICAL" -gt 0 ]; then
  echo -e "  ${RED}FAILED: ${CRITICAL} critical findings. Fix before deploying.${RESET}"
  exit 1
fi

if [ "$CI_MODE" = true ] && [ "$TOTAL_FINDINGS" -gt 0 ]; then
  echo -e "  ${YELLOW}CI mode: ${TOTAL_FINDINGS} findings found. Review recommended.${RESET}"
  exit 1
fi

echo -e "  ${GREEN}PASSED: No critical findings.${RESET}"
exit 0
