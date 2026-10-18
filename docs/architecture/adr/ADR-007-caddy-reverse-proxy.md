# ADR-007: Caddy as reverse proxy

## Status

Accepted

## Context

The platform needs an ingress reverse proxy that terminates TLS, routes by hostname to the API, Dashboard, and Marketing services, and can shift traffic between application versions without downtime. The proxy also has to front a high-availability pair (ADR-010, ADR-011), which means its runtime configuration must be changeable without a restart.

The main options were:

- **Nginx**: Ubiquitous, extremely performant, and flexible — but HTTPS certificate provisioning/renewal requires an external tool (certbot) or careful ACME plumbing, upstream weights are changed by rewriting files and reloading, and the configuration DSL is less approachable for a small platform team.
- **Traefik**: Strong dynamic configuration and Docker integration, but a more complex mental model (providers, routers, middlewares) and a heavier configuration surface for a Compose-only deployment.
- **Caddy**: Automatic HTTPS built in, a compact configuration format, and a JSON admin API that supports runtime changes (including load-balancer weights) with no restart.
- **HAProxy**: Excellent load balancing, but no built-in ACME and a lower-level configuration model.

## Decision

Adopt **Caddy 2.8** (`caddy:2.8.4-alpine`, extended with a small Dockerfile adding `bash`, `curl`, `jq`) as the reverse proxy.

- **Automatic TLS**: in production Caddy obtains and renews certificates via the ACME **DNS-01 challenge** using the Cloudflare API token (supports wildcards, no port-80 validation). In development it uses its internal CA for `*.localhost`.
- **Modular Caddyfile**: a main `Caddyfile` composed from three reusable snippets — `security.conf` (HSTS, CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, referrer/permissions policy), `rate-limiting.conf` (per-IP limits; stricter zone for the API), and `upstreams.conf` (upstream definitions for API, Dashboard, Marketing).
- **Host-based routing**: separate site blocks keyed by `{$DOMAIN_API}`, `{$DOMAIN_DASHBOARD}`, `{$DOMAIN_MARKETING}` (plus SigNoz and the dev-only MinIO console), each proxying with `lb_policy least_conn`.
- **Runtime reconfiguration**: the admin API is bound to `127.0.0.1:2019` and used by `scripts/deploy/dynamic-upstream.sh` to adjust upstream weights for blue-green/canary releases (ADR-008).
- **Network placement**: Caddy is cross-attached to `edge` (ingress) and `backend` (upstreams), never to `infrastructure`.

## Consequences

### Positive

- **Simpler operations**: one process handles TLS issuance, renewal, routing, headers, and rate limiting without sidecars.
- **Zero-downtime deploys**: the admin API lets traffic shift between versions without a reload or restart.
- **Readable config**: the snippet-based Caddyfile is short and self-documenting.
- **Automatic HTTPS**: fewer moving parts than an Nginx + certbot pairing.

### Negative

- **Fewer modules than Nginx**: edge cases that Nginx's module ecosystem covers may need a different approach.
- **Admin API is powerful**: it can rewrite the entire running config; it is therefore restricted to loopback.
- **Per-instance rate-limit state**: rate counters live in each Caddy process (see ADR-010).

### Risks

- **ACME dependency**: production certificates depend on Cloudflare's DNS API and Let's Encrypt availability. A token rotation or outage affects issuance/renewal; certificate caching and monitoring mitigate this.
- **Config reload errors**: a malformed Caddyfile or admin-API payload can take the proxy down. Changes go through review and `just validate-compose` / config checks before deploy.

## References

- Caddy service: `docs/services/caddy.md`
- Customizing Caddy: `docs/configuration/customizing-caddy.md`
- Config files: `docker/config/caddy/`
- Blue-green upstreams: ADR-008 · Active-standby HA: ADR-010 · Keepalived: ADR-011
