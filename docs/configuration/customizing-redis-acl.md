# Customizing Redis ACL

Redis access control is defined in `docker/config/redis/users.acl`. The file uses the `>password-file` syntax so passwords are resolved at container startup by the Redis entrypoint script, which reads environment variables (dev) or Vault secrets (staging/prod) and generates the final ACL configuration.

## ACL File Format

```
user <name> on ><password-placeholder> ~<key-pattern> &<pubsub-channel> <permissions>
```

- `on` / `off`: Enable or disable the user.
- `>file`: Password is read from an environment variable or Vault secret at startup. The entrypoint replaces `{{REDIS_*_PASSWORD}}` placeholders with actual values.
- `~pattern`: Key namespace pattern (e.g., `~*` for all keys, `~app:*` for app-prefixed keys).
- `&channel`: Pub/Sub channel pattern.
- `+@category` / `-@category`: Grant or revoke command categories. `-@dangerous` blocks FLUSHALL, FLUSHDB, DEBUG, CONFIG, SHUTDOWN.

## Current Users

| User       | Password Source                                                      | Key Access      | Permissions                | Purpose                                                                    |
| ---------- | -------------------------------------------------------------------- | --------------- | -------------------------- | -------------------------------------------------------------------------- |
| `default`  | disabled                                                             | N/A             | `off`                      | Anonymous connections rejected entirely                                    |
| `admin`    | `{{REDIS_ADMIN_PASSWORD}}` → `.env` (dev) / Vault (staging, prod)    | `~*` (all keys) | `+@all`                    | Operational tooling, Sentinel, administrative tasks                        |
| `app`      | `{{REDIS_PASSWORD}}` → `.env` (dev) / Vault (staging, prod)          | `~*` (all keys) | `+@all -@dangerous`        | API and Dashboard service account — read/write but no destructive commands |
| `readonly` | `{{REDIS_READONLY_PASSWORD}}` → `.env` (dev) / Vault (staging, prod) | `~*` (all keys) | `+@read`                   | Monitoring dashboards and health checks — read-only                        |
| `sentinel` | `{{REDIS_SENTINEL_PASSWORD}}` → `.env` (dev) / Vault (staging, prod) | `~*` (all keys) | `+@all -@dangerous +config | rewrite +config                                                            | get +ping +info ...` | Sentinel instances for cluster management |

## Adding a New User

1. **Generate a password** and add it to your environment:

```bash
# Add to .env for development
REDIS_WORKER_PASSWORD=$(openssl rand -hex 32)
```

For staging/prod, configure Vault to provide the secret via the `redis/` secret engine.

2. **Add the environment variable** to the Redis service in `docker/compose/base.yml` or the appropriate override file.

3. **Add the user to `docker/config/redis/users.acl`**:

```
# Worker — background job processor, read/write on app:* keys only
user worker on >{{REDIS_WORKER_PASSWORD}} ~app:* &* +@all -@dangerous
```

4. **Make the variable available** to the Redis container by adding it to the service environment or Vault configuration.

5. **Restart Redis** to apply:

```bash
just restart redis-primary
```

## Modifying Permissions

To change what an existing user can do, edit the ACL line in `users.acl`. Common adjustments:

- **Restrict key scope**: Change `~*` to `~app:*` to limit access to only `app:`-prefixed keys.
- **Add specific commands**: Use `+command` syntax (e.g., `+get +set +hget +hset`).
- **Remove command categories**: Use `-@category` (e.g., `-@admin` to block CONFIG, DEBUG, SHUTDOWN).

## Regenerating ACL After Password Rotation

When you rotate a password, restart the Redis container so the entrypoint regenerates `users.acl` from the template:

```bash
# Rotate a single password (update .env for dev, or use Vault for staging/prod)
just rotate-secrets

# Restart Redis to pick up new secret
just restart redis-primary

# Verify the new ACL is active
docker exec infra_redis-primary redis-cli \
  --user admin --pass "$REDIS_ADMIN_PASSWORD" \
  ACL LIST
```

## Dangerous Commands

`FLUSHALL`, `FLUSHDB`, and `DEBUG` are additionally disabled via `rename-command` in `redis.conf` (set to empty strings). Even the `admin` user cannot invoke them because the commands are renamed to nothing at the server level. This provides defense in depth beyond ACL rules.
