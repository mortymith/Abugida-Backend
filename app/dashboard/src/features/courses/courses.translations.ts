/**
 * Lesson Translations variant management (spec 04 § S-2.7 → Lesson Editor
 * → Translations sub-tab).
 *
 * The Translations sub-tab lets an author translate a lesson's body and
 * title into the other supported content languages (`en`, `am`, `ti`,
 * `gez`). The base variant lives on `lessons` itself; translation
 * variants live in `lesson_variants`.
 *
 * Key rules:
 *
 * 1. **One variant per language per lesson.** Unique on
 *    `(lesson_id, language)`.
 * 2. **The base variant is the source of truth for readiness.** RC-4a/b/c
 *    evaluate only the base variant — an untranslated variant is an
 *    *advisory* exemption, never a blocker.
 * 3. **The untranslated flag.** A language with no variant shows an
 *    "Untranslated" flag in the sub-tab. The flag is advisory — it does
 *    not block publishing.
 * 4. **Per-item `language` override.** `lessons.language` overrides
 *    `courses.content_language` for the base variant. A variant in the
 *    same language as the base is redundant and rejected.
 *
 * This module is framework-free: it owns the variant set model, the
 * untranslated-flag computation, and the redundancy check.
 */

import type { CourseContentLanguage, LessonLanguage } from '@abugida/database/catalog'

export const SUPPORTED_CONTENT_LANGUAGES: readonly (CourseContentLanguage | LessonLanguage)[] = [
  'en',
  'am',
  'ti',
  'gez',
]

export const CONTENT_LANGUAGE_LABELS: Record<CourseContentLanguage | LessonLanguage, string> = {
  en: 'English',
  am: 'አማርኛ (Amharic)',
  ti: 'ትግርኛ (Tigrinya)',
  gez: 'ግዕዝ (Geʻez)',
}

export interface LessonVariantSummary {
  readonly language: CourseContentLanguage | LessonLanguage
  readonly title: string
  readonly updatedAt: number
  readonly updatedBy: string | null
}

export interface TranslationsModel {
  readonly baseLanguage: CourseContentLanguage | LessonLanguage
  readonly variants: readonly LessonVariantSummary[]
}

export interface UntranslatedLanguage {
  readonly language: CourseContentLanguage | LessonLanguage
  readonly label: string
}

/**
 * Compute the list of untranslated languages — languages that have no
 * variant AND are not the base language. The spec calls for an
 * "Untranslated" flag on each of these in the sub-tab.
 *
 * The base language is never "untranslated" — it is the source. A variant
 * in the base language is redundant and rejected (see `canAddVariant`).
 */
export function untranslatedLanguages(model: TranslationsModel): UntranslatedLanguage[] {
  const variantLanguages = new Set(model.variants.map((v) => v.language))
  return SUPPORTED_CONTENT_LANGUAGES.filter(
    (lang) => lang !== model.baseLanguage && !variantLanguages.has(lang),
  ).map((lang) => ({ language: lang, label: CONTENT_LANGUAGE_LABELS[lang] }))
}

/**
 * Whether a variant can be added for `language`. A variant is rejected
 * when:
 * - The language is the base language (redundant — the base variant
 *   already covers it).
 * - A variant for that language already exists (unique constraint).
 */
export function canAddVariant(
  model: TranslationsModel,
  language: CourseContentLanguage | LessonLanguage,
): { permitted: boolean; reason: string | null } {
  if (language === model.baseLanguage) {
    return {
      permitted: false,
      reason: `This is the base language (${CONTENT_LANGUAGE_LABELS[language]}). Edit the lesson body directly to change it.`,
    }
  }
  if (model.variants.some((v) => v.language === language)) {
    return {
      permitted: false,
      reason: `A ${CONTENT_LANGUAGE_LABELS[language]} translation already exists. Edit it instead.`,
    }
  }
  return { permitted: true, reason: null }
}

/**
 * The effective language for the base variant. If `lessons.language` is
 * set, it overrides `courses.content_language`; otherwise the course's
 * content language is the base.
 */
export function resolveBaseLanguage(
  lessonLanguage: LessonLanguage | null,
  courseContentLanguage: CourseContentLanguage,
): CourseContentLanguage | LessonLanguage {
  return lessonLanguage ?? courseContentLanguage
}

/**
 * Whether the translation coverage is "complete" — every supported
 * language has a variant (or is the base). The spec does not block
 * publishing on incomplete coverage (advisory exemption), but the
 * sub-tab shows a coverage summary.
 */
export function isCoverageComplete(model: TranslationsModel): boolean {
  return untranslatedLanguages(model).length === 0
}

/**
 * Coverage percentage for the sub-tab summary. The base language counts
 * as 1 covered language; each variant counts as 1.
 */
export function coveragePercentage(model: TranslationsModel): number {
  const total = SUPPORTED_CONTENT_LANGUAGES.length
  const covered = total - untranslatedLanguages(model).length
  return Math.round((covered / total) * 100)
}

/**
 * Coverage summary label for the sub-tab header.
 *
 * - "All 4 languages covered" — 100%
 * - "3 of 4 languages covered" — partial
 * - "1 of 4 languages covered" — only the base
 */
export function coverageSummaryLabel(model: TranslationsModel): string {
  const total = SUPPORTED_CONTENT_LANGUAGES.length
  const covered = total - untranslatedLanguages(model).length
  if (covered === total) return `All ${total} languages covered`
  return `${covered} of ${total} languages covered`
}
