/**
 * @module tags
 *
 * Tags feature module — public-facing tag listing and courses by tag.
 *
 * Usage in app.ts:
 * ```ts
 * import { createTagsHandlers, createTagsRouteMap, createTagsRepository, createTagsService } from './modules/tags'
 *
 * const tagsRepo = createTagsRepository(db)
 * const tagsService = createTagsService(tagsRepo)
 * const tagsHandlers = createTagsHandlers(tagsService)
 * for (const { route, handler } of createTagsRouteMap(tagsHandlers)) {
 *   app.openapi(route, handler)
 * }
 * ```
 */

export { listTagsRoute, listCoursesByTagRoute } from './tags.routes'

export type { ListTagsRoute, ListCoursesByTagRoute } from './tags.routes'

export { createTagsHandlers, createTagsRouteMap } from './tags.handlers'

export { createTagsRepository, type TagsRepository } from './tags.repository'

export { createTagsService, type TagsService } from './tags.service'

export type { TagView, TagCourseListQuery } from './tags.types'
