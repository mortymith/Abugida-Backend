/**
 * @module auth.schemas
 *
 * Zod schemas for the auth feature module.
 */

import { z } from '@hono/zod-openapi'

// ── Shared error schemas ───────────────────────────────────────────────────

export const ProblemDetailSchema = z
  .object({
    type: z.string().url(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    instance: z.string(),
    correlationId: z.string().uuid().optional(),
  })
  .openapi('ProblemDetail')

export const UnauthorizedSchema = ProblemDetailSchema.extend({
  status: z.literal(401),
}).openapi('Unauthorized')

export const ValidationErrorSchema = ProblemDetailSchema.extend({
  status: z.literal(422),
}).openapi('ValidationError')

export const UserSchema = z
  .object({
    id: z.string().openapi({ example: 'usr_01H5XQ9V...' }),
    email: z.string().email().openapi({ example: 'user@example.com' }),
    name: z.string().nullable().openapi({ example: 'John Doe' }),
    emailVerified: z.boolean().openapi({ example: true }),
    image: z.string().url().nullable().openapi({ example: null }),
  })
  .openapi('AuthUser')

export const SessionSchema = z
  .object({
    id: z.string().openapi({ example: 'sess_01H5XQ9V...' }),
    expiresAt: z.string().datetime().openapi({ example: '2025-08-01T12:00:00Z' }),
  })
  .openapi('AuthSession')

export const MeResponseSchema = z
  .object({
    user: UserSchema,
    session: SessionSchema,
  })
  .openapi('AuthMeResponse')

export const SocialLoginBodySchema = z
  .object({
    provider: z
      .enum(['google', 'telegram'])
      .openapi({ description: 'Social provider to sign in with.', example: 'telegram' }),
  })
  .openapi('SocialLoginBody')

export const SocialSignInResponseSchema = z
  .object({
    url: z.string().url().openapi({
      description: 'Provider authorization URL the user must be redirected to.',
      example:
        'https://oauth.telegram.org/auth?response_type=code&client_id=123456789&scope=openid+profile&code_challenge_method=S256',
    }),
    redirect: z.boolean().openapi({
      description:
        'True when the client must navigate to `url` to continue the flow (the URL is also set as the Location header for browser navigations).',
    }),
  })
  .openapi('SocialSignInResponse')

export const TelegramConfigSchema = z
  .object({
    provider: z.literal('telegram').openapi({
      description: 'Provider id to pass to POST /auth/sign-in/social for Telegram sign-in.',
    }),
    botUsername: z.string().openapi({
      description:
        'Bot username (without @). Empty when only Telegram OIDC is configured — the bot token is not part of the OIDC flow.',
    }),
    loginWidgetEnabled: z.boolean().openapi({
      description: 'Always false: the legacy Telegram Login Widget is not supported.',
    }),
    miniAppEnabled: z.boolean().openapi({
      description: 'Always false: Telegram Mini App sign-in is not supported.',
    }),
    oidcEnabled: z.boolean().openapi({
      description:
        'True when Telegram OIDC sign-in is available. Gate the "Continue with Telegram" button on this flag.',
    }),
    testMode: z.boolean(),
  })
  .openapi('TelegramConfig')
