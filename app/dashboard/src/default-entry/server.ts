/**
 * @module server
 *
 * TanStack Start server entry.
 *
 * Owns the two things the request path needs before anything else runs:
 *
 *  1. **Observability**, initialized once per process. The shared auth
 *     instance (`config/auth.server`) and the feature server bridges log
 *     through `@abugida/observability`, whose logger throws until
 *     `initObservability()` has run — so it has to happen before the first
 *     request is served, not inside a handler.
 *  2. **The `/auth/*` request handler**, owned by `@abugida/auth` and mounted
 *     here at `AUTH_BASE_PATH`. The browser calls this origin directly, so
 *     the dashboard serves its own better-auth endpoints; both apps configure
 *     the same instance from the same package.
 *
 * Better Auth's own OpenAPI documentation endpoints (the schema dump and its
 * Scalar reference page) are not served: the schema is published by the API's
 * own OpenAPI document, and a second copy here would be an undocumented
 * endpoint. The passwordless platform's credential routes are refused the same
 * way.
 */
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import type { Register } from '@tanstack/react-router'
import type { RequestHandler } from '@tanstack/react-start/server'
import { isOpenApiPluginPath, isPasswordlessDisabledPath } from '@abugida/auth/routes'
import { env } from '../config/app.config'
import { init } from '../config/observability.config'

const startHandler = createStartHandler(defaultStreamHandler)

let initialized: Promise<void> | undefined

/** Idempotent: the first request wins, later ones await the same promise. */
function ensureInitialized(): Promise<void> {
  initialized ??= (async () => {
    try {
      await init()
    } catch (error: unknown) {
      // A telemetry backend being unreachable must not take the app down.
      console.error('Observability init failed:', error)
    }
  })()
  return initialized
}

const fetch: RequestHandler<Register> = async (...args) => {
  const request = args[0]
  const url = new URL(request.url)

  await ensureInitialized()

  if (url.pathname === env.AUTH_BASE_PATH || url.pathname.startsWith(`${env.AUTH_BASE_PATH}/`)) {
    if (
      isOpenApiPluginPath(url.pathname, env.AUTH_BASE_PATH) ||
      isPasswordlessDisabledPath(url.pathname, env.AUTH_BASE_PATH)
    ) {
      return new Response('Not Found', { status: 404 })
    }
    const { getAuth } = await import('../config/auth.server')
    return getAuth().raw.handler(request)
  }

  return startHandler(...args)
}

export type ServerEntry = { fetch: RequestHandler<Register> }

export function createServerEntry(entry: ServerEntry): ServerEntry {
  return {
    async fetch(...args) {
      return await entry.fetch(...args)
    },
  }
}

export default createServerEntry({ fetch })
