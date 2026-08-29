# Runbooks — Decision Tree

## Which Runbook Do I Need?

Follow this decision tree to find the right runbook for your situation:

```
What do you need to do?
│
├─ Something is broken or users are impacted?
│  └─ ▶ incident-response/
│     Service down, cascade failure, network partition,
│     database unavailable, Redis failover, Vault sealed, etc.
│
├─ Something suspicious or potentially compromised?
│  └─ ▶ security-events/
│     Unauthorized access, compromised secret, vulnerability found,
│     TLS certificate expired.
│
├─ Need to ship code to an environment?
│  └─ ▶ deploy/
│     Deploy to dev, deploy to prod, canary rollback,
│     blue-green switch, post-deploy verification.
│
├─ Need to backup, restore, or migrate data?
│  └─ ▶ data-operations/
│     Full backup, per-service backups (Postgres, Redis, MinIO),
│     restores, data migration, storage cleanup.
│
├─ Planned maintenance or operational change?
│  └─ ▶ maintenance/
│     Rolling restart, scale up/down, config change,
│     certificate rotation, dependency upgrade, log rotation.
│
└─ Need to look something up (architecture, contacts, commands)?
   └─ ▶ reference/
      Service dependency map, useful commands, environment details,
      contact & escalation procedures.
```

## Quick-Link Table

| Directory                                  | Description                                                        |
| ------------------------------------------ | ------------------------------------------------------------------ |
| [`incident-response/`](incident-response/) | Step-by-step procedures for active incidents and service outages   |
| [`security-events/`](security-events/)     | Response playbooks for security anomalies and vulnerabilities      |
| [`deploy/`](deploy/)                       | Code shipment procedures for dev and production environments       |
| [`data-operations/`](data-operations/)     | Backup, restore, migration, and data lifecycle operations          |
| [`maintenance/`](maintenance/)             | Planned operational tasks and routine maintenance procedures       |
| [`reference/`](reference/)                 | Lookup tables, dependency maps, and environment reference material |

## Usage

1. Identify your situation using the tree above.
2. Open the relevant subdirectory and select the specific runbook.
3. Follow each step in order. Do not skip verification steps.
4. After resolving, update the incident timeline and run post-mortem if severity warrants it.

All runbooks assume you are running commands from the project root and have the `just` command available.
