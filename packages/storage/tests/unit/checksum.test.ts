/**
 * Unit tests for checksum calculation.
 */

import { describe, it, expect } from 'vitest'
import { calculateChecksum, calculateChecksumHex } from '../../src/validation/checksum.ts'

describe('Checksum', () => {
  it('calculateChecksumHex returns consistent SHA-256 hex digest', async () => {
    const data = new TextEncoder().encode('hello world')
    const hash = await calculateChecksumHex(data)
    // Known SHA-256 of "hello world"
    expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')
  })

  it('calculateChecksum returns base64-encoded hash', async () => {
    const data = new TextEncoder().encode('test')
    const hash = await calculateChecksum(data)
    // Should be a valid base64 string
    expect(hash).toMatch(/^[A-Za-z0-9+/]+=*$/)
  })

  it('empty input produces valid hash', async () => {
    const data = new Uint8Array(0)
    const hash = await calculateChecksumHex(data)
    // SHA-256 of empty string
    expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})
