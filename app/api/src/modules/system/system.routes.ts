/**
 * @module system.routes
 *
 * Route definitions for the system module — root, liveness, and readiness probes.
 * Also includes the self-hosted API documentation endpoints (OpenAPI 3.1 document
 * at `GET /docs` and Scalar reference UI at `/scalar`), which are development-only.
 *
 * The OpenAPI document served at `/docs` provides a comprehensive reference for
 * all registered endpoints, including request/response schemas, authentication
 * requirements, and error formats.
 */

import type { OpenAPIHono } from '@hono/zod-openapi'
import { createRoute } from '@hono/zod-openapi'
import { Scalar } from '@scalar/hono-api-reference'
import { appConfig } from '@/config/app_config'
import type { AppEnv } from '@/middleware/types'
import {
  RootResponseSchema,
  HealthLivenessResponseSchema,
  HealthReadinessResponseSchema,
} from './system.schemas'

// ── GET / ───────────────────────────────────────────────────────────────

export const rootRoute = createRoute({
  method: 'get',
  path: '/',
  tags: ['System'],
  summary: 'API root',
  description: 'Returns a welcome message confirming the API is running.',
  responses: {
    200: {
      description: 'Success',
      content: {
        'text/plain': {
          schema: RootResponseSchema,
        },
      },
    },
  },
})

export type RootRoute = typeof rootRoute

// ── GET /health (liveness) ──────────────────────────────────────────────

export const healthLivenessRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['System'],
  summary: 'Liveness probe',
  description:
    'Returns 200 OK if the Abugida application process is running.\nNo authentication required. No dependency checks performed.',
  security: [],
  responses: {
    200: {
      description: 'Service is alive',
      content: {
        'application/json': {
          schema: HealthLivenessResponseSchema,
        },
      },
    },
    429: {
      description: 'Too many requests',
    },
    500: {
      description: 'Internal server error',
    },
  },
})

export type HealthLivenessRoute = typeof healthLivenessRoute

// ── GET /health/ready (readiness) ───────────────────────────────────────

export const healthReadinessRoute = createRoute({
  method: 'get',
  path: '/health/ready',
  tags: ['System'],
  summary: 'Readiness probe',
  description:
    'Returns 200 OK only if all critical dependencies are available.\nChecks database connectivity, SMS provider, and payment gateway status.',
  security: [],
  responses: {
    200: {
      description: 'All dependencies available',
      content: {
        'application/json': {
          schema: HealthReadinessResponseSchema,
        },
      },
    },
    429: {
      description: 'Too many requests',
    },
    503: {
      description: 'One or more dependencies unavailable',
      content: {
        'application/json': {
          schema: HealthReadinessResponseSchema,
        },
      },
    },
  },
})

export type HealthReadinessRoute = typeof healthReadinessRoute

// ── Documentation endpoints (development only) ──────────────────────────

/**
 * Mount the documentation endpoints onto the composed Hono application.
 * Called once from `app.ts` after all feature routes are registered.
 *
 * The OpenAPI document is served at `GET /docs` and the Scalar interactive
 * reference UI at `/scalar`. Both are only available in non-production
 * environments to prevent exposing internal API details.
 */
