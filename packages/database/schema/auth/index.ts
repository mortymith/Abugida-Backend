export * from './users'
export * from './user-profiles'
export * from './devices'
export * from './user-consents'
export * from './session'
export * from './account'
export * from './verification'
export * from './jwks'
export * from './two-factor'
export * from './organization'

import { users } from './users'
import { session } from './session'
import { account } from './account'
import { verification } from './verification'
import { jwks } from './jwks'
import { twoFactor } from './two-factor'
import { organization, member, invitation } from './organization'

// Keys must match Better Auth's model names (singular, `usePlural: false`).
// Plugin models belong here too because the Drizzle adapter validates every
// field Better Auth writes against these tables.
export const authSchema = {
  user: users,
  session,
  account,
  verification,
  jwks,
  twoFactor,
  organization,
  member,
  invitation,
}
