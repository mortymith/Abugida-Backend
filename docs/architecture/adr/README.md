# Architecture Decision Records (ADR)

This directory contains all Architecture Decision Records for the project. ADRs capture important design decisions, their context, and their consequences.

## ADR Index

| ADR     | Title                                          | Status         | Summary                                                                                                                                                          |
| ------- | ---------------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADR-001 | Bun runtime for API and Website                | Accepted       | Replaced Node.js with Bun 1.2.1-alpine for smaller images and faster startup                                                                                     |
| ADR-002 | Alpine/distroless base images only             | Accepted       | All services use minimal base images; zero `:latest` tags; Trivy scanning enforced                                                                               |
| ADR-003 | Compose overlay pattern                        | Accepted       | Originally base + dev/prod overlays; now 12-file modular Compose structure in `docker/compose/` directory                                                        |
| ADR-004 | Three-layer network isolation                  | Accepted       | Edge, backend, and infrastructure networks with defense in depth                                                                                                 |
| ADR-005 | IPAM-managed subnets                           | Accepted       | Fixed subnets per network to prevent address drift across compose restarts                                                                                       |
| ADR-006 | Secret layering (dev .env, staging/prod Vault) | Accepted       | Dev uses `.env` variables directly; staging/prod use HashiCorp Vault for dynamic credentials                                                                     |
| ADR-007 | Caddy as reverse proxy                         | Accepted       | Chosen over Nginx for automatic HTTPS and simpler configuration                                                                                                  |
| ADR-008 | Blue-green deployment with Caddy upstreams     | Accepted       | Weighted upstreams with DEPLOY_VERSION env var for zero-downtime deploys                                                                                         |
| ADR-009 | Keepalived VRRP for edge HA                    | Accepted       | Floating VIP with health checks; <5s failover between Caddy instances                                                                                            |
| ADR-010 | Caddy active-standby (no load balancing)       | Accepted       | Single active proxy to avoid sticky session complexity                                                                                                           |
| ADR-011 | Keepalived health checks for both Caddys       | Accepted       | Both active and standby are monitored; VIP moves if active is unhealthy                                                                                          |
| ADR-012 | MinIO for S3-compatible object storage         | Accepted       | Self-hosted alternative to AWS S3 with versioning and CRR                                                                                                        |
| ADR-013 | Website direct database reads                  | **Superseded** | Was: Frontend reads from PostgreSQL primary directly (bypasses PgBouncer for read queries). Superseded: all application services connect via PgBouncer (ADR-019) |
| ADR-014 | Redis Sentinel for HA caching                  | Accepted       | 1 primary + 2 replicas + 3 sentinels with quorum=2                                                                                                               |
| ADR-015 | MinIO bucket policies (readonly, upload, app)  | Accepted       | Three policy tiers for access control                                                                                                                            |
| ADR-016 | MinIO versioning and CRR to minio-backup       | Accepted       | Cross-region replication in prod for disaster recovery                                                                                                           |
| ADR-017 | Docker Secrets for Development                 | **Deprecated** | Was: native Docker secrets for dev. Superseded by ADR-006: dev now uses `.env` variables                                                                         |
| ADR-018 | SigNoz alerting via Telegram                   | Accepted       | Alertmanager routes critical alerts to Telegram channel                                                                                                          |
| ADR-019 | PgBouncer connection pooling                   | Accepted       | Transaction-mode pooling with scram-sha-256 auth                                                                                                                 |
| ADR-020 | Cloudflare Tunnel for SigNoz access            | Accepted       | Outbound-only tunnel; SigNoz UI reachable only via Cloudflare                                                                                                    |
| ADR-021 | ClickHouse as metrics/trace backend            | Accepted       | Columnar storage for SigNoz observability data                                                                                                                   |
| ADR-022 | Redis ACL with three users                     | Accepted       | app (read/write), admin (full), readonly (monitoring)                                                                                                            |
| ADR-023 | Just v1.40.0 as central CLI                    | Accepted       | Single entry point for all infra operations                                                                                                                      |
| ADR-024 | Modular Compose file structure                 | Accepted       | 12 purpose-split YAML files in `docker/compose/` with profile-based environment overrides                                                                        |
| ADR-025 | PowerSync Postgres storage + split roles       | Accepted       | PostgreSQL bucket storage (no MongoDB), sync/api role split, Sync Streams, Better Auth JWKS client auth                                                          |

## ADR Template

```markdown
# ADR-NNN: [Title]

## Status

[Proposed | Accepted | Deprecated | Superseded by ADR-NNN]

## Context

What is the issue that we're seeing that is motivating this decision or change?

## Decision

What is the change that we're proposing and/or doing?

## Consequences

What becomes easier or more difficult to do because of this change?

### Positive

- ...

### Negative

- ...

### Risks

- ...
```
