/**
 * @example tanstack/server-functions
 * @description Instrumenting TanStack Start server functions with observability.
 *
 * Place these snippets inside your app/dashboard project.
 */

import { createServerFn } from '@tanstack/react-start'
import {
  initObservability,
  shutdownObservability,
  logger,
  withSpan,
  recordServerError,
  createInstrumentedHandler,
  withServerSpan,
} from '../src/index.ts'

await initObservability({
  serviceName: 'dashboard',
  serviceVersion: '1.0.0',
  environment: process.env.NODE_ENV ?? 'development',
})

logger.info('Observability initialized for dashboard')

// ---------------------------------------------------------------------------
// Server function: Fetch user profile
// ---------------------------------------------------------------------------

export const getUserProfile = createServerFn({ method: 'GET' }).handler(async ({ data }) => {
  return withServerSpan('dashboard.getUserProfile', async (span) => {
    const userId = (data as { userId: string }).userId
    span.setAttribute('user.id', userId)

    const profile = await fetchUserProfile(userId)
    span.setAttribute('user.email_verified', profile.emailVerified)

    return profile
  })
})

// ---------------------------------------------------------------------------
// Server function: Publish a course (with error handling)
// ---------------------------------------------------------------------------

export const publishCourse = createServerFn({ method: 'POST' }).handler(async ({ data }) => {
  return withServerSpan('dashboard.publishCourse', async (span) => {
    try {
      const { courseId } = data as { courseId: string }
      span.setAttribute('course.id', courseId)

      const course = await loadCourse(courseId)
      validateCourse(course)

      const result = await withSpan('course.publish', async (publishSpan) => {
        publishSpan.setAttribute('course.id', courseId)
        publishSpan.setAttribute('course.chapters', course.chapterCount)
        return doPublish(courseId)
      })

      logger.info({ courseId, success: true }, 'Course published')
      return result
    } catch (error) {
      recordServerError(error)
      throw error
    }
  })
})

// ---------------------------------------------------------------------------
// Wrapped server function with auto-tracing
// ---------------------------------------------------------------------------

const fetchDashboardStats = createInstrumentedHandler(
  'dashboard.fetchStats',
  async (span, userId: string) => {
    span.setAttribute('user.id', userId)

    const stats = await computeStats(userId)
    span.setAttribute('stats.courses_enrolled', stats.enrolledCount)
    span.setAttribute('stats.courses_completed', stats.completedCount)

    return stats
  },
)

export async function getDashboardStats(userId: string) {
  return fetchDashboardStats(userId)
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

process.addListener('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down')
  await shutdownObservability()
  process.exit(0)
})

// ---------------------------------------------------------------------------
// Helpers (stubs)
// ---------------------------------------------------------------------------

interface UserProfile {
  id: string
  email: string
  emailVerified: boolean
}

interface Course {
  id: string
  title: string
  chapterCount: number
}

interface Stats {
  enrolledCount: number
  completedCount: number
}

async function fetchUserProfile(userId: string): Promise<UserProfile> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  return { id: userId, email: 'user@example.com', emailVerified: true }
}

async function loadCourse(courseId: string): Promise<Course> {
  await new Promise((resolve) => setTimeout(resolve, 20))
  return { id: courseId, title: 'Sample', chapterCount: 12 }
}

function validateCourse(course: Course): void {
  if (course.chapterCount === 0) {
    throw new Error('Course must have at least one chapter')
  }
}

async function doPublish(courseId: string): Promise<{ publishedAt: string }> {
  await new Promise((resolve) => setTimeout(resolve, 100))
  return { publishedAt: new Date().toISOString() }
}

async function computeStats(userId: string): Promise<Stats> {
  await new Promise((resolve) => setTimeout(resolve, 50))
  return { enrolledCount: 5, completedCount: 3 }
}
