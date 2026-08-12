/**
 * @module processors/webhook
 * @description Webhook processing for incoming callbacks from Telebirr
 * and SMSEthiopia (FR-400, FR-1000).
 */

import type { JobProcessor, ProcessorEntry, WebhookProcessJobData } from "../core/types.js";
import { JobType } from "../core/types.js";
import { QUEUE_NAMES } from "../definitions/queues.js";

// ---------------------------------------------------------------------------
// Webhook Process Processor
// ---------------------------------------------------------------------------

/**
 * Process incoming webhooks from external providers.
 *
 * Expected side effects:
 * - Validate webhook signature
 * - Parse and normalise the payload
 * - Route to the appropriate downstream handler
 * - For Telebirr: enqueue PURCHASE_COMPLETE
 * - For SMSEthiopia: process SMS delivery receipts
 * - Store raw webhook for audit purposes
 */
export const processWebhook: JobProcessor<WebhookProcessJobData> = async (data, job) => {
  const { source, idempotencyKey } = data;

  console.debug(`[webhook:process] Processing webhook from ${source}`, {
    jobId: job.id,
    idempotencyKey,
  });

  switch (source) {
    case "telebirr": {
      // TODO: Verify Telebirr signature
      // const isValid = verifyTelebirrSignature(payload, headers);
      // if (!isValid) throw new Error('Invalid Telebirr signature');

      // TODO: Route to purchase completion handler
      // const purchaseId = payload.outTradeNo;
      // Enqueue PURCHASE_COMPLETE job...

      return {
        source,
        processed: true,
        routedTo: "PURCHASE_COMPLETE",
        processedAt: new Date().toISOString(),
      };
    }

    case "sms_ethiopia": {
      // TODO: Process SMS delivery receipt
      // const messageId = payload.messageId;
      // const status = payload.status; // 'delivered' | 'failed'
      // Update notification record...

      return {
        source,
        processed: true,
        routedTo: "SMS_DELIVERY_RECEIPT",
        processedAt: new Date().toISOString(),
      };
    }

    default: {
      console.warn(`[webhook:process] Unknown webhook source: ${source}`, {
        jobId: job.id,
      });
      return {
        source,
        processed: false,
        reason: "Unknown source",
        processedAt: new Date().toISOString(),
      };
    }
  }
};

// ---------------------------------------------------------------------------
// Processor Entries
// ---------------------------------------------------------------------------

export const webhookProcessors: ProcessorEntry<WebhookProcessJobData>[] = [
  {
    jobType: JobType.WEBHOOK_PROCESS,
    processor: processWebhook,
    queueName: QUEUE_NAMES.WEBHOOKS,
    concurrency: 5,
  },
];
