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
    provider: z.enum(['google', 'apple']).openapi({ example: 'google' }),
  })
  .openapi('SocialLoginBody')
