# Infrastructure Documentation

## Quick Start

New here? Start with [Onboarding](onboarding/quick-start.md) — you'll be running in 5 minutes.

## Documentation Map

| Section           | What it answers             | Link                             |
| ----------------- | --------------------------- | -------------------------------- |
| **Onboarding**    | "How do I start?"           | [onboarding/](onboarding/)       |
| **Architecture**  | "Why is it built this way?" | [architecture/](architecture/)   |
| **Services**      | "What does each piece do?"  | [services/](services/)           |
| **Configuration** | "How do I change things?"   | [configuration/](configuration/) |
| **Runbooks**      | "What do I do when...?"     | [runbooks/](runbooks/)           |
| **Development**   | "How do I contribute?"      | [development/](development/)     |

## Onboarding

| Document                                             | Description                                        |
| ---------------------------------------------------- | -------------------------------------------------- |
| [Prerequisites](onboarding/prerequisites.md)         | System requirements, tool versions, port reference |
| [Installation](onboarding/installation.md)           | Step-by-step install guide                         |
| [Quick Start](onboarding/quick-start.md)             | 5-minute path to running                           |
| [Project Structure](onboarding/project-structure.md) | Directory layout explanation                       |

## Architecture

| Document                                             | Description                                 |
| ---------------------------------------------------- | ------------------------------------------- |
| [Overview](architecture/overview.md)                 | System diagram, service catalog, data flow  |
| [Networking](architecture/networking.md)             | 3-layer network, subnets, firewall rules    |
| [Security Model](architecture/security-model.md)     | Trust boundaries, secret flow, threat model |
| [Deployment Model](architecture/deployment-model.md) | Blue-green, canary, CI/CD pipelines         |
| [ADR Index](architecture/adr/README.md)              | Architecture Decision Records               |

## Services

| Document                                     | Description                                 |
| -------------------------------------------- | ------------------------------------------- |
| [Dependency Map](services/_index.md)         | Startup order, service dependencies         |
| [PostgreSQL](services/postgres.md)           | Primary + replicas, PgBouncer, WAL archival |
| [Redis](services/redis.md)                   | Sentinel cluster, ACL, persistence          |
| [MinIO](services/minio.md)                   | S3-compatible storage, CRR, policies        |
| [ClickHouse](services/clickhouse.md)         | Observability storage, TTL tables           |
| [Vault](services/vault.md)                   | Dynamic secrets, PKI (Staging + Prod)       |
| [Caddy](services/caddy.md)                   | Reverse proxy, TLS, blue-green upstreams    |
| [Cloudflared](services/cloudflared.md)       | Cloudflare Tunnel (prod only)               |
| [Keepalived](services/keepalived.md)         | Floating VIP, VRRP failover                 |
| [OTEL Collector](services/otel-collector.md) | Telemetry pipelines (traces/metrics/logs)   |
| [SigNoz](services/signoz.md)                 | Dashboards, alerting, retention             |
| [API](services/api.md)                       | Bun runtime, health endpoints               |
| [Dashboard](services/dashboard.md)           | TanStack Start app, PgBouncer-backed        |
| [Marketing](services/marketing.md)           | Astro landing page, static caching          |

## Configuration

| Document                                                                  | Description                        |
| ------------------------------------------------------------------------- | ---------------------------------- |
| [Environment Variables](configuration/environment-variables.md)           | Master .env reference              |
| [Compose Overlays](configuration/compose-overlays.md)                     | How base/dev/prod layering works   |
| [Customizing Caddy](configuration/customizing-caddy.md)                   | Caddyfile, snippets, adding vhosts |
| [Customizing Redis ACL](configuration/customizing-redis-acl.md)           | users.acl, user management         |
| [Customizing Vault Policies](configuration/customizing-vault-policies.md) | HCL policies, loading new policies |
| [Adding a Service](configuration/adding-a-service.md)                     | 10-step template for new services  |

## Runbooks

See the [Runbooks README](runbooks/README.md) for a decision tree that routes you to the right procedure.

| Category                                         | Use when                 | Files      |
| ------------------------------------------------ | ------------------------ | ---------- |
| [Incident Response](runbooks/incident-response/) | Something is broken      | 8 runbooks |
| [Security Events](runbooks/security-events/)     | Something suspicious     | 4 runbooks |
| [Data Operations](runbooks/data-operations/)     | Backup, restore, migrate | 7 runbooks |
| [Deploy](runbooks/deploy/)                       | Shipping code            | 5 runbooks |
| [Maintenance](runbooks/maintenance/)             | Planned work             | 7 runbooks |
| [Reference](runbooks/reference/)                 | Quick lookups            | 4 runbooks |

## Development

| Document                                                      | Description                              |
| ------------------------------------------------------------- | ---------------------------------------- |
| [Dev Workflow](development/dev-workflow.md)                   | Branching, PRs, CI/CD                    |
| [Writing Just Recipes](development/writing-just-recipes.md)   | How to extend the justfile               |
| [Dockerfile Guidelines](development/dockerfile-guidelines.md) | Multi-stage, Alpine, non-root patterns   |
| [Testing](development/testing.md)                             | Integration, security, performance tests |
| [Troubleshooting](development/troubleshooting.md)             | Common issues and fixes                  |
