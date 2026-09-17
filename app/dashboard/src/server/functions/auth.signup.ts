import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/config/auth.config'

export interface SignupInput {
  name: string
  slug: string
  useCase: string
}

export const signupOrganization = createServerFn({ method: 'POST' })
  .validator((input: SignupInput) => input)
  .handler(async ({ data }) => {
    const request = getRequest()
    const session = await auth.getSession(request.headers)

    if (!session.ok) {
      throw new Error('You must be signed in to create a workspace')
    }

    const userId = session.value.user.id

    // Create the organization using better-auth's organization plugin
    const result = await (auth.raw.api as any).createOrganization({
      body: {
        name: data.name,
        slug: data.slug,
        userId,
      },
    })

    if (!result) {
      throw new Error('Failed to create workspace')
    }

    return {
      organizationId: result.id,
      organizationName: result.name,
      slug: result.slug,
    }
  })
