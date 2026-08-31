/**
 * @example hono/metrics
 * @description Observability metrics usage in a Hono API.
 *
 * Run with: bun run examples/hono/metrics.ts
 */

import { Hono } from 'hono'
import {
  initObservability,
  shutdownObservability,
  logger,
  createCounter,
  createHistogram,
  createUpDownCounter,
  incrementCounter,
  recordHistogram,
  getMeter,
} from '../src/index.ts'

const app = new Hono()

async function bootstrap() {
  await initObservability({
    serviceName: 'api-metrics',
    serviceVersion: '1.0.0',
    environment: 'production',
  })

  const orderCounter = createCounter('orders_created_total', {
    description: 'Total number of orders created',
  })

  const paymentAmount = createHistogram('payment_amount_usd', {
    description: 'Payment amount in USD',
    unit: 'USD',
  })

  const activeUsers = createUpDownCounter('active_users', {
    description: 'Number of currently active users',
  })

  const meter = getMeter()

  meter
    .createObservableGauge('queue_depth', {
      description: 'Current depth of the processing queue',
    })
    .addCallback((result) => {
      result.observe(42)
    })

  app.post('/api/orders', async (c) => {
    const body = await c.req.json<{
      userId: string
      amount: number
      currency: string
      items: Array<{ id: string; quantity: number }>
    }>()

    orderCounter.add(1, { currency: body.currency })

    paymentAmount.record(body.amount, {
      currency: body.currency,
      item_count: body.items.length,
    })

    logger.info({ userId: body.userId, amount: body.amount }, 'Order created')

    return c.json({ orderId: `order_${Date.now()}`, status: 'pending' }, 202)
  })

  app.post('/api/users/:id/login', async (c) => {
    const userId = c.req.param('id')
    activeUsers.add(1, { userId })
    logger.info({ userId }, 'User logged in')
    return c.json({ status: 'logged_in' })
  })

  app.post('/api/users/:id/logout', async (c) => {
    const userId = c.req.param('id')
    activeUsers.add(-1, { userId })
    logger.info({ userId }, 'User logged out')
    return c.json({ status: 'logged_out' })
  })

  app.get('/api/metrics/summary', async (c) => {
    const summary = {
      ordersCreated: 'orders_created_total counter',
      paymentAmounts: 'payment_amount_usd histogram',
      activeUsers: 'active_users up-down counter',
      queueDepth: 'queue_depth observable gauge',
    }
    return c.json(summary)
  })

  process.addListener('SIGTERM', async () => {
    await shutdownObservability()
    process.exit(0)
  })

  return Bun.serve({ port: 3001, fetch: app.fetch })
}

bootstrap()
