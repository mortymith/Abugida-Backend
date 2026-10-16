import { pgEnum } from 'drizzle-orm/pg-core'
import { z } from 'zod'

/**
 * Default language for authored course content (spec 04 S-2.20 →
 * _Content language_, spec 11 _Localization & Formatting_).
 *
 * Lives in this shared module so both `courses.content_language` and
 * `lessons.language` (the per-item override) reference the same Postgres
 * enum without creating a circular import between `courses.ts` and
 * `lessons.ts`.
 *
 * Distinct from the workspace **UI** language: this one decides the
 * `:lang()` line-height class and the default `lang` on new content, never
 * the chrome around it.
 */
export const courseContentLanguageEnum = z.enum(['en', 'am', 'ti', 'gez'])
export type CourseContentLanguage = z.infer<typeof courseContentLanguageEnum>

/**
 * Single source of truth for the Postgres enum. Both `courses` and
 * `lessons` reference this; the enum is created once by the first migration
 * that needs it.
 */
export const courseContentLanguagePgEnum = pgEnum('course_content_language', [
  'en',
  'am',
  'ti',
  'gez',
])

/**
 * Per-item language override (spec 04 S-2.7). Implemented as a new Postgres
 * enum `lesson_language` whose values mirror `course_content_language`, so a
 * future spec revision could diverge them without a column rewrite. NULL on
 * the column means "inherit `courses.content_language`".
 */
export const lessonLanguageEnum = courseContentLanguageEnum
export type LessonLanguage = CourseContentLanguage
export const lessonLanguagePgEnum = pgEnum('lesson_language', ['en', 'am', 'ti', 'gez'])
