/**
 * OpenAPI documentation for the routes mounted by `mountAuthRoutes`.
 *
 * Better Auth owns the request handling. These definitions only describe the
 * public contract and are registered with the same handler before the
 * catch-all mount is installed.
 */

import { createRoute, z } from '@hono/zod-openapi'
import {
  MeResponseSchema,
  SessionSchema,
  SocialLoginBodySchema,
  SocialSignInResponseSchema,
  TelegramConfigSchema,
  UserSchema,
  ValidationErrorSchema,
} from './auth.schemas'

const AuthErrorSchema = z
  .object({
    error: z.object({
      kind: z.string().openapi({ example: 'unauthorized' }),
      message: z.string().openapi({ example: 'No active session.' }),
    }),
  })
  .openapi('AuthError')

export const socialSignInRoute = createRoute({
  method: 'post',
  path: '/auth/sign-in/social',
  tags: ['Auth'],
  summary: 'Start social sign-in',
  description:
    'Initiates an OAuth sign-in flow. Only provider is required; redirect destinations and OAuth options are configured by the backend.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: SocialLoginBodySchema,
          examples: {
            google: {
              summary: 'Sign in with Google',
              value: { provider: 'google' },
            },
            telegram: {
              summary: 'Sign in with Telegram',
              value: { provider: 'telegram' },
            },
          },
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Authorization URL for the requested provider.',
      content: { 'application/json': { schema: SocialSignInResponseSchema } },
    },
    400: {
      description: 'The OAuth flow could not be started (e.g. the provider is misconfigured).',
    },
    422: {
      description: 'Request body validation failed (e.g. unknown provider).',
      content: { 'application/problem+json': { schema: ValidationErrorSchema } },
    },
    429: { description: 'Authentication rate limit exceeded.' },
  },
})

export const oauthCallbackRoute = createRoute({
  method: 'get',
  path: '/auth/callback/{provider}',
  tags: ['Auth'],
  summary: 'Complete social sign-in',
  description: 'Handles the OAuth provider redirect and establishes a session.',
  request: {
    params: z.object({
      provider: z.enum(['google', 'telegram-oidc']).openapi({
        description:
          "Provider id embedded in the redirect URI registered with the provider console. Telegram OIDC uses Better Auth's internal id `telegram-oidc` (the public sign-in id `telegram` maps to it server-side).",
        example: 'telegram-oidc',
      }),
    }),
  },
  responses: {
    302: {
      description: 'Redirect to the post-login callback URL with the session cookie set.',
    },
    400: { description: 'Invalid or rejected OAuth callback (state mismatch, rejected code).' },
  },
})

export const telegramConfigRoute = createRoute({
  method: 'get',
  path: '/auth/telegram/config',
  tags: ['Auth'],
  summary: 'Get Telegram sign-in configuration',
  description: 'Returns Telegram sign-in capability flags for client-side UI rendering.',
  responses: {
    200: {
      description: 'Telegram sign-in capability flags.',
      content: { 'application/json': { schema: TelegramConfigSchema } },
    },
  },
})

export const getSessionRoute = createRoute({
  method: 'get',
  path: '/auth/get-session',
  tags: ['Auth'],
  summary: 'Get current session',
  description: 'Returns the current user and session, or an empty response when signed out.',
  responses: {
    200: {
      description: 'Current session state.',
      content: { 'application/json': { schema: MeResponseSchema.nullable() } },
    },
  },
})

export const signOutRoute = createRoute({
  method: 'post',
  path: '/auth/sign-out',
  tags: ['Auth'],
  summary: 'Sign out',
  description: 'Invalidates the current session.',
  responses: {
    200: { description: 'Session signed out.' },
    401: {
      description: 'No active session.',
      content: { 'application/json': { schema: AuthErrorSchema } },
    },
  },
})

export const refreshSessionRoute = createRoute({
  method: 'post',
  path: '/auth/session/refresh',
  tags: ['Auth'],
  summary: 'Refresh current session',
  description: 'Performs a cache-bypassing session lookup.',
  responses: {
    200: {
      description: 'Fresh session state.',
      content: {
        'application/json': {
          schema: z
            .object({ session: SessionSchema, user: UserSchema })
            .openapi('RefreshedSession'),
        },
      },
    },
    401: {
      description: 'No active session.',
      content: { 'application/json': { schema: AuthErrorSchema } },
    },
    403: {
      description: 'Origin is not trusted.',
      content: { 'application/json': { schema: AuthErrorSchema } },
    },
  },
})

export type SocialSignInRoute = typeof socialSignInRoute
export type OAuthCallbackRoute = typeof oauthCallbackRoute
export type TelegramConfigRoute = typeof telegramConfigRoute
export type GetSessionRoute = typeof getSessionRoute
export type SignOutRoute = typeof signOutRoute
export type RefreshSessionRoute = typeof refreshSessionRoute
