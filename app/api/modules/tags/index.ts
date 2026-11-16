/**
 * @module tags
 *
 * Tags feature module — public-facing tag listing and courses by tag.
 *
 * Usage in app.ts:
 * ```ts
 * import { createTagsHandlers, createTagsRouteMap, createTagsRepository, createTagsService } from '#/modules/tags'
 *
 * const tagsRepo = createTagsRepository(db)
 * const tagsService = createTagsService(tagsRepo)
 * const tagsHandlers = createTagsHandlers(tagsService)
 * for (const { route, handler } of createTagsRouteMap(tagsHandlers)) {
 *   app.openapi(route, handler)
 * }
 * ```
 */

export { listTagsRoute, listCoursesByTagRoute } from '#/modules/tags/tags.routes'

export type { ListTagsRoute, ListCoursesByTagRoute } from '#/modules/tags/tags.routes'

export { createTagsHandlers, createTagsRouteMap } from '#/modules/tags/tags.handlers'

export { createTagsRepository, type TagsRepository } from '#/modules/tags/tags.repository'

export { createTagsService, type TagsService } from '#/modules/tags/tags.service'

export type { TagView, TagCourseListQuery } from '#/modules/tags/tags.types'
