/**
 * Server-only implementation of S-2.13 Bulk Module & Lesson Import.
 * CSV/Markdown parsed natively; XLSX via `xlsx`, DOCX via `mammoth`.
 */
import { and, eq, inArray, isNull } from '@abugida/database'
import { courses, examTypes, lessons, modules } from '@abugida/database/catalog'
import { importJobs } from '@abugida/database/ops'
import { db } from '#/config/db.config'
import {
  nextModuleSortOrder,
  requireAuthoringRole,
  slugifyTitle,
  uniqueCourseSlug,
} from './courses.server-helpers.server'
import { buildImportPlan, parseCsv, parseMarkdownOutline } from '../courses.import-rows'
import type { ImportPreview, ImportValidation, ImportRunResult } from '../courses.types'
import type { ImportMapping } from '../schemas/courses.workflow.schema'

const MAX_FILE_BYTES = 20 * 1024 * 1024
const UNDO_WINDOW_MS = 30 * 60 * 1000

export async function parseImportFileImpl(input: {
  fileName: string
  content: string
}): Promise<ImportPreview> {
  await requireAuthoringRole()

  const base64Bytes = Math.ceil((input.content.length * 3) / 4)
  if (base64Bytes > MAX_FILE_BYTES) {
    throw new Error('FILE_TOO_LARGE: files are limited to 20 MB')
  }

  const name = input.fileName.toLowerCase()
  if (name.endsWith('.csv')) {
    const table = parseCsv(input.content)
    return { columns: table.headers, rows: table.rows.slice(0, 2000) }
  }
  if (name.endsWith('.md') || name.endsWith('.markdown')) {
    const table = parseMarkdownOutline(input.content)
    return { columns: table.headers, rows: table.rows.slice(0, 2000) }
  }
  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const XLSX = await import('xlsx')
    const buffer = Buffer.from(input.content, 'base64')
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheet: unknown = workbook.Sheets[workbook.SheetNames[0] ?? '']
    if (sheet == null) throw new Error('EMPTY_FILE: the spreadsheet has no sheets')
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false })
    const [headers = [], ...body] = rows
    return {
      columns: headers.map((header) => String(header ?? '').trim()),
      rows: body.slice(0, 2000).map((row) => row.map((cell) => String(cell ?? ''))),
    }
  }
  if (name.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const buffer = Buffer.from(input.content, 'base64')
    const { value: html } = await mammoth.convertToHtml({ buffer })
    const markdown = htmlToMarkdownHeadings(html)
    const table = parseMarkdownOutline(markdown)
    if (table.rows.length === 0) {
      throw new Error('NO_STRUCTURE: use Heading 1/2 for modules and Heading 3 for lessons')
    }
    return { columns: table.headers, rows: table.rows.slice(0, 2000) }
  }
  throw new Error('UNSUPPORTED_FORMAT: use .csv, .xlsx, .md, or .docx')
}

function htmlToMarkdownHeadings(html: string): string {
  return html
    .replace(/<h1[^>]*>(.*?)<\/h1>/gis, (_, text) => `\n# ${stripTags(text)}\n`)
    .replace(/<h2[^>]*>(.*?)<\/h2>/gis, (_, text) => `\n## ${stripTags(text)}\n`)
    .replace(/<h3[^>]*>(.*?)<\/h3>/gis, (_, text) => `\n### ${stripTags(text)}\n`)
    .replace(/<p[^>]*>(.*?)<\/p>/gis, (_, text) => `\n${stripTags(text)}\n`)
    .replace(/<li[^>]*>(.*?)<\/li>/gis, (_, text) => `\n- ${stripTags(text)}`)
    .replace(/<!--.*?-->/gs, '')
}

function stripTags(fragment: string): string {
  return fragment
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim()
}

export async function validateImportImpl(input: {
  fileName: string
  rows: (string | null)[][]
  mapping: ImportMapping
}): Promise<ImportValidation> {
  await requireAuthoringRole()
  const table = {
    headers: Object.keys(input.mapping),
    rows: input.rows.map((row) => row.map((cell) => cell ?? '')),
  }
  const plan = buildImportPlan(table, input.mapping)
  return {
    moduleCount: plan.modules.length,
    lessonCount: plan.modules.reduce((sum, module) => sum + module.lessons.length, 0),
    warnings: plan.warnings,
    skipped: plan.skipped,
  }
}

