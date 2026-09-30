#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# Container Resource Usage
# ADR-009
#
# CPU / memory / network / block I/O per container. Single snapshot
# (`--no-stream`), scoped to the current compose project so unrelated
# containers on the host are hidden.
#
# Usage:
#   bash scripts/monitoring/container-stats.sh            # project containers
#   bash scripts/monitoring/container-stats.sh --all      # every container
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=scripts/lib/common.sh
source "${SCRIPT_DIR}/../lib/common.sh"

COMPOSE_PROJECT="${COMPOSE_PROJECT_NAME:-infra}"
SCOPE="project"

while [ $# -gt 0 ]; do
  case "$1" in
  --all) SCOPE="all" ;;
  *)
    echo "usage: $(basename "$0") [--all]" >&2
    exit 64
    ;;
  esac
  shift
done

require_cmd docker "install Docker Engine (see scripts/setup/prerequisites.sh)"

# Go template braces live in single quotes so the shell leaves them alone.
FORMAT='table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}'

if [ "${SCOPE}" = "all" ]; then
  docker stats --no-stream --format "${FORMAT}"
else
  log_info "Resource usage (project: ${COMPOSE_PROJECT})"
  containers="$(docker ps -q --filter "label=com.docker.compose.project=${COMPOSE_PROJECT}")"
  if [ -z "${containers}" ]; then
    log_warn "no running containers for project '${COMPOSE_PROJECT}' — start it: just dev-up"
    exit 0
  fi
  # shellcheck disable=SC2086
  docker stats --no-stream --format "${FORMAT}" ${containers}
fi
