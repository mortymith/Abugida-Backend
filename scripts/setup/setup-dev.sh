#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════════════
# Dev Environment Setup (standalone wrapper)
# Source: deployment.md v3.0.0, ADR-009
#
# Thin wrapper over the shared tiered bring-up so `just setup-dev` and
# this script can never drift apart.
#
# Usage:
#   bash scripts/setup/setup-dev.sh
# ════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bash "${SCRIPT_DIR}/bring-up.sh" dev
