/**
 * One-shot HTML → Markdown body migration — spec 12 § 5.3.
 *
 * Converts every lesson whose `body` is still legacy HTML into Markdown, in
 * batches, and prints the run report the spec defines. Safe to re-run: rows
 * already marked 'markdown' are skipped, and a row that cannot be converted is
 * reported and left as HTML rather than being guessed at.
 *
 * Usage (from `app/dashboard/`):
 *   bun run migrate:lesson-markdown            # dry run, changes nothing
 *   bun run migrate:lesson-markdown -- --write # actually write
 *
 * Per-lesson conversion also ships as the `migrateLessonBodyToMarkdown` server
 * function, so a single lesson can be converted on demand from the UI.
 */
import { eq, sql } from '@abugida/database'
import { lessons } from '@abugida/database/catalog'
import { db } from '#/config/db.config'
import {
  convertLegacyHtmlToMarkdown,
  emptyMigrationReport,
  formatMigrationReport,
} from '#/features/courses/courses.legacy-html'
import type { MigrationReport } from '#/features/courses/courses.legacy-html'
import { auditMarkdown, normalizeMarkdown, roundTrip } from '#/features/courses/courses.markdown'

const BATCH_SIZE = 200

function classify(html: string | null): {
  action: 'migrated' | 'skipped'
  markdown?: string
  reason?: string
  offset?: number
} {
  if (html == null || html.trim() === '') return { action: 'skipped' }

  const converted = convertLegacyHtmlToMarkdown(html)
  if (!converted.ok) {
    return { action: 'skipped', reason: converted.reason, offset: converted.offset ?? undefined }
  }

  const check = roundTrip(converted.markdown)
  if (!check.stable) {
    return { action: 'skipped', reason: 'conversion is not stable under re-serialization' }
  }
  const issues = auditMarkdown(converted.markdown)
  if (issues.length > 0) {
    return { action: 'skipped', reason: `conversion is lossy: ${issues[0]?.code}` }
  }

  return { action: 'migrated', markdown: normalizeMarkdown(converted.markdown) }
}

async function main(): Promise<void> {
  const write = process.argv.includes('--write')
  const report: MigrationReport = emptyMigrationReport()

  let offset = 0
  for (;;) {
    // Keyset pagination on `id` rather than OFFSET so a long run stays stable.
    const rows = await db
      .select({
        id: lessons.id,
        publicId: lessons.publicId,
        title: lessons.title,
        body: lessons.body,
        bodyFormat: lessons.bodyFormat,
      })
      .from(lessons)
      .where(
        sql`${lessons.id} > ${offset} and ${lessons.deletedAt} is null and (
          ${lessons.bodyFormat} = 'html'
          or ${lessons.bodyFormat} is null
        )`,
      )
      .orderBy(lessons.id)
      .limit(BATCH_SIZE)

    if (rows.length === 0) break
    offset = rows[rows.length - 1]?.id ?? offset

    for (const row of rows) {
      report.scanned += 1

      if (row.bodyFormat === 'markdown') {
        report.alreadyMarkdown += 1
        continue
      }
      if (row.body == null || row.body.trim() === '') {
        // Nothing to convert, but the row is still HTML by definition; stamp it
        // so the editor stops showing the legacy notice for an empty lesson.
        report.skippedEmpty += 1
        if (write) {
          await db.update(lessons).set({ bodyFormat: 'markdown' }).where(eq(lessons.id, row.id))
        }
        continue
      }

      const result = classify(row.body)
      if (result.action === 'migrated') {
        if (write) {
          const updated = await db
            .update(lessons)
            .set({
              body: result.markdown === '' ? null : result.markdown,
              bodyFormat: 'markdown',
            })
            .where(
              sql`${lessons.id} = ${row.id} and (${lessons.bodyFormat} = 'html' or ${lessons.bodyFormat} is null)`,
            )
            .returning({ id: lessons.id })
          if (!updated.at(0)) {
            // Someone else converted it first; count as already-converted.
            report.alreadyMarkdown += 1
            continue
          }
        }
        report.migrated += 1
        continue
      }

      report.skippedUnconvertible += 1
      report.rows.push({
        lessonPublicId: row.publicId,
        title: row.title,
        status: 'skipped_unconvertible',
        reason: result.reason ?? 'unknown',
        offset: result.offset,
      })
    }

    if (rows.length < BATCH_SIZE) break
  }

  console.error(write ? '' : 'DRY RUN — pass --write to apply.\n')
  console.error(formatMigrationReport(report))
  await db.$client.end()
}

main().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
