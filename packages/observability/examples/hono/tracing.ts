/**
 * @example hono/tracing
 * @description Observability tracing usage in a Hono API with child spans.
 *
 * Run with: bun run examples/hono/tracing.ts
 */

import { Hono } from 'hono'
import {
  initObservability,
  shutdownObservability,
  logger,
  getTracer,
  withSpan,
  recordError,
} from '../src/index.ts'
import { observabilityMiddleware } from '../src/integrations/hono.ts'

const app = new Hono()

async function bootstrap() {
  await initObservability({
    serviceName: 'api-tracing',
    serviceVersion: '1.0.0',
    environment: 'production',
  })

  const tracer = getTracer('api-tracing')

  app.use('*', observabilityMiddleware())

  app.post('/api/courses/:courseId/publish', async (c) => {
    const courseId = c.req.param('courseId')

    return tracer.startActiveSpan('publishCourse', async (span) => {
      try {
        span.setAttribute('course.id', courseId)
        span.setAttribute('user.id', c.req.header('x-user-id') ?? 'unknown')

        const course = await withSpan('db.fetchCourse', async (s) => {
          s.setAttribute('db.operation', 'SELECT')
          return fetchCourseFromDb(courseId)
        })

        await withSpan('validate.course', async (s) => {
          s.setAttribute('validation.type', 'business_rules')
          validateCourse(course)
        })

        const mediaAssets = await withSpan('storage.uploadAssets', async (s) => {
          s.setAttribute('storage.bucket', 'course-media')
          s.setAttribute('storage.operation', 'upload')
          return uploadCourseMedia(courseId)
        })

        const publishedCourse = await withSpan('db.updateCourse', async (s) => {
          s.setAttribute('db.operation', 'UPDATE')
          s.setAttribute('db.table', 'courses')
          return updateCourseInDb(courseId, { status: 'published', mediaAssets })
        })

        await withSpan('queue.scheduleNotifications', async (s) => {
          s.setAttribute('queue.name', 'notifications')
          s.setAttribute('notification.type', 'course_published')
          await scheduleNotifications(courseId)
        })

        span.setAttribute('course.published', true)
        span.setAttribute('course.media.count', mediaAssets.length)

        logger.info({ courseId, mediaCount: mediaAssets.length }, 'Course published')

        return c.json({ course: publishedCourse })
      } catch (error) {
        recordError(error)
        span.recordException(error instanceof Error ? error : new Error(String(error)))
        return c.json({ error: 'Failed to publish course' }, 500)
      } finally {
        span.end()
      }
    })
  })

  app.post('/api/enrollments/bulk', async (c) => {
    const body = await c.req.json<{ userId: string; courseIds: string[] }>()

    return withSpan('bulkEnroll', async (span) => {
      span.setAttribute('user.id', body.userId)
      span.setAttribute('enrollment.count', body.courseIds.length)

      const results = await Promise.allSettled(
        body.courseIds.map((courseId) =>
          withSpan(`enroll.course.${courseId}`, async (s) => {
            s.setAttribute('course.id', courseId)
            return enrollUserInCourse(body.userId, courseId)
          }),
        ),
      )

      const successful = results.filter((r) => r.status === 'fulfilled').length
      const failed = results.filter((r) => r.status === 'rejected').length

      span.setAttribute('enrollment.successful', successful)
      span.setAttribute('enrollment.failed', failed)

      return c.json({ successful, failed })
    })
  })

  process.addListener('SIGTERM', async () => {
    await shutdownObservability()
    process.exit(0)
  })

  return Bun.serve({ port: 3002, fetch: app.fetch })
}

interface Course {
  id: string
  title: string
  status: string
}

async function fetchCourseFromDb(courseId: string): Promise<Course> {
  await new Promise((resolve) => setTimeout(resolve, 20))
  return { id: courseId, title: 'Sample Course', status: 'draft' }
}

function validateCourse(course: Course): void {
  if (!course.title) {
    throw new Error('Course must have a title')
  }
}

async function uploadCourseMedia(courseId: string): Promise<string[]> {
  await new Promise((resolve) => setTimeout(resolve, 100))
  return [`asset_${courseId}_1.mp4`, `asset_${courseId}_2.pdf`]
}

async function updateCourseInDb(courseId: string, updates: Partial<Course>): Promise<Course> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  return { id: courseId, title: 'Sample Course', status: updates.status ?? 'draft' }
}

async function scheduleNotifications(courseId: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 50))
}

async function enrollUserInCourse(userId: string, courseId: string): Promise<{ id: string }> {
  await new Promise((resolve) => setTimeout(resolve, 40))
  return { id: `enrollment_${userId}_${courseId}` }
}

bootstrap()
