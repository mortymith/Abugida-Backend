/**
 * Spec 11 § Resilience States: 403 Forbidden surface.
 * "A dedicated page, never a silent empty list."
 */

export interface ForbiddenConfig {
  readonly resourceName: string | null
  readonly requestId: string | null
}

export function forbiddenTitle(config: ForbiddenConfig): string {
  if (config.resourceName) return `You don't have access to ${config.resourceName}.`
  return "You don't have access to this."
}

export function forbiddenBody(config: ForbiddenConfig): string {
  const resource = config.resourceName ? ` to ${config.resourceName}` : ''
  return `You don't have access${resource}. Ask an Admin to grant you the right role.`
}

export function forbiddenRequestIdLabel(config: ForbiddenConfig): string | null {
  if (!config.requestId) return null
  return `Request ID: ${config.requestId}`
}

/**
 * Spec 11 § Resilience States: 404 Not Found surface.
 * "This was deleted, or you followed an old link."
 */
export interface NotFoundConfig {
  readonly resourceName: string | null
  readonly requestId: string | null
  readonly backLabel: string
}

export function notFoundTitle(config: NotFoundConfig): string {
  if (config.resourceName)
    return `This ${config.resourceName} was deleted, or you followed an old link.`
  return 'This was deleted, or you followed an old link.'
}

export function notFoundBody(config: NotFoundConfig): string {
  return `This ${config.resourceName ?? 'resource'} may have been deleted or the link is outdated.`
}

export function notFoundBackLabel(config: NotFoundConfig): string {
  return `Back to ${config.backLabel}`
}
