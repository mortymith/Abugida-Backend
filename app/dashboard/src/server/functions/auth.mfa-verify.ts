import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/lib/auth.server'

export const verifyMfa = createServerFn({ method: 'POST' })
  .validator((input: { code: string }) => input)
  .handler(async ({ data }) => {
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
