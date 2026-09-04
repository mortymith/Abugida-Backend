/**
 * Unit tests for stream utilities.
 */

import { describe, test, expect } from 'bun:test'
import {
  streamToBuffer,
  bufferToStream,
  toReadableStream,
  getBodyLength,
} from '../../src/utils/stream.ts'

describe('Stream utilities', () => {
  test('bufferToStream and streamToBuffer round-trip', async () => {
    const original = new Uint8Array([1, 2, 3, 4, 5])
    const stream = bufferToStream(original)
    const result = await streamToBuffer(stream)
    expect(result).toEqual(original)
  })

  test('toReadableStream handles Uint8Array', () => {
    const stream = toReadableStream(new Uint8Array([1, 2, 3]))
    expect(stream).toBeInstanceOf(ReadableStream)
  })

  test('toReadableStream handles string', () => {
    const stream = toReadableStream('hello')
    expect(stream).toBeInstanceOf(ReadableStream)
  })

  test('toReadableStream handles ArrayBuffer', () => {
    const stream = toReadableStream(new ArrayBuffer(8))
    expect(stream).toBeInstanceOf(ReadableStream)
  })

  test('toReadableStream passes through ReadableStream', () => {
    const original = new ReadableStream()
    const stream = toReadableStream(original)
    expect(stream).toBe(original)
  })

  test('getBodyLength returns length for Uint8Array', () => {
    expect(getBodyLength(new Uint8Array(42))).toBe(42)
  })

  test('getBodyLength returns length for ArrayBuffer', () => {
    expect(getBodyLength(new ArrayBuffer(16))).toBe(16)
  })

  test('getBodyLength returns undefined for ReadableStream', () => {
    expect(getBodyLength(new ReadableStream())).toBeUndefined()
  })
})
