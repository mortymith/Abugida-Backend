# Caddy 2.8

> **Automatic TLS termination and HTTP reverse proxy.** Production deploys two identical instances in active-standby configuration managed by Keepalived and a floating virtual IP.

---

## Overview

| Property           | Value                                       |
| ------------------ | ------------------------------------------- |
| **Base Image**     | `caddy:2.8.4-alpine`                        |
| **Container Port** | 80 (HTTP), 443 (HTTPS)                      |
| **Admin API**      | `localhost:2019`                            |
| **Networks**       | `edge`, `backend`                           |
| **Environments**   | Production (HA pair), Dev (single instance) |

A custom Dockerfile extends the official image with operational utilities:

```dockerfile
FROM caddy:2.8.4-alpine
RUN apk add --no-cache bash curl jq
```

---

## Active-Standby HA Architecture

| Instance        | Role                                       | Binds VIP?           | Failover Time |
| --------------- | ------------------------------------------ | -------------------- | ------------- |
| `caddy-active`  | Serves all inbound traffic                 | Yes (via Keepalived) | —             |
| `caddy-standby` | Idle, identical config, ready to take over | No (until failover)  | < 5 seconds   |

Both instances mount the **same** Caddyfile and snippet directory, guaranteeing configuration parity. When the active instance fails its health check, Keepalived migrates the VIP to the standby, which begins serving traffic immediately.

---

## Caddyfile Structure

The Caddyfile uses an import-based modular structure. Three reusable snippets encapsulate cross-cutting concerns:

| Snippet         | File                          | Purpose                                                                                                   |
| --------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| `security`      | `snippets/security.conf`      | HSTS, X-Frame-Options (DENY), X-Content-Type-Options (nosniff), Content-Security-Policy                   |
| `rate-limiting` | `snippets/rate-limiting.conf` | Per-IP: 100 req/s with burst allowance of 200                                                             |
| `upstreams`     | `snippets/upstreams.conf`     | Upstream definitions for API (`api:3000`), Dashboard (`dashboard:8080`), and Marketing (`marketing:8080`) |

```caddyfile
import snippets/security
import snippets/rate-limiting
import snippets/upstreams

handle /api/* {
    reverse_proxy api:3000 {
        lb_policy least_conn
    }
}

handle /* {
    reverse_proxy dashboard:8080 {
        lb_policy least_conn
    }
}
```

The Marketing site is routed to `marketing:8080` by hostname (`DOMAIN_MARKETING`) rather than by path.

---

## Load Balancing

Caddy reverse-proxies to the application services (API, Dashboard, Marketing) using the `least_conn` policy. When multiple replicas are running (3 per service in production), Docker's embedded DNS distributes requests across all healthy container instances.

Blue-green and canary traffic shifting is handled by `scripts/deploy/dynamic-upstream.sh`, which modifies upstream weights at runtime via Caddy's JSON admin API (`localhost:2019`). This enables **zero-downtime deployment transitions** without restarting Caddy.

---

## TLS Strategy

| Environment | Method           | Certificate Source                                    |
| ----------- | ---------------- | ----------------------------------------------------- |
| Dev         | `*.localhost`    | Caddy's built-in auto-HTTPS with self-signed local CA |
| Prod        | DNS-01 challenge | Let's Encrypt via Cloudflare API token                |

Production TLS certificates are automatically provisioned and renewed by Caddy's embedded ACME client using the Cloudflare DNS challenge. This avoids port 80 validation requirements and supports wildcard certificates.

---

## Capabilities & Network Placement

```yaml
cap_add:
  - NET_ADMIN
networks:
  - edge
  - backend
```

| Setting         | Purpose                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **`NET_ADMIN`** | Required for IP-level socket operations associated with the active-standby VIP setup. The VIP itself is managed by Keepalived. |
| **`edge`**      | Receives inbound traffic from the VIP.                                                                                         |
| **`backend`**   | Proxies requests to application services (API, Dashboard, Marketing).                                                          |

---

## Health Check

```yaml
healthcheck:
  test: ['CMD', 'curl', '-sf', 'http://localhost:80/health']
  interval: 10s
  timeout: 5s
  retries: 3
  start_period: 15s
```

Probed by both Docker (for dependency resolution) and Keepalived (for VIP failover decisions).

---

## Operational Notes

- **Certificate persistence** — Auto-HTTPS certificates are stored inside the container's writable layer. For persistence across container recreations, volume-mount the certificate cache.
- **Admin API security** — Bound to `localhost` only; not reachable from other containers or the host.
- **Rate limiting state** — Per-instance. During failover, the standby starts with a fresh rate counter.
- **Traffic shifting** — Use `scripts/deploy/dynamic-upstream.sh` for blue-green and canary deployments.
