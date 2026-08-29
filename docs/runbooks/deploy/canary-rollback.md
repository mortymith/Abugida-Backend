# Canary Rollback

## Prerequisites

- A canary deployment is partially live (e.g., green at 10-50% traffic)
- `just rollback` recipe is available and tested
- You have identified the issue causing the rollback (check logs, metrics)
- `DEPLOY_VERSION` still points to the previous stable version in env

## Steps

1. **Immediately route all traffic back to the known-good blue slot** to stop errors from reaching users.

   ```bash
   just dynamic-upstream blue 100
   ```

2. **Restart any faulty containers** in the green slot to clear crash loops and free resources.

   ```bash
   docker compose restart api
   ```

3. **Run the full rollback recipe.** This resets `DEPLOY_VERSION` to the previous stable version, re-pulls images, and ensures the blue slot is fully healthy.

   ```bash
   just rollback
   ```

4. **Verify the system is stable** after rollback.

   ```bash
   just health
   ```

5. **Document the incident.** Note the version that failed, the symptoms, and the root cause for the post-mortem.

## Verification

- `just deployment-status` shows 100% traffic on blue with the previous stable version.
- `just health` passes all checks.
- Error rates return to baseline within minutes.
- No crash-looping containers remain.
- `just otel-status` confirms telemetry is flowing normally.
