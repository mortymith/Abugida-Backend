# ADR-005: IPAM-managed subnets

## Status

Accepted

## Context

Docker's default bridge networks are assigned addresses from an internal pool chosen at creation time. If the network is removed and recreated — which `docker compose down && up` does routinely — the assigned subnet can change. That instability has real consequences:

- Host firewall rules that reference a service subnet (e.g. "allow 5432 only from the backend network") break when the subnet moves.
- Debugging is harder when the address of a service is not predictable between restarts.
- Running more than one environment on the same host risks two networks colliding for the same default range.

A fixed addressing scheme is also easier to reason about in documentation and diagrams.

## Decision

Define every network with explicit **IPAM** configuration — a fixed `subnet` and `gateway` — so addresses are stable across restarts:

| Network          | Subnet        | Gateway    | Internal | Purpose                                              |
| ---------------- | ------------- | ---------- | -------- | ---------------------------------------------------- |
| `edge`           | 172.20.0.0/24 | 172.20.0.1 | no       | DMZ — Caddy, Keepalived VIP                          |
| `backend`        | 172.21.0.0/24 | 172.21.0.1 | no       | Application services — API, Dashboard, Marketing     |
| `infrastructure` | 172.22.0.0/24 | none       | **yes**  | Data layer — databases, cache, storage, secrets, obs |

Additional decisions:

- **VIP in-band**: the Keepalived floating VIP (prod) is `172.20.0.100/24`, inside the edge subnet, so it is predictable and firewall rules can target it.
- **`COMPOSE_PROJECT_NAME` prefix**: network names are prefixed (`infra-dev_*`, `infra-prod_*`) so multiple environments can coexist on one host without subnet collisions.
- **No gateway on infrastructure**: because it is `internal: true`, that network has no gateway at all (see ADR-004).

The subnets are mirrored by host `iptables` rules in `docs/architecture/networking.md` that permit data-layer ports only from `172.21.0.0/24` (backend) or `172.22.0.0/24` (infrastructure).

## Consequences

### Positive

- **Stable addressing**: subnets and gateways survive restart cycles, so firewall rules and docs stay valid.
- **Deterministic debugging**: operators can reference expected service IPs.
- **Multi-environment on one host**: project-name prefixing plus fixed ranges avoid collisions.

### Negative

- **Manual allocation**: someone must choose and maintain the ranges and avoid clashing with the host's own networks or VPN ranges.
- **Limited headroom**: `/24` per tier is ample for the current service count but not unlimited; adding many replicas needs a review.

### Risks

- **Host/LAN conflict**: `172.20.0.0/24`–`172.22.0.0/24` can overlap a corporate or VPN range. If a host already uses these, the ranges must be changed in one place (`networks.yml`) and in the firewall rules.
- **Drift between definition and rules**: the subnet appears both in `networks.yml` and in prose/iptables. The service-to-network matrix in `networking.md` is the cross-reference that keeps them aligned.

## References

- Network architecture: `docs/architecture/networking.md`
- Three-layer isolation: ADR-004
- Network module: `docker/compose/networks.yml`
