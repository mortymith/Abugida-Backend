/**
 * @module errors
 *
 * The tenant package's error vocabulary. Small on purpose: every failure a
 * caller may want to map to a status code or a form field is a subclass with a
 * stable `code`, so an app never has to parse a message to decide what to do.
 */

import type { TenantSlugFailure } from './slug'

/** Base class for every error this package throws. */
export class TenantError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = new.target.name
    this.code = code
  }
}

/** A slug that cannot be used as a tenant identifier or in a tenant URL. */
export class TenantSlugError extends TenantError {
  readonly reason: TenantSlugFailure

  constructor(reason: TenantSlugFailure, message: string) {
    super(`tenant_slug_${reason}`, message)
    this.reason = reason
  }
}

/** The domain configuration is unusable (empty base domain, bad protocol…). */
export class TenantConfigError extends TenantError {
  constructor(message: string) {
    super('tenant_invalid_config', message)
  }
}

/** The hostname did not name a tenant that exists. */
export class TenantNotFoundError extends TenantError {
  constructor(message = 'This workspace does not exist.') {
    super('tenant_not_found', message)
  }
}

/** No authenticated caller, so no tenant context can be established. */
export class TenantUnauthenticatedError extends TenantError {
  constructor(message = 'Sign in to open this workspace.') {
    super('tenant_unauthenticated', message)
  }
}

/** Authenticated, but not a member of the tenant that was requested. */
export class TenantMembershipError extends TenantError {
  constructor(message = 'You do not have access to this workspace.') {
    super('tenant_not_member', message)
  }
}

/** A member of the tenant, but without the permission the operation needs. */
export class TenantPermissionError extends TenantError {
  readonly permission: string

  constructor(permission: string, message?: string) {
    super(
      'tenant_permission_denied',
      message ?? `This action requires the “${permission}” permission.`,
    )
    this.permission = permission
  }
}
