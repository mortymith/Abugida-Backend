# Troubleshooting

## Quick Diagnostics

Before diving into specific issues, run the built-in diagnostics:

```bash
just diagnostics
```

This collects container states, health endpoints, disk usage, and network connectivity into a single report. Use it as your first step for any unresolved problem.

## Common Issues

| Problem                                | Likely Cause                                                                                      | Fix                                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Container exits immediately            | Missing environment variable in `.env` or incorrect reference in compose                          | Verify the variable exists in `.env` and matches the compose reference. Check `docker compose logs <service>` for the exact missing variable                  |
| Container stuck in `Created` state     | Volume mount point does not exist on the host, or permission denied on bind mount                 | Run `just scaffold` to create directories. Check `ls -la` on the mount source                                                                                 |
| HEALTHCHECK failing (unhealthy)        | Dependency service not ready yet, or app listening on wrong port                                  | Check `just logs <service>` for startup errors. Verify `--start-period` is long enough. Run `just health-api` manually                                        |
| Container cannot reach another service | Service not on the same Docker network, or `internal: true` blocks egress                         | Verify both services share a network in the compose module files. If `internal: true` is set, only internal communication is allowed — this is by design      |
| OTEL not receiving traces/metrics      | OTEL collector crashed, ClickHouse unavailable, or exporter endpoint misconfigured                | Run `just otel-status`. Check collector logs with `just logs otel-collector`. Verify `OTEL_EXPORTER_OTLP_ENDPOINT` in the app's environment                   |
| Vault sealed after restart             | Vault restarts sealed by design — Shamir keys must be re-applied                                  | Run `just vault-unseal`. For automated unseal, configure an auto-unseal backend (see Vault service docs)                                                      |
| Caddy TLS certificate fails to obtain  | DNS not pointing to the host, or ACME challenge port (80) blocked by firewall or Cloudflare proxy | Verify DNS A/AAAA records resolve to the server IP. Ensure port 80 is reachable. Check `just logs caddy-active` for ACME error details                        |
| Redis Sentinel failover not triggering | Fewer than majority of sentinels online, or `quorum` set too high                                 | Confirm all sentinel containers are running (`docker compose ps`). Check `quorum` value in `docker/config/redis/redis-sentinel.conf` — must be ≤ floor(N/2)+1 |
| Redis ACL auth failures                | Password mismatch between `users.acl` template and the environment variable provided at runtime   | Compare `REDIS_ADMIN_PASSWORD` value in `.env` with the ACL file. Ensure the password is set correctly                                                        |

## Getting Logs

```bash
just logs <service>          # Tail all logs
just logs-errors <service>   # Tail only errors/warnings
```

## Escalation

If `just diagnostics` and the table above do not resolve the issue, consult the [incident-response runbooks](../runbooks/incident-response/service-down.md) and escalate per [contact-escalation](../runbooks/reference/contact-escalation.md).
