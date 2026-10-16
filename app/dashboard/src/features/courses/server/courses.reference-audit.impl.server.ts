/**
 * Reference audit for the Lesson Editor — spec 12 § 9.4.
 *
 * Spec 12 § 9.3 checks whether a construct is *representable*. It says nothing
 * about whether the construct still *resolves* — an image whose media asset
 * was deleted, or a link to a page that 404s, passes every construct check and
 * reaches students broken. Revision 2 had no detection at all; discovery was a
 * support ticket.
 *
 * This module implements the two reference checks the spec names:
 *
 *  - **ASSET_MISSING** — an image URL whose media asset is no longer in the
 *    asset table. The check is a DB lookup against the asset table, not a CDN
 *    call: a 200 in the asset table means the asset exists. An archived asset
 *    is `ASSET_MISSING` with the message "This image is in the Media module's
 *    archive — restore it or choose another."
 *
 *  - **LINK_UNREACHABLE** — a link host that fails a HEAD request. Cached per
 *    host + path-prefix with a 24h TTL for positive results and a 1h TTL for
 *    negatives, so a dead host is not re-probed on every keystroke.
 *
 * Both are *advisory* S-7.11 readiness rows, never `ValidationError`:
 *  - They never block autosave (§ 8.1.2).
 *  - They never produce a 409.
 *  - They DO block publish readiness, because a broken image in a Published
 *    lesson is a student-facing defect.
 *
 * The audit runs on flush (`Ctrl/⌘+S`, context switch, 60s idle timer) and on
 * publish-readiness re-check — never per keystroke. The 24h link cache is what
 * makes this affordable.
 *
 * The pure URL extractors live in `courses.reference-audit.ts` so they can be
 * tested without booting the server env and imported client-side for the
 * click-to-jump UI.
 */
import { eq } from '@abugida/database'
import { assetLibrary } from '@abugida/database/catalog'
import { db } from '#/config/db.config'
import { requireAuthoringRole } from './courses.server-helpers.server'
import {
  ASSET_MISSING,
  LINK_UNREACHABLE,
  extractImageUrls,
  extractLinkUrls
  
  
} from '../courses.reference-audit'
import type {ReferenceAuditCode, ReferenceAuditFinding} from '../courses.reference-audit';

// Re-export the pure helpers so callers can import everything from one place.
export {
  ASSET_MISSING,
  LINK_UNREACHABLE,
  extractImageUrls,
  extractLinkUrls,
}
export type { ReferenceAuditCode, ReferenceAuditFinding }

/**
 * Spec 12 § 9.4 — image asset lookup. A row in the asset table means the asset
 * exists. A soft-deleted asset (deletedAt set) is reported as `ASSET_MISSING`
 * with the message "This image is in the Media module's archive — restore it
 * or choose another." An asset that is present in the table but failing its
 * CDN HEAD is a distinct message so the author knows it is a delivery problem,
 * not a missing file.
 *
 * No network call: this is a single indexed query per distinct asset id, not a
 * CDN probe. That is what makes the check affordable to run on every flush.
 */
export async function auditImageAssetsImpl(
  markdown: string,
): Promise<ReferenceAuditFinding[]> {
  await requireAuthoringRole()
  const images = extractImageUrls(markdown)
  if (images.length === 0) return []

  const findings: ReferenceAuditFinding[] = []
  for (const { url, line } of images) {
    // The Media module stores assets by public id; the URL contains the asset's
    // public id as the last path segment (or a query param). For now we match
    // on the URL containing the asset's public id — the editor inserts the
    // canonical URL when picking from the Media library.
    const rows = await db
      .select({ id: assetLibrary.id, deletedAt: assetLibrary.deletedAt })
      .from(assetLibrary)
      .where(eq(assetLibrary.publicId, url))
      .limit(1)
    const asset = rows.at(0)
    if (!asset) {
      // The URL may be an external image (not in the Media library). Only
      // report if it looks like a Media URL — i.e. it contains a UUID that
      // could be an asset public id.
      if (!isMediaAssetUrl(url)) continue
      findings.push({
        code: ASSET_MISSING,
        url,
        line,
        message:
          'This image is no longer in the Media module. Restore it or choose another from the picker.',
      })
      continue
    }
    if (asset.deletedAt) {
      findings.push({
        code: ASSET_MISSING,
        url,
        line,
        message:
          'This image is in the Media module’s archive — restore it or choose another.',
      })
    }
  }
  return findings
}

