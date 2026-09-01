/**
 * @module error-handler
 *
 * Centralized RFC 9457 (problem+json) error handling for the API. The spec
 * mandates `application/problem+json` for every 4xx/5xx response, so this
 * module owns:
 *
 *   - `problemResponse()` — the single builder for spec-compliant error bodies
 *     (used here and by the rate-limit / api-key-auth middlewares).
 *   - `errorHandler()` — `app.onError` hook: maps thrown errors to consistent
 *     status codes, records unexpected 5xx through the observability stack,
 *     and never leaks internals in production.
 *   - `notFoundHandler()` — `app.notFound` hook: 404 problem+json for unknown
 *     routes.
 *   - `zodOpenApiHook()` — default validation hook for `@hono/zod-openapi`
 *     routes: maps Zod failures to the spec's 422 shape with an `errors[]`
 *     array of field-level issues.
 *
 * The response shape follows `docs/api-spec.yaml` (`ProblemDetail`):
 *   { type, title, status, detail, instance, correlationId?, errors? }
 */

import type { Context, ErrorHandler, NotFoundHandler } from 'hono'
import type { Hook } from '@hono/zod-openapi'
import { HTTPException } from 'hono/http-exception'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import { recordError } from '@abugida/observability'
import { appConfig } from '../config/app_config'
import type { AppEnv } from './types'

export interface ProblemErrorField {
  field: string
  message: string
  code: string
  rejectedValue?: unknown
}

export interface ProblemDetails {
  type: string
  title: string
  status: number
  detail: string
  instance: string
  correlationId?: string
  errors?: ProblemErrorField[]
}

const STATUS_TITLES: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable',
}

const STATUS_TYPES: Record<number, string> = {
  400: 'invalid-parameter',
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not-found',
  409: 'conflict',
  413: 'payload-too-large',
  422: 'validation-error',
  429: 'too-many-requests',
  500: 'internal-server-error',
  503: 'service-unavailable',
}

function problemType(status: number): string {
  const slug = STATUS_TYPES[status]
  return slug ? `${appConfig.ERROR_BASE_URL}/${slug}` : 'about:blank'
}

function problemTitle(status: number): string {
  return STATUS_TITLES[status] ?? 'Error'
}

export interface ProblemResponseOptions {
  status: number
  detail: string
  title?: string
  errors?: ProblemErrorField[]
}

/**
 * Build and return a spec-compliant problem+json response for the request.
 */
export function problemResponse(c: Context<AppEnv>, options: ProblemResponseOptions): Response {
  const body: ProblemDetails = {
    type: problemType(options.status),
    title: options.title ?? problemTitle(options.status),
    status: options.status,
    detail: options.detail,
    instance: new URL(c.req.path, c.req.url).toString(),
    correlationId: c.get('requestId'),
    ...(options.errors && options.errors.length > 0 ? { errors: options.errors } : {}),
  }
  return c.json(body, options.status as ContentfulStatusCode, {
    'Content-Type': 'application/problem+json',
  })
}

/**
 * Hono `app.onError` hook. Known HTTP exceptions map to their status; anything
 * else is a 500, logged and recorded on the active OTel span. Internal error
 * details are stripped in production.
 */
export function errorHandler(): ErrorHandler<AppEnv> {
  return (error, c) => {
    if (error instanceof HTTPException && error.status < 500) {
      const detail = error.message || problemTitle(error.status)
      return problemResponse(c, { status: error.status, detail })
    }

    recordError(error, {
      context: {
        requestId: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
      },
    })

    const status = error instanceof HTTPException ? error.status : 500
    const detail =
      status >= 500
        ? 'An unexpected error occurred. Please try again later.'
        : error.message || problemTitle(status)

    return problemResponse(c, { status, detail })
  }
}

/**
 * Hono `app.notFound` hook. Returns a 404 problem+json for unmatched routes.
 */
export function notFoundHandler(): NotFoundHandler<AppEnv> {
  return (c) => problemResponse(c, { status: 404, detail: 'The requested resource was not found.' })
}

/**
 * Validation hook for `@hono/zod-openapi` `openapi()` routes. Maps Zod failures
 * onto the spec's 422 problem+json shape. Wire as `defaultHook` on the
 * `OpenAPIHono` app (or per-route when the app is switched to it).
 */
export const zodOpenApiHook: Hook<Record<string, unknown>, AppEnv, string, Response | undefined> = (
  result,
  c,
) => {
  if (result.success) return undefined

  const errors: ProblemErrorField[] = result.error.issues.map((issue) => ({
    field: issue.path?.join('.') ?? '',
    message: issue.message,
    code: issue.code ?? 'invalid_value',
    ...('rejectedValue' in issue ? { rejectedValue: issue.rejectedValue } : {}),
  }))

  return problemResponse(c, {
    status: 422,
    detail: 'The request parameters are invalid.',
    errors,
  })
}
