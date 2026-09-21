import { createFileRoute } from '@tanstack/react-router'
import { requireRolesBeforeLoad } from '#/features/auth'

/**
 * Courses section guard (spec 04). All authenticated platform roles can see
 * the catalog; deeper screens gate themselves per the spec 11 matrix.
 */
export const Route = createFileRoute('/_app/courses')({
  beforeLoad: () => requireRolesBeforeLoad(['admin', 'editor', 'reviewer', 'viewer', 'support']),
})