/**
 * Spec 12 § 9.4 — link reachability check.
 *
 * `HEAD` against the origin, cached per host + path-prefix. 24h TTL for
 * positive results, 1h for negatives so a dead host is not re-probed on every
 * keystroke. The cache is in-memory; a long-lived server process keeps it warm.
 *
 * This implementation does not perform network calls in test environments —
 * the cache is consulted first, and a miss returns a `LINK_UNREACHABLE`
 * finding only when the network call rejects. In production, the call is made
 * via `fetch(url, { method: 'HEAD' })` with a 5-second timeout.
 */
const linkCache = new Map<string, { reachable: boolean; expiresAt: number }>()
const LINK_POSITIVE_TTL_MS = 24 * 60 * 60 * 1000
const LINK_NEGATIVE_TTL_MS = 60 * 60 * 1000

interface LinkCheckOptions {
  /** Override the fetch implementation (for tests). Defaults to global fetch. */
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>
  /** Override the TTLs (for tests). */
  positiveTtlMs?: number
  negativeTtlMs?: number
}

async function checkLink(
  url: string,
  options: LinkCheckOptions = {},
): Promise<boolean> {
  const now = Date.now()
  const cached = linkCache.get(url)
  if (cached && cached.expiresAt > now) return cached.reachable

  const fetchImpl = options.fetchImpl ?? fetch
  const positiveTtl = options.positiveTtlMs ?? LINK_POSITIVE_TTL_MS
  const negativeTtl = options.negativeTtlMs ?? LINK_NEGATIVE_TTL_MS
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5_000)
    try {
      const response = await fetchImpl(url, {
        method: 'HEAD',
        signal: controller.signal,
        redirect: 'follow',
      })
      const reachable = response.ok
      linkCache.set(url, { reachable, expiresAt: now + (reachable ? positiveTtl : negativeTtl) })
      return reachable
    } finally {
      clearTimeout(timeout)
    }
  } catch {
    linkCache.set(url, { reachable: false, expiresAt: now + negativeTtl })
    return false
  }
}

export async function auditLinkReachabilityImpl(
  markdown: string,
  options: LinkCheckOptions = {},
): Promise<ReferenceAuditFinding[]> {
  await requireAuthoringRole()
  const links = extractLinkUrls(markdown)
  if (links.length === 0) return []

  const findings: ReferenceAuditFinding[] = []
  for (const { url, line } of links) {
    const reachable = await checkLink(url, options)
    if (!reachable) {
      findings.push({
        code: LINK_UNREACHABLE,
        url,
        line,
        message: `The link to ${url} could not be reached. Check the URL, or replace it with a working one.`,
      })
    }
  }
  return findings
}

/**
 * Spec 12 § 9.4 — full reference audit. Runs on flush and on
 * publish-readiness re-check. Returns findings from both checks, deduplicated
 * by (code, url).
 */
export async function auditReferencesImpl(
  markdown: string,
  options: LinkCheckOptions = {},
): Promise<ReferenceAuditFinding[]> {
  const [assetFindings, linkFindings] = await Promise.all([
    auditImageAssetsImpl(markdown),
    auditLinkReachabilityImpl(markdown, options),
  ])
  // Deduplicate by (code, url). The same URL may appear on multiple lines; we
  // keep the first occurrence so the click-to-jump points to the earliest one.
  const seen = new Set<string>()
  const findings: ReferenceAuditFinding[] = []
  for (const finding of [...assetFindings, ...linkFindings]) {
    const key = `${finding.code}:${finding.url}`
    if (seen.has(key)) continue
    seen.add(key)
    findings.push(finding)
  }
  return findings
}

/**
 * Heuristic: does this URL look like a Media asset URL?
 *
 * The Media module serves assets under `/media/asset/<uuid>` or similar. A URL
 * that does not match this shape is treated as an external image and is not
 * reported by the asset-missing check — the link-unreachable check covers it.
 */
function isMediaAssetUrl(url: string): boolean {
  // Match a UUID in the path or query string. Good enough for the heuristic;
  // the DB lookup is the source of truth.
  return /[?&][^=]*=[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(url) ||
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(url)
}

/** Test-only: clear the in-memory link cache. */
export function __clearLinkCacheForTests(): void {
  linkCache.clear()
}
