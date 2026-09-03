/**
 * @module users.types
 *
 * TypeScript interfaces for the users feature module. These map the API
 * response contracts to the underlying database shapes.
 */

// ── Profile ────────────────────────────────────────────────────────────────

export interface UserProfileView {
  id: string
  displayName: string | null
  email: string
  avatarUrl: string | null
  educationSegment: string | null
  notificationPreferences: Record<string, unknown>
  languagePreference: string
  timezone: string
  examPreferences: unknown[]
  isOnboardingCompleted: boolean
  onboardingStep: number
  accountStatus: string
  createdAt: string
}

export interface UpdateProfileFields {
  displayName?: string
  email?: string
  avatarObjectKey?: string
  educationSegment?: string
  languagePreference?: string
  timezone?: string
  notificationPreferences?: Record<string, unknown>
  examPreferences?: unknown[]
}

// ── Onboarding ─────────────────────────────────────────────────────────────

export interface OnboardingState {
  isCompleted: boolean
  currentStep: number
}

// ── Consents ───────────────────────────────────────────────────────────────

export interface ConsentRecord {
  consentType: string
  consentVersion: string
  isGranted: boolean
  consentedAt: string
}

export interface ConsentUpdateItem {
  consentType: string
  consentVersion: string
  isGranted: boolean
}

// ── Devices ────────────────────────────────────────────────────────────────

export interface DeviceView {
  id: string
  deviceIdentifier: string
  deviceName: string | null
  platform: string | null
  osVersion: string | null
  appVersion: string | null
  lastActiveAt: string
  isActive: boolean
}

export interface DeviceRegistrationFields {
  deviceIdentifier: string
  deviceName?: string
  platform?: string
  osVersion?: string
  appVersion?: string
}

export interface DeviceUpdateFields {
  deviceName?: string
  isActive?: boolean
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export interface DashboardData {
  userStats: UserStats
  recentActivity: ActivityItem[]
  insights: Insight[]
  weeklyData: WeeklyData
  deadlines: Deadline[]
  jumpBack: JumpBackItem
}

export interface UserStats {
  minutesToday: number
  lessonsToday: number
  xpEarned: number
  streakDays: number
  streakTarget: number
}

export interface ActivityItem {
  id: string
  type: string
  title: string
  subtitle: string
  detail: string
  time: string
  group: string
}

export interface Insight {
  id: string
  icon: string
  bgColor: string
  iconColor: string
  title: string
  description: string
}

export interface WeeklyData {
  barHeights: number[]
  dayTotals: string[]
  sessions: Record<string, WeeklySession[]>
}

export interface WeeklySession {
  course: string
  lesson: string
  duration: string
}

export interface Deadline {
  title: string
  date: string
  daysLeft: number
  color: string
}

export interface JumpBackItem {
  title: string
  progress: number
  imageSeed: string
}

// ── GDPR ───────────────────────────────────────────────────────────────────

export interface AccountDeletionRequest {
  confirmation: string
  reason?: string
  deleteAllData?: boolean
}

export interface ExportOptions {
  include: string[] | undefined
  format: 'json' | 'csv' | undefined
}
