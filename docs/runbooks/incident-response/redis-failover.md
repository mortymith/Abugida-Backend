# Runbook: Redis Failover

## Symptoms

- `redis-cli ping` returns no response or an error.
- Sentinel logs report `+sdown` or `+odown` for the current master.
- Applications report Redis connection timeouts or failover-related reconnects.

## Impact

- Session data, caching, and any pub/sub functionality are interrupted during the failover window. Depending on replication lag, a small amount of data may be lost if `appendonly` was not enabled or the replica was behind.

## Diagnosis

1. Run the global health check to identify the failing Redis node:

   ```bash
   just health
   ```

2. Check the container status of the primary, replicas, and sentinels:

   ```bash
   docker ps -a --filter "name=infra_redis"
   ```

3. Query Sentinel for the current master address:

   ```bash
   docker exec infra_redis-sentinel-1 redis-cli -p 26379 SENTINEL GET-MASTER-ADDR-BY-NAME mymaster
   ```

4. Check replication info on the newly promoted master:

   ```bash
   docker exec infra_redis-primary-1 redis-cli INFO replication
   ```

5. Verify Redis ACL rules if auth errors appear:

   ```bash
   docker exec infra_redis-primary-1 redis-cli ACL LIST
   ```

## Resolution

1. If Sentinel has already promoted a replica, verify the new primary is writable:

   ```bash
   docker exec infra_redis-primary-1 redis-cli SET healthcheck 1
   ```

2. If no automatic failover occurred, manually promote a replica:

   ```bash
   docker exec infra_redis-sentinel-1 redis-cli -p 26379 SENTINEL FAILOVER mymaster
   ```

3. If a replica is out of sync or stale, reconfigure it to replicate from the new primary:

   ```bash
   docker exec infra_redis-replica-1 redis-cli REPLICAOF <new-primary-ip> 6379
   ```

4. If Redis is completely down, restart all Redis services in order: sentinels first, then replicas, then primary:

   ```bash
   just restart redis-sentinel && just restart redis-replica && just restart redis-primary
   ```

## Verification

1. Confirm PING succeeds on the primary:

   ```bash
   docker exec infra_redis-primary-1 redis-cli PING
   ```

2. Confirm Sentinel recognizes the correct master:

   ```bash
   docker exec infra_redis-sentinel-1 redis-cli -p 26379 SENTINEL GET-MASTER-ADDR-BY-NAME mymaster
   ```

3. Verify applications reconnected:

   ```bash
   just logs api | tail -20
   ```

4. Run full health:

   ```bash
   just health
   ```
