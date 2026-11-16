# syntax=docker/dockerfile:1

# ═════════════════════════════════════════════════════════════════════
# Abugida Worker Service — Multi-Stage Dockerfile
#
# Stage 0 (`base`) inlines the shared Abugida base toolchain:
# Bun 1.4.4 + pnpm 12.15.0 (installed via Bun — this image contains no
# Node.js), the runtime tooling (bash, curl, jq,
# postgresql17-client) used by the healthcheck and ops tasks, and the
# non-root `appuser` (uid/gid 1000, WORKDIR /app).
#
#   Stage 1 (builder): workspace-aware pnpm install against the frozen
#                      lockfile, the two shared workspace packages the worker
#                      consumes (`@abugida/queue`, `@abugida/observability`)
#                      compiled to dist/, then a single-file Bun bundle
#                      (target=bun inlines every dependency — no node_modules
#                      needed at runtime).
#   Stage 2 (runtime): base stage + bundled worker + entrypoint + healthcheck.
#
# The worker is the job consumer (ADR-028): it owns the BullMQ runtime and
# the processors, and it is the only process that reads the
# TELEBIRR_*/SMS_ETHIOPIA_* secrets.
#
# Lives in app/worker/ but builds from the MONOREPO ROOT context (both
# docker-compose.yml and CI pass `.`), so manifest, source, and entrypoint
# paths below are repo-relative.
# ═════════════════════════════════════════════════════════════════════

ARG BUILD_VERSION=0.0.1

# ── Stage 0: Shared base ────────────────────────────────────────────
# oven/bun pinned by digest (multi-arch index) for reproducible,
# supply-chain-safe builds. Bump the tag AND digest together.
FROM oven/bun:1.4.4-alpine@sha256:4cf82f5686b196504fe119db3fcd9185b191f82ece82c40680e597228ec6070a AS base

# Version pins (single source of truth for this inline copy).
ARG PNPM_VERSION=12.15.0
ARG APK_BASH=5.2.37-r0
ARG APK_CURL=8.14.1-r3
ARG APK_JQ=1.8.1-r0
ARG APK_PG17_CLIENT=17.11-r0

# Toolchain + runtime tooling (all pinned). No Node.js packages: pnpm is
# installed and executed by Bun — the only JS runtime in this image. The
# node→bun symlink lets dependency lifecycle scripts (esbuild, sharp) run
# under Bun; it is a symlink to bun, not a Node.js installation.
RUN apk add --no-cache \
        bash=${APK_BASH} \
        curl=${APK_CURL} \
        jq=${APK_JQ} \
        postgresql17-client=${APK_PG17_CLIENT} \
    && BUN_INSTALL=/usr/local bun add --global pnpm@${PNPM_VERSION} \
    && ln -s "$(command -v bun)" /usr/local/bin/node

# bash is present from the step above; use it with pipefail for all RUN.
SHELL ["/bin/bash", "-euo", "pipefail", "-c"]

# Non-root user (uid/gid 1000): replaces oven/bun's stock `bun` user so
# downstream stages can rely on a stable, documented user.
RUN deluser bun \
    && addgroup --gid 1000 appuser \
    && adduser -D --uid 1000 -G appuser --shell /bin/bash --home /app appuser

WORKDIR /app
# Numeric uid:gid (matches appuser, 1000:1000) for host/k8s uid resolvability.
USER 1000:1000

# Toolchain verification (fails the build if anything is broken).
RUN bun --version \
    && pnpm --version \
    && bash --version | head -n1 \
    && curl --version | head -n1 \
    && jq --version \
    && psql --version \
    && whoami

STOPSIGNAL SIGTERM

# ── Stage 1: Builder ────────────────────────────────────────────────
FROM base AS builder

WORKDIR /app

