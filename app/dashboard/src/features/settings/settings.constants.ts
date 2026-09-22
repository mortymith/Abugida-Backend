/**
 * Static settings constants (spec 08 + spec 11). Pure data — no db, no env —
 * so both server and client code and unit tests can import it safely.
 */

// ── S-6.1 General ────────────────────────────────────────────────────────────

export const DATE_FORMATS = ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'] as const

export const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'am', label: 'አማርኛ (Amharic)' },
] as const

export const COMMON_TIMEZONES = [
  'Africa/Addis_Ababa',
  'Africa/Nairobi',
  'Africa/Lagos',
  'Europe/London',
  'Europe/Berlin',
  'America/New_York',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'UTC',
] as const

// ── S-6.2 Team role definitions (spec S-6.2 wireframe) ───────────────────────

export const ROLE_DEFINITIONS: Array<{ role: string; description: string }> = [
  { role: 'Admin', description: 'Full access to all features' },
  { role: 'Editor', description: 'Can create, edit, and manage courses' },
  { role: 'Reviewer', description: 'Approves or rejects lessons for publication' },
  { role: 'Viewer', description: 'Read-only access to courses and analytics' },
  { role: 'Support', description: 'Can view students and send communications' },
]

// ── S-6.9 Roles & Permissions matrix (spec 11 modules) ───────────────────────

export const PERMISSION_MODULES = [
  'Dashboard',
  'Courses',
  'Content Library',
  'Students',
  'Analytics',
  'Settings',
  'Billing',
] as const

export const PERMISSION_CAPABILITIES = ['view', 'create', 'edit', 'delete', 'publish'] as const

export type PermissionModule = (typeof PERMISSION_MODULES)[number]
export type PermissionCapability = (typeof PERMISSION_CAPABILITIES)[number]

export type PermissionMatrix = Record<string, string[]>

/**
 * Spec 11 roles matrix translated into module → capabilities per role. This
 * is the starting default when a role row is first saved and the baseline a
 * custom role clones. Capabilities not meaningful for a module are simply
 * absent (matches the "—" cells in the spec matrix).
 */
export const BUILT_IN_ROLE_PERMISSIONS: Record<string, PermissionMatrix> = {
  admin: {
    Dashboard: ['view', 'create', 'edit', 'delete', 'publish'],
    Courses: ['view', 'create', 'edit', 'delete', 'publish'],
    'Content Library': ['view', 'create', 'edit', 'delete', 'publish'],
    Students: ['view', 'create', 'edit', 'delete', 'publish'],
    Analytics: ['view', 'create', 'edit', 'delete', 'publish'],
    Settings: ['view', 'create', 'edit', 'delete'],
    Billing: ['view', 'create', 'edit', 'delete'],
  },
  editor: {
    Dashboard: ['view', 'create', 'edit', 'delete', 'publish'],
    Courses: ['view', 'create', 'edit', 'publish'],
    'Content Library': ['view', 'create', 'edit', 'delete', 'publish'],
    Students: ['view', 'create', 'edit'],
    Analytics: ['view'],
  },
  reviewer: {
    Dashboard: ['view'],
    Courses: ['view', 'publish'],
    Analytics: ['view'],
    Students: ['view'],
    'Content Library': ['view'],
  },
  viewer: {
    Dashboard: ['view'],
    Courses: ['view'],
    'Content Library': ['view'],
    Analytics: ['view'],
    Students: ['view'],
  },
  support: {
    Dashboard: ['view'],
    Students: ['view', 'create'],
    Analytics: ['view'],
    Courses: ['view'],
  },
}

/** Built-in roles are seeded from this order; admin always exists first. */
export const BUILT_IN_ROLES = ['admin', 'editor', 'reviewer', 'support', 'viewer'] as const

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  admin: 'Full access to all features',
  editor: 'Can create, edit, and manage courses',
  reviewer: 'Approves or rejects lessons for publication',
  support: 'Can view students and send communications',
  viewer: 'Read-only access to courses and analytics',
}

// ── S-6.7 API keys ───────────────────────────────────────────────────────────

export const API_KEY_PREFIX = 'sk_live'
export const WEBHOOK_EVENT_TYPES = [
  'enrollment.created',
  'course.published',
  'student.updated',
  'payment.completed',
] as const

// ── S-6.10 Privacy ───────────────────────────────────────────────────────────

export const SLA_DAYS = 30
export const SLA_WARNING_DAYS = 5
export const RETENTION_INACTIVITY_OPTIONS = [6, 12, 18, 24, 36] as const
export const RETENTION_WARNING_OPTIONS = [7, 14, 30] as const
