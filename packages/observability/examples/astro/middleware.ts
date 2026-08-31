/**
 * @example astro/middleware
 * @description Middleware that extracts trace context for SSR pages.
 *
 * File: src/middleware.ts
 */

import { defineMiddleware } from 'astro:middleware'
import { instrumentRequest } from '../src/integrations/astro.ts'

export const onRequest = defineMiddleware(async (context, next) => {
  return instrumentRequest(context.request.headers, context.url.pathname, next)
})
