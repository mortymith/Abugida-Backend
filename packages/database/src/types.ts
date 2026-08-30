export type { InferSelectModel, InferInsertModel } from 'drizzle-orm'

export type { SelectUser, InsertUser, UpdateUser } from '../schema/auth/users'
export type {
  SelectUserProfile,
  InsertUserProfile,
  UpdateUserProfile,
} from '../schema/auth/user-profiles'
export type { SelectDevice, InsertDevice, UpdateDevice } from '../schema/auth/devices'
export type { SelectUserConsent, InsertUserConsent } from '../schema/auth/user-consents'
export type { SelectLoginAttempt, InsertLoginAttempt } from '../schema/auth/login-attempts'

export type { SelectCourse, InsertCourse, UpdateCourse } from '../schema/catalog/courses'
export type { SelectModule, InsertModule, UpdateModule } from '../schema/catalog/modules'
export type { SelectLesson, InsertLesson, UpdateLesson } from '../schema/catalog/lessons'
export type { SelectExamType, InsertExamType, UpdateExamType } from '../schema/catalog/exam-types'
export type {
  SelectCourseTag,
  InsertCourseTag,
  UpdateCourseTag,
} from '../schema/catalog/course-tags'
export type {
  SelectCourseTagAssignment,
  InsertCourseTagAssignment,
} from '../schema/catalog/course-tag-assignments'
export type {
  SelectCourseStats,
  InsertCourseStats,
  UpdateCourseStats,
} from '../schema/catalog/course-stats'
export type {
  SelectCourseStatsHistory,
  InsertCourseStatsHistory,
} from '../schema/catalog/course-stats-history'
export type { SelectBundle, InsertBundle, UpdateBundle } from '../schema/catalog/course-bundles'
export type {
  SelectBundleCourse,
  InsertBundleCourse,
  UpdateBundleCourse,
} from '../schema/catalog/bundle-courses'

export type { SelectPurchase, InsertPurchase, UpdatePurchase } from '../schema/finance/purchases'
export type {
  SelectPurchaseOption,
  InsertPurchaseOption,
  UpdatePurchaseOption,
} from '../schema/finance/purchase-options'
export type {
  SelectPurchaseTransaction,
  InsertPurchaseTransaction,
} from '../schema/finance/purchase-transactions'
export type {
  SelectPaymentGateway,
  InsertPaymentGateway,
  UpdatePaymentGateway,
} from '../schema/finance/payment-gateways'
export type {
  SelectContentLicense,
  InsertContentLicense,
  UpdateContentLicense,
} from '../schema/finance/content-licenses'
export type {
  SelectContentLicenseGrant,
  InsertContentLicenseGrant,
  UpdateContentLicenseGrant,
} from '../schema/finance/content-license-grants'

export type {
  SelectEnrollment,
  InsertEnrollment,
  UpdateEnrollment,
} from '../schema/learning/enrollments'
export type {
  SelectLessonCompletion,
  InsertLessonCompletion,
  UpdateLessonCompletion,
} from '../schema/learning/lesson-completions'
export type {
  SelectQuizQuestion,
  InsertQuizQuestion,
  UpdateQuizQuestion,
} from '../schema/learning/quiz-questions'
export type {
  SelectQuizAttempt,
  InsertQuizAttempt,
  UpdateQuizAttempt,
} from '../schema/learning/quiz-attempts'
export type {
  SelectQuizAnswer,
  InsertQuizAnswer,
  UpdateQuizAnswer,
} from '../schema/learning/quiz-answers'
export type {
  SelectQuizAnswerHistory,
  InsertQuizAnswerHistory,
} from '../schema/learning/quiz-answer-history'
export type {
  SelectCourseReview,
  InsertCourseReview,
  UpdateCourseReview,
} from '../schema/learning/course-reviews'

export type { SelectAuditLog, InsertAuditLog } from '../schema/ops/audit-logs'
export type { SelectRole, InsertRole, UpdateRole } from '../schema/ops/roles'
export type { SelectPrincipal, InsertPrincipal, UpdatePrincipal } from '../schema/ops/principals'
export type {
  SelectCourseRole,
  InsertCourseRole,
  UpdateCourseRole,
} from '../schema/ops/course-roles'
export type {
  SelectPermissionsReference,
  InsertPermissionsReference,
  UpdatePermissionsReference,
} from '../schema/ops/permissions-reference'
export type { SelectSecurityEvent, InsertSecurityEvent } from '../schema/ops/security-events'
export type {
  SelectFeatureFlag,
  InsertFeatureFlag,
  UpdateFeatureFlag,
} from '../schema/ops/feature-flags'
export type {
  SelectOutboxEvent,
  InsertOutboxEvent,
  UpdateOutboxEvent,
} from '../schema/ops/outbox-events'
export type {
  SelectWebhookEvent,
  InsertWebhookEvent,
  UpdateWebhookEvent,
} from '../schema/ops/webhook-events'
export type {
  SelectSystemConfig,
  InsertSystemConfig,
  UpdateSystemConfig,
} from '../schema/ops/system-configs'
export type { SelectApiKey, InsertApiKey, UpdateApiKey } from '../schema/ops/api-keys'

export type {
  SelectFileMetadata,
  InsertFileMetadata,
  UpdateFileMetadata,
} from '../schema/shared/file-metadata'
