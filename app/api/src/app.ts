/**
 * @module app
 *
 * Hono application composition. Wires the shared auth, observability, database,
 * queue and storage infrastructure together, applies the API middleware stack
 * (`src/middleware`) and exposes the HTTP endpoints.
 *
 * Configuration lives in `./config`; this module only consumes it.
 */

import { OpenAPIHono, extendZodWithOpenApi } from '@hono/zod-openapi'
import { z } from 'zod'
import { createConnection } from '@abugida/queue'
import type { RedisClient } from 'bun'
import { createStorage, type Storage, type StorageConfig } from '@abugida/storage'
import type { QueueClient } from '@abugida/queue'
import { mountAuthRoutes } from '@abugida/auth/hono'
import { verifyRequestOrigin } from '@abugida/auth'
import {
  socialSignInRoute,
  oauthCallbackRoute,
  signOutRoute,
  getSessionRoute,
  refreshSessionRoute,
} from './modules/auth'

import { appConfig } from './config/app_config'
import { createAuthInstance } from './config/auth'
import { db } from './config/database'
import { createQueue } from './config/queue'
import { queueConfig } from './config/queue'
import { logger } from './config/observability'
import { createRateLimiters } from './config/rate-limit'
import { applyMiddleware, zodOpenApiHook, type AppEnv } from './middleware'
import {
  createSystemHandlers,
  createSystemRouteMap,
  createUserRepository,
  createUsersService,
  createUsersHandlers,
  createUsersRouteMap,
  createEnrollmentsRepository,
  createEnrollmentsService,
  createEnrollmentsHandlers,
  createEnrollmentsRouteMap,
  createBookmarksRepository,
  createBookmarksService,
  createBookmarksHandlers,
  createBookmarksRouteMap,
  createRecommendationsRepository,
  createRecommendationsService,
  createRecommendationsHandlers,
  createRecommendationsRouteMap,
  createExamTypesRepository,
  createExamTypesService,
  createExamTypesHandlers,
  createExamTypesRouteMap,
  createTagsRepository,
  createTagsService,
  createTagsHandlers,
  createTagsRouteMap,
  createResourcesRepository,
  createResourcesService,
  createResourcesHandlers,
  createResourcesRouteMap,
  createBundlesRepository,
  createBundlesService,
  createBundlesHandlers,
  createBundlesRouteMap,
  createDownloadsRepository,
  createDownloadsService,
  createDownloadsHandlers,
  createDownloadsRouteMap,
  createPurchasesRepository,
  createPurchasesService,
  createPurchasesHandlers,
  createPurchasesRouteMap,
  createQuizzesRepository,
  createQuizzesService,
  createQuizzesHandlers,
  createQuizzesRouteMap,
  createWebhooksRepository,
  createWebhooksService,
  createWebhooksHandlers,
  createWebhooksRouteMap,
  registerSystemDocumentation,
} from './modules'

extendZodWithOpenApi(z)

/**
 * Build the S3-compatible storage config from validated application config.
 * Returns `undefined` when storage is not configured, keeping the API
 * operational without object storage (graceful degradation).
 */
function buildStorageConfig(): StorageConfig | undefined {
  if (!appConfig.STORAGE_PROVIDER) return undefined
  return {
    provider: appConfig.STORAGE_PROVIDER,
    endpoint: appConfig.STORAGE_ENDPOINT!,
    region: appConfig.STORAGE_REGION,
    accessKeyId: appConfig.STORAGE_ACCESS_KEY_ID ?? '',
    secretAccessKey: appConfig.STORAGE_SECRET_ACCESS_KEY ?? '',
    bucket: appConfig.STORAGE_BUCKET ?? '',
    forcePathStyle: appConfig.STORAGE_FORCE_PATH_STYLE,
    ...(appConfig.STORAGE_MAX_ATTEMPTS !== undefined
      ? { maxAttempts: appConfig.STORAGE_MAX_ATTEMPTS }
      : {}),
    ...(appConfig.STORAGE_REQUEST_TIMEOUT !== undefined
      ? { requestTimeout: appConfig.STORAGE_REQUEST_TIMEOUT }
      : {}),
    ...(appConfig.STORAGE_CONNECTION_TIMEOUT !== undefined
      ? { connectionTimeout: appConfig.STORAGE_CONNECTION_TIMEOUT }
      : {}),
  }
}

