import { createFileRoute, redirect } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth/server'

/**
 * `/courses/$courseId/lessons/$lessonId` — a **route alias**, not a second
 * editor (spec 04 § Routing Contract).
 *
 * Search results, notifications and the Media "Used in" list still link here, so
 * the path has to keep resolving — but the spec is explicit that it "must not
 * host a second editor implementation". It redirects to the workspace Curriculum
 * tab with the item selected, which renders the same `LessonEditor` the old
 * route did, under the workspace shell.
 *
 * This redirect is only safe because the item pane renders that editor: an alias
 * pointing at a tab with no pane for the content would delete the only path to
 * editing, which is worse than a known duplication. It runs in `beforeLoad`,
 * before anything renders, so there is never a flash of a standalone lesson page.
 *
 * The guard is widened to match the workspace route rather than kept at
 * admin/editor: the destinations it forwards to are permission-filtered
 * in-component, and a Reviewer deep-linking here should land in the workspace
 * review flow, not on a redirect.
 */
export const Route = createFileRoute('/_app/courses/$courseId/lessons/$lessonId')({
  beforeLoad: ({ params }) => {
    requireRolesBeforeLoad(['admin', 'editor', 'reviewer', 'viewer', 'support'])
    throw redirect({
      to: '/courses/$courseId',
      params: { courseId: params.courseId },
      search: { tab: 'curriculum', item: params.lessonId },
    })
  },
})
