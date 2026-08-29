# Runbook: MinIO Data Unreachable

## Symptoms

- MinIO health or liveness probes fail.
- Applications report S3-compatible API errors (`NoSuchKey`, `AccessDenied`, or connection timeouts).
- SigNoz object-storage traces show gaps.

## Impact

- Any service storing or retrieving objects (backups, artifacts, trace storage) is unable to read or write data. If CRR (Cross-Cluster Replication) was active, replication queue may back up.

## Diagnosis

1. Check MinIO container status:

   ```bash
   docker ps -a --filter "name=infra_minio"
   ```

2. Review MinIO logs for disk errors, permission issues, or OOM:

   ```bash
   just logs minio
   ```

3. Check available disk space on the MinIO data volume:

   ```bash
   docker exec infra_minio-1 df -h /data
   ```

4. Verify the `mc` alias is functional and can reach the endpoint:

   ```bash
   docker exec infra_minio-1 mc alias list
   ```

5. Test a simple bucket operation:

   ```bash
   docker exec infra_minio-1 mc ls minio/
   ```

6. If cross-cluster replication is configured, check the CRR status of affected buckets:

   ```bash
   docker exec infra_minio-1 mc replicate info minio/<bucket-name>
   ```

## Resolution

1. If disk space is full, expand the volume or clear old objects:

   ```bash
   docker exec infra_minio-1 mc rm --recursive --older-than 30d minio/backups/
   ```

2. If permissions are incorrect on the data directory, fix them:

   ```bash
   docker exec infra_minio-1 chown -R 1000:1000 /data
   ```

3. Restart MinIO to recover from a crash loop:

   ```bash
   just restart minio
   ```

4. If CRR is stalled, resync the remote bucket:

   ```bash
   docker exec infra_minio-1 mc replicate resync minio/<bucket-name>
   ```

## Verification

1. Confirm the MinIO health endpoint responds:

   ```bash
   curl -s -o /dev/null -w '%{http_code}' http://localhost:9000/minio/health/live
   ```

2. Run the full health suite:

   ```bash
   just health
   ```

3. Confirm dependent services (API, SigNoz) are no longer logging S3 errors:

   ```bash
   just logs api | tail -20
   ```
