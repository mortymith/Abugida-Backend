/**
 * @module system
 *
 * System module — health checks, metrics, operational endpoints, and
 * self-hosted API documentation.
 *
 * Usage in app.ts:
 * ```ts
 * import {
 *   createSystemHandlers,
 *   createSystemRouteMap,
 *   registerSystemDocumentation,
 * } from './modules/system'
 *
 * const systemHandlers = createSystemHandlers()
 * for (const { route, handler } of createSystemRouteMap(systemHandlers)) {
 *   app.openapi(route, handler)
 * }
 *
 * registerSystemDocumentation(app)
 * ```
 */

export {
  rootRoute,
  healthLivenessRoute,
  healthReadinessRoute,
  registerSystemDocumentation,
} from './system.routes'

export type { RootRoute, HealthLivenessRoute, HealthReadinessRoute } from './system.routes'

export { createSystemHandlers, createSystemRouteMap } from './system.handlers'
