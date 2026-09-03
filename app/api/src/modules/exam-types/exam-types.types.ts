/**
 * @module exam-types.types
 *
 * TypeScript interfaces for the exam types feature module.
 */

export interface ExamTypeView {
  id: string
  name: string
  slug: string
  description: string | null
  parentExamTypeId: string | null
  depth: number
  sortOrder: number
  isActive: boolean
  children?: ExamTypeView[]
}

export interface ExamTypeListQuery {
  cursor: string | undefined
  limit: number | undefined
  includeChildren: boolean | undefined
}

export interface ChildExamTypeListQuery {
  parentExamTypeId: string
}
