#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Dev Environment Setup (standalone, idempotent)
# Source: deployment.md v3.0.0, ADR-009
#
# Runs the full dev bootstrap: scaffold, .env, compose up, init.
# This is the same as `just setup-dev` but can be called directly.
#
# Usage:
#   bash scripts/setup/setup-dev.sh
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${PROJECT_ROOT}"

DEV_COMPOSE="docker compose --project-directory . -f docker/compose/networks.yml -f docker/compose/volumes.yml -f docker/compose/base.yml -f docker/compose/profiles/dev.override.yml"

echo "==> [setup-dev] Starting dev services..."
${DEV_COMPOSE} up -d

echo "==> [setup-dev] Waiting for services..."
bash docker/init/wait-for-services.sh dev

echo "==> [setup-dev] Initializing MinIO..."
${DEV_COMPOSE} run --rm init-minio || true

echo "==> [setup-dev] Dev environment ready."
