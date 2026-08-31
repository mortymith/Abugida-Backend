/**
 * @example tanstack/ssr-instrumentation
 * @description Instrumenting SSR rendering and route loaders in TanStack Start.
 *
 * Place this in your app/dashboard project.
 */

import { createMiddleware } from '@tanstack/react-start'
import { initObservability, logger, withServerSpan, recordServerError } from '../src/index.ts'

await initObservability({
  serviceName: 'dashboard',
  serviceVersion: '1.0.0',
  environment: process.env.NODE_ENV ?? 'development',
})

// ---------------------------------------------------------------------------
// Global middleware that creates a span for every request
// ---------------------------------------------------------------------------

export const observabilityMiddleware = createMiddleware().server(async ({ next, request }) => {
  return withServerSpan('http.request', async (span) => {
    const url = new URL(request.url)
    span.setAttribute('http.method', request.method)
    span.setAttribute('http.path', url.pathname)
    span.setAttribute('http.user_agent', request.headers.get('user-agent') ?? 'unknown')

    try {
      const result = await next({ context: { traceSpan: span } })
      span.setAttribute('http.status_code', 200)
      return result
    } catch (error) {
      span.setAttribute('http.status_code', 500)
      recordServerError(error)
      throw error
    }
  })
})

// ---------------------------------------------------------------------------
// Route loader with custom span
// ---------------------------------------------------------------------------

export async function loadDashboardData(userId: string) {
  return withServerSpan('loader.dashboard', async (span) => {
    span.setAttribute('user.id', userId)

    const [enrollments, recommendations, progress] = await Promise.all([
      withServerSpan('db.fetchEnrollments', async (s) => {
        s.setAttribute('user.id', userId)
        return fetchEnrollments(userId)
      }),
      withServerSpan('ml.fetchRecommendations', async (s) => {
        s.setAttribute('user.id', userId)
        s.setAttribute('ml.model', 'course-recommender-v2')
        return fetchRecommendations(userId)
      }),
      withServerSpan('db.fetchProgress', async (s) => {
        s.setAttribute('user.id', userId)
        return fetchProgress(userId)
      }),
    ])

    span.setAttribute('loader.enrollments', enrollments.length)
    span.setAttribute('loader.recommendations', recommendations.length)

    logger.info(
      {
        userId,
        enrollments: enrollments.length,
        recommendations: recommendations.length,
      },
      'Dashboard data loaded',
    )

    return { enrollments, recommendations, progress }
  })
}

// ---------------------------------------------------------------------------
// Server function: Track user action
// ---------------------------------------------------------------------------

export async function trackUserAction(
  userId: string,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  return withServerSpan('user.action', async (span) => {
    span.setAttribute('user.id', userId)
    span.setAttribute('action.name', action)
    for (const [key, value] of Object.entries(metadata)) {
      span.setAttribute(`action.${key}`, String(value))
    }

    logger.info({ userId, action, metadata }, 'User action tracked')
    return { tracked: true }
  })
}

// ---------------------------------------------------------------------------
// Helpers (stubs)
// ---------------------------------------------------------------------------

interface Enrollment {
  id: string
  courseId: string
  progress: number
}

interface Recommendation {
  id: string
  courseId: string
  score: number
}

interface Progress {
  userId: string
  totalHours: number
  currentStreak: number
}

async function fetchEnrollments(userId: string): Promise<Enrollment[]> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  return [{ id: '1', courseId: 'c1', progress: 0.5 }]
}

async function fetchRecommendations(userId: string): Promise<Recommendation[]> {
  await new Promise((resolve) => setTimeout(resolve, 80))
  return [{ id: 'r1', courseId: 'c2', score: 0.92 }]
}

async function fetchProgress(userId: string): Promise<Progress> {
  await new Promise((resolve) => setTimeout(resolve, 20))
  return { userId, totalHours: 42, currentStreak: 7 }
}
