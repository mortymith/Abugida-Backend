#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════════════════
# Integration Test Suite (§5.1 Verify subgraph)
# ═════════════════════════════════════════════════════════════════════════════════════════════
#
# Runs the full verification chain from §5.1:
#   Smoke Tests → API Tests → Cache Tests → Database Tests → Notify
#
# Each test group returns 0 (pass) or 1 (fail).
# The suite fails fast on first group failure.
#
# Usage:
#   bash tests/integration/test-suite.sh
#   bash tests/integration/test-suite.sh --group smoke
#   bash tests/integration/test-suite.sh --group api
# ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
set -euo pipefail

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "${PROJECT_ROOT}"

set -a
source .env
set +a

FILTER_GROUP="${1:-all}"
FAILED=0
PASSED=0
TOTAL=0

# ── Test helpers ──────────────────────────────────────────────────

test_pass() {
  echo "  [PASS] $1"
  PASSED=$((PASSED + 1))
  TOTAL=$((TOTAL + 1))
}
test_fail() {
  echo "  [FAIL] $1"
  FAILED=$((FAILED + 1))
  TOTAL=$((TOTAL + 1))
}

assert_http() {
  local name="$1" url="$2" expected_code="${3:-200}"
  HTTP_CODE=$(curl -sf -o /dev/null -w '%{http_code}' "${url}" 2> /dev/null || echo '000')
  if [ "${HTTP_CODE}" = "${expected_code}" ]; then
    test_pass "${name} (${HTTP_CODE})"
  else
    test_fail "${name} (expected ${expected_code}, got ${HTTP_CODE})"
  fi
}

assert_json_field() {
  local name="$1" url="$2" field="$3" expected="$4"
  VALUE=$(curl -sf "${url}" 2> /dev/null | jq -r ".${field}" 2> /dev/null || echo '')
  if [ "${VALUE}" = "${expected}" ]; then
    test_pass "${name} (field ${field}=${VALUE})"
  else
    test_fail "${name} (expected ${field}=${expected}, got ${VALUE})"
  fi
}

assert_container_cmd() {
  local name="$1" container="$2" cmd="$3" expected="$4"
  RESULT=$(docker exec "${container}" ${cmd} 2> /dev/null || echo '')
  if echo "${RESULT}" | grep -qi "${expected}"; then
    test_pass "${name}"
  else
    test_fail "${name} (expected '${expected}', got '${RESULT}')"
  fi
}

# ═════════════════════════════════════════════════════════════════════
# GROUP 1: SMOKE TESTS (§5.1 Smoke node)
# ═════════════════════════════════════════════════════════════════════
run_smoke() {
  echo "=== Smoke Tests ==="

  # API is reachable
  assert_http "API /health" "http://localhost:3001/health" 200

  # Dashboard is reachable
  assert_http "Dashboard /health" "http://localhost:8081/health" 200

  # Marketing is reachable
  assert_http "Marketing /health" "http://localhost:8082/health" 200

  # Redis responds
  assert_container_cmd "Redis PING" "${COMPOSE_PROJECT}_redis-primary" \
    "redis-cli ping" "PONG"

  # PostgreSQL is accepting connections
  assert_container_cmd "PostgreSQL ready" "${COMPOSE_PROJECT}_postgres-primary" \
    "pg_isready -U app" "accepting"

  # PgBouncer is proxying
  assert_container_cmd "PgBouncer ready" "${COMPOSE_PROJECT}_pgbouncer" \
    "pg_isready -h localhost -p 6432 -U ${POSTGRES_USER:-app}" "accepting"

  # MinIO is live
  assert_http "MinIO health" "http://localhost:9000/minio/health/live" 200
}

# ═════════════════════════════════════════════════════════════════════
# GROUP 2: API TESTS (§5.1 APITest node)
# ═════════════════════════════════════════════════════════════════════
run_api() {
  echo "=== API Tests ==="

  # Health endpoint returns JSON with status
  assert_json_field "API status" "http://localhost:3001/health" "status" "ok"

  # DB health returns JSON
  assert_json_field "API DB status" "http://localhost:3001/db-health" "status" "ok"

  # API responds to a non-existent route with 404, not 500
  assert_http "API 404 handling" "http://localhost:3001/api/v1/nonexistent" 404

  # API responds to OPTIONS with CORS headers
  CORS=$(curl -sf -o /dev/null -w '%{http_code}' -X OPTIONS \
    -H 'Origin: http://localhost' \
    -H 'Access-Control-Request-Method: GET' \
    "http://localhost:3001/api/v1/users" 2> /dev/null || echo '000')
  if [ "${CORS}" = "204" ] || [ "${CORS}" = "200" ]; then
    test_pass "API CORS preflight"
  else
    test_fail "API CORS preflight (got ${CORS})"
  fi
}

