# Redis 7.4

> **In-memory data store** providing caching, session management, and real-time feature flags. Production deploys a Sentinel-managed cluster with automatic failover and zero-downtime client reconnection.

---

## Overview

| Property           | Value              |
| ------------------ | ------------------ |
| **Image**          | `redis:7.4-alpine` |
| **Container Port** | 6379               |
| **Dev Host Port**  | 6379               |
| **Network**        | `infrastructure`   |
| **Environments**   | All                |

---

## Configuration Files

| File                                      | Purpose                                                                                                   |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `docker/config/redis/redis.conf`          | Core server settings — persistence, memory eviction policy, renamed dangerous commands, TLS configuration |
| `docker/config/redis/users.acl`           | ACL-based user definitions for `app`, `admin`, and `readonly` roles                                       |
| `docker/config/redis/redis-sentinel.conf` | Sentinel monitor target, quorum size, failover timing, and notification settings                          |

---

## Sentinel High-Availability Topology

```
┌─────────────┐
│   Primary   │  ← Writes + Reads
└──────┬───────┘
       │ sync
  ┌────┴────┐
  ▼         ▼
┌────────┐ ┌────────┐
│Replica │ │Replica │  ← Reads only
└────────┘ └────────┘

┌──────────┐ ┌──────────┐ ┌──────────┐
│Sentinel 1│ │Sentinel 2│ │Sentinel 3│  ← Quorum = 2
└──────────┘ └──────────┘ └──────────┘
```

Three Sentinel instances monitor the primary. A failover is triggered when two of three sentinels agree the primary is down (`down-after-milliseconds`). Once triggered, Sentinels:

1. Elect a new primary from the replicas.
2. Reconfigure remaining replicas to follow the new primary.
3. Notify connected clients of the topology change.

Application clients query any Sentinel for the current primary address using `SENTINEL get-master-addr-by-name`.

---

## ACL-Based Access Control

Redis 6+ ACLs replace the legacy `requirepass` model with fine-grained, per-user permission sets:

| User       | Permission String                       | Intended Use                                                               |
| ---------- | --------------------------------------- | -------------------------------------------------------------------------- |
| `app`      | `~* +@all -@dangerous`                  | Application services — full data access but destructive operations blocked |
| `admin`    | `~* +@all`                              | Operational tooling and emergency access — unrestricted                    |
| `readonly` | `~* +@read -@write -@admin -@dangerous` | Monitoring dashboards and health checks — read-only                        |

---

## Dangerous Command Renaming

The following commands are renamed to empty strings in `redis.conf`, rendering them completely unreachable even to authenticated users:

```bash
rename-command FLUSHDB    ""
rename-command FLUSHALL   ""
rename-command DEBUG     ""
rename-command CONFIG    ""
rename-command SHUTDOWN  ""
rename-command KEYS      ""
```

This is a **defence-in-depth** measure. Even if an attacker obtains valid credentials, they cannot enumerate keys, flush data, or reconfigure the server.

---

## Persistence Strategy

Redis uses a hybrid persistence model combining RDB snapshots with AOF (Append-Only File) for maximum durability:

```bash
save 900 1        # Snapshot after 900s if ≥1 write
save 300 10       # Snapshot after 300s if ≥10 writes
save 60 10000     # Snapshot after 60s if ≥10000 writes
appendonly yes
appendfsync everysec
```

| Method  | Characteristics                               | Recovery Use                                   |
| ------- | --------------------------------------------- | ---------------------------------------------- |
| **RDB** | Compact, fast-to-load point-in-time snapshots | Disaster recovery — restore full dataset       |
| **AOF** | Logs every write, fsyncs once per second      | Crash recovery — limits data loss to ≤1 second |

The memory eviction policy is set to `allkeys-lru`, evicting the least-recently-used keys when the memory limit is reached. This is appropriate for caching workloads where stale data can be recomputed from PostgreSQL.

---

## Health Check

```yaml
healthcheck:
  test: ['CMD', 'redis-cli', '-u', 'redis://app:${REDIS_PASSWORD_ENV}@localhost', 'ping']
  interval: 10s
  timeout: 5s
  retries: 5
```

Authenticates as the `app` user, verifying both that the server is responding and that ACL-based authentication is functional.

---

## Resource Allocation

| Component         | CPU Limit | Memory Limit | Notes                                                 |
| ----------------- | --------- | ------------ | ----------------------------------------------------- |
| Primary / Replica | 4 CPUs    | 8 GB         | Sized for production caching workload                 |
| Sentinel (each)   | 0.5 CPU   | 256 MB       | Lightweight — monitors and coordinates failovers only |

---

## Backup & Recovery

| Operation | Script                             | Method       |
| --------- | ---------------------------------- | ------------ |
| Backup    | `scripts/backup/backup-redis.sh`   | RDB snapshot |
| Restore   | `scripts/restore/restore-redis.sh` | RDB restore  |

---

## Operational Notes

- **Sentinel is production-only.** Development uses a single Redis instance without replicas or sentinels.
- **Failover latency** — Connected clients may experience a brief spike (typically <2 s) while the new primary is elected and replicas re-sync.
- **Monitoring** — Cache hit/miss ratios, memory usage, and command throughput are tracked in the SigNoz Redis dashboard.
