/**
 * @module exam-types.repository
 *
 * Database operations for the exam types feature module.
 */

import { eq, and, desc, lt, isNull } from 'drizzle-orm'
import type { DatabaseClient } from '@abugida/database/client'
import { examTypes } from '@abugida/database/catalog'

// ── Cursor helpers ─────────────────────────────────────────────────────────

function encodeCursor(id: number): string {
  return Buffer.from(`cursor:${id}`).toString('base64url')
}

function decodeCursor(cursor: string | undefined): number | undefined {
  if (!cursor) return undefined
  const decoded = Buffer.from(cursor, 'base64url').toString('utf-8')
  const match = decoded.match(/^cursor:(\d+)$/)
  if (!match?.[1]) throw new Error('Invalid cursor format')
  return Number.parseInt(match[1], 10)
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface ExamTypeRow {
  id: number
  publicId: string
  name: string
  slug: string
  description: string | null
  parentExamTypeId: number | null
  depth: number
  sortOrder: number
  isActive: boolean
}

// ── Repository interface ───────────────────────────────────────────────────

export interface ExamTypesRepository {
  findTopLevel(opts: {
    cursor: string | undefined
    limit: number
  }): Promise<{ rows: ExamTypeRow[]; hasMore: boolean }>
  findByPublicId(publicId: string): Promise<ExamTypeRow | undefined>
  findChildren(parentId: number): Promise<ExamTypeRow[]>
  findChildrenByPublicId(parentPublicId: string): Promise<ExamTypeRow[]>
}

// ── Factory ────────────────────────────────────────────────────────────────

export function createExamTypesRepository(db: DatabaseClient): ExamTypesRepository {
  return {
    async findTopLevel(opts) {
      const { cursor, limit } = opts
      const effectiveLimit = limit + 1

      const conditions = [
        isNull(examTypes.parentExamTypeId),
        isNull(examTypes.deletedAt),
        eq(examTypes.isActive, true),
      ]

      const cursorId = decodeCursor(cursor)
      if (cursorId !== undefined) {
        conditions.push(lt(examTypes.id, cursorId))
      }

      const rows = await db
        .select()
        .from(examTypes)
        .where(and(...conditions))
        .orderBy(desc(examTypes.sortOrder), desc(examTypes.id))
        .limit(effectiveLimit)

      const hasMore = rows.length > limit
      const data = hasMore ? rows.slice(0, limit) : rows

      return { rows: data, hasMore }
    },

    async findByPublicId(publicId) {
      const [row] = await db
        .select()
        .from(examTypes)
        .where(and(eq(examTypes.publicId, publicId), isNull(examTypes.deletedAt)))
        .limit(1)
      return row
    },

    async findChildren(parentId) {
      return db
        .select()
        .from(examTypes)
        .where(
          and(
            eq(examTypes.parentExamTypeId, parentId),
            isNull(examTypes.deletedAt),
            eq(examTypes.isActive, true),
          ),
        )
        .orderBy(examTypes.sortOrder, examTypes.id)
    },

    async findChildrenByPublicId(parentPublicId) {
      const parent = await this.findByPublicId(parentPublicId)
      if (!parent) return []
      return this.findChildren(parent.id)
    },
  }
}

export { encodeCursor, decodeCursor }
