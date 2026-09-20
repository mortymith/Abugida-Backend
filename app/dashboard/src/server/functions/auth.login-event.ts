import { createServerFn } from '@tanstack/react-start'
import { logger } from '#/config/observability.config'

export const writeLoginEvent = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      event: 'login_success' | 'login_failed' | 'mfa_success' | 'mfa_failed'
      provider: string
      metadata?: Record<string, unknown>
    }) => input,
  )
  .handler(async ({ data }) => {
    const { getRequest } = await import('@tanstack/react-start/server')
    const { auth } = await import('#/config/auth.server')
    const request = getRequest()
    const session = await auth.getSession(request.headers)

    const context = {
      event: data.event,
      provider: data.provider,
      userId: session.ok ? session.value.user.id : null,
      userAgent: request.headers.get('user-agent') ?? undefined,
      ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      ...data.metadata,
    }

    if (data.event.includes('failed')) {
      logger.warn(context, 'auth event')
    } else {
      logger.info(context, 'auth event')
    }

    return { recorded: true }
  })
