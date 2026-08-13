/**
 * Connection management — health checks and circuit breaker.
 */

import type { S3Client } from '@aws-sdk/client-s3'
import { HeadBucketCommand } from '@aws-sdk/client-s3'

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------

export interface HealthCheckResult {
  /** Whether the bucket is reachable. */
  healthy: boolean
  /** Bucket name. */
  bucket: string
  /** Region reported by S3. */
  region?: string
  /** Latency in milliseconds. */
  latencyMs?: number
  /** Error message if unhealthy. */
  error?: string
}

/**
 * Verify that the configured bucket exists and is accessible.
 */
export async function checkHealth(client: S3Client, bucket: string): Promise<HealthCheckResult> {
  const start = performance.now()
  try {
    const result = await client.send(new HeadBucketCommand({ Bucket: bucket }))
    const latencyMs = performance.now() - start
    return {
      healthy: true,
      bucket,
      region: result.$metadata.httpStatusCode === 200 ? undefined : undefined,
      latencyMs: Math.round(latencyMs),
    }
  } catch (err) {
    const latencyMs = performance.now() - start
    return {
      healthy: false,
      bucket,
      latencyMs: Math.round(latencyMs),
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerConfig {
  /** Number of failures before opening the circuit. */
  failureThreshold: number
  /** Duration in ms to keep the circuit open before trying half-open. */
  resetTimeout: number
  /** Number of successes in half-open state needed to close the circuit. */
  successThreshold: number
}

const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  resetTimeout: 30_000,
  successThreshold: 2,
}

export class CircuitBreaker {
  private state: CircuitState = 'closed'
  private failureCount = 0
  private successCount = 0
  private lastFailureTime = 0
  private readonly config: CircuitBreakerConfig

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CIRCUIT_CONFIG, ...config }
  }

  /** Current circuit state. */
  getState(): CircuitState {
    if (this.state === 'open') {
      const elapsed = Date.now() - this.lastFailureTime
      if (elapsed >= this.config.resetTimeout) {
        this.state = 'half-open'
        this.successCount = 0
      }
    }
    return this.state
  }

  /** Whether a request is allowed to proceed. */
  isAllowed(): boolean {
    const state = this.getState()
    return state === 'closed' || state === 'half-open'
  }

  /** Record a successful operation. */
  recordSuccess(): void {
    if (this.state === 'half-open') {
      this.successCount++
      if (this.successCount >= this.config.successThreshold) {
        this.state = 'closed'
        this.failureCount = 0
        this.successCount = 0
      }
    } else {
      this.failureCount = 0
    }
  }

  /** Record a failed operation. */
  recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = Date.now()
    if (this.state === 'half-open' || this.failureCount >= this.config.failureThreshold) {
      this.state = 'open'
    }
  }

  /** Force-reset the circuit to closed state. */
  reset(): void {
    this.state = 'closed'
    this.failureCount = 0
    this.successCount = 0
  }
}
