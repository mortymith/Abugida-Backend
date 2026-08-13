/**
 * Stream utilities for processing large files efficiently.
 */

/**
 * Convert a `ReadableStream<Uint8Array>` into a single `Uint8Array`.
 * Use sparingly — prefer streaming when possible.
 */
export async function streamToBuffer(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let totalLength = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    totalLength += value.byteLength
  }

  const buffer = new Uint8Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    buffer.set(chunk, offset)
    offset += chunk.byteLength
  }

  return buffer
}

/**
 * Create a `ReadableStream<Uint8Array>` from a `Uint8Array`.
 */
export function bufferToStream(buffer: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(buffer)
      controller.close()
    },
  })
}

/**
 * Get the total byte length of a stream without consuming it.
 * Returns a new stream plus the computed length.
 */
export async function measureStream(
  stream: ReadableStream<Uint8Array>,
): Promise<{ length: number; stream: ReadableStream<Uint8Array> }> {
  const [branch1, branch2] = stream.tee()
  let length = 0
  const reader = branch1.getReader()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    length += value.byteLength
  }

  return { length, stream: branch2 }
}

/**
 * Split a stream into fixed-size chunks for multipart upload.
 *
 * @param stream - The source stream.
 * @param partSize - Minimum size of each part in bytes (last part may be smaller).
 * @yields `Uint8Array` chunks.
 */
export async function* chunkStream(
  stream: ReadableStream<Uint8Array>,
  partSize: number,
): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader()
  let buffer = new Uint8Array(0)

  while (true) {
    const { done, value } = await reader.read()
    if (!done && value) {
      // Append incoming data to buffer
      const merged = new Uint8Array(buffer.byteLength + value.byteLength)
      merged.set(buffer, 0)
      merged.set(value, buffer.byteLength)
      buffer = merged
    }

    // Yield complete parts
    while (buffer.byteLength >= partSize) {
      yield buffer.slice(0, partSize)
      buffer = buffer.slice(partSize)
    }

    if (done) break
  }

  // Yield remaining data as the final part
  if (buffer.byteLength > 0) {
    yield buffer
  }
}

/**
 * Convert various body types to a `ReadableStream<Uint8Array>`.
 */
export function toReadableStream(body: unknown): ReadableStream<Uint8Array> {
  if (body instanceof ReadableStream) {
    return body as ReadableStream<Uint8Array>
  }
  if (body instanceof Uint8Array) {
    return bufferToStream(body)
  }
  if (body instanceof ArrayBuffer) {
    return bufferToStream(new Uint8Array(body))
  }
  if (typeof body === 'string') {
    return bufferToStream(new TextEncoder().encode(body))
  }
  if (body instanceof Blob) {
    return body.stream() as ReadableStream<Uint8Array>
  }
  throw new Error(`Unsupported body type: ${typeof body}`)
}

/**
 * Get byte length of a body input without fully reading it.
 * Returns `undefined` if the length cannot be determined without reading.
 */
export function getBodyLength(body: unknown): number | undefined {
  if (body instanceof Uint8Array) return body.byteLength
  if (body instanceof ArrayBuffer) return body.byteLength
  if (typeof body === 'string') return new TextEncoder().encode(body).byteLength
  if (body instanceof Blob) return body.size
  // ReadableStream requires reading to determine length
  return undefined
}
