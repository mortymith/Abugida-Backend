# ADR-022: Redis ACL with three users

## Status

Accepted

## Context

Redis historically secured access with a single `requirepass` password: anyone with that password could run every command, including `FLUSHALL` and `CONFIG`. That all-or-nothing model is a poor fit for a cache shared by several consumers with different needs:

- the **application** needs read/write for sessions, caching, and rate limiting, but must never be able to destroy the dataset;
- **operators** need full access for inspection and maintenance;
- **monitoring** needs to read metrics and health, and should not be able to write or administer anything.

A single shared credential also means one leak compromises everything, and there is no way to tell consumers apart for audit or revocation.

## Decision

Use Redis 6+ **ACLs** with distinct, least-privilege users, and defend dangerous commands twice.

### Users

| User       | Key Access | Permissions                                          | Purpose                                                        |
| ---------- | ---------- | ---------------------------------------------------- | -------------------------------------------------------------- |
| `default`  | —          | `off`                                                | Anonymous connections rejected entirely                        |
| `app`      | `~*`       | `+@all -@dangerous`                                  | API/Dashboard — read/write, destructive commands blocked       |
| `admin`    | `~*`       | `+@all`                                              | Operational tooling, Sentinel administration, emergency access |
| `readonly` | `~*`       | `+@read +@connection`                                | Monitoring dashboards and health checks — read-only            |
| `sentinel` | `~*`       | `+@all -@dangerous` + config get/rewrite + ping/info | Sentinel instances managing the cluster                        |

### Passwords

- Passwords are referenced in `docker/config/redis/users.acl` as `{{REDIS_*_PASSWORD}}` placeholders. The Redis entrypoint resolves them at container startup from environment variables (dev, via `.env`) or Vault-provided values (staging/prod), per ADR-006.
- Rotating a password means updating the source and restarting Redis so the ACL is regenerated; verification is via `ACL LIST` as `admin`.

### Defence in depth

`FLUSHALL`, `FLUSHDB`, `DEBUG`, `CONFIG`, `SHUTDOWN`, and `KEYS` are additionally **renamed to empty strings** in `redis.conf`:

```conf
rename-command FLUSHALL ""
rename-command FLUSHDB  ""
rename-command DEBUG    ""
rename-command CONFIG   ""
rename-command SHUTDOWN ""
rename-command KEYS     ""
```

This makes them unreachable **even for the `admin` user**, preventing accidental destruction and key enumeration by an attacker who holds valid credentials.

## Consequences

### Positive

- **Least privilege**: each consumer authenticates as a user whose permissions match its role.
- **Destructive commands blocked**: `-@dangerous` plus `rename-command` means no routine consumer can flush or reconfigure the server.
- **Monitoring is safe**: `readonly` cannot mutate state.
- **No secrets in git**: passwords are placeholders resolved at startup.

### Negative

- **More credentials**: several users to manage, rotate, and inject — handled centrally by ADR-006.
- **Duplicate defence can be confusing**: a command may be denied by ACL _and_ removed by rename; operators must know both exist.
- **Verification cost**: checking effective permissions means inspecting `ACL LIST` per user.

### Risks

- **Admin over-provisioning**: the `admin` user is powerful (though `rename-command` still removes the most dangerous commands). It is reserved for operations and Sentinel.
- **Placeholder resolution failure**: if a password variable is missing at startup, the ACL cannot be generated and Redis fails to start — a loud failure by design.
- **ACL file drift**: the `.acl` file and the `redis.conf` renames must stay in step; both are version-controlled and checked by `scripts/security/check-configs.sh`.

## References

- Redis service: `docs/services/redis.md`
- Customizing Redis ACL: `docs/configuration/customizing-redis-acl.md`
- Config: `docker/config/redis/users.acl`, `docker/config/redis/redis.conf`
- HA topology: ADR-014 · Network isolation: ADR-004 · Secret layering: ADR-006
