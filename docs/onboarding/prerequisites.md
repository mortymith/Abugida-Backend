# Prerequisites

## System Requirements

| Resource    | Minimum                      | Recommended                  |
| ----------- | ---------------------------- | ---------------------------- |
| **OS**      | Ubuntu 22.04 LTS             | Ubuntu 24.04 LTS             |
| **CPU**     | 4 cores                      | 8 cores                      |
| **RAM**     | 8 GB                         | 16 GB                        |
| **Disk**    | 40 GB free (SSD)             | 80 GB free (SSD)             |
| **Network** | Loopback + outbound internet | Multi-homed with VIP support |

A **Linux host is required**. Keepalived (VRRP) and iptables-persistent do not run on macOS or Windows, even inside VMs without TUN/TAP passthrough.

## Tool Versions

| Tool           | Minimum Version | Purpose                                 |
| -------------- | --------------- | --------------------------------------- |
| Docker CE      | 27.0+           | Container runtime (host daemon)         |
| Docker Compose | v2.24.0+        | Multi-service orchestration             |
| Devbox         | 0.18+           | Toolchain sandbox (pins every tool)     |
| Just           | 1.40.0          | Task runner / CLI                       |
| Bun            | 1.4.4           | App runtime (API, Dashboard, Marketing) |
| Trivy          | 0.58.0          | Container image scanning                |
| jq             | 1.6+            | JSON processing                         |

All required tools are installed automatically by the prerequisites script (see [Installation](installation.md)).

### Toolchain sandbox

Except for the **Docker daemon**, every tool in the table above is provided — and version-pinned
— by the [Devbox](../development/devbox-sandbox.md) sandbox declared in `devbox.json`:

```bash
just sandbox-setup   # materialise the pinned toolchain (Nix store) + install dependencies
just sandbox-shell   # enter the sandbox
just sandbox-doctor  # verify the sandbox against the versions this repository declares
```

`devbox.lock` is committed, so every developer resolves the same Bun, pnpm, Node, just and
linter versions. The sandbox provides the Docker **client**; the daemon stays on the host.

## Port Requirements

### Production

| Port | Protocol | Service | Notes                     |
| ---- | -------- | ------- | ------------------------- |
| 80   | TCP      | Caddy   | HTTP → HTTPS redirect     |
| 443  | TCP      | Caddy   | TLS termination           |
| 8200 | TCP      | Vault   | Secrets engine (internal) |

### Development

| Port | Protocol | Service                        |
| ---- | -------- | ------------------------------ |
| 3001 | TCP      | API (Bun)                      |
| 8081 | TCP      | Dashboard (Bun)                |
| 8082 | TCP      | Marketing site (Astro)         |
| 9001 | TCP      | MinIO Console                  |
| 9000 | TCP      | MinIO S3 API                   |
| 3002 | TCP      | SigNoz UI                      |
| 5432 | TCP      | PostgreSQL                     |
| 6432 | TCP      | PgBouncer                      |
| 6379 | TCP      | Redis                          |
| 8123 | TCP      | ClickHouse HTTP (staging only) |
| 8085 | TCP      | PowerSync                      |
| 4317 | TCP      | OTEL gRPC                      |
| 4318 | TCP      | OTEL HTTP                      |

Ensure no conflicting services bind to these ports before starting the stack.
