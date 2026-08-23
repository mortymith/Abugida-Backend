# syntax=docker/dockerfile:1

# ═════════════════════════════════════════════════════════════════════
# Abugida Marketing Service — Multi-Stage Dockerfile
#
# Stage 0 (`base`) inlines the shared Abugida base toolchain:
# Bun 1.3.14 + pnpm 11.21.0, the runtime tooling (bash, curl, jq,
# postgresql17-client) used by the healthcheck and ops tasks, and the
# non-root `appuser` (uid/gid 1000, WORKDIR /app).
#
#   Stage 1 (builder): workspace-aware pnpm install against the frozen
#                      lockfile, then `astro build` for a fully static
#                      dist/ output.
#   Stage 2 (runtime): base stage + static dist/ + a small Bun static-file
#                      server (server.mjs) + entrypoint + healthcheck. The
#                      output is static, so no node_modules ship at runtime.
#
# Lives in app/marketing/ but builds from the MONOREPO ROOT context (both
# docker-compose.yml and CI pass `.`), so manifest, source, and entrypoint
# paths below are repo-relative.
# ═════════════════════════════════════════════════════════════════════

ARG BUILD_VERSION=0.0.1

# ── Stage 0: Shared base ────────────────────────────────────────────
# oven/bun pinned by digest (multi-arch index) for reproducible,
# supply-chain-safe builds. Bump the tag AND digest together.
FROM oven/bun:1.3.14-alpine@sha256:5acc90a93e91ff07bf72aa90a7c9f0fa189765aec90b47bdbf2152d2196383c0 AS base

# Version pins (single source of truth for this inline copy).
ARG PNPM_VERSION=11.21.0
ARG APK_NODEJS=22.23.2-r0
ARG APK_NPM=11.6.4-r0
ARG APK_BASH=5.2.37-r0
ARG APK_CURL=8.14.1-r3
ARG APK_JQ=1.8.1-r0
ARG APK_PG17_CLIENT=17.11-r0

# Toolchain + runtime tooling (all pinned). npm bootstraps pnpm and is
# removed afterwards; node stays because pnpm runs on it.
RUN apk add --no-cache \
        bash=${APK_BASH} \
        curl=${APK_CURL} \
        jq=${APK_JQ} \
        nodejs=${APK_NODEJS} \
        npm=${APK_NPM} \
        postgresql17-client=${APK_PG17_CLIENT} \
    && npm install --global pnpm@${PNPM_VERSION} \
    && npm cache clean --force \
    && apk del --no-cache npm \
    && rm -rf /root/.npm

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
    && node --version \
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

# Workspace manifests first for maximum layer caching. Only @abugida/marketing
# is installed via the --filter flag; it has no workspace dependencies, so the
# other app/* and packages/* projects are not required. --chown keeps the
# tree writable by the base image's non-root appuser (1000:1000).
COPY --chown=1000:1000 package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --chown=1000:1000 app/marketing/package.json app/marketing/

# pnpm store is a persistent BuildKit cache mount, so package downloads
# survive lockfile changes and are shared across rebuilds of this image.
RUN --mount=type=cache,id=pnpm-marketing,uid=1000,gid=1000,target=/app/.local/share/pnpm/store \
    pnpm install --filter @abugida/marketing --frozen-lockfile

# Astro config + tsconfig, then source and static assets.
COPY --chown=1000:1000 app/marketing/astro.config.mjs app/marketing/tsconfig.json app/marketing/
COPY --chown=1000:1000 app/marketing/src app/marketing/src
COPY --chown=1000:1000 app/marketing/public app/marketing/public

WORKDIR /app/app/marketing
RUN bun run build

# ── Stage 2: Runtime ────────────────────────────────────────────────
FROM base AS runtime

ARG BUILD_VERSION=0.0.1
ARG ENVIRONMENT=development

WORKDIR /app

# Only the static build output is shipped — the runtime image carries no
# node_modules, lockfiles, or build tooling.
COPY --from=builder --chown=1000:1000 /app/app/marketing/dist ./dist

# Bun static-file server (serves dist/ with correct MIME types) and the
# entrypoint. Exec bit is set explicitly so the image is robust to checkout
# provenance.
COPY --chown=1000:1000 app/marketing/server.mjs ./server.mjs
COPY --chmod=0755 app/marketing/entrypoint.sh /usr/local/bin/entrypoint.sh

# OpenTelemetry defaults (entrypoint.sh re-exports these from the runtime
# environment, so they remain overridable per environment).
ENV NODE_ENV=production \
    PORT=8080 \
    OTEL_SERVICE_NAME=marketing \
    OTEL_SERVICE_VERSION=${BUILD_VERSION} \
    OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317 \
    OTEL_TRACES_EXPORTER=otlp \
    OTEL_METRICS_EXPORTER=otlp \
    OTEL_RESOURCE_ATTRIBUTES=service.name=marketing,deployment.environment=${ENVIRONMENT}

LABEL org.opencontainers.image.title="Abugida Marketing"
LABEL org.opencontainers.image.description="Astro marketing site built on the shared Abugida Bun/pnpm base"
LABEL org.opencontainers.image.base.name="oven/bun:1.3.14-alpine"
LABEL org.opencontainers.image.version="${BUILD_VERSION}"
LABEL org.opencontainers.image.vendor="Abugida"
LABEL org.opencontainers.image.licenses="MIT"
LABEL org.opencontainers.image.source="https://github.com/mortymith/Abugida-Backend"

EXPOSE 8080

# Re-assert non-root execution (guards against future root-level edits).
USER 1000:1000

# curl ships in the base stage; the /health contract is documented in
# app/marketing/entrypoint.sh.
HEALTHCHECK --interval=15s --timeout=5s --retries=3 --start-period=10s \
    CMD ["/bin/sh", "-c", "curl -sf http://localhost:8080/health || exit 1"]

# The oven/bun entrypoint inherited via the base stage is replaced with the
# entrypoint, which `exec`s the command below as PID 1.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["bun", "server.mjs"]
