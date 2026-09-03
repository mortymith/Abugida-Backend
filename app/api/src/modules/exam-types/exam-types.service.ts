/**
 * @module exam-types.service
 *
 * Business logic for the exam types feature module.
 */

import type { ExamTypesRepository } from './exam-types.repository'
import type { ExamTypeRow } from './exam-types.repository'
import { encodeCursor } from './exam-types.repository'
import type { ExamTypeView, ExamTypeListQuery, ChildExamTypeListQuery } from './exam-types.types'

// ── Errors ─────────────────────────────────────────────────────────────────

export class ExamTypeNotFoundError extends Error {
  constructor(message = 'Exam type not found.') {
    super(message)
    this.name = 'ExamTypeNotFoundError'
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function toView(row: ExamTypeRow, children?: ExamTypeView[]): ExamTypeView {
  const view: ExamTypeView = {
    id: row.publicId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    parentExamTypeId: row.parentExamTypeId ? String(row.parentExamTypeId) : null,
    depth: row.depth,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  }
  if (children) view.children = children
  return view
}

// ── Service ────────────────────────────────────────────────────────────────

export interface ExamTypesService {
  listExamTypes(query: ExamTypeListQuery): Promise<{
    data: ExamTypeView[]
    meta: { cursor: string | null; hasMore: boolean; limit: number }
  }>
  getExamType(examTypeId: string, includeChildren: boolean): Promise<ExamTypeView>
  listChildExamTypes(query: ChildExamTypeListQuery): Promise<{
    data: ExamTypeView[]
  }>
}

export function createExamTypesService(repo: ExamTypesRepository): ExamTypesService {
  return {
    async listExamTypes(query) {
      const limit = query.limit ?? 20
      const { rows, hasMore } = await repo.findTopLevel({
        cursor: query.cursor,
        limit,
      })

      const data: ExamTypeView[] = []

      for (const row of rows) {
        if (query.includeChildren) {
          const children = await repo.findChildren(row.id)
          data.push(
            toView(
              row,
              children.map((c) => toView(c)),
            ),
          )
        } else {
          data.push(toView(row))
        }
      }

      const lastRow = rows[rows.length - 1]
      return {
        data,
        meta: {
          cursor: hasMore && lastRow ? encodeCursor(lastRow.id) : null,
          hasMore,
          limit,
        },
      }
    },

    async getExamType(examTypeId, includeChildren) {
      const row = await repo.findByPublicId(examTypeId)
      if (!row) throw new ExamTypeNotFoundError()

      if (includeChildren) {
        const children = await repo.findChildren(row.id)
        return toView(
          row,
          children.map((c) => toView(c)),
        )
      }

      return toView(row)
    },

    async listChildExamTypes(query) {
      const children = await repo.findChildrenByPublicId(query.parentExamTypeId)
      return {
        data: children.map((c) => toView(c)),
      }
    },
  }
}