export async function runImportImpl(input: {
  fileName: string
  coursePublicId?: string
  newCourseTitle?: string
  rows: (string | null)[][]
  mapping: ImportMapping
}): Promise<ImportRunResult> {
  const userId = await requireAuthoringRole()

  const table = {
    headers: Object.keys(input.mapping),
    rows: input.rows.map((row) => row.map((cell) => cell ?? '')),
  }
  const plan = buildImportPlan(table, input.mapping)
  if (plan.modules.length === 0) {
    throw new Error('NOTHING_TO_IMPORT: no valid rows found')
  }

  let courseId: number
  let coursePublicId: string
  let moduleStartOrder = 0

  if (input.coursePublicId) {
    const rows = await db
      .select()
      .from(courses)
      .where(and(eq(courses.publicId, input.coursePublicId), isNull(courses.deletedAt)))
      .limit(1)
    const course = rows.at(0)
    if (!course) throw new Error('COURSE_NOT_FOUND')
    courseId = course.id
    coursePublicId = course.publicId
    moduleStartOrder = await nextModuleSortOrder(course.id)
  } else {
    const title = (input.newCourseTitle?.trim() || input.fileName.replace(/\.[^.]+$/, '')).slice(
      0,
      300,
    )
    const examTypeId = await firstExamTypeId()
    const slug = await uniqueCourseSlug(slugifyTitle(title))
    const inserted = await db
      .insert(courses)
      .values({
        title,
        slug,
        examTypeId,
        instructorId: userId,
        status: 'draft',
        pricingModel: 'free',
        isFree: true,
      })
      .returning({ id: courses.id, publicId: courses.publicId })
    const course = inserted.at(0)
    if (!course) throw new Error('COURSE_CREATE_FAILED')
    courseId = course.id
    coursePublicId = course.publicId
  }

  const createdModuleIds: string[] = []
  const createdLessonIds: string[] = []
  let moduleCursor = moduleStartOrder
  let jobPublicId = 'unknown'

  await db.transaction(async (tx) => {
    for (const module of plan.modules) {
      const insertedModule = await tx
        .insert(modules)
        .values({
          courseId,
          instructorId: userId,
          title: module.title.slice(0, 300),
          sortOrder: moduleCursor,
        })
        .returning({ publicId: modules.publicId })
      moduleCursor += 1
      createdModuleIds.push(insertedModule.at(0)!.publicId)
      const moduleId = (
        await tx
          .select({ id: modules.id })
          .from(modules)
          .where(eq(modules.publicId, insertedModule.at(0)!.publicId))
          .limit(1)
      ).at(0)!.id

      for (const [lessonIndex, lesson] of module.lessons.entries()) {
        const insertedLesson = await tx
          .insert(lessons)
          .values({
            moduleId,
            courseId,
            instructorId: userId,
            title: lesson.title.slice(0, 300),
            body: lesson.content,
            contentType: lesson.videoUrl ? 'video' : 'exercise',
            videoUrl: lesson.videoUrl,
            durationSeconds: lesson.durationMinutes == null ? null : lesson.durationMinutes * 60,
            sortOrder: lessonIndex,
            tags: ['source:import'],
          })
          .returning({ publicId: lessons.publicId })
        createdLessonIds.push(insertedLesson.at(0)!.publicId)
      }
    }

    const insertedJob = await tx
      .insert(importJobs)
      .values({
        courseId,
        fileName: input.fileName.slice(0, 300),
        mapping: input.mapping,
        stats: {
          rows: input.rows.length,
          modules: createdModuleIds.length,
          lessons: createdLessonIds.length,
          warnings: plan.warnings.length,
          skipped: plan.skipped.length,
        },
        createdIds: { moduleIds: createdModuleIds, lessonIds: createdLessonIds },
        status: 'completed',
        undoExpiresAt: new Date(Date.now() + UNDO_WINDOW_MS),
        createdBy: userId,
      })
      .returning({ publicId: importJobs.publicId })
    jobPublicId = insertedJob.at(0)?.publicId ?? jobPublicId
  })

  return {
    jobPublicId,
    coursePublicId,
    moduleCount: createdModuleIds.length,
    lessonCount: createdLessonIds.length,
    undoExpiresAt: new Date(Date.now() + UNDO_WINDOW_MS).toISOString(),
  }
}

export async function undoImportImpl(jobPublicId: string): Promise<{ ok: true }> {
  await requireAuthoringRole()

  const rows = await db
    .select()
    .from(importJobs)
    .where(eq(importJobs.publicId, jobPublicId))
    .limit(1)
  const job = rows.at(0)
  if (!job) throw new Error('JOB_NOT_FOUND')
  if (job.status === 'undone') throw new Error('ALREADY_UNDONE')
  if (!job.undoExpiresAt || job.undoExpiresAt.getTime() < Date.now()) {
    throw new Error('UNDO_EXPIRED: the 30-minute undo window has passed')
  }

  const created = job.createdIds as { moduleIds?: string[]; lessonIds?: string[] }
  const lessonIds = created.lessonIds ?? []
  const moduleIds = created.moduleIds ?? []

  await db.transaction(async (tx) => {
    if (lessonIds.length) {
      await tx
        .update(lessons)
        .set({ deletedAt: new Date() })
        .where(inArray(lessons.publicId, lessonIds))
    }
    if (moduleIds.length) {
      await tx
        .update(modules)
        .set({ deletedAt: new Date() })
        .where(inArray(modules.publicId, moduleIds))
    }
    await tx.update(importJobs).set({ status: 'undone' }).where(eq(importJobs.id, job.id))
  })
  return { ok: true }
}

async function firstExamTypeId(): Promise<number> {
  const rows = await db
    .select({ id: examTypes.id })
    .from(examTypes)
    .where(and(eq(examTypes.isActive, true), isNull(examTypes.deletedAt)))
    .limit(1)
  const found = rows.at(0)?.id
  if (found) return found
  const inserted = await db
    .insert(examTypes)
    .values({ name: 'General', slug: `general-${Date.now().toString(36)}` })
    .returning({ id: examTypes.id })
  const id = inserted.at(0)?.id
  if (!id) throw new Error('EXAM_TYPE_UNAVAILABLE')
  return id
}
