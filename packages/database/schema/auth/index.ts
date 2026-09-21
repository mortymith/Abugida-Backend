export * from './users'
export * from './user-profiles'
export * from './devices'
export * from './user-consents'
export * from './session'
export * from './account'
export * from './verification'
export * from './jwks'
export * from './organization'

import { users } from './users'
import { session } from './session'
import { account } from './account'
import { verification } from './verification'
import { jwks } from './jwks'
import { organization, member, invitation } from './organization'

export const authSchema = {
  user: users,
  session,
  account,
  verification,
  jwks,
  organization,
  member,
  invitation,
}
