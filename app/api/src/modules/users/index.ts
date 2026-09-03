/**
 * @module users
 *
 * Users feature module — profile management, onboarding, consents,
 * GDPR export, device management, and dashboard.
 *
 * Usage in app.ts:
 * ```ts
 * import { createUsersHandlers, createUsersRouteMap, createUserRepository, createUsersService } from './modules/users'
 *
 * const userRepo = createUserRepository(db)
 * const usersService = createUsersService(userRepo, queue)
 * const usersHandlers = createUsersHandlers(usersService)
 * for (const { route, handler } of createUsersRouteMap(usersHandlers)) {
 *   app.openapi(route, handler)
 * }
 * ```
 */

export {
  getProfileRoute,
  updateProfileRoute,
  deleteAccountRoute,
  getOnboardingRoute,
  updateOnboardingRoute,
  retriggerOnboardingRoute,
  getConsentsRoute,
  updateConsentsRoute,
  exportDataRoute,
  getDevicesRoute,
  registerDeviceRoute,
  updateDeviceRoute,
  removeDeviceRoute,
  getDashboardRoute,
} from './users.routes'

export type {
  GetProfileRoute,
  UpdateProfileRoute,
  DeleteAccountRoute,
  GetOnboardingRoute,
  UpdateOnboardingRoute,
  RetriggerOnboardingRoute,
  GetConsentsRoute,
  UpdateConsentsRoute,
  ExportDataRoute,
  GetDevicesRoute,
  RegisterDeviceRoute,
  UpdateDeviceRoute,
  RemoveDeviceRoute,
  GetDashboardRoute,
} from './users.routes'

export { createUsersHandlers, createUsersRouteMap } from './users.handlers'

export { createUserRepository, type UserRepository } from './users.repository'

export {
  createUsersService,
  UserNotFoundError,
  DeviceLimitExceededError,
  DeviceNotFoundError,
  ConflictError,
  type UsersService,
} from './users.service'

export type {
  UserProfileView,
  OnboardingState,
  ConsentRecord,
  ConsentUpdateItem,
  DeviceView,
  DeviceRegistrationFields,
  DeviceUpdateFields,
  DashboardData,
  UserStats,
  ActivityItem,
  Insight,
  WeeklyData,
  WeeklySession,
  Deadline,
  JumpBackItem,
  AccountDeletionRequest,
  ExportOptions,
  UpdateProfileFields,
} from './users.types'
