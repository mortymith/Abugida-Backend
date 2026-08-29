# Runbook: Unauthorized Access

## Symptoms

- Unusual IP addresses or user agents in Docker logs.
- Vault audit log shows access from unexpected client IPs or tokens.
- Redis or Postgres connection attempts from unknown hosts.
- Alert from IDS/IPS or Cloudflare WAF indicating malicious traffic.

## Impact

- Depends on the level of access gained. Database access could mean data exfiltration or modification. Container access could mean lateral movement across the stack. Immediate containment is critical.

## Diagnosis

1. Search Docker logs for suspicious access patterns across all services:

   ```bash
   just logs postgres-primary | rg -i "authentication\|connection.*refused\|fatal"
   just logs redis-primary | rg -i "unauth\|acl\|denied"
   just logs vault | rg -i "login\|access.*denied\|token"
   just logs api | rg -i "401\|403\|forbidden"
   ```

2. Review Vault audit logs for unauthorized access attempts:

   ```bash
   docker exec infra_vault-1 vault audit list -detailed
   ```

3. Check Redis ACL for unexpected users:

   ```bash
   docker exec infra_redis-primary-1 redis-cli ACL LIST
   ```

4. Check Postgres `pg_hba.conf` for overly permissive rules:

   ```bash
   docker exec infra_postgres-primary-1 cat /var/lib/postgresql/data/pg_hba.conf
   ```

5. Review the current firewall state:

   ```bash
   just firewall-status
   ```

## Resolution

1. Immediately block the offending IP address at the host firewall:

   ```bash
   sudo iptables -A INPUT -s <attacker-ip> -j DROP
   ```

2. Rotate all credentials that may have been exposed:

   ```bash
   just rotate-secrets --db && just rotate-secrets --redis && just rotate-secrets --api
   ```

3. Tighten `pg_hba.conf` to restrict connections to known CIDR ranges only, then restart:

   ```bash
   just restart postgres-primary
   ```

4. Review and tighten Redis ACL rules to remove any default or overly permissive entries.

5. Restart all services to enforce the new credentials:

   ```bash
   just restart api && just restart dashboard && just restart marketing
   ```

6. Restore the firewall to its known-good baseline:

   ```bash
   just firewall-restore
   ```

## Verification

1. Confirm the blocked IP is no longer reaching any container:

   ```bash
   sudo iptables -L INPUT -n | rg "<attacker-ip>"
   ```

2. Validate secrets are consistent:

   ```bash
   just validate-secrets
   ```

3. Confirm all services are healthy and logging normal traffic:

   ```bash
   just health
   ```

4. Escalate to the security team for forensic review of logs and potential data exposure.
