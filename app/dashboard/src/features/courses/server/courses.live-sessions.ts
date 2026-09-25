import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { liveSessionCancelSchema, liveSessionSaveSchema } from '../schemas/courses.learning.schema'
import type { LiveSessionDTO } from '../courses.types'

const courseInputSchema = z.object({ coursePublicId: z.string().uuid() })

export const getLiveSessions = createServerFn({ method: 'GET' })
  .validator((input: unknown) => courseInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ upcoming: LiveSessionDTO[]; history: LiveSessionDTO[] }> => {
    const { getLiveSessionsImpl } = await import('./courses.live-sessions.impl.server')
    return getLiveSessionsImpl(data.coursePublicId)
  })

/** Schedule/update a session. Throws HOST_CONFLICT on host-overlap (spec). */
export const saveLiveSession = createServerFn({ method: 'POST' })
  .validator((input: unknown) => liveSessionSaveSchema.parse(input))
  .handler(async ({ data }): Promise<LiveSessionDTO> => {
    const { saveLiveSessionImpl } = await import('./courses.live-sessions.impl.server')
    return saveLiveSessionImpl(data)
  })

export const cancelLiveSession = createServerFn({ method: 'POST' })
  .validator((input: unknown) => liveSessionCancelSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { cancelLiveSessionImpl } = await import('./courses.live-sessions.impl.server')
    return cancelLiveSessionImpl(data)
  })

/** Attach a finished recording to a lesson (S-2.9 "attach to lesson"). */
export const attachSessionRecording = createServerFn({ method: 'POST' })
  .validator((input: unknown) =>
    z
      .object({
        sessionPublicId: z.string().uuid(),
        lessonPublicId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { attachSessionRecordingImpl } = await import('./courses.live-sessions.impl.server')
    return attachSessionRecordingImpl(data)
  })