# Workspace manifests first for maximum layer caching. The `--filter
# @abugida/worker...` selector pulls in the worker's workspace
# dependencies (@abugida/queue, @abugida/observability) and their
# transitive third-party packages; their manifests therefore have to be
# present before the install. --chown keeps the tree writable by the base
# image's non-root appuser (1000:1000).
COPY --chown=1000:1000 package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --chown=1000:1000 app/worker/package.json app/worker/
COPY --chown=1000:1000 packages/queue/package.json packages/queue/
COPY --chown=1000:1000 packages/observability/package.json packages/observability/
COPY --chown=1000:1000 tooling/typescript-config/package.json tooling/typescript-config/

# pnpm store is a persistent BuildKit cache mount, so package downloads
# survive lockfile changes and are shared across rebuilds of this image.
RUN --mount=type=cache,id=pnpm-worker,uid=1000,gid=1000,target=/app/.local/share/pnpm/store \
    pnpm install --filter @abugida/worker... --frozen-lockfile

# The shared packages are consumed as compiled dist/ builds, so they are
# compiled here. Their tsconfigs extend @abugida/typescript-config, which
# ships the preset files (no build step).
COPY --chown=1000:1000 tsconfig.json ./
COPY --chown=1000:1000 tooling/typescript-config tooling/typescript-config
COPY --chown=1000:1000 packages/queue/tsconfig.json packages/queue/
COPY --chown=1000:1000 packages/queue/src packages/queue/src
COPY --chown=1000:1000 packages/observability/tsconfig.json packages/observability/
COPY --chown=1000:1000 packages/observability/src packages/observability/src

RUN pnpm --filter @abugida/queue run build \
    && pnpm --filter @abugida/observability run build

# The app tsconfig resolves the @/* path alias used by the worker source.
COPY --chown=1000:1000 app/worker/tsconfig.json app/worker/
COPY --chown=1000:1000 app/worker/src app/worker/src

# Compile into a single self-contained bundle (no runtime install step).
WORKDIR /app/app/worker
RUN bun build src/index.ts --target bun --outfile dist/index.js

# ── Stage 2: Runtime ────────────────────────────────────────────────
FROM base AS runtime

ARG BUILD_VERSION=0.0.1
ARG ENVIRONMENT=development

WORKDIR /app

# Only the compiled bundle is shipped — the runtime image carries no
# node_modules, lockfiles, or build tooling.
COPY --from=builder /app/app/worker/dist ./dist

# Exec bit is set explicitly so the image is robust to checkout provenance.
COPY --chmod=0755 app/worker/entrypoint.sh /usr/local/bin/entrypoint.sh

# OpenTelemetry defaults (entrypoint.sh re-exports these from the runtime
# environment, so they remain overridable per environment).
ENV NODE_ENV=production \
    OTEL_SERVICE_NAME=worker \
    OTEL_SERVICE_VERSION=${BUILD_VERSION} \
    OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317 \
    OTEL_TRACES_EXPORTER=otlp \
    OTEL_METRICS_EXPORTER=otlp \
    OTEL_RESOURCE_ATTRIBUTES=service.name=worker,deployment.environment=${ENVIRONMENT}

LABEL org.opencontainers.image.title="Abugida Worker"
LABEL org.opencontainers.image.description="Background job worker (BullMQ consumer) built on the shared Abugida Bun/pnpm base"
LABEL org.opencontainers.image.base.name="oven/bun:1.4.4-alpine"
LABEL org.opencontainers.image.version="${BUILD_VERSION}"
LABEL org.opencontainers.image.vendor="Abugida"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://github.com/mortymith/Abugida-Backend"

EXPOSE 3000

# Re-assert non-root execution (guards against future root-level edits).
USER 1000:1000

# curl ships in the base stage; the /health contract is documented in
# app/worker/entrypoint.sh.
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=30s \
    CMD ["/bin/sh", "-c", "curl -sf http://localhost:3000/health || exit 1"]

# The oven/bun entrypoint inherited via the base stage is replaced with the
# dependency-wait entrypoint, which `exec`s the command below as PID 1.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
# Disallow runtime code generation (bun 1.4.3+): eval(), new Function(),
# node:vm, data: URL imports, Worker eval and inspector codegen all throw.
# Validated against the full test suites and a smoke run of this worker.
CMD ["bun", "--disallow-code-generation-from-strings=strict", "dist/index.js"]
