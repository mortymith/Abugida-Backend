# Blue-Green Traffic Switch

## Prerequisites

- Two deployment slots (blue and green) running in Docker Compose prod overlay
- `dynamic-upstream.sh` script accessible and executable
- Caddy configured with `lb_policy weighted` and both upstreams registered
- Just CLI installed
- Current traffic distribution known (check with `just deployment-status`)

## Steps

1. **Understand the mechanism.** `dynamic-upstream.sh` modifies the Caddy configuration on the fly, adjusting the weight of each upstream. Caddy's `lb_policy weighted` directive reads these weights to distribute requests. No restart of Caddy is required.

2. **Switch all traffic to blue.** This sets the blue upstream weight to 100% and green to 0%.

   ```bash
   just dynamic-upstream blue 100
   ```

3. **Switch all traffic to green.** This sets the green upstream weight to 100% and blue to 0%.

   ```bash
   just dynamic-upstream green 100
   ```

4. **For gradual canary rollouts,** split traffic between slots.

   ```bash
   just dynamic-upstream green 10
   just dynamic-upstream blue 90
   ```

   Increase the green percentage incrementally as confidence grows.

5. **Confirm the active slot** matches expectations.

   ```bash
   just deployment-status
   ```

## Verification

- `just deployment-status` shows the correct upstream weight distribution.
- Caddy logs (`docker compose logs caddy --tail 50`) reflect the updated upstream weights.
- Requests hitting the API return the version corresponding to the active slot.
- No 5xx errors spike during or after the switch.
- `just health` passes on the active slot.
