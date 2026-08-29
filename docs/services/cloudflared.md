# Cloudflared

> **Outbound tunnel to Cloudflare's edge network** — exposes internal services without opening any inbound ports on the host. The sole ingress path for production access to SigNoz.

---

## Overview

| Property         | Value                                |
| ---------------- | ------------------------------------ |
| **Image**        | `cloudflare/cloudflared:2024.12.2`   |
| **Mode**         | Outbound tunnel (no published ports) |
| **Transport**    | QUIC or HTTP/2                       |
| **Network**      | `infrastructure`                     |
| **Environments** | Production only                      |

---

## Why Cloudflare Tunnel?

Traditional reverse proxy setups require opening inbound ports (80, 443) on the host firewall, creating an attack surface that must be defended. Cloudflared inverts this model: the tunnel initiates an **outbound** connection to Cloudflare's edge, meaning no inbound ports are required on the host. This architecture is inherently more secure and simplifies firewall configuration.

---

## Configuration

The service is configured via a bind-mounted `config.yml` with ingress rules routing Cloudflare-hosted domains to internal containers:

```yaml
ingress:
  - hostname: ${DOMAIN_SIGNOZ:-signoz.localhost}
    service: http://signoz-frontend:8080
    originRequest:
      noTLSVerify: false
  - service: http_status:404
```

| Rule          | Behaviour                                                         |
| ------------- | ----------------------------------------------------------------- |
| SigNoz domain | Routes to SigNoz frontend container with TLS verification enabled |
| Catch-all     | Returns HTTP 404 for any unmatched hostname                       |

Authentication uses the `TUNNEL_TOKEN` environment variable:

```yaml
environment:
  TUNNEL_TOKEN: ${CLOUDFLARE_TUNNEL_TOKEN:-}
```

---

## Network Security

No ports are published to the host. Cloudflared runs on the `infrastructure` network and initiates an outbound connection to Cloudflare's edge:

- **No firewall rules** needed for inbound traffic.
- **Not scannable** from the internet.
- **TLS termination** occurs at the Cloudflare edge before traffic reaches the tunnel.
- Traffic between Cloudflare's edge and the origin is also encrypted using Cloudflare's own TLS certificate.

---

## Reconnection Behaviour

If the tunnel connection drops (network disruption, container restart), Cloudflared automatically reconnects using **exponential backoff**. No manual intervention is required. During the reconnection window, requests to the SigNoz domain will receive an error from Cloudflare's edge.

---

## DNS Requirements

DNS records for the SigNoz domain must be proxied through Cloudflare (orange cloud in the Cloudflare dashboard). CNAME records pointing to the tunnel's assigned domain are created automatically when the tunnel is first registered.

---

## Operational Notes

- **Production-only.** Local development accesses SigNoz directly on host port 3002.
- **Empty token** — If `CLOUDFLARE_TUNNEL_TOKEN` is not set, the container starts but the tunnel will not establish (Cloudflared exits with a configuration error).
- **Resource limits** are enforced in production to prevent the lightweight tunnel process from consuming excessive resources.
