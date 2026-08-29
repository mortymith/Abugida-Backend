# Customizing Caddy

The Caddy configuration lives in `docker/config/caddy/` and is composed from a main `Caddyfile` and three reusable snippets. The configuration is mounted read-only into the Caddy container.

## File Layout

```
docker/config/caddy/
├── Caddyfile                    # Main configuration
└── snippets/
    ├── upstreams.conf           # Backend upstream definitions (dynamic)
    ├── security.conf            # Security headers (HSTS, CSP, X-Frame)
    └── rate-limiting.conf       # Global and per-zone rate limits
```

## Caddyfile Structure

The file has four sections:

1. **Global options block** — Admin API on loopback (`127.0.0.1:2019`), ACME issuer selection (`local` for dev / `letsencrypt` for prod), JSON log output with rotation.
2. **Snippet imports** — `security.conf`, `rate-limiting.conf`, `upstreams.conf` are imported at the top level.
3. **Site blocks** — One block per virtual host, keyed by `{$DOMAIN_*}` environment variables:
   - **Dashboard** (`{$DOMAIN_DASHBOARD}`): Static asset caching (`/static/*`, `/assets/*`), health endpoint bypass, CDN-friendly Cache-Control headers for the TanStack Start app.
   - **Marketing** (`{$DOMAIN_MARKETING}`): Astro landing page with aggressive CDN-friendly caching and a health endpoint bypass.
   - **API** (`{$DOMAIN_API}`): Re-imports security and rate-limiting snippets, strict `no-store` cache policy, health check bypass.
   - **SigNoz** (`{$DOMAIN_SIGNOZ}`): Production-only via Cloudflare Tunnel, no security headers.
   - **MinIO Console** (`{$DOMAIN_MINIO_CONSOLE}`): Dev-only, direct reverse proxy.
4. **Upstream definitions** — Centralized in `snippets/upstreams.conf` as the single source of truth. The `scripts/deploy/dynamic-upstream.sh` rewrites this file during blue-green cutovers using Caddy's `lb_weight` directive.

## Snippet Reference

| Snippet              | Path                          | Purpose                                                                                                                                        | Applied To                                                                                      |
| -------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `upstreams.conf`     | `snippets/upstreams.conf`     | Defines `set_upstream` blocks for API, Dashboard, and Marketing. Rewritten by `dynamic-upstream.sh` during deployments.                        | All site blocks via `reverse_proxy api` / `reverse_proxy dashboard` / `reverse_proxy marketing` |
| `security.conf`      | `snippets/security.conf`      | HSTS (1 year, preload), CSP, X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy, server header removal. | Global import + explicit re-import on API block                                                 |
| `rate-limiting.conf` | `snippets/rate-limiting.conf` | Global zone: 100 req/s per IP (burst 200). API zone: 50 req/s per IP (burst 100).                                                              | Global import + explicit `rate_limit api_zone` on API block                                     |

## Adding a New Virtual Host

Add a new site block to `docker/config/caddy/Caddyfile`:

```caddy
# New service — {$DOMAIN_SERVICE}
{$DOMAIN_SERVICE:service.localhost} {
    import snippets/security.conf

    handle /health {
        reverse_proxy my-service:8080
    }

    handle {
        reverse_proxy my-service {
            lb_policy least_conn
            health_path /health
            health_interval 10s
            health_timeout 5s
        }
    }
}
```

Then:

1. Add the `DOMAIN_SERVICE` variable to `.env.example` and `.env`.
2. If the service uses blue-green, add an upstream block in `snippets/upstreams.conf` and update `dynamic-upstream.sh`.
3. Add a firewall rule in the Cloudflare Tunnel config if the service should be externally accessible in production.

## Modifying Rate Limits

Edit `docker/config/caddy/snippets/rate-limiting.conf`. Adjust the `events` (requests per window) and `burst` (allowed spike) values:

```caddy
rate_limit api_zone {
    zone dynamic {
        key {client_ip}
        events 100       # Increase from 50 for higher throughput
        window 1s
        burst 200        # Increase from 100
    }
}
```

After editing, reload Caddy via its admin API or restart the container:

```bash
just caddy-reload
```

## Changing TLS Settings

The ACME issuer is controlled by `CADDY_ACME_ISSUER`:

- **Dev**: Set to `internal` — Caddy uses its built-in local CA for `*.localhost` certificates. No external network calls.
- **Prod**: Set to `letsencrypt` — Caddy requests certificates from the Let's Encrypt staging or production ACME servers.

In production, Vault PKI can replace Let's Encrypt. Mount the Vault-issued certificate and key, then set the issuer to `internal` with a custom certificate path in the global options block.
