import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import type { ReadinessResult } from '../courses.readiness'

const coursePublicIdInput = z.object({ coursePublicId: z.string().uuid() })

/**
 * S-2.22 Publish Readiness & Course Review: `RC-1…RC-8` evaluated
 * **server-side**. The client checklist is a convenience; publishing
 * re-validates at the moment of publish, so this read is never the gate.
 *
 * The same evaluator backs the S-2.1 authoring-health line, which is why the
 * catalog card and this checklist can never disagree about a count.
 */
export const getPublishReadiness = createServerFn({ method: 'GET' })
  .validator((input: unknown) => coursePublicIdInput.parse(input))
  .handler(async ({ data }): Promise<ReadinessResult> => {
    const { getPublishReadinessImpl } = await import('./courses.readiness.impl.server')
    return getPublishReadinessImpl(data.coursePublicId)
  })
