# ADR-020: Cloudflare Tunnel for SigNoz UI

## Status

Accepted

## Context

The SigNoz observability UI must be accessible to team members outside the local network, but publishing its port directly on the host would expose infrastructure services to the internet and require manual TLS certificate management.

## Decision

Deploy `cloudflared` as a sidecar container in the monitoring compose file, establishing an outbound-only tunnel to Cloudflare's edge. An ingress rule restricts the tunnel to only forward traffic to the SigNoz frontend service—no other container ports are reachable through the tunnel. No ports are published on the host for SigNoz; all external access flows through Cloudflare's zero-trust network.

## Consequences

**Positive:** The host machine has no open ports for the monitoring stack, removing a broad attack surface. Access is governed by Cloudflare Access policies (email, SSO, IP allowlists), providing zero-trust authentication without a separate VPN. TLS termination is handled entirely by Cloudflare, eliminating certificate management for this service.

Negative:** The tunnel depends on a Cloudflare account and a valid tunnel token. If Cloudflare's edge is unreachable, the SigNoz UI becomes inaccessible even though the stack itself is healthy. Debugging connectivity issues requires understanding both Docker networking and Cloudflare tunnel configuration.

**Risks:** The tunnel token itself is a sensitive credential—if leaked, an attacker could route traffic through the tunnel. The single-point dependency on Cloudflare's availability may be unacceptable for teams requiring air-gapped or fully self-hosted observability.
