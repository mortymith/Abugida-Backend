# Installation

## Step 1 — Clone the Repository

```bash
git clone <repository-url> ~/my-project
cd ~/my-project
```

## Step 2 — Install Required Tools

Install the following tools manually (see each project's official installation docs):

| Tool                       | Version | Purpose            |
| -------------------------- | ------- | ------------------ |
| Docker CE + Compose plugin | 27.x    | Container runtime  |
| Just                       | 1.40.0  | Task runner        |
| Bun                        | 1.2.x   | JavaScript runtime |
| Trivy                      | 0.58.x  | Security scanner   |

Verify installation:

```bash
docker --version    # Docker CE 27.x
just --version     # just 1.40.0
bun --version      # Bun 1.2.x
trivy --version    # Trivy 0.58.x
```

## Step 3 — Configure Environment

```bash
cp .env.example .env
```

Edit `.env` to set database passwords, API keys, and other environment-specific values. Development secrets are stored as environment variables in `.env` (gitignored). Staging and production use HashiCorp Vault instead. Defaults are suitable for local development but **must be changed before production deployment**.

## Step 4 — Start the Dev Environment

```bash
just dev
```

This command assembles and starts the modular Compose files for development:

1. Reads `docker/compose/networks.yml`, `docker/compose/volumes.yml`, `docker/compose/base.yml`, `docker/compose/profiles/dev.override.yml`
2. Creates Docker networks (`edge`, `backend`, `infrastructure`) with IPAM subnets
3. Builds custom images (Redis) from `docker/dockerfiles/`
4. Starts 5 infrastructure services: PostgreSQL, PgBouncer, Redis, MinIO, PowerSync
5. Publishes ports for local debugging

## Step 5 — Verify the Stack

```bash
just health
```

Expected output: a table showing all 5 dev services reporting `healthy`. If any service reports `unhealthy` or `starting`, check logs with:

```bash
just logs <service-name>
```

## Step 6 — Start Staging (Optional)

For a fuller environment with application services and observability:

```bash
just staging
```

This adds API, Dashboard, Marketing, and the observability stack — ClickHouse, OTEL Collector, SigNoz (20 services total).

## Troubleshooting

- **Port conflicts**: See [Prerequisites](prerequisites.md) for the full port list. Stop conflicting services or adjust ports in `.env`.
- **Permission denied on Docker**: Add your user to the `docker` group — `sudo usermod -aG docker $USER`, then log out and back in.
- **Insufficient memory**: Reduce ClickHouse memory limits in `docker/compose/profiles/staging.override.yml` or increase available RAM.

## Next Steps

Proceed to [Quick Start](quick-start.md) for a guided walkthrough of the running stack.
