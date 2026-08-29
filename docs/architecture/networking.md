# Network Architecture

**Source:** deployment.md v3.0.0, ADR-004

## 1. Overview

The infrastructure uses three isolated bridge networks implementing defense in depth (ADR-004). Each network maps to a distinct tier in the architecture, with strict rules about which services may attach and whether external routing is permitted. This separation ensures that even if an application service is compromised, the attacker cannot directly reach data-layer services without crossing network boundaries.

The design follows a principle of minimal connectivity: services are placed on the fewest networks necessary to fulfill their role, and the infrastructure network has no external route at all, creating an air-gapped data layer that can only be reached from the backend network.

## 2. Network Definitions

| Network          | Subnet        | Gateway    | Internal | Purpose                                                         |
| ---------------- | ------------- | ---------- | -------- | --------------------------------------------------------------- |
| `edge`           | 172.20.0.0/24 | 172.20.0.1 | no       | DMZ — TLS termination, reverse proxy, Keepalived VIP            |
| `backend`        | 172.21.0.0/24 | 172.21.0.1 | no       | Application services — API, Dashboard, and Marketing containers |
| `infrastructure` | 172.22.0.0/24 | none       | **yes**  | Data layer — databases, cache, storage, secrets, observability  |

### Key Properties

- **`internal: true`** on `infrastructure` means containers on that network have no default gateway and cannot reach the internet. This is a hard restriction enforced by Docker's network driver, not just a firewall rule. Services that need to pull images or reach external APIs (e.g., MinIO versioning replication, Vault PKI OCSP) must do so from a different network or use a sidecar proxy.

- **`COMPOSE_PROJECT_NAME` prefix** ensures network names don't collide when multiple environments run on the same host. In dev, this resolves to `infra-dev_edge`, `infra-dev_backend`, `infra-dev_infrastructure`; in prod, `infra-prod_*`.

- **IPAM-managed subnets** guarantee consistent addressing across `docker compose down && up` cycles. Without explicit subnets, Docker assigns from its default pool, which can shift.

## 3. Service-to-Network Membership Matrix

This matrix is the single source of truth for which services attach to which networks. Every service block in the `docker/compose/` module files (`base.yml`, `app.yml`, `observability.yml`, `edge.yml`, `scaling.yml`, `security.yml`) MUST reference this matrix. Do not add a service to a network without updating this table.

### Legend

- **Primary** — the service's main network; it is reachable here by its service name.
- **Cross** — the service is also attached to this network for data-layer or proxy access.

### Edge Network (`edge`, 172.20.0.0/24)

| Service         | Role                  | Internal Port | Notes                                                    |
| --------------- | --------------------- | ------------- | -------------------------------------------------------- |
| `keepalived`    | Floating VIP manager  | N/A           | Binds VIP 172.20.0.100; VRRP between Caddy nodes         |
| `caddy-active`  | Primary reverse proxy | 80, 443       | Cross-attached to `backend` for upstream routing         |
| `caddy-standby` | Hot standby proxy     | 80, 443       | Same config as active; takes over on Keepalived failover |

### Backend Network (`backend`, 172.21.0.0/24)

| Service         | Role                | Internal Port | Cross-Network    | Notes                                                                                                        |
| --------------- | ------------------- | ------------- | ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `caddy-active`  | Proxy → upstream    | 80, 443       | → edge           | Routes by Host header: `DOMAIN_API` to API, `DOMAIN_DASHBOARD` to Dashboard, `DOMAIN_MARKETING` to Marketing |
| `caddy-standby` | Proxy → upstream    | 80, 443       | → edge           | Same routing rules                                                                                           |
| `api`           | REST API backend    | 3000          | → infrastructure | Handles mutations, auth, business logic                                                                      |
| `dashboard`     | Web dashboard app   | 8080          | → infrastructure | PgBouncer + Redis access (ADR-019)                                                                           |
| `marketing`     | Static landing page | 8080          | —                | Backend network only; no data-layer access                                                                   |

### Infrastructure Network (`infrastructure`, 172.22.0.0/24, internal)

