# Keepalived

> **VRRP-based virtual IP failover** between active and standby Caddy instances, ensuring high availability for ingress traffic with <5 second failover.

---

## Overview

| Property          | Value                                |
| ----------------- | ------------------------------------ |
| **Image**         | `osixia/keepalived:2.0.20-alpine`    |
| **Network**       | Host mode (required for VIP binding) |
| **VIP**           | `172.20.0.100/24`                    |
| **Failover Time** | < 5 seconds                          |
| **Environments**  | Production only                      |

---

## How It Works

1. Both Caddy instances (active and standby) run simultaneously with identical configurations.
2. Keepalived assigns the VIP to the active Caddy's host interface.
3. Keepalived continuously probes both Caddy instances via HTTP health checks (`/health`).
4. If the active Caddy fails its health check, Keepalived reduces the local priority below the standby's.
5. The standby detects the priority change and assumes the VIP.
6. The VIP migrates to the standby host, and it begins serving traffic.

---

## Configuration

| File                                                | Purpose                                              |
| --------------------------------------------------- | ---------------------------------------------------- |
| `docker/config/keepalived/keepalived.conf`          | Final runtime configuration (bind-mounted read-only) |
| `docker/config/keepalived/keepalived.conf.template` | Template for reference                               |

The VRRP interface name is resolved at host level by `docker/init/resolve-vrrp-interface.sh` during `just setup-prod`, which detects the correct network interface and writes the final configuration.

---

## Linux Capabilities

```yaml
cap_add:
  - NET_ADMIN # Add/remove the VIP from network interfaces
  - NET_BROADCAST # Send and receive VRRP broadcast advertisements
  - NET_RAW # Raw ICMP sockets for neighbour discovery and ARP
```

Without these capabilities, Keepalived cannot manipulate the host's network interfaces or participate in VRRP elections.

---

## Network Mode

Host network mode (`network_mode: host`) is mandatory. Keepalived must bind the VIP directly to a physical host interface for it to be reachable by external clients. Bridge networking would isolate the VIP inside the container's network namespace, making it invisible to the outside world.

---

## Split-Brain Prevention

VRRP authentication and priority-based election prevent split-brain scenarios. Only the instance with the highest priority holds the VIP. If both instances believe they should hold the VIP (e.g., due to network partition), the authentication key ensures only one instance can successfully advertise.

---

## Operational Notes

- **Failover time** — <5 seconds under normal conditions. Network partitions or extreme load may extend this.
- **Dev environment** — Uses a single Caddy instance without Keepalived. The VIP concept does not exist in dev.
- **Reclaiming VIP** — After a failover, the original active must pass its health checks before reclaiming the VIP on the next Keepalived election cycle.
