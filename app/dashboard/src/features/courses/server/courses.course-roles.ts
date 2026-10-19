/**
 * Spec 13 S-13.3 Role Assignment — course-role server functions. The heavy
 * lifting lives in `courses.course-roles.impl.server.ts`; the impl is
 * imported inside the handler so this module stays safe for the client
 * bundle.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { COURSE_ROLE_NAMES } from '../courses.course-roles'
import type { CourseRoleAssignment, CourseRoleName } from '../courses.course-roles'

export type { CourseRoleAssignment, CourseRoleName }
export { COURSE_ROLE_NAMES }

const grantSchema = z.object({
  coursePublicId: z.string().uuid(),
  userPublicId: z.string().min(1),
  roleName: z.enum(COURSE_ROLE_NAMES as unknown as [string, ...string[]]),
})

export const grantCourseRole = createServerFn({ method: 'POST' })
  .validator((input: unknown) => grantSchema.parse(input))
  .handler(async ({ data }): Promise<CourseRoleAssignment> => {
    const { grantCourseRoleImpl } = await import('./courses.course-roles.impl.server')
    return grantCourseRoleImpl({
      coursePublicId: data.coursePublicId,
      userPublicId: data.userPublicId,
      roleName: data.roleName as CourseRoleName,
    })
  })

const revokeSchema = z.object({ courseRolePublicId: z.string().uuid() })

export const revokeCourseRole = createServerFn({ method: 'POST' })
  .validator((input: unknown) => revokeSchema.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { revokeCourseRoleImpl } = await import('./courses.course-roles.impl.server')
    return revokeCourseRoleImpl({ courseRolePublicId: data.courseRolePublicId })
  })

const listSchema = z.object({ coursePublicId: z.string().uuid().optional() })

export const listCourseRoles = createServerFn({ method: 'GET' })
  .validator((input: unknown) => listSchema.parse(input))
  .handler(async ({ data }): Promise<CourseRoleAssignment[]> => {
    const { listCourseRolesImpl } = await import('./courses.course-roles.impl.server')
    return listCourseRolesImpl({ coursePublicId: data.coursePublicId })
  })
