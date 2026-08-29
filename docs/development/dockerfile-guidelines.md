# Dockerfile Guidelines

## Multi-Stage Pattern

Every application Dockerfile must use at least two stages: a **builder** and a **runtime** stage. The builder installs all dependencies and compiles or bundles source code. The runtime stage copies only the artifacts needed to run.

```dockerfile
FROM oven/bun:1.3.14-alpine AS builder
WORKDIR /build
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY <workspace>/ .
RUN bun run build

FROM oven/bun:1.3.14-alpine AS runtime
WORKDIR /app
COPY --from=builder --chown=appuser:appuser /build/dist ./dist
```

Reference implementations:

- `app/api/Dockerfile` — Bun API pattern: shared non-root base toolchain, workspace-aware `pnpm install` against the frozen lockfile, single-file `bun build` bundle, exec-form `HEALTHCHECK`
- `app/dashboard/Dockerfile` and `app/marketing/Dockerfile` — same pattern for the TanStack Start dashboard and Astro marketing site
- `docker/dockerfiles/redis/Dockerfile` — config-only wrapper over the upstream Redis image (the remaining infra-image style)

## Mandatory Rules

| Rule                 | Details                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Alpine base**      | All images must use Alpine variants (`*-alpine`) for minimal attack surface                                              |
| **Pinned versions**  | Never use `:latest`. Pin to exact version (e.g., `oven/bun:1.2.1-alpine`, `redis:7.4-alpine`)                            |
| **Non-root user**    | Create a dedicated user (`appuser`) and `USER appuser` before `EXPOSE`/`ENTRYPOINT`                                      |
| **HEALTHCHECK**      | Every service must include a `HEALTHCHECK` instruction with `--interval`, `--timeout`, `--retries`, and `--start-period` |
| **Minimal packages** | Only install runtime-essential packages via `apk add --no-cache`. No build tools in the runtime stage                    |
| **.dockerignore**    | Always use `.dockerignore` to exclude `node_modules`, `.git`, `.env*`, `data/`, and `*.md`                               |

## COPY Ownership

Use `COPY --chown=user:group` when copying files into directories owned by the non-root user. If the build stage runs as root (default) and the runtime stage drops to `appuser`, ensure copied files are readable:

```dockerfile
COPY --from=builder --chown=appuser:appuser /build/dist ./dist
```

## HEALTHCHECK

Health checks must hit an application endpoint or a known-good probe:

- **API services:** `curl -sf http://localhost:3000/health`
- **Redis:** `redis-cli -u redis://... ping`
- **Postgres:** `pg_isready -U app`

Set `--start-period` long enough for dependency services to become available (30s minimum for apps, 15s for infrastructure).

## Runtime Stage

Install only what the process needs at runtime. For the API, this means `bash`, `curl`, `jq`, and `postgresql17-client` (for entrypoint health checks). For infrastructure images like Redis, add `bash`, `jq`, and `netcat-openbsd` only if the entrypoint script requires them.

## Dockerfile Location

Application Dockerfiles are **co-located with their app**: `app/<service>/Dockerfile` (currently `app/api`, `app/dashboard`, `app/marketing`). Compose builds them with the **repository root as the build context** so workspace manifests, lockfiles, and shared sources resolve via repo-relative paths:

```yaml
build:
  context: .
  dockerfile: app/api/Dockerfile
```

Infrastructure images that need custom entrypoints or config wrapping (Caddy, Redis, postgres-replica) keep their Dockerfiles under `docker/dockerfiles/<service>/Dockerfile`.
