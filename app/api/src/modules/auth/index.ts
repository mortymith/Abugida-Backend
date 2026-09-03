/**
 * @module auth
 *
 * OpenAPI documentation for the Better Auth endpoints mounted by the API.
 *
 * Better Auth's request handler implements these routes; this module does not
 * create parallel or alias endpoints.
 *
 * Usage in app.ts:
 * ```ts
 * app.openapi(socialSignInRoute, handler)
 * ```
 */

export {
  socialSignInRoute,
  oauthCallbackRoute,
  signOutRoute,
  getSessionRoute,
  refreshSessionRoute,
} from './auth.routes'

export type {
  SocialSignInRoute,
  OAuthCallbackRoute,
  SignOutRoute,
  GetSessionRoute,
  RefreshSessionRoute,
} from './auth.routes'

export { UserSchema, SessionSchema, MeResponseSchema } from './auth.schemas'