export function registerSystemDocumentation(app: OpenAPIHono<AppEnv>): void {
  if (appConfig.NODE_ENV === 'production') return

  app.doc31('/docs', {
    openapi: '3.1.0',
    info: {
      title: 'Abugida Application API',
      version: appConfig.OTEL_SERVICE_VERSION,
      description: `# Overview

Unified REST API for the **Abugida Application** — a comprehensive learning platform
supporting examination preparation across multiple education segments.

**Ethiopian users only. All prices in Ethiopian Birr (ETB). Telebirr is the sole payment method.**

## API Versioning

All endpoints are versioned via the URL path prefix \`/api/v1/\`. Breaking changes will
increment the version number. Non-breaking additions may be introduced within v1.

## Authentication

Authentication endpoints (\`/auth/*\`) are provided by **Better Auth** framework.
The API uses **JWT Bearer tokens** for user authentication:
- Sign-in providers: **Google Sign-In** and **Telegram**
- Access and refresh token lifecycle managed by Better Auth
- Include as: \`Authorization: Bearer <access_token>\`

Webhook endpoints use **API Key** authentication via the \`X-API-Key\` header.

## Response Envelope

All successful responses follow a consistent envelope:

**Single resource:**
\`\`\`json
{
  "data": { ... },
  "meta": {
    "requestId": "uuid-v7",
    "timestamp": "2026-04-30T10:30:00Z"
  }
}
\`\`\`

**Collection with cursor pagination:**
\`\`\`json
{
  "data": [ ... ],
  "meta": {
    "requestId": "uuid-v7",
    "timestamp": "2026-04-30T10:30:00Z",
    "hasNextPage": true,
    "nextCursor": "base64url-encoded-cursor",
    "limit": 20
  }
}
\`\`\`

## Error Format

All errors follow [RFC 7807 Problem Details](https://tools.ietf.org/html/rfc7807):
\`\`\`json
{
  "type": "https://api.example.com/errors/invalid-parameter",
  "title": "Invalid Parameter",
  "status": 400,
  "detail": "The 'email' field must be a valid email address.",
  "instance": "/api/v1/users/me",
  "correlationId": "01JQXYZ..."
}
\`\`\`

## Rate Limiting

Per NFR-403:
- **Authenticated users:** 100 requests per minute
- **Unauthenticated IPs:** 1000 requests per minute

Rate limit status is returned in response headers:
- \`X-RateLimit-Limit\`: Maximum requests per window
- \`X-RateLimit-Remaining\`: Requests remaining in current window
- \`X-RateLimit-Reset\`: Unix timestamp when the window resets

When exceeded, the API returns \`429 Too Many Requests\` with a \`Retry-After\` header.

## Pagination

All collection endpoints use **cursor-based pagination**:
- \`?cursor=<opaque-cursor>&limit=<1-100>\`
- Default limit: 20
- Maximum limit: 100
- Response includes \`nextCursor\` when more results exist

## Enum Serialization Convention

All enum values are transmitted as **UPPER_SNAKE_CASE** in both requests and responses
(e.g., \`IOS\`, \`ANDROID\`, \`WEB\`). The API gateway serializes/deserializes to/from the
database's lowercase snake_case storage format transparently. Clients never need to
handle lowercase enum values.`,
      contact: {
        name: 'Abugida API Support Team',
        email: 'api-support@abugada.com',
        url: 'https://abugada.com/developers',
      },
      license: {
        name: 'Proprietary',
        url: 'https://abugada.com/license',
      },
    },
    servers: [
      {
        url: `http://${appConfig.HOST}:${appConfig.PORT}`,
        description: 'Local development server',
      },
      {
        url: 'https://accuracy-flip-playing.ngrok-free.dev',
        description: 'Tunnel development server',
      },
    ],
    tags: [
      {
        name: 'System',
        description:
          'Health checks, metrics, and operational endpoints. Includes liveness and readiness probes for container orchestration and load balancer integration.',
      },
      {
        name: 'Auth',
        description:
          'Authentication and session management powered by Better Auth. Includes sign-up, sign-in (email/password, Google, Telegram), session refresh, sign-out, OAuth callbacks, email verification, and password reset flows.',
      },
      {
        name: 'Users',
        description:
          'User profiles, preferences, onboarding, devices, and GDPR operations. Covers the full user lifecycle from registration through account deletion, including consent management and data export.',
      },
      {
        name: 'Dashboard',
        description:
          'User dashboard with aggregated statistics, activity feed, and insights. Provides a single endpoint for the home screen with study time, lessons, XP, streak, and weekly data.',
      },
      {
        name: 'ExamTypes',
        description:
          'Exam type hierarchy navigation (self-referencing tree). Represents education categories and sub-categories for organizing courses.',
      },
      {
        name: 'Resources',
        description:
          'Educational resource library — hierarchy navigation, course search, and lesson details. Covers courses, modules, lessons, tags, and full-text search with autocomplete.',
      },
      {
        name: 'Bundles',
        description:
          'Course bundles — grouped course packages by exam type with discount pricing. Supports browsing, search, and purchase option discovery.',
      },
      {
        name: 'Progress',
        description:
          'User learning progress, enrollments, lesson completions, and study tracking. Tracks completion percentages and learning history across all enrolled courses.',
      },
      {
        name: 'Bookmark',
        description:
          'User bookmarks for courses and resources. Enables quick access to frequently visited or saved content.',
      },
      {
        name: 'Downloads',
        description:
          'Offline course content downloads, download status tracking, and presigned download URLs for mobile offline access.',
      },
      {
        name: 'Purchases',
        description:
          'Telebirr-only purchases for courses and bundles. Manages the complete purchase lifecycle from initiation through enrollment creation.',
      },
      {
        name: 'Quiz',
        description:
          'Quiz questions, attempts, and answer submission. Supports server-side grading and attempt history tracking.',
      },
      {
        name: 'Recommendations',
        description:
          'Course ratings, reviews, and popularity-based recommendations. Helps users discover relevant content based on community feedback.',
      },
      {
        name: 'Webhooks',
        description:
          'Incoming webhooks from payment providers and SMS service. Handles asynchronous callbacks for payment confirmation and delivery status.',
      },
    ],
  })

  app.use(
    '/scalar',
    Scalar({
      url: '/docs',
      pageTitle: 'Abugida API — Scalar Reference',
    }),
  )
}
