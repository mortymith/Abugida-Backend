/**
 * Central registry mapping linkable entity types (search results,
 * notifications) to their destination routes.
 *
 * Routes that belong to other spec modules (Courses S-2.6, Students S-4.2,
 * Settings S-6.x, Content Library S-3.3) do not exist yet. Each entry carries
 * an `exists` flag so the UI can navigate when the target lands and fall back
 * to an explanatory toast instead of a broken route — one flag to flip per
 * module as those specs are implemented.
 */
export type LinkableEntityType =
  'course' | 'lesson' | 'review_queue' | 'student' | 'asset' | 'revenue' | 'team' | 'notification'

export interface EntityLink {
  path: string
  exists: boolean
}

const REGISTRY: Record<LinkableEntityType, EntityLink> = {
  course: { path: '/courses/{id}', exists: true }, // S-2.6 Course Detail (spec part 04) — live
  lesson: { path: '/courses/{id}', exists: false }, // S-2.7 editor needs course+lesson ids; flip when notifications carry both
  review_queue: { path: '/courses/reviews', exists: true }, // S-2.14 Approval Queue — live
  student: { path: '/students/{id}', exists: true }, // S-4.2 Student Profile (spec part 06) — live
  asset: { path: '/content-library/{id}', exists: true }, // S-3.3 Asset Detail (spec part 05) — live
  revenue: { path: '/dashboard/revenue', exists: true },
  team: { path: '/settings/team', exists: true }, // S-6.2 Team Management (spec part 08) — live
  notification: { path: '/notifications', exists: true },
}

export function resolveEntityLink(
  type: LinkableEntityType,
  entityPublicId: string,
  extra?: Record<string, string>,
): EntityLink {
  const entry = REGISTRY[type]
  let path = entry.path.replace('{id}', encodeURIComponent(entityPublicId))
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      path = path.replace(`{${key}}`, encodeURIComponent(value))
    }
  }
  return { path, exists: entry.exists }
}
