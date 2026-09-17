import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/config/auth.config'

export const writeLoginEvent = createServerFn({ method: 'POST' })
  .validator(
    (input: {
      event: 'login_success' | 'login_failed' | 'mfa_success' | 'mfa_failed'
      provider: string
      metadata?: Record<string, unknown>
    }) => input,
  )
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.getSession(request.headers)

    // Log the event for audit purposes
    // In production, this would write to a login_events table
    console.log('Login event:', {
      ...data,
      userId: session.ok ? session.value.user.id : null,
      timestamp: new Date().toISOString(),
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip'),
    })

    return { recorded: true }
  })
