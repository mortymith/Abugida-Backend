/**
 * @test unit/utils
 * @description Unit tests for utility modules (retry, idempotency, validators, errors).
 */

import { describe, test, expect } from "bun:test";

// ---------------------------------------------------------------------------
// Retry Tests
// ---------------------------------------------------------------------------

describe("Retry Utilities", () => {
  test("calculateBackoff should use exponential strategy by default", async () => {
    const { calculateBackoff } = await import("../../src/utils/retry.js");

    const d1 = calculateBackoff(1);
    const d2 = calculateBackoff(2);
    const d3 = calculateBackoff(3);

    // Exponential: delay = base * 2^(attempt-1)
    expect(d2).toBeGreaterThan(d1);
    expect(d3).toBeGreaterThan(d2);
  });

  test("calculateBackoff should cap at maxDelay", async () => {
    const { calculateBackoff } = await import("../../src/utils/retry.js");

    const delay = calculateBackoff(20, { maxDelay: 1000 });
    expect(delay).toBeLessThanOrEqual(1000);
  });

  test("withRetry should succeed on first attempt", async () => {
    const { withRetry } = await import("../../src/utils/retry.js");

    const fn = async () => "success";
    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe("success");
  });

  test("withRetry should retry and eventually succeed", async () => {
    const { withRetry } = await import("../../src/utils/retry.js");

    let attempts = 0;
    const fn = async () => {
      attempts++;
      if (attempts < 3) throw new Error("transient failure");
      return "recovered";
    };

    const result = await withRetry(fn, {
      maxAttempts: 5,
      baseDelay: 10, // fast for tests
    });
    expect(result).toBe("recovered");
    expect(attempts).toBe(3);
  });

  test("withRetry should throw after exhausting retries", async () => {
    const { withRetry } = await import("../../src/utils/retry.js");

    const fn = async () => {
      throw new Error("permanent failure");
    };

    await expect(withRetry(fn, { maxAttempts: 2, baseDelay: 10 })).rejects.toThrow("permanent failure");
  });
});

// ---------------------------------------------------------------------------
// Error Classification Tests
// ---------------------------------------------------------------------------

describe("Error Utilities", () => {
  test("classifyError should identify connection errors", async () => {
    const { classifyError } = await import("../../src/utils/errors.js");

    expect(classifyError(new Error("ECONNREFUSED"))).toBe("connection");
    expect(classifyError(new Error("connection timeout"))).toBe("connection");
    expect(classifyError(new Error("timeout exceeded")).includes("timeout"));
    expect(classifyError(new Error("some other error"))).toBe("unknown");
  });

  test("safeErrorMessage should not leak internals", async () => {
    const { safeErrorMessage } = await import("../../src/utils/errors.js");

    expect(safeErrorMessage(new Error("secret password exposed"))).toBe("An internal error occurred");
  });
});

// ---------------------------------------------------------------------------
// Validator Tests
// ---------------------------------------------------------------------------

describe("Validators", () => {
  test("validateJobData should validate PURCHASE_INITIATE", async () => {
    const { validateJobData } = await import("../../src/utils/validators.js");
    const { JobType } = await import("../../src/core/types.js");

    // Valid data
    const valid = validateJobData(JobType.PURCHASE_INITIATE, {
      userId: "user-1",
      courseId: "course-1",
      amount: 500,
      currency: "ETB",
      paymentMethod: "telebirr",
      idempotencyKey: "key-1",
    });
    expect(valid.valid).toBe(true);
    expect(valid.errors).toHaveLength(0);

    // Missing required fields
    const invalid = validateJobData(JobType.PURCHASE_INITIATE, {
      userId: "",
      courseId: "course-1",
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.length).toBeGreaterThan(0);
  });

  test("validateJobData should validate WEBHOOK_PROCESS with enum", async () => {
    const { validateJobData } = await import("../../src/utils/validators.js");
    const { JobType } = await import("../../src/core/types.js");

    // Invalid source
    const invalid = validateJobData(JobType.WEBHOOK_PROCESS, {
      source: "unknown_provider",
      payload: {},
      headers: {},
      idempotencyKey: "key-1",
    });
    expect(invalid.valid).toBe(false);
    expect(invalid.errors.some((e) => e.includes("source"))).toBe(true);

    // Valid source
    const valid = validateJobData(JobType.WEBHOOK_PROCESS, {
      source: "telebirr",
      payload: { data: "test" },
      headers: { "content-type": "application/json" },
      idempotencyKey: "key-1",
    });
    expect(valid.valid).toBe(true);
  });

  test("validateJobData should reject unknown job types", async () => {
    const { validateJobData } = await import("../../src/utils/validators.js");

    const result = validateJobData("UNKNOWN_JOB" as any, {});
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain("Unknown job type");
  });
});
