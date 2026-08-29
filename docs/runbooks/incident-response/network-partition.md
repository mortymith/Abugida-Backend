# Runbook: Network Partition

## Symptoms

- VIP `172.20.0.100` is unreachable from clients.
- `curl` requests to public domains served by Caddy time out.
- SigNoz dashboard becomes inaccessible if Cloudflared tunnel is affected.
- Keepalived logs show state transitions (`Entering BACKUP STATE`, `Transition to MASTER`).

## Impact

- All external traffic is disrupted. The active-standby Caddy pair may both believe they are active (split-brain) or neither is serving. Internal inter-service communication across the 3-layer network (edge/backend/infra) may be broken.

## Diagnosis

1. Check the VIP is assigned to a host:

   ```bash
   ip addr show | rg "172.20.0.100"
   ```

2. Check Keepalived container status and logs:

   ```bash
   docker ps -a --filter "name=infra_keepalived"
   just logs keepalived
   ```

3. Verify both Caddy instances are healthy:

   ```bash
   docker ps --filter "name=infra_caddy"
   just logs caddy-active && just logs caddy-standby
   ```

4. Check the VRRP interface used by Keepalived:

   ```bash
   docker exec infra_keepalived-1 ip link show
   ```

5. Verify iptables is not blocking VRRP (protocol 112) or HTTP/HTTPS traffic:

   ```bash
   sudo iptables -L -n | rg -E "112|80|443"
   ```

6. If Cloudflared is involved, check its tunnel status:

   ```bash
   just logs cloudflared
   ```

## Resolution

1. If Keepalived is in a bad state, restart it to re-negotiate the VIP:

   ```bash
   just restart keepalived
   ```

2. Verify the VIP reappears on the active node:

   ```bash
   ip addr show | rg "172.20.0.100"
   ```

3. If iptables rules are blocking traffic, restore the firewall:

   ```bash
   just firewall-restore
   ```

4. If Caddy is unhealthy on the active node, restart it:

   ```bash
   just restart caddy-active
   ```

5. If Cloudflared lost its tunnel, restart it:

   ```bash
   just restart cloudflared
   ```

## Verification

1. Confirm the VIP responds to HTTP:

   ```bash
   curl -s -o /dev/null -w '%{http_code}' http://172.20.0.100
   ```

2. Verify Keepalived is in MASTER state on the expected node:

   ```bash
   just logs keepalived | tail -5
   ```

3. Run full health:

   ```bash
   just health
   ```
