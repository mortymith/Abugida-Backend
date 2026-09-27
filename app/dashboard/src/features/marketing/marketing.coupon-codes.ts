/**
 * Coupon code generation and single-use batch CSV (spec 10 S-8.3) — pure
 * module. Codes exclude visually ambiguous characters (0/O, 1/I/L) and are
 * always produced uppercase; the table displays them uppercase and checkout
 * matches case-insensitively.
 */

export const COUPON_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export const COUPON_CODE_MIN_LENGTH = 6
export const COUPON_CODE_MAX_LENGTH = 40

/** Spec example generates 500 codes; capped to keep a single request sane. */
export const MAX_BATCH_SIZE = 1_000

export function randomCodePart(length: number, random: () => number = Math.random): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += COUPON_ALPHABET[Math.floor(random() * COUPON_ALPHABET.length)]
  }
  return out
}

export interface BatchCodeOptions {
  /** Optional partner prefix, e.g. `ACME` → `ACME-a3f8k2`. */
  prefix?: string
  /** Random part length (default 6 → ~34^6 space). */
  length?: number
  /** Deterministic random for tests. */
  random?: () => number
}

/**
 * Generate `count` unique codes. Uniqueness is guaranteed by rejection — the
 * caller additionally relies on the DB unique index for concurrent runs.
 */
export function generateCouponCodes(count: number, options: BatchCodeOptions = {}): string[] {
  if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH_SIZE) {
    throw new Error(`INVALID_BATCH_SIZE:count must be between 1 and ${MAX_BATCH_SIZE}`)
  }
  const length = options.length ?? 6
  if (!Number.isInteger(length) || length < 4 || length > 12) {
    throw new Error('INVALID_CODE_LENGTH:length must be between 4 and 12')
  }
  const prefix = options.prefix?.replace(/[^A-Za-z0-9]/g, '').toUpperCase() ?? ''
  const random = options.random ?? Math.random
  const maxAttempts = count * 20
  const codes = new Set<string>()
  let attempts = 0
  while (codes.size < count) {
    if (attempts++ > maxAttempts) {
      throw new Error('CODE_SPACE_EXHAUSTED:increase the code length')
    }
    const body = randomCodePart(length, random)
    codes.add(prefix ? `${prefix}-${body}` : body)
  }
  return [...codes]
}

/** Normalize user/partner input into the canonical stored form. */
export function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase()
}

export interface CouponCsvOptions {
  expiresAt?: string | null
}

/** Minimal CSV for distribution partners (spec: export single-use batches). */
export function buildCouponCsv(codes: string[], options: CouponCsvOptions = {}): string {
  const header = options.expiresAt ? 'code,expires_at' : 'code'
  const lines = [header]
  for (const code of codes) {
    // Codes are generated from a safe alphabet so quoting is unnecessary,
    // but guard anyway — the file leaves the system.
    const safe = normalizeCouponCode(code)
    if (!/^[A-Z0-9-]+$/.test(safe)) throw new Error(`INVALID_CSV_CODE:${code}`)
    lines.push(options.expiresAt ? `${safe},${options.expiresAt}` : safe)
  }
  return `${lines.join('\n')}\n`
}
