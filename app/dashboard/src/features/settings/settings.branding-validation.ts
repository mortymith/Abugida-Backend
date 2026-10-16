/**
 * S-6.4 Branding validation (spec 08 § S-6.4). Live contrast validation
 * for primary color, bounded custom CSS validation.
 */

/** WCAG 2.2 AA minimum contrast ratio for white text on a color. */
export const MIN_CONTRAST_RATIO = 4.5

/**
 * Compute the relative luminance of a hex color.
 */
function relativeLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/**
 * Compute the contrast ratio between a hex color and white text.
 * Returns a number like 5.70 (for #7c3aed).
 */
export function computeContrastRatio(hexColor: string): number {
  const lum = relativeLuminance(hexColor)
  const whiteLum = 1.0
  const lighter = Math.max(lum, whiteLum)
  const darker = Math.min(lum, whiteLum)
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100
}

/**
 * Whether the contrast ratio passes WCAG 2.2 AA (4.5:1).
 */
export function isContrastPassing(ratio: number): boolean {
  return ratio >= MIN_CONTRAST_RATIO
}

/**
 * Auto-adjust a hex color to the nearest passing contrast ratio against
 * white text. Darkens the color until it passes.
 */
export function autoAdjustToPassing(hexColor: string): string {
  let r = parseInt(hexColor.slice(1, 3), 16)
  let g = parseInt(hexColor.slice(3, 5), 16)
  let b = parseInt(hexColor.slice(5, 7), 16)
  while (
    !isContrastPassing(
      computeContrastRatio(
        `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
      ),
    )
  ) {
    r = Math.max(0, r - 8)
    g = Math.max(0, g - 8)
    b = Math.max(0, b - 8)
    if (r === 0 && g === 0 && b === 0) break
  }
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
}

/**
 * The contrast label for the UI: "white on this: 5.70:1 ✔"
 */
export function contrastLabel(hexColor: string): string {
  const ratio = computeContrastRatio(hexColor)
  const pass = isContrastPassing(ratio)
  return `white on this: ${ratio.toFixed(2)}:1 ${pass ? '✔' : '✖'}`
}

/**
 * The rejection message when contrast is below 4.5:1.
 */
export function contrastRejectionMessage(hexColor: string): string {
  const ratio = computeContrastRatio(hexColor)
  return `White text on this colour is ${ratio.toFixed(1)}:1 — pick a darker shade`
}

// ── Custom CSS validation ──────────────────────────────────────────────────

export interface CssRejection {
  readonly line: number
  readonly declaration: string
  readonly reason: string
}

/**
 * Validate custom CSS. The spec: "The field accepts only CSS custom-
 * property declarations matching /^--[a-z0-9-]+\s*:/". !important and
 * bare selectors are rejected with line numbers."
 */
export function validateCustomCss(css: string): { valid: boolean; rejections: CssRejection[] } {
  const rejections: CssRejection[] = []
  const lines = css.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    const trimmed = lines[i].trim()
    // Skip empty lines and comments
    if (trimmed === '' || trimmed.startsWith('/*') || trimmed.endsWith('*/')) continue

    // Reject !important
    if (trimmed.includes('!important')) {
      rejections.push({ line: lineNum, declaration: trimmed, reason: '!important is not allowed' })
      continue
    }

    // Reject bare selectors (element, class, id — anything not a custom property)
    if (!trimmed.startsWith('--')) {
      rejections.push({
        line: lineNum,
        declaration: trimmed,
        reason: 'bare selectors are not allowed — only design tokens (--token: value;)',
      })
      continue
    }

    // Validate the custom-property declaration format
    if (!/^--[a-z0-9-]+\s*:/.test(trimmed)) {
      rejections.push({
        line: lineNum,
        declaration: trimmed,
        reason: 'invalid custom-property declaration',
      })
      continue
    }
  }

  return { valid: rejections.length === 0, rejections }
}

/**
 * Format rejections for the UI. "Rejected: line 3 — !important is not allowed"
 */
export function formatRejections(rejections: CssRejection[]): string[] {
  return rejections.map((r) => `Rejected: line ${r.line} — ${r.reason}`)
}
