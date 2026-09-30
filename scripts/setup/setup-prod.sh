#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# Prod Environment Setup (standalone wrapper)
# Source: deployment.md v3.0.0, ADR-009
#
# Thin wrapper over the shared tiered bring-up so `just setup-prod` and
# this script can never drift apart.
#
# Usage:
#   bash scripts/setup/setup-prod.sh
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bash "${SCRIPT_DIR}/bring-up.sh" prod
