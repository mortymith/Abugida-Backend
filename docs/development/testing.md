# Testing

## Workspace Unit Tests (`bun test`)

**Runner:** `bun test`, orchestrated per workspace by `pnpm test` (Turborepo).

```bash
pnpm test                        # every workspace
pnpm --filter @abugida/api test  # one workspace
bun test tests/unit/             # one directory, from a workspace
```

### Test environment (`NODE_ENV=test`)

`bun test` sets `NODE_ENV=test` and automatically loads a workspace-level `.env.test` file when present (real environment variables still win over file values). Workspaces whose modules validate configuration at import time ship a committed `.env.test.example` with safe, non-secret placeholders:

```bash
cp app/api/.env.test.example app/api/.env.test   # once; .env.test is gitignored
```

After this, all unit tests run with no exported variables and no shell setup. The file only satisfies format validation — unit tests never open database, Redis, or OAuth connections. Placeholders live in `.env.test.example` (committed) so a missing file is one `cp` away, not a debugging session. A workspace that later needs more test-time configuration adds its variables to its own `.env.test.example` — there is no shared loader to keep in sync.

Production configuration keeps its strict validation (https origins, real providers, secret strength); `.env.test` cannot weaken it because Bun only reads it when `NODE_ENV=test`.

## Integration Tests

**Runner:** `docker/tests/integration/test-suite.sh`
**Invoke:** `just test-suite [group]`

The suite accepts a `--group` flag to run a subset:

| Group           | What It Verifies                                                                      |
| --------------- | ------------------------------------------------------------------------------------- |
| `smoke`         | All containers are running and report healthy via `docker compose ps`                 |
| `api`           | API `/health` and `/db-health` return 200 with correct JSON schema                    |
| `cache`         | Redis `PING` succeeds, `SET`/`GET` round-trips work, sentinel reports correct primary |
| `db`            | PostgreSQL `pg_isready`, schema tables exist, read replica responds to queries        |
| `all` (default) | Runs all groups in sequence: smoke, api, cache, db                                    |

Run before every PR merge. CI mirrors this via `just test-suite all`.

## Security Tests

### Port Scan (nmap)

**Invoke:** `just port-scan [target]`
**Script:** `docker/tests/security/nmap/scan-ports.sh`

Scans the host to verify only expected ports are open. Compares open ports against the known service map (Caddy on 80/443, SSH, Cloudflare Tunnel). Any unexpected open port fails the check.

### Tunnel Access Test

**Invoke:** `just tunnel-test`
**Script:** `docker/tests/security/tunnel-access-test.sh`

Validates that SigNoz is reachable through the Cloudflare Tunnel and that Vault is **not** reachable externally. Verifies the tunnel access policy.

### Dependency & Image Scan (Trivy)

**Invoke:** `just audit-dependencies`
**Script:** `scripts/security/audit-dependencies.sh`

Runs Trivy against Dockerfiles, lockfiles (`pnpm-lock.yaml`), and built images. Fails on CRITICAL or HIGH CVEs. Also invoked by `security.yml` in CI.

## Compose Validation

**Invoke:** `just validate-compose`

Validates the modular Compose files in `docker/compose/` using `docker compose config` for YAML correctness, service consistency across environments, and correct service counts (dev: 6, staging: 10, prod: 24).

## Performance Tests

**Location:** `docker/tests/performance/k6/`
**Runner:** k6

Load tests targeting the API under simulated traffic. Run manually with `k6 run docker/tests/performance/k6/<scenario>.js`. No `just` recipe exists yet — execute k6 directly. Results are not gated in CI but should be reviewed before production deploys handling significant traffic.
