/**
 * @test unit/processors
 * @description Unit tests for all job processors.
 */

import { describe, test, expect, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Processor Import Tests
// ---------------------------------------------------------------------------

describe("Processor Registry", () => {
  test("allProcessors should export all 16 job types", async () => {
    const { allProcessors } = await import("../../src/processors/index.js");
    const { JobType } = await import("../../src/core/types.js");

    const expectedTypes = Object.values(JobType);
    const registeredTypes = allProcessors.map((p) => p.jobType);

    for (const type of expectedTypes) {
      expect(registeredTypes).toContain(type);
    }
  });

  test("getProcessorsForQueue should filter correctly", async () => {
    const { getProcessorsForQueue } = await import("../../src/processors/index.js");
    const { JobType } = await import("../../src/core/types.js");

    const purchaseProcessors = getProcessorsForQueue("abugida.purchases");
    expect(purchaseProcessors).toHaveLength(2);
    expect(purchaseProcessors.map((p) => p.jobType)).toContain(JobType.PURCHASE_INITIATE);
    expect(purchaseProcessors.map((p) => p.jobType)).toContain(JobType.PURCHASE_COMPLETE);
  });

  test("getProcessorForJobType should find the right processor", async () => {
    const { getProcessorForJobType } = await import("../../src/processors/index.js");
    const { JobType } = await import("../../src/core/types.js");

    const entry = getProcessorForJobType(JobType.QUIZ_GRADE);
    expect(entry).toBeDefined();
    expect(entry?.queueName).toBe("abugida.quizzes");
  });
});

// ---------------------------------------------------------------------------
// Individual Processor Tests
// ---------------------------------------------------------------------------

describe("Purchase Processors", () => {
  test("processPurchaseInitiate should return purchase data", async () => {
    const { purchaseProcessors } = await import("../../src/processors/purchase.js");

    const processor = purchaseProcessors.find((p) => p.jobType === "PURCHASE_INITIATE");
    expect(processor).toBeDefined();

    const result = await processor!.processor(
      {
        userId: "user-1",
        courseId: "course-1",
        amount: 500,
        currency: "ETB",
        paymentMethod: "telebirr",
        idempotencyKey: "test-key",
      },
      { id: "job-1", name: "PURCHASE_INITIATE", attemptsMade: 0, timestamp: Date.now() }
    );

    expect(result).toBeDefined();
    expect((result as Record<string, unknown>).status).toBe("pending");
  });
});

describe("Notification Processors", () => {
  test("processSmsNotification should mask phone numbers in logs", async () => {
    const { notificationProcessors } = await import("../../src/processors/notification.js");

    const processor = notificationProcessors.find((p) => p.jobType === "SMS_NOTIFICATION");
    expect(processor).toBeDefined();

    const result = await processor!.processor(
      {
        recipientPhone: "+251912345678",
        message: "Your enrollment is confirmed!",
        idempotencyKey: "test-key",
      },
      { id: "job-1", name: "SMS_NOTIFICATION", attemptsMade: 0, timestamp: Date.now() }
    );

    expect(result).toBeDefined();
    expect((result as Record<string, unknown>).status).toBe("sent");
    // Phone should be masked in result
    expect((result as Record<string, unknown>).recipientPhone).not.toBe("+251912345678");
  });
});

describe("Webhook Processors", () => {
  test("processWebhook should handle telebirr source", async () => {
    const { webhookProcessors } = await import("../../src/processors/webhook.js");

    const processor = webhookProcessors.find((p) => p.jobType === "WEBHOOK_PROCESS");
    expect(processor).toBeDefined();

    const result = await processor!.processor(
      {
        source: "telebirr",
        payload: { outTradeNo: "txn-123" },
        headers: { "content-type": "application/json" },
        idempotencyKey: "test-key",
      },
      { id: "job-1", name: "WEBHOOK_PROCESS", attemptsMade: 0, timestamp: Date.now() }
    );

    expect((result as Record<string, unknown>).processed).toBe(true);
    expect((result as Record<string, unknown>).routedTo).toBe("PURCHASE_COMPLETE");
  });
});
