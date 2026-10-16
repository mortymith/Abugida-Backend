/**
 * S-7.12 Forbidden (403) surface (spec 09 § S-7.12).
 * "A dedicated page, never a silent empty list."
 */

export interface ForbiddenConfig {
  readonly resourceName: string | null
  readonly requestId: string | null
}

export function forbiddenTitle(config: ForbiddenConfig): string {
  if (config.resourceName) {
    return `You don't have access to ${config.resourceName}.`
  }
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
