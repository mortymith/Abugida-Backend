# ADR-024: Modular Compose file structure

## Status

Accepted

## Context

The original Compose configuration was a set of monolithic files: a root `docker-compose.yml` plus `docker-compose.dev.yml` and `docker-compose.prod.yml`. Every service was defined in the shared file and re-stated or overridden in each environment file. This produced three symptoms:

1. **Duplication**: the same service block appeared in multiple files, and edits had to be mirrored by hand.
2. **Drift**: an override that was meant to mirror a base change silently fell out of step.
3. **Poor navigability**: finding one service meant scrolling a very large file, and understanding which services ran in which environment required diffing whole files.

The platform also has clearly separable layers — core data stores, application services, observability, edge ingress, scaling, and security — that map onto distinct environments. A structure that followed those seams would let each environment assemble exactly the layers it needs.

## Decision

Replace the monolithic files with a **modular, purpose-split Compose structure** under `docker/compose/`, assembled per environment by Docker Compose's multi-file merge.

### Modules

| File                | Purpose                                                           |
| ------------------- | ----------------------------------------------------------------- |
| `networks.yml`      | Network definitions (edge, backend, infrastructure) with IPAM     |
| `volumes.yml`       | Shared named volume declarations                                  |
| `base.yml`          | Core infrastructure: Postgres, PgBouncer, Redis, MinIO, PowerSync |
| `app.yml`           | Application services: API, Dashboard, Marketing                   |
| `observability.yml` | ClickHouse, OTEL Collector, SigNoz frontend                       |
| `edge.yml`          | Caddy active/standby, Cloudflared                                 |
| `scaling.yml`       | Redis/PG replicas, Redis Sentinels                                |
| `security.yml`      | Vault, MinIO backup (staging + prod)                              |

### Profile overrides

| File                            | Adds                                                            |
| ------------------------------- | --------------------------------------------------------------- |
| `profiles/dev.override.yml`     | Published ports, low resources, infra only                      |
| `profiles/staging.override.yml` | Published ports, moderate resources, app + observability labels |
| `profiles/prod.override.yml`    | No published ports, high resources, replicas                    |

### Tier assembly

Docker Compose merges files left-to-right, so each tier is a subset of modules plus its override. The mapping is defined **once** in `scripts/lib/compose.sh` and reached through `dc <tier>`:

| Tier        | Modules                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------- |
| **Dev**     | networks + volumes + base + dev.override                                                    |
| **Staging** | networks + volumes + base + app + observability + security + staging.override               |
| **Prod**    | networks + volumes + base + app + observability + edge + scaling + security + prod.override |

Base modules define services **without** ports or resource limits; overrides add those. The root-level monolithic files are removed and are not a supported configuration.

This realises, at the file-layout level, the overlay pattern recorded in ADR-003.

## Consequences

### Positive

- **One definition per service**: a change lives in a single module.
- **Layered environments**: a tier assembles exactly the layers it needs, and the difference between environments is explicit.
- **Navigable**: each file has one concern, so operators can find a service quickly.
- **Single source of truth for the tier mapping**: `scripts/lib/compose.sh` owns the file lists, so the justfile, setup scripts, and validation agree by construction.

### Negative

- **Merge semantics must be understood**: some keys concatenate (`ports`) and others replaced; reading the effective config needs `docker compose config`.
- **File ordering is part of the contract**: a module placed later changes the result.
- **More files to touch**: adding a service can mean editing a module _and_ the relevant override(s).

### Risks

- **Module set/override drift**: an override that forgets a key leaves the base default in force. `just validate-compose` parses each tier's merged configuration with placeholder secrets to catch structural mistakes.
- **Tier-list duplication**: if the file lists were repeated in multiple places they would drift; this is why the mapping lives only in `scripts/lib/compose.sh` (ADR-009, ADR-021).
- **Layer leakage**: a service placed in the wrong module runs in the wrong environments. The service-to-network matrix and `docs/services/_index.md` are the references.

## References

- Deployment model: `docs/architecture/deployment-model.md`
- Compose overlays guide: `docs/configuration/compose-overlays.md`
- Overlay pattern: ADR-003 · Tier helper: `scripts/lib/compose.sh`
- Network/IPAM: ADR-004, ADR-005
