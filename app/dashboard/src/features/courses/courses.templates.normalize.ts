/**
 * Client-safe repair helpers for template structures.
 *
 * A template's `structure` lives in a JSONB column and is therefore untrusted:
 * earlier seed revisions (and `saveCourseAsTemplate` from other sources) can
 * contain content types that are not members of the `content_type` Postgres
 * enum. Importing such a template fails at the `lessons` insert with
 * `invalid input value for enum content_type`, so every payload must be passed
 * through {@link normalizeTemplateStructure} before use.
 */
import { TEMPLATE_CONTENT_TYPES } from './courses.types'
import type { TemplateContentType, TemplateStructure } from './courses.types'

/** Out-of-enum content types mapped to the closest valid enum value. */
export const LEGACY_CONTENT_TYPE_ALIASES: Record<string, TemplateContentType> = {
  reading: 'pdf',
  text: 'pdf',
  article: 'pdf',
  document: 'pdf',
  doc: 'pdf',
  image: 'pdf',
  audio: 'video',
  sound: 'video',
  presentation: 'video',
  slides: 'video',
  task: 'exercise',
  assignment: 'exercise',
  written_test: 'quiz',
  test: 'quiz',
}

const CANONICAL: readonly string[] = TEMPLATE_CONTENT_TYPES

/**
 * Coerces an arbitrary value into a member of the `content_type` enum.
 * Unrecognised or non-string values fall back to 'video' so a single bad lesson
 * never aborts an entire import.
 */
export function normalizeTemplateContentType(value: unknown): TemplateContentType {
  if (typeof value !== 'string') return 'video'
  const key = value.trim().toLowerCase()
  const direct = CANONICAL.find((option) => option === key)
  if (direct) return direct as TemplateContentType
  return LEGACY_CONTENT_TYPE_ALIASES[key] ?? 'video'
}

/**
 * Coerces a stored template payload into a valid {@link TemplateStructure},
 * repairing missing/legacy content types and tolerating malformed shapes.
 */
export function normalizeTemplateStructure(raw: unknown): TemplateStructure {
  const source = raw !== null && typeof raw === 'object' ? (raw as { modules?: unknown }) : {}
  const rawModules = Array.isArray(source.modules) ? (source.modules as unknown[]) : []

  return {
    modules: rawModules.map((rawModule) => {
      const module = (rawModule ?? {}) as TemplateStructure['modules'][number]
      const rawLessons = Array.isArray(module.lessons) ? (module.lessons as unknown[]) : []
      return {
        ...module,
        lessons: rawLessons.map((rawLesson) => {
          const lesson = (rawLesson ??
            {}) as TemplateStructure['modules'][number]['lessons'][number]
          return {
            ...lesson,
            contentType: normalizeTemplateContentType(lesson.contentType),
          }
        }),
      }
    }),
  }
}
