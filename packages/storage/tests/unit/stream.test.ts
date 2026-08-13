/**
 * Unit tests for stream utilities.
 */

import { describe, it, expect } from 'vitest'
import {
  streamToBuffer,
  bufferToStream,
  toReadableStream,
  getBodyLength,
} from '../../src/utils/stream.ts'

describe('Stream utilities', () => {
  it('bufferToStream and streamToBuffer round-trip', async () => {
    const original = new Uint8Array([1, 2, 3, 4, 5])
    const stream = bufferToStream(original)
    const result = await streamToBuffer(stream)
    expect(result).toEqual(original)
  })

  it('toReadableStream handles Uint8Array', () => {
    const stream = toReadableStream(new Uint8Array([1, 2, 3]))
    expect(stream).toBeInstanceOf(ReadableStream)
  })

  it('toReadableStream handles string', () => {
    const stream = toReadableStream('hello')
    expect(stream).toBeInstanceOf(ReadableStream)
  })

  it('toReadableStream handles ArrayBuffer', () => {
    const stream = toReadableStream(new ArrayBuffer(8))
    expect(stream).toBeInstanceOf(ReadableStream)
  })

  it('toReadableStream passes through ReadableStream', () => {
    const original = new ReadableStream()
    const stream = toReadableStream(original)
    expect(stream).toBe(original)
  })

  it('getBodyLength returns length for Uint8Array', () => {
    expect(getBodyLength(new Uint8Array(42))).toBe(42)
  })

  it('getBodyLength returns length for ArrayBuffer', () => {
    expect(getBodyLength(new ArrayBuffer(16))).toBe(16)
  })

  it('getBodyLength returns undefined for ReadableStream', () => {
    expect(getBodyLength(new ReadableStream())).toBeUndefined()
  })
})
