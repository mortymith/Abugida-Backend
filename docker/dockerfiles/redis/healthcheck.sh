#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════
# Redis Health Check (2.6 Fix)
# ═════════════════════════════════════════════════════════
# Reads the password from environment variables (ADR-006)
# and runs an authenticated PING. Used as the Docker HEALTHCHECK.
# ═════════════════════════════════════════════════════════
set -euo pipefail

ROLE="${ROLE:-primary}"

if [ "${ROLE}" = "sentinel" ]; then
  # Sentinel health check: use sentinel password
  SENTINEL_PASS="${REDIS_SENTINEL_PASSWORD:-}"
  if [ -n "${SENTINEL_PASS}" ]; then
    redis-cli -a "${SENTINEL_PASS}" --no-auth-warning -p 26379 ping || exit 1
  else
    redis-cli -p 26379 ping || exit 1
  fi
else
  # Server health check: authenticate as admin (default user is disabled
  # in users.acl, and readonly lacks @connection). Without an explicit
  # --user, -a authenticates the disabled default user.
  REDIS_PASS="${REDIS_ADMIN_PASSWORD:-${REDIS_PASSWORD:-}}"
  if [ -n "${REDIS_PASS}" ]; then
    redis-cli --user admin -a "${REDIS_PASS}" --no-auth-warning ping || exit 1
  else
    redis-cli ping || exit 1
  fi
fi
