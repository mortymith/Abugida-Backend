/**
 * Pure URL extraction for the reference audit — spec 12 § 9.4.
 *
 * The DB-backed `auditImageAssetsImpl` and the network-backed
 * `auditLinkReachabilityImpl` live in `courses.reference-audit.impl.server.ts`
 * and pull in the database client + auth config. The extractors themselves are
 * pure: they take a Markdown string and return URLs with 1-based line numbers.
 *
 * Splitting them into this file lets `bun test` exercise them without booting
 * the server env, and lets the editor import them client-side for the
 * click-to-jump UI without dragging the server impl into the client bundle.
 */

/** Advisory code: an image's media asset is missing or archived. */
export const ASSET_MISSING = 'ASSET_MISSING' as const
/** Advisory code: a link's host failed a HEAD check. */
export const LINK_UNREACHABLE = 'LINK_UNREACHABLE' as const

export type ReferenceAuditCode = typeof ASSET_MISSING | typeof LINK_UNREACHABLE

export interface ReferenceAuditFinding {
  code: ReferenceAuditCode
  /** The URL that triggered the finding. */
  url: string
  /** 1-based line number in the Markdown source, for the click-to-jump. */
  line: number
  /** Human-readable message: what is wrong and how to fix it. */
  message: string
}

/**
 * Extract every image URL from a Markdown body, with its 1-based line number.
 * Used by both the asset-missing check and the editor's image-preview hover.
 */
export function extractImageUrls(markdown: string): Array<{ url: string; line: number }> {
  const results: Array<{ url: string; line: number }> = []
  const re = /!\[[^\]]*\]\(([^)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(markdown)) !== null) {
    const url = match[1].trim().split(/\s+/)[0] // strip optional title
    const upTo = markdown.slice(0, match.index)
    const line = upTo.split('\n').length
    results.push({ url, line })
  }
  return results
}

/**
 * Extract every link URL from a Markdown body, with its 1-based line number.
 * Excludes image URLs (which start with `!`). Used by the link-unreachable
 * check.
 */
export function extractLinkUrls(markdown: string): Array<{ url: string; line: number }> {
  const results: Array<{ url: string; line: number }> = []
  // Match [text](url) but NOT ![alt](url). The lookbehind avoids the `!`.
  const re = /(?<!!)\[[^\]]*\]\(([^)]+)\)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(markdown)) !== null) {
    const url = match[1].trim().split(/\s+/)[0]
    // Skip mailto: and relative URLs — they are not HEAD-checkable.
    if (!/^https?:\/\//i.test(url)) continue
    const upTo = markdown.slice(0, match.index)
    const line = upTo.split('\n').length
    results.push({ url, line })
  }
  return results
}