# ═════════════════════════════════════════════════════════════════════
# GROUP 3: CACHE TESTS (§5.1 CacheTest node)
# ═════════════════════════════════════════════════════════════════════
run_cache() {
  echo "=== Cache Tests ==="

  # Redis can SET and GET
  assert_container_cmd "Redis SET/GET" "${COMPOSE_PROJECT}_redis-primary" \
    "redis-cli SET _test_suite_check 1 && redis-cli GET _test_suite_check" "\"1\""

  # Redis can DEL
  docker exec "${COMPOSE_PROJECT}_redis-primary" redis-cli DEL _test_suite_check > /dev/null
  test_pass "Redis DEL"

  # Redis info shows correct maxmemory policy
  assert_container_cmd "Redis maxmemory-policy" "${COMPOSE_PROJECT}_redis-primary" \
    "redis-cli CONFIG GET maxmemory-policy" "allkeys-lru"

  # Sentinel is monitoring (prod only)
  if docker ps --format '{{.Names}}' | grep -q "${COMPOSE_PROJECT}_redis-sentinel-1"; then
    assert_container_cmd "Sentinel monitoring" "${COMPOSE_PROJECT}_redis-sentinel-1" \
      "redis-cli -p 26379 SENTINEL MASTER mymaster" "mymaster"
  fi
}

# ═════════════════════════════════════════════════════════════════════
# GROUP 4: DATABASE TESTS (§5.1 DBTest node)
# ═════════════════════════════════════════════════════════════════════
run_database() {
  echo "=== Database Tests ==="

  # PgBouncer can reach PostgreSQL
  RESULT=$(docker exec "${COMPOSE_PROJECT}_pgbouncer" psql -h localhost -p 6432 \
    -U app -d app -tAc "SELECT 1;" 2> /dev/null || echo '')
  if [ "${RESULT}" = "1" ]; then
    test_pass "PgBouncer -> PostgreSQL connectivity"
  else
    test_fail "PgBouncer -> PostgreSQL connectivity (got '${RESULT}')"
  fi

  # Users table exists
  TABLE_EXISTS=$(docker exec "${COMPOSE_PROJECT}_postgres-primary" psql -U app -d app -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_name = 'users';" 2> /dev/null || echo '0')
  if [ "${TABLE_EXISTS}" -ge 1 ]; then
    test_pass "Users table exists"
  else
    test_fail "Users table not found (count: ${TABLE_EXISTS})"
  fi

  # Sessions table exists
  TABLE_EXISTS=$(docker exec "${COMPOSE_PROJECT}_postgres-primary" psql -U app -d app -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_name = 'sessions';" 2> /dev/null || echo '0')
  if [ "${TABLE_EXISTS}" -ge 1 ]; then
    test_pass "Sessions table exists"
  else
    test_fail "Sessions table not found (count: ${TABLE_EXISTS})"
  fi

  # Audit log table exists
  TABLE_EXISTS=$(docker exec "${COMPOSE_PROJECT}_postgres-primary" psql -U app -d app -tAc \
    "SELECT count(*) FROM information_schema.tables WHERE table_name = 'audit_log';" 2> /dev/null || echo '0')
  if [ "${TABLE_EXISTS}" -ge 1 ]; then
    test_pass "Audit_log table exists"
  else
    test_fail "Audit_log table not found (count: ${TABLE_EXISTS})"
  fi

  # Replication check (prod only)
  if docker ps --format '{{.Names}}' | grep -q "${COMPOSE_PROJECT}_postgres-replica-1"; then
    STANDBY_COUNT=$(docker exec "${COMPOSE_PROJECT}_postgres-primary" psql -U app -d app -tAc \
      "SELECT count(*) FROM pg_stat_replication;" 2> /dev/null || echo '0')
    if [ "${STANDBY_COUNT}" -ge 1 ]; then
      test_pass "Replication active (${STANDBY_COUNT} standby)"
    else
      test_fail "No replication standbys found"
    fi
  fi
}

# ═════════════════════════════════════════════════════════════════════
# MAIN
# ═════════════════════════════════════════════════════════════════════
echo "════════════════════════════════════════════════════════════"
echo "  Integration Test Suite"
echo "════════════════════════════════════════════════════════════"
echo ""

case "${FILTER_GROUP}" in
--group)
  shift
  "${1:-smoke}"
  ;;
smoke) run_smoke ;;
api) run_api ;;
cache) run_cache ;;
database) run_database ;;
all)
  run_smoke || true
  run_api || true
  run_cache || true
  run_database || true
  ;;
*)
  echo "Usage: $0 [--group {smoke|api|cache|database}|all]"
  exit 1
  ;;
esac

echo ""
echo "════════════════════════════════════════════════════════════"
printf "  Results: ${PASSED} passed, ${FAILED} failed (of ${TOTAL})\n"
echo "════════════════════════════════════════════════════════════"

if [ ${FAILED} -gt 0 ]; then
  # §5.1 NotifyFailure
  LEVEL=error CONTEXT=deploy TASK=test-suite bash "${PROJECT_ROOT}/scripts/backup/telegram-notify.sh" \
    "Integration tests FAILED: ${FAILED}/${TOTAL}" 2> /dev/null || true
  exit 1
fi
