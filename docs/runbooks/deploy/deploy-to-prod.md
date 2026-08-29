# Deploy to Production

## Prerequisites

- GitHub Actions `deploy-prod.yml` has 2-reviewer approval (do not bypass)
- Tag or commit with the target version ready
- `DEPLOY_VERSION` environment variable set to the version being deployed
- `DEPLOY_STRATEGY=recreate` configured in the environment
- Recent backup completed (`just backup-all`)
- `just health` passing on current production

## Steps

1. **Run pre-flight checks** to validate the target environment is ready.

   ```bash
   ./scripts/pre-flight.sh
   ```

   This verifies disk space, Docker availability, env vars, network connectivity, and S3 access.

2. **Deploy the specified version.** This pulls images tagged with the version, starts containers with the prod overlay, and switches Caddy upstreams via blue-green.

   ```bash
   just deploy-prod v2.4.1
   ```

   The recipe sets `DEPLOY_VERSION=v2.4.1`, runs the blue-green switch, and waits for the new containers to become healthy.

3. **Check deployment status** to confirm the new version is live.

   ```bash
   just deployment-status
   ```

4. **Run post-deploy health checks.**

   ```bash
   just health
   ```

5. **If anything fails, initiate a rollback** (see canary-rollback runbook).

   ```bash
   just rollback
   ```

## Verification

- `just deployment-status` shows the new version active on all upstreams.
- `just health` passes all service checks.
- `just health-replication` shows replicas caught up.
- API responds with the expected version in headers or `/health`.
- No error spikes in monitoring dashboards.
- Caddy is routing traffic to the new (green) upstream.
