/**
 * Checksum calculation (SHA-256) for upload integrity verification.
 */

/**
 * Calculate the SHA-256 checksum of a Uint8Array.
 *
 * Uses the Web Crypto API (available in Bun and modern browsers).
 * Returns a base64-encoded hash suitable for S3's `ChecksumSHA256`.
 */
export async function calculateChecksum(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer)
  return bufferToBase64(new Uint8Array(hash))
}

/**
 * Calculate the SHA-256 checksum of a ReadableStream.
 *
 * Reads the entire stream into memory — use only for reasonably-sized
 * files. For large files, prefer client-side hash computation during
 * the upload process.
 */
export async function calculateStreamChecksum(stream: ReadableStream<Uint8Array>): Promise<string> {
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

  return calculateChecksum(buffer)
}

/**
 * Calculate the SHA-256 hex digest of a Uint8Array.
 *
 * Returns a hex-encoded string (e.g. for comparison or logging).
 */
export async function calculateChecksumHex(data: Uint8Array): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer)
  return bufferToHex(new Uint8Array(hash))
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function bufferToBase64(buffer: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < buffer.byteLength; i++) {
    binary += String.fromCharCode(buffer[i]!)
  }
  return btoa(binary)
}

function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
