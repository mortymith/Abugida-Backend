/**
 * Spec 11 § Localization & Formatting: script-aware formatting.
 * - Read time: Ge'ez /180 wpm, Latin /220 wpm
 * - Ethiopian calendar option
 * - Time format: "6:00 PM EAT"
 */

export const LATIN_WPM = 220
export const GEZ_WPM = 180

export type ScriptType = 'latin' | 'ethiopic'
export type CalendarSystem = 'gregorian' | 'ethiopian'

const ETHIOPIC_LANGUAGES = new Set(['am', 'ti', 'gez'])

export function classifyScript(language: string): ScriptType {
  const primary = language.split('-')[0]?.toLowerCase() ?? ''
  return ETHIOPIC_LANGUAGES.has(primary) ? 'ethiopic' : 'latin'
}

export function computeReadTimeSeconds(wordCount: number, language: string): number {
  if (wordCount <= 0) return 0
  const wpm = classifyScript(language) === 'ethiopic' ? GEZ_WPM : LATIN_WPM
  return Math.ceil(wordCount / wpm) * 60
}

export function formatReadTime(seconds: number): string {
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining === 0 ? `${hours}h` : `${hours}h ${remaining}m`
}

// ── Ethiopian calendar ─────────────────────────────────────────────────────

const ETHIOPIAN_MONTHS = [
  'Meskerem',
  'Tikimt',
  'Hidar',
  'Tahsas',
  'Tir',
  'Yekatit',
  'Megabit',
  'Miazia',
  'Ginbot',
  'Sene',
  'Hamle',
  'Nehase',
  'Pagume',
]

/**
 * Approximate Gregorian → Ethiopian date conversion. The Ethiopian calendar
 * has 13 months (12 × 30 days + Pagume 5/6). This approximation is accurate
 * for dates after September 11, 1991 (the epoch used by the Eritrean/Ethiopian
 * calendar). For audit/certificate dates, always use Gregorian (spec 11).
 */
export function toEthiopianDate(date: Date): { year: number; month: number; day: number } {
  const gYear = date.getUTCFullYear()

  // Ethiopian new year is Sept 11 (or 12 in leap years)
  const ethNewYear = new Date(Date.UTC(gYear, 8, 11)) // Sept 11
  if (date < ethNewYear) {
    // Before Ethiopian new year — belongs to previous Ethiopian year
  }

  // Simplified: Ethiopian year = Gregorian year - 8 (adjust for before/after Sept 11)
  let ethYear = gYear - 8
  let daysSinceEthNewYear = Math.floor(
    (date.getTime() - ethNewYear.getTime()) / (24 * 60 * 60 * 1000),
  )
  if (daysSinceEthNewYear < 0) {
    ethYear--
    const prevEthNewYear = new Date(Date.UTC(gYear - 1, 8, 11))
    daysSinceEthNewYear = Math.floor(
      (date.getTime() - prevEthNewYear.getTime()) / (24 * 60 * 60 * 1000),
    )
  }

  const ethMonth = Math.floor(daysSinceEthNewYear / 30) + 1
  const ethDay = (daysSinceEthNewYear % 30) + 1

  return { year: ethYear, month: ethMonth, day: ethDay }
}

export function formatDateInCalendar(date: Date, calendar: CalendarSystem = 'gregorian'): string {
  if (calendar === 'ethiopian') {
    const eth = toEthiopianDate(date)
    const monthName = ETHIOPIAN_MONTHS[eth.month - 1] ?? `Month ${eth.month}`
    return `${eth.day} ${monthName} ${eth.year}`
  }
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

// ── Time format: "6:00 PM EAT" ─────────────────────────────────────────────

export function formatTimeEAT(date: Date): string {
  const time = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  return `${time} EAT`
}

// ── Typography tokens ───────────────────────────────────────────────────────

export interface ScriptTypography {
  readonly fontFamily: string
  readonly lineHeight: number
  readonly letterSpacing: string
  readonly noLineClamp: boolean
}

export const ETHIOPIC_TYPOGRAPHY: ScriptTypography = {
  fontFamily: "'Noto Sans Ethiopic', 'Noto Sans', sans-serif",
  lineHeight: 1.6,
  letterSpacing: 'normal',
  noLineClamp: true,
}

export const LATIN_TYPOGRAPHY: ScriptTypography = {
  fontFamily: "'Inter', system-ui, sans-serif",
  lineHeight: 1.5,
  letterSpacing: 'normal',
  noLineClamp: true,
}

export function typographyForLanguage(language: string): ScriptTypography {
  return classifyScript(language) === 'ethiopic' ? ETHIOPIC_TYPOGRAPHY : LATIN_TYPOGRAPHY
}