| Service              | Role                  | Internal Port    | Cross-Network | Notes                                                                                        |
| -------------------- | --------------------- | ---------------- | ------------- | -------------------------------------------------------------------------------------------- |
| `api`                | Application           | 3000             | → backend     | Accesses Postgres via PgBouncer, Redis, MinIO, Vault                                         |
| `dashboard`          | Application           | 8080             | → backend     | Accesses Postgres via PgBouncer (ADR-019), Redis for cache/sessions                          |
| `marketing`          | Application           | 8080             | —             | Backend network only; no data-layer access                                                   |
| `postgres-primary`   | Database (write)      | 5432             | —             | Streaming replication source                                                                 |
| `postgres-replica-1` | Database (read)       | 5432             | —             | Read replica, replicated from primary                                                        |
| `postgres-replica-2` | Database (read)       | 5432             | —             | Read replica, prod only                                                                      |
| `pgbouncer`          | Connection pooler     | 6432             | —             | Sits between app services and Postgres (ADR-019)                                             |
| `redis-primary`      | Cache (read/write)    | 6379             | —             | App sessions, caching, rate limiting                                                         |
| `redis-replica-1`    | Cache (read)          | 6379             | —             | Read replica, prod only                                                                      |
| `redis-replica-2`    | Cache (read)          | 6379             | —             | Read replica, prod only                                                                      |
| `redis-sentinel-1`   | HA monitor            | 26379            | —             | Sentinel quorum member (ADR-022)                                                             |
| `redis-sentinel-2`   | HA monitor            | 26379            | —             | Sentinel quorum member, prod only                                                            |
| `redis-sentinel-3`   | HA monitor            | 26379            | —             | Sentinel quorum member, prod only                                                            |
| `minio`              | Object storage        | 9000, 9001       | —             | S3-compatible, versioning + CRR (prod)                                                       |
| `vault`              | Secrets management    | 8200, 8201       | —             | PKI, dynamic creds, audit log (ADR-006)                                                      |
| `otel-collector`     | Telemetry collector   | 4317, 4318, 8889 | —             | Receives OTLP from services, forwards to SigNoz                                              |
| `clickhouse`         | Metrics/trace storage | 8123, 9009       | —             | Columnar backend for SigNoz                                                                  |
| `signoz-frontend`    | Observability UI      | 3001             | —             | Bundles UI, query service, and alerting; accessed via Cloudflare Tunnel (ADR-020)            |
| `powersync-sync`     | Real-time sync engine | 8085 (probes)    | —             | Singleton replication worker; logical replication from postgres-primary (bypasses PgBouncer) |
| `powersync-api`      | Client sync API       | 8085             | —             | Stateless sync endpoint; proxied by Caddy via DOMAIN_SYNC (ADR-025)                          |
| `minio-backup`       | CRR target (prod)     | 9000, 9001       | —             | Cross-region replication target                                                              |
| `init-minio`         | One-shot init (prod)  | N/A              | —             | Creates buckets, policies, CRR rules; `restart: "no"`                                        |
| `cloudflared`        | Tunnel client         | N/A              | —             | Outbound tunnel to Cloudflare (ADR-020), no inbound ports                                    |

## 4. Traffic Flow Rules

### Inbound (External → Edge)

1. Internet traffic arrives on the host's ports 80/443 (prod) or published debug ports (dev/staging).
2. Caddy terminates TLS and inspects the Host header.
3. Requests to `DOMAIN_API` are proxied to `api:3000` on the `backend` network.
4. Requests to `DOMAIN_DASHBOARD` are proxied to `dashboard:8080` on the `backend` network.
5. Requests to `DOMAIN_MARKETING` are proxied to `marketing:8080` on the `backend` network.
6. Cloudflare Tunnel (prod) provides an alternative inbound path for SigNoz only — it proxies directly to `signoz-frontend:8080` on the `infrastructure` network via the `cloudflared` sidecar.

### East-West (Backend → Infrastructure)

