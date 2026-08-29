# ADR-004: Three-Layer Network Isolation

## Status

Accepted

## Context

The infrastructure runs 15+ services spanning reverse proxies, application servers, databases, caches, object storage, secrets management, and observability. Running all services on a single Docker bridge network provides no defense in depth — a compromised application container could directly access PostgreSQL, Redis, or Vault with no network boundary.

Previous iterations used a two-tier model (frontend + backend) which provided insufficient isolation for observability and secrets services that should never be reachable from the edge layer.

We need a network architecture that:

1. Enforces defense in depth at the network level.
2. Prevents data-layer services from reaching the internet (no exfiltration path).
3. Prevents edge services from reaching infrastructure directly.
4. Is enforceable by Docker's network driver (not just iptables rules that can be misconfigured).
5. Provides consistent, predictable IP addressing across container restarts.

## Decision

Implement three isolated Docker bridge networks, each mapped to a distinct architectural tier:

| Network          | Subnet        | Internal | Purpose                                                        |
| ---------------- | ------------- | -------- | -------------------------------------------------------------- |
| `edge`           | 172.20.0.0/24 | no       | DMZ — Caddy reverse proxy, Keepalived VIP                      |
| `backend`        | 172.21.0.0/24 | no       | Application services — API, Dashboard, Marketing               |
| `infrastructure` | 172.22.0.0/24 | **yes**  | Data layer — databases, cache, storage, secrets, observability |

Key design choices:

- **`internal: true`** on the infrastructure network. This is enforced by Docker's libnetwork driver — containers on this network have no default gateway and no NAT to external hosts. This is a structural guarantee, not a configurable firewall rule.
- **IPAM-managed subnets** with explicit `subnet` and `gateway` fields ensure addresses remain stable across `docker compose down && up` cycles.
- **Cross-network membership** for services that bridge tiers: Caddy (edge + backend) and API/Dashboard (backend + infrastructure) each have two network interfaces; Marketing attaches to the backend network only.
- **`COMPOSE_PROJECT_NAME`** prefixing prevents network name collisions when dev and prod environments run on the same host.

## Consequences

### Positive

- **Defense in depth**: Even if an application container is compromised, the attacker cannot directly reach infrastructure services without being on the infrastructure network.
- **No data exfiltration**: `internal: true` means compromised databases or caches cannot initiate outbound connections. This is a hard Docker-level restriction.
- **Clear security boundary**: The network topology mirrors the trust hierarchy — untrusted (edge) → semi-trusted (backend) → trusted (infrastructure).
- **Predictable addressing**: IPAM subnets mean operators can reference services by their expected IPs for debugging and monitoring.

### Negative

- **Cross-network complexity**: Services bridging tiers (Caddy, API, Dashboard) require two network interfaces in their Compose definitions. This must be carefully maintained.
- **No single default network**: Developers must explicitly assign each service to the correct network(s) — there is no "default" fallback.
- **Service discovery by name only works within a network**: `api` on the backend network cannot be resolved from the edge network. This is intentional but requires awareness.

### Risks

- **Misconfigured network membership** is the primary risk. A service accidentally placed on the wrong network could bypass isolation. The service-to-network membership matrix in `networking.md` mitigates this.
- **Docker bridge networks do not support network policies** like Kubernetes. Security relies on `internal: true` and host-level iptables rules for additional enforcement.
