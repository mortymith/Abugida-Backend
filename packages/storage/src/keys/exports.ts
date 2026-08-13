/**
 * Export-related storage key generators.
 *
 * Key structure:
 * ```
 * exports/{exportId}/data.{json|csv}
 * ```
 */

/** Generate the base key for an export directory. */
export function exportKey(exportId: string): string {
  return `exports/${exportId}`
}

/** Generate the key for an export data file. */
export function exportData(exportId: string, format: 'json' | 'csv' = 'json'): string {
  return `exports/${exportId}/data.${format}`
}
