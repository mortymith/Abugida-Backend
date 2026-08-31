/**
 * @example hono/basic
 * @description Basic observability setup for a Hono REST API.
 *
 * Run with: bun run examples/hono/basic.ts
 */

import { Hono } from 'hono'
import {
  initObservability,
  shutdownObservability,
  logger,
  getTracer,
  createCounter,
  createHistogram,
  recordError,
  withSpan,
} from '../src/index.ts'
import { observabilityMiddleware } from '../src/integrations/hono.ts'

const app = new Hono()

async function bootstrap() {
  await initObservability({
    serviceName: 'api',
    serviceVersion: '1.0.0',
    environment: process.env.NODE_ENV ?? 'development',
  })

  logger.info('Observability initialized for API')

  const requestCounter = createCounter('http_requests_total', {
    description: 'Total number of HTTP requests',
  })

  const requestDuration = createHistogram('http_request_duration_ms', {
    description: 'HTTP request duration in milliseconds',
    unit: 'ms',
  })

  app.use('*', observabilityMiddleware())

  app.get('/health', async (c) => {
    const start = performance.now()

    requestCounter.add(1, { method: 'GET', route: '/health' })

    try {
      await withSpan('health.check', async (span) => {
        span.setAttribute('check.type', 'database')
        await checkDatabase()
        return true
      })

      const duration = performance.now() - start
      requestDuration.record(duration, { method: 'GET', route: '/health' })

      return c.json({ status: 'healthy', timestamp: new Date().toISOString() })
    } catch (error) {
      recordError(error)
      return c.json({ status: 'unhealthy', error: String(error) }, 503)
    }
  })

  app.get('/api/courses', async (c) => {
    return withSpan('api.listCourses', async (span) => {
      span.setAttribute('course.list.limit', 20)

      const courses = await fetchCourses()
      span.setAttribute('course.list.count', courses.length)

      return c.json({ courses })
    })
  })

  app.post('/api/courses/:id/enroll', async (c) => {
    const courseId = c.req.param('id')
    const userId = c.req.header('x-user-id') ?? 'anonymous'

    return withSpan('api.enrollCourse', async (span) => {
      span.setAttribute('course.id', courseId)
      span.setAttribute('user.id', userId)

      const enrollment = await enrollUser(courseId, userId)
      span.setAttribute('enrollment.id', enrollment.id)

      return c.json({ enrollment }, 201)
    })
  })

  process.addListener('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down')
    await shutdownObservability()
    process.exit(0)
  })

  logger.info('Starting Hono server on port 3000')
  return Bun.serve({ port: 3000, fetch: app.fetch })
}

async function checkDatabase(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10))
}

async function fetchCourses(): Promise<Array<{ id: string; title: string }>> {
  await new Promise((resolve) => setTimeout(resolve, 50))
  return [
    { id: '1', title: 'Introduction to TypeScript' },
    { id: '2', title: 'Advanced React Patterns' },
  ]
}

async function enrollUser(
  courseId: string,
  userId: string,
): Promise<{ id: string; courseId: string; userId: string }> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  return { id: `enroll_${Date.now()}`, courseId, userId }
}

bootstrap()
