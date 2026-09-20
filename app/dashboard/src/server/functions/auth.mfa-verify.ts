import { createServerFn } from '@tanstack/react-start'

export const verifyMfa = createServerFn({ method: 'POST' })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }) => {
    const { getRequest } = await import('@tanstack/react-start/server')
    const { auth } = await import('#/config/auth.server')
    const request = getRequest()

    // Use better-auth's two-factor plugin to verify the TOTP code
    await (auth.raw.api as any).verifyTwoFactorOTP({
      body: {
        code: data.code,
      },
      headers: request.headers,
    })

    return { success: true }
  })