export interface ApiApplication {
  app: OpenAPIHono<AppEnv>
  queue?: QueueClient | undefined
  storage?: Storage | undefined
}

/**
 * Create the fully wired Hono application. Fails fast when authentication
 * cannot be configured (e.g. no OAuth provider is present). The rate limiter
 * falls back to in-memory limiters when the shared Redis connection cannot be
 * created, so the API still boots for local development.
 */
export function createApp(): ApiApplication {
  const auth = createAuthInstance()

  let queue: QueueClient | undefined
  let storage: Storage | undefined

  try {
    queue = createQueue()
  } catch (err) {
    logger.warn({ error: (err as Error).message }, 'Queue unavailable — skipping')
  }

  try {
    const storageConfig = buildStorageConfig()
    if (storageConfig) storage = createStorage(storageConfig)
  } catch (err) {
    logger.warn({ error: (err as Error).message }, 'Storage unavailable — skipping')
  }

  let rateLimitRedis: RedisClient | undefined
  try {
    // Reuse the shared queue Redis connection (Bun's native client). Lazily
    // connects on first command; purpose-tagged so it doesn't collide with the
    // producer/worker connections.
    rateLimitRedis = createConnection(queueConfig, 'rate-limit')
  } catch (err) {
    logger.warn(
      { error: (err as Error).message },
      'Rate-limit Redis unavailable — using in-memory limiters',
    )
  }
  const limiters = createRateLimiters(rateLimitRedis)

  const app = new OpenAPIHono<AppEnv>({
    defaultHook: zodOpenApiHook,
  })

  applyMiddleware(app, { auth, db, limiters })

  // ── Feature modules ──────────────────────────────────────────────────────

  // ── Auth — Better Auth endpoints ─────────────────────────────────────────
  // Register documentation routes before the mounted catch-all so Hono
  // matches these explicit routes first. Better Auth remains the handler.
  // Better Auth's generated handler response is intentionally broader than
  // the response types declared by these documentation-only routes.
  // OpenAPI validation consumes JSON request bodies before invoking the handler.
  // Rebuild the social sign-in request so Better Auth can parse the body too.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const socialAuthHandler = ((c: any) => {
    const body = c.req.valid('json')
    const request = new Request(c.req.raw.url, {
      method: c.req.raw.method,
      headers: c.req.raw.headers,
      body: JSON.stringify(body),
    })
    return auth.raw.handler(request)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const authHandler = ((c: any) => auth.raw.handler(c.req.raw)) as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const refreshHandler = async (c: any) => {
    if (auth.config.cors?.origins) {
      const originCheck = verifyRequestOrigin(c.req.raw, {
        trustedOrigins: auth.config.cors.origins,
      })
      if (!originCheck.ok) {
        return c.json(
          { error: { kind: originCheck.error.kind, message: originCheck.error.message } },
          403,
        )
      }
    }

    const result = await auth.refreshSession(c.req.raw.headers)
    if (!result.ok) {
      return c.json({ error: { kind: result.error.kind, message: result.error.message } }, 401)
    }
    return c.json({ session: result.value.session, user: result.value.user })
  }
  app.openapi(socialSignInRoute, socialAuthHandler)
  app.openapi(oauthCallbackRoute, authHandler)
  app.openapi(signOutRoute, authHandler)
  app.openapi(getSessionRoute, authHandler)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.openapi(refreshSessionRoute, refreshHandler as any)
  mountAuthRoutes(app as unknown as Parameters<typeof mountAuthRoutes>[0], auth)

  // Users module — profile, onboarding, consents, devices, dashboard
  const userRepo = createUserRepository(db)
  const usersService = createUsersService(userRepo, queue)
  const usersHandlers = createUsersHandlers(usersService)
  for (const { route, handler } of createUsersRouteMap(usersHandlers)) {
    app.openapi(route, handler)
  }

  // Enrollments module — progress, enrollments, lesson completions
  const enrollmentsRepo = createEnrollmentsRepository(db)
  const enrollmentsService = createEnrollmentsService(enrollmentsRepo, queue)
  const enrollmentsHandlers = createEnrollmentsHandlers(enrollmentsService)
  for (const { route, handler } of createEnrollmentsRouteMap(enrollmentsHandlers)) {
    app.openapi(route, handler)
  }

  // Bookmarks module — quick-access bookmarks
  const bookmarksRepo = createBookmarksRepository(db)
  const bookmarksService = createBookmarksService(bookmarksRepo)
  const bookmarksHandlers = createBookmarksHandlers(bookmarksService)
  for (const { route, handler } of createBookmarksRouteMap(bookmarksHandlers)) {
    app.openapi(route, handler)
  }

  // Recommendations module — personalized course recommendations
  const recommendationsRepo = createRecommendationsRepository(db)
  const recommendationsService = createRecommendationsService(recommendationsRepo)
  const recommendationsHandlers = createRecommendationsHandlers(recommendationsService)
  for (const { route, handler } of createRecommendationsRouteMap(recommendationsHandlers)) {
    app.openapi(route, handler)
  }

  // Exam types module — public exam type hierarchy navigation
  const examTypesRepo = createExamTypesRepository(db)
  const examTypesService = createExamTypesService(examTypesRepo)
  const examTypesHandlers = createExamTypesHandlers(examTypesService)
  for (const { route, handler } of createExamTypesRouteMap(examTypesHandlers)) {
    app.openapi(route, handler)
  }

  // Tags module — public tag listing and courses by tag
  const tagsRepo = createTagsRepository(db)
  const tagsService = createTagsService(tagsRepo)
  const tagsHandlers = createTagsHandlers(tagsService)
  for (const { route, handler } of createTagsRouteMap(tagsHandlers)) {
    app.openapi(route, handler)
  }

  // Resources module — courses, modules, lessons (public content hierarchy)
  const resourcesRepo = createResourcesRepository(db)
  const resourcesService = createResourcesService(resourcesRepo)
  const resourcesHandlers = createResourcesHandlers(resourcesService)
  for (const { route, handler } of createResourcesRouteMap(resourcesHandlers)) {
    app.openapi(route, handler)
  }

  // Bundles module — course bundles, bundle courses, purchase options, search
  const bundlesRepo = createBundlesRepository(db)
  const bundlesService = createBundlesService(bundlesRepo)
  const bundlesHandlers = createBundlesHandlers(bundlesService)
  for (const { route, handler } of createBundlesRouteMap(bundlesHandlers)) {
    app.openapi(route, handler)
  }

  // Downloads module — offline course content downloads, status, presigned URLs
  const downloadsRepo = createDownloadsRepository(db)
  const downloadsService = createDownloadsService(downloadsRepo, storage)
  const downloadsHandlers = createDownloadsHandlers(downloadsService)
  for (const { route, handler } of createDownloadsRouteMap(downloadsHandlers)) {
    app.openapi(route, handler)
  }

  // Purchases module — Telebirr-only purchases for courses and bundles
  const purchasesRepo = createPurchasesRepository(db)
  const purchasesService = createPurchasesService(purchasesRepo)
  const purchasesHandlers = createPurchasesHandlers(purchasesService)
  for (const { route, handler } of createPurchasesRouteMap(purchasesHandlers)) {
    app.openapi(route, handler)
  }

  // Quizzes module — quiz questions, attempts, and answer submission
  const quizzesRepo = createQuizzesRepository(db)
  const quizzesService = createQuizzesService(quizzesRepo)
  const quizzesHandlers = createQuizzesHandlers(quizzesService)
  for (const { route, handler } of createQuizzesRouteMap(quizzesHandlers)) {
    app.openapi(route, handler)
  }

  // Webhooks module — incoming webhooks from payment providers and SMS service
  const webhooksRepo = createWebhooksRepository(db)
  const webhooksService = createWebhooksService(webhooksRepo, queue)
  const webhooksHandlers = createWebhooksHandlers(webhooksService)
  for (const { route, handler } of createWebhooksRouteMap(webhooksHandlers)) {
    app.openapi(route, handler)
  }

  // ── System endpoints ──────────────────────────────────────────────────

  const systemHandlers = createSystemHandlers()
  for (const { route, handler } of createSystemRouteMap(systemHandlers)) {
    app.openapi(route, handler)
  }

  // ── Documentation endpoints (development only) ──────────────────────────

  registerSystemDocumentation(app)

  return { app, queue, storage }
}
