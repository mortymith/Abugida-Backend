import { eq, and, desc } from 'drizzle-orm'
import { db } from './db'
import { courses, modules, lessons, enrollments, courseStats, courseReviews } from '../schema'

/**
 * Example: Querying courses with relations
 *
 * This demonstrates various query patterns using Drizzle ORM
 * with the Abugida schema.
 */

// 1. Get all published courses with stats
const publishedCourses = await db
  .select({
    id: courses.id,
    publicId: courses.publicId,
    title: courses.title,
    slug: courses.slug,
    status: courses.status,
    isFree: courses.isFree,
    totalEnrollments: courseStats.totalEnrollments,
    averageRating: courseStats.averageRating,
  })
  .from(courses)
  .leftJoin(courseStats, eq(courses.id, courseStats.courseId))
  .where(eq(courses.status, 'published'))
  .orderBy(desc(courseStats.popularityScore))

console.log('Published courses:', publishedCourses)

// 2. Get course with its modules and lessons
const courseId = 1
const courseWithModules = await db.query.courses.findFirst({
  where: eq(courses.id, courseId),
  with: {
    modules: {
      orderBy: (modules, { asc }) => [asc(modules.sortOrder)],
      with: {
        lessons: {
          orderBy: (lessons, { asc }) => [asc(lessons.id)],
        },
      },
    },
    stats: true,
  },
})

console.log('Course with modules:', courseWithModules)

// 3. Get student enrollment with progress
const studentId = 1
const studentEnrollments = await db
  .select({
    enrollmentId: enrollments.id,
    progressPercentage: enrollments.progressPercentage,
    isCompleted: enrollments.isCompleted,
    lastAccessedAt: enrollments.lastAccessedAt,
    courseTitle: courses.title,
    courseSlug: courses.slug,
  })
  .from(enrollments)
  .innerJoin(courses, eq(enrollments.courseId, courses.id))
  .where(eq(enrollments.studentId, studentId))
  .orderBy(desc(enrollments.lastAccessedAt))

console.log('Student enrollments:', studentEnrollments)

// 4. Get course reviews
const courseReviewsList = await db
  .select({
    rating: courseReviews.rating,
    title: courseReviews.title,
    content: courseReviews.content,
    moderationStatus: courseReviews.moderationStatus,
    createdAt: courseReviews.createdAt,
  })
  .from(courseReviews)
  .where(and(eq(courseReviews.courseId, courseId), eq(courseReviews.moderationStatus, 'approved')))
  .orderBy(desc(courseReviews.createdAt))

console.log('Course reviews:', courseReviewsList)
