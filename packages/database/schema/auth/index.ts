export * from './users'
export * from './user-profiles'
export * from './devices'
export * from './user-consents'
export * from './login-attempts'
export * from './session'
export * from './account'
export * from './verification'

import { users } from './users'
import { session } from './session'
import { account } from './account'
import { verification } from './verification'

export const authSchema = { user: users, session, account, verification }
