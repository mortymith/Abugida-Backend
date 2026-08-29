#!/usr/bin/env bash
# ═════════════════════════════════════════════════════════════════════
# Marketing Entrypoint
#
# Starts the statically built Astro site (server.mjs). The build is fully
# static, so there are no external dependencies to wait for.
#
# The application must expose:
#   GET /health → 200 {"status":"ok"}
# ═════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Export OTEL env vars (defaults from the image, overridable) ──────
export OTEL_EXPORTER_OTLP_ENDPOINT
export OTEL_SERVICE_NAME
export OTEL_SERVICE_VERSION
export OTEL_RESOURCE_ATTRIBUTES

# ── Start the application ────────────────────────────────────────────
echo "[entrypoint] Starting marketing server on port ${PORT:-8080}..."
exec "$@"
