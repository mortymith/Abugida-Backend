/**
 * @example hono/producer
 * @description Example of enqueuing jobs from a Hono API route.
 */

import { Hono } from "hono";
import {
  createHonoQueueClient,
  type HonoQueueContext,
  mergeWithDefaults,
  JobType,
  type PurchaseInitiateJobData,
} from "../../../src/index.js";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const config = mergeWithDefaults({
  redis: {
    hostname: "localhost",
    port: 6379,
  },
  logging: { level: "debug", format: "pretty" },
});

const app = new Hono<{ Variables: HonoQueueContext }>();
const queue = createHonoQueueClient(config);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

/** Initiate a purchase */
app.post("/api/purchases", async (c) => {
  const body = await c.req.json<{
    userId: string;
    courseId: string;
    amount: number;
    currency: string;
    paymentMethod: string;
  }>();

  const jobId = await queue.enqueue(JobType.PURCHASE_INITIATE, {
    userId: body.userId,
    courseId: body.courseId,
    amount: body.amount,
    currency: body.currency,
    paymentMethod: body.paymentMethod,
    idempotencyKey: `purchase:${body.userId}:${body.courseId}:${Date.now()}`,
  } satisfies PurchaseInitiateJobData);

  return c.json({ jobId, status: "queued" }, 202);
});

/** Webhook receiver (Telebirr callback) */
app.post("/api/webhooks/telebirr", async (c) => {
  const payload = await c.req.json();
  const headers = Object.fromEntries(c.req.raw.headers.entries());

  const jobId = await queue.enqueue(JobType.WEBHOOK_PROCESS, {
    source: "telebirr",
    payload,
    headers,
    idempotencyKey: `webhook:telebirr:${payload.outTradeNo ?? Date.now()}`,
  });

  return c.json({ jobId, status: "queued" }, 202);
});

/** Request GDPR data export */
app.post("/api/exports/request", async (c) => {
  const { userId, format } = await c.req.json<{
    userId: string;
    format: "json" | "csv";
  }>();

  const jobId = await queue.enqueue(JobType.DATA_EXPORT, {
    userId,
    format,
    requestedAt: new Date().toISOString(),
    idempotencyKey: `export:${userId}:${Date.now()}`,
  });

  return c.json({ jobId, status: "queued" }, 202);
});

/** Bulk enqueue: send notifications to multiple users */
app.post("/api/notifications/bulk", async (c) => {
  const { recipients, message } = await c.req.json<{
    recipients: Array<{ phone: string; name?: string }>;
    message: string;
  }>();

  const jobIds = await queue.enqueueBulk(
    recipients.map((r) => ({
      jobType: JobType.SMS_NOTIFICATION as JobType,
      data: {
        recipientPhone: r.phone,
        message: r.name ? `Hello ${r.name}, ${message}` : message,
        idempotencyKey: `sms:${r.phone}:${Date.now()}`,
      },
    }))
  );

  return c.json({ jobIds, count: jobIds.length }, 202);
});

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log("[example:hono:producer] Hono producer example (not actually serving)");
console.log("In a real app, you would use: serve(app, { port: 3000 })");