- API and Dashboard containers have two network interfaces (backend + infrastructure). This allows them to reach both Caddy (for health checks or response headers) and data-layer services. Marketing is attached to the backend network only and has no data-layer access.
- PgBouncer sits on the infrastructure network and acts as a connection pooler. App services connect to `pgbouncer:6432` instead of directly to PostgreSQL, reducing connection overhead by 80%+ (ADR-019). All application services connect via PgBouncer (API and Dashboard for database access); the previous exception where Website read directly from `postgres-primary:5432` (ADR-013) has been removed and ADR-013 is superseded.
- Redis Sentinel is reachable only within the infrastructure network (port 26379). Application services connect to Sentinel to discover the current primary address.

### Blocked Paths

- **Infrastructure → Internet**: `internal: true` prevents any container on the 172.22.0.0/24 subnet from reaching external hosts. This blocks data exfiltration even if a database is compromised.
- **Edge → Infrastructure**: Caddy cannot directly reach data-layer services. It must proxy through the backend network to application services, which then access infrastructure. This adds a hop but ensures all data access goes through application-layer auth.
- **Direct database access from host**: In production, no ports from the infrastructure network are published to the host. All database access must go through the application layer or a bastion host.

## 5. Three-Environment Differences

| Aspect | Dev | Staging | Prod |
|--------|-------------|------------|
| Caddy HA (Keepalived) | Not deployed | Not deployed | Active-standby with VIP 172.20.0.100 |
| Redis replicas | 0 | 0 | 2 (primary + 2 replicas) |
| Redis Sentinels | 0 | 0 | 3 (quorum = 2) |
| PostgreSQL replicas | 0 | 0 | 2 (primary + 2 read replicas) |
| API / Dashboard / Marketing | Not deployed | Single instance, published ports | 3 replicas each, no published ports |
| OTEL / SigNoz | Not deployed | Single instance, published ports | Single instance, no published ports |
| Published ports | Infrastructure only | All services | Only 80/443 on host |
| Cloudflare Tunnel | Not deployed | Not deployed | Required for SigNoz (ADR-020) |
| Vault | Not deployed | Not deployed | Dynamic secrets + PKI |

## 6. Firewall Rules (Production Host)

These iptables rules complement Docker's network isolation at the host level. They are applied in addition to Docker's built-in filtering.

```bash
# Edge network — allow public HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Block direct access to infrastructure subnets from external interfaces
iptables -A INPUT -s 172.22.0.0/24 -i eth0 -j DROP

# Redis — allow only from backend network
iptables -A INPUT -p tcp --dport 6379 -s 172.21.0.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 6379 -s 127.0.0.1 -j ACCEPT
iptables -A INPUT -p tcp --dport 6379 -j DROP

# Redis Sentinel — infrastructure internal only
iptables -A INPUT -p tcp --dport 26379 -s 172.22.0.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 26379 -j DROP

# PostgreSQL — allow only from backend network and localhost
iptables -A INPUT -p tcp --dport 5432 -s 172.21.0.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 5432 -s 127.0.0.1 -j ACCEPT
iptables -A INPUT -p tcp --dport 5432 -j DROP

# Vault — infrastructure internal only
iptables -A INPUT -p tcp --dport 8200 -s 172.22.0.0/24 -j ACCEPT
iptables -A INPUT -p tcp --dport 8200 -j DROP
```

## 7. Adding a New Service

When adding a new service, follow the checklist in [Adding a Service](../configuration/adding-a-service.md). Key networking steps:

1. Determine which tier the service belongs to (edge / backend / infrastructure).
2. Add the service to the appropriate `docker/compose/` module file (base.yml for all-env, app.yml for staging+prod, edge.yml for prod, etc.).
3. If the service needs to be reached by Caddy AND access data-layer services, it must join both `backend` and `infrastructure`.
4. If the service only provides data or infra services (no HTTP API for Caddy), it belongs on `infrastructure` only.
5. Add the service to the matrix table above.
6. If the service opens a new port, add a firewall rule in Section 6.
7. Update any Caddy upstream configs in `docker/config/caddy/` to reference the new service by its Compose service name.
