# Contact & Escalation Reference

## On-Call Rotation

| Role                 | Responsibility                                                                                                                       | Response SLA | Contact Method                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------ |
| L1 — First Responder | Auto-restart failed containers, check logs, verify health endpoints, acknowledge alerts                                              | 15 min       | Telegram `@oncall-l1` channel                                      |
| L2 — Senior Operator | Investigate root cause, rotate compromised secrets, coordinate failover (caddy-active ↔ standby, redis sentinel), review OTEL traces | 30 min       | Telegram `@oncall-l2` channel + direct message to on-call engineer |
| L3 — Infra Lead      | Approve vendor contact, authorize DR failover, post-incident review, capacity decisions                                              | 60 min       | Telegram `@oncall-l3` channel + phone if unreachable               |

## Escalation Criteria

| Trigger                                                | Action                                                            | Level   |
| ------------------------------------------------------ | ----------------------------------------------------------------- | ------- |
| Single container crash, health check failure           | Restart via `just restart <service>`, check `just logs <service>` | L1      |
| OOM kill, persistent crash loop after 2 restarts       | Collect diagnostics with `just diagnostics`, escalate             | L2      |
| Data loss risk, backup verification failure            | Halt writes if possible, engage L3 immediately                    | L3      |
| Secret exposure or unauthorized access                 | Rotate secrets via `just rotate-secrets`, revoke Vault tokens     | L2 → L3 |
| Caddy failover or keepalived VIP shift                 | Verify traffic flow, check `just health-api`                      | L1 → L2 |
| ClickHouse or SignNoz ingestion lag > 5 min            | Check `just ch-health`, inspect OTEL pipeline                     | L2      |
| Vendor-side outage (Cloudflare tunnel, cert authority) | Contact vendor, update status page                                | L3      |

## Telegram Alert Setup Reference

Alerts are routed via the OTEL Collector to Telegram. Configure webhooks in `infra/otel-collector/config.yaml`:

1. Create a Telegram bot via `@BotFather`, obtain the API token. Store in Vault at `secret/telegram/bot-token`.
2. Create a Telegram group, add the bot, obtain the chat ID. Store in Vault at `secret/telegram/chat-id`.
3. The OTEL alerting pipeline references these via Vault templating in the compose overlay.
4. Test delivery: `just tunnel-test` verifies the alert path end-to-end.

## Status Page

Public status page URL: `https://status.example.com`

Update via the status-page repository (separate repo, linked in `README.md`). Mark components as **Degraded** or **Outage** with an estimated recovery time. Revert to **Operational** once `just health` passes all checks.

## Incident Communication Template

```
🔴 INCIDENT — [SERVICE] — [SEVERITY: P1/P2/P3]

**Summary:** [One-line description]
**Impact:** [Affected users/features]
**Started:** [ISO 8601 timestamp]
**Current Status:** [Investigating / Mitigating / Monitoring / Resolved]

**Actions Taken:**
1. [Action]
2. [Action]

**Next Steps:**
- [Planned action]

**Runbook Used:** [Link to relevant runbook]
```

Post in the `#incidents` Telegram channel. Update every 30 minutes until resolved. A full post-mortem is required within 48 hours for any P1 incident.
