/**
 * Temporary storage key generators.
 *
 * Key structure:
 * ```
 * temp/{sessionId}/{filename}
 * ```
 */

/** Generate the base key for a temp session directory. */
export function temp(sessionId: string): string {
  return `temp/${sessionId}`
}

/** Generate the key for a temp file within a session. */
export function tempFile(sessionId: string, filename: string): string {
  return `temp/${sessionId}/${filename}`
}

/** List prefix for all files in a temp session. */
export function tempPrefix(sessionId: string): string {
  return `temp/${sessionId}/`
}
