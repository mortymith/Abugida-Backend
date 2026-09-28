/**
 * Server-side Markdown services for the Lesson Editor — spec 12 § 9.1 / § 9.3
 * and § 5.3 (migration).
 *
 * `MarkdownManager` is DOM-free, so all of this genuinely runs on the server
 * under Bun rather than being a client-only convenience.
 */
import { and, eq } from '@abugida/database'
import { lessons } from '@abugida/database/catalog'
import { db } from '#/config/db.config'
import { requireAuthoringRole, resolveLesson } from './courses.server-helpers.server'
import { convertLegacyHtmlToMarkdown } from '../courses.legacy-html'
import { auditMarkdown, normalizeMarkdown, roundTrip } from '../courses.markdown'
import {
  readBodyFormat,
  validateLessonMarkdown as validateBody,
} from '../schemas/courses.markdown.schema'
import type { MarkdownValidation } from '../schemas/courses.markdown.schema'

export type { MarkdownValidation }

/** Spec 12 § 9.3: lint a Markdown body on the server. */
export function validateLessonMarkdownImpl(markdown: string): MarkdownValidation {
  return validateBody(markdown)
}

export interface LessonMarkdownExport {
  markdown: string
  bodyFormat: 'html' | 'markdown'
}

/** Spec 12 § 9.1: raw Markdown export. Legacy HTML is converted on the way out. */
export async function exportLessonMarkdownImpl(
  lessonPublicId: string,
): Promise<LessonMarkdownExport> {
  await requireAuthoringRole()
  const lesson = await resolveLesson(lessonPublicId)
  const bodyFormat = readBodyFormat(lesson.bodyFormat)

  if (bodyFormat === 'markdown' || !lesson.body) {
    return { markdown: lesson.body ?? '', bodyFormat: 'markdown' }
  }

  const converted = convertLegacyHtmlToMarkdown(lesson.body)
  if (!converted.ok) {
    // Not convertible: hand back the original so the author still gets their
    // content, and label the format honestly rather than pretending.
    return { markdown: lesson.body, bodyFormat: 'html' }
  }
  return { markdown: converted.markdown, bodyFormat: 'markdown' }
}

export type MigrationOutcome =
  | { status: 'already_markdown' }
  | { status: 'skipped_empty' }
  | { status: 'migrated'; markdown: string }
  | { status: 'skipped_unconvertible'; reason: string; offset: number | null }

/**
 * Spec 12 § 5.3: convert one lesson body from legacy HTML to Markdown.
 *
 * Idempotent and safe to re-run. A row that cannot be converted is left as HTML
 * rather than being guessed at, and the result is only written when the emitted
 * Markdown is both stable and lossless.
 */
export async function migrateLessonBodyImpl(lessonPublicId: string): Promise<MigrationOutcome> {
  await requireAuthoringRole()
  const lesson = await resolveLesson(lessonPublicId)

  if (readBodyFormat(lesson.bodyFormat) === 'markdown') return { status: 'already_markdown' }

  const html = lesson.body
  if (html == null || html.trim() === '') return { status: 'skipped_empty' }

  const converted = convertLegacyHtmlToMarkdown(html)
  if (!converted.ok) {
    return {
      status: 'skipped_unconvertible',
      reason: converted.reason,
      offset: converted.offset,
    }
  }

  // Belt and braces: never persist a body that would change on the next save or
  // that the editor would silently trim.
  const check = roundTrip(converted.markdown)
  if (!check.stable || auditMarkdown(converted.markdown).length > 0) {
    return {
      status: 'skipped_unconvertible',
      reason: 'conversion is not lossless or not stable under re-serialization',
      offset: null,
    }
  }

  const markdown = normalizeMarkdown(converted.markdown)

  const updated = await db
    .update(lessons)
    .set({ body: markdown === '' ? null : markdown, bodyFormat: 'markdown' })
    .where(
      and(eq(lessons.id, lesson.id), eq(lessons.bodyFormat, readBodyFormat(lesson.bodyFormat))),
    )
    .returning({ id: lessons.id })

  if (!updated.at(0)) {
    return { status: 'already_markdown' }
  }

  return { status: 'migrated', markdown }
}
