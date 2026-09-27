import { createServerFn } from '@tanstack/react-start'

import { WorkspaceSchema } from '#/features/auth/schemas/auth.signup.schema'

export const getSignupProviders = createServerFn({ method: 'GET' }).handler(async () => {
  const { env } = await import('#/config/app.config')

  return [
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET ? (['google'] as const) : []),
    ...(env.TELEGRAM_OIDC_CLIENT_ID && env.TELEGRAM_OIDC_CLIENT_SECRET
      ? (['telegram-oidc'] as const)
      : []),
  ]
})

export const signupOrganization = createServerFn({ method: 'POST' })
  .validator(WorkspaceSchema)
  .handler(async ({ data }) => {
    const { getRequest } = await import('@tanstack/react-start/server')
    const { auth } = await import('#/config/auth.server')
    const request = getRequest()
    const session = await auth.getSession(request.headers)

    if (!session.ok) {
      throw new Error('UNAUTHENTICATED: You must be signed in to create a workspace')
    }

    // The organization plugin must receive the current request so it can resolve
    // the session, create the owner membership, and activate the organization.
    const result = await (auth.raw.api as any).createOrganization({
      headers: request.headers,
      body: {
        name: data.name,
        slug: data.slug,
        useCase: data.useCase,
      },
    })

    if (!result) {
      throw new Error('ORGANIZATION_CREATION_FAILED: Failed to create workspace')
    }

    return {
      organizationId: result.id,
      organizationName: result.name,
      slug: result.slug,
    }
  })
