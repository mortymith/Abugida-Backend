/**
 * OpenAPI documentation for the routes mounted by `mountAuthRoutes`.
 *
 * Better Auth owns the request handling. These definitions only describe the
 * public contract and are registered with the same handler before the
 * catch-all mount is installed.
 */

import { createRoute, z } from '@hono/zod-openapi'
import { MeResponseSchema, SessionSchema, SocialLoginBodySchema, UserSchema } from './auth.schemas'

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
  description: 'Starts an OAuth sign-in flow for a configured provider.',
  request: { body: { content: { 'application/json': { schema: SocialLoginBodySchema } } } },
  responses: {
    200: { description: 'OAuth redirect or callback response.' },
    400: { description: 'Invalid provider or request.' },
    429: { description: 'Authentication rate limit exceeded.' },
  },
})

export const oauthCallbackRoute = createRoute({
  method: 'get',
  path: '/auth/callback/{provider}',
  tags: ['Auth'],
  summary: 'Complete social sign-in',
  description: 'Handles the OAuth provider callback and establishes a session.',
  request: { params: z.object({ provider: z.string().openapi({ example: 'google' }) }) },
  responses: {
    302: { description: 'Redirect after authentication.' },
    400: { description: 'Invalid or rejected OAuth callback.' },
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
export type GetSessionRoute = typeof getSessionRoute
export type SignOutRoute = typeof signOutRoute
export type RefreshSessionRoute = typeof refreshSessionRoute
