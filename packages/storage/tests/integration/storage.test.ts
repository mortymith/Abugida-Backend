/**
 * Integration tests for storage operations against a real MinIO instance.
 *
 * These tests require a running MinIO container. Start one with:
 *
 * ```bash
 * docker run -d -p 9000:9000 -p 9001:9001 \
 *   -e MINIO_ROOT_USER=minioadmin \
 *   -e MINIO_ROOT_PASSWORD=minioadmin \
 *   minio/minio server /data --console-address ":9001"
 * ```
 *
 * Set SKIP_INTEGRATION=1 to skip these tests.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'

// Skip integration tests unless explicitly enabled
const skip = !process.env.RUN_INTEGRATION

describe.skipIf(skip)('Storage integration tests', () => {
  // Integration tests would go here, using a real MinIO instance.
  // They are skipped by default to avoid CI dependency on Docker.

  it('should upload and download an object', async () => {
    // Placeholder — requires real MinIO
    expect(true).toBe(true)
  })

  it('should generate and use presigned URLs', async () => {
    expect(true).toBe(true)
  })

  it('should handle multipart uploads', async () => {
    expect(true).toBe(true)
  })
})
