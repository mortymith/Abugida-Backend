import { createServerFn } from '@tanstack/react-start'
import {
  aiModuleExpandSchema,
  aiModuleRegenerateSchema,
  aiOutlineRequestSchema,
  aiQuizRegenerateSchema,
  aiQuizRequestSchema,
} from '../schemas/courses.workflow.schema'
import type { AiOutlineResult, AiQuizDraft } from '../courses.types'

/** S-2.11: generate a course outline draft (persisted as an ai_generation_job). */
export const generateCourseOutline = createServerFn({ method: 'POST' })
  .validator((input: unknown) => aiOutlineRequestSchema.parse(input))
  .handler(async ({ data }): Promise<AiOutlineResult> => {
    const { generateCourseOutlineImpl } = await import('./courses.ai.impl.server')
    return generateCourseOutlineImpl(data)
  })

/** Regenerate a single module inside the draft (per-module Retry). */
export const regenerateOutlineModule = createServerFn({ method: 'POST' })
  .validator((input: unknown) => aiModuleRegenerateSchema.parse(input))
  .handler(async ({ data }): Promise<AiOutlineResult> => {
    const { regenerateOutlineModuleImpl } = await import('./courses.ai.impl.server')
    return regenerateOutlineModuleImpl(data)
  })

/** Expand a module with N more lessons (per-module Expand). */
export const expandOutlineModule = createServerFn({ method: 'POST' })
  .validator((input: unknown) => aiModuleExpandSchema.parse(input))
  .handler(async ({ data }): Promise<AiOutlineResult> => {
    const { expandOutlineModuleImpl } = await import('./courses.ai.impl.server')
    return expandOutlineModuleImpl(data)
  })

/** S-2.16: draft quiz questions from a lesson's body (min 200 words). */
export const generateQuizDraft = createServerFn({ method: 'POST' })
  .validator((input: unknown) => aiQuizRequestSchema.parse(input))
  .handler(async ({ data }): Promise<AiQuizDraft> => {
    const { generateQuizDraftImpl } = await import('./courses.ai.impl.server')
    return generateQuizDraftImpl(data)
  })

/** Regenerate a single question, excluding already-shown prompts. */
export const regenerateQuizQuestion = createServerFn({ method: 'POST' })
  .validator((input: unknown) => aiQuizRegenerateSchema.parse(input))
  .handler(async ({ data }): Promise<AiQuizDraft> => {
    const { regenerateQuizQuestionImpl } = await import('./courses.ai.impl.server')
    return regenerateQuizQuestionImpl(data)
  })
