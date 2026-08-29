# PowerSync Sync Lag

## Symptoms

- Client applications display stale data despite local changes appearing committed.
- PowerSync health endpoint (`/health`) returns OK, but sync lag continues to grow.

## Impact

Clients fall out of sync with the source of truth. Offline caches become stale, potentially leading to data conflicts or incorrect application state. Prolonged lag also risks WAL bloat on the primary.

## Diagnosis

1. `just ps-status` — confirm the container is running and healthy.
2. `just ps-slot-lag` — check `lag_bytes` and whether the slot is marked `active`. Rising lag with `active=true` indicates the service is alive but falling behind; `active=false` means the replication connection has dropped.
3. `just disk-usage` — inspect WAL volume on the primary. Rapid WAL growth combined with an inactive slot confirms the slot is retaining segments.
4. `just ps-logs sync` — search for replication errors, connection resets, or OOM kills.

## Resolution

1. `just ps-restart` — a clean restart usually re-establishes the replication connection and resumes consumption.
2. If lag persists, check PostgreSQL load with `docker stats` to rule out primary saturation.
3. **Last resort only** — if the slot is inactive and lag is massive, drop and recreate the replication slot. **Warning:** this destroys sync state. All clients must perform a full re-sync afterwards.

## Verification

Run `just ps-slot-lag`. Confirm `lag_bytes` is near 0 and `active=true`. Spot-check client applications to verify they reflect recent database changes.
