/**
 * @example tanstack/metrics
 * @description Recording metrics from TanStack Start server functions.
 *
 * Place this in your app/dashboard project.
 */

import { createServerFn } from '@tanstack/react-start'
import {
  initObservability,
  createCounter,
  createHistogram,
  createUpDownCounter,
  withServerSpan,
  withSpan,
} from '../src/index.ts'

await initObservability({
  serviceName: 'dashboard',
  serviceVersion: '1.0.0',
  environment: process.env.NODE_ENV ?? 'development',
})

const pageViewCounter = createCounter('dashboard_page_views_total', {
  description: 'Total number of dashboard page views',
})

const actionCounter = createCounter('dashboard_actions_total', {
  description: 'Total number of user actions',
})

const loaderDuration = createHistogram('dashboard_loader_duration_ms', {
  description: 'Dashboard loader execution time in milliseconds',
  unit: 'ms',
})

const activeSessions = createUpDownCounter('dashboard_active_sessions', {
  description: 'Number of active dashboard sessions',
})

// ---------------------------------------------------------------------------
// Track page view (called from client component)
// ---------------------------------------------------------------------------

export const trackPageView = createServerFn({ method: 'POST' }).handler(async ({ data }) => {
  return withServerSpan('dashboard.trackPageView', async (span) => {
    const { userId, page, referrer } = data as {
      userId: string
      page: string
      referrer?: string
    }

    pageViewCounter.add(1, { page })
    activeSessions.add(1, { userId })

    span.setAttribute('page.name', page)
    if (referrer) span.setAttribute('page.referrer', referrer)

    return { tracked: true }
  })
})

// ---------------------------------------------------------------------------
// Track user action
// ---------------------------------------------------------------------------

export const trackAction = createServerFn({ method: 'POST' }).handler(async ({ data }) => {
  return withServerSpan('dashboard.trackAction', async (span) => {
    const { userId, action, target } = data as {
      userId: string
      action: string
      target?: string
    }

    actionCounter.add(1, { action })

    span.setAttribute('user.id', userId)
    span.setAttribute('action.name', action)
    if (target) span.setAttribute('action.target', target)

    return { tracked: true }
  })
})

// ---------------------------------------------------------------------------
// Timed loader wrapper
// ---------------------------------------------------------------------------

export async function loadTimedData<T>(loaderName: string, loaderFn: () => Promise<T>): Promise<T> {
  const start = performance.now()
  try {
    return await withSpan(loaderName, () => loaderFn())
  } finally {
    const duration = performance.now() - start
    loaderDuration.record(duration, { loader: loaderName })
  }
}

// ---------------------------------------------------------------------------
// End session
// ---------------------------------------------------------------------------

export const endSession = createServerFn({ method: 'POST' }).handler(async ({ data }) => {
  const { userId } = data as { userId: string }
  activeSessions.add(-1, { userId })
  return { ended: true }
})
