/**
 * @example astro/api-routes
 * @description Instrumenting Astro API routes with error tracking and metrics.
 *
 * File: src/pages/api/contact.ts
 */

import type { APIRoute } from 'astro'
import { createCounter, createHistogram, withPageSpan, recordAstroError } from '../src/index.ts'

const contactCounter = createCounter('marketing_contact_submissions_total', {
  description: 'Total number of contact form submissions',
})

const contactDuration = createHistogram('marketing_contact_duration_ms', {
  description: 'Contact form processing time in milliseconds',
  unit: 'ms',
})

export const POST: APIRoute = async ({ request }) => {
  return withPageSpan('api.contact', async (span) => {
    const start = performance.now()

    try {
      const body = (await request.json()) as {
        name?: string
        email?: string
        message?: string
      }

      span.setAttribute('contact.name', body.name ?? 'anonymous')

      if (!body.email || !body.message) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        })
      }

      await sendContactEmail(body)

      contactCounter.add(1, { status: 'success' })
      return new Response(JSON.stringify({ status: 'sent' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    } catch (error) {
      recordAstroError(error)
      contactCounter.add(1, { status: 'error' })

      return new Response(JSON.stringify({ error: 'Failed to send' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      })
    } finally {
      contactDuration.record(performance.now() - start, { route: 'contact' })
    }
  })
}

async function sendContactEmail(body: { name?: string; email: string; message: string }) {
  await new Promise((resolve) => setTimeout(resolve, 100))
}
