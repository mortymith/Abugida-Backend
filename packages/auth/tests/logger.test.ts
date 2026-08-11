import { describe, it, expect } from "bun:test";
import { noopLogger, redact } from "../src/core/logger";

describe("noopLogger", () => {
  it("does nothing and never throws for any log level", () => {
    expect(() => {
      noopLogger.debug("x");
      noopLogger.info("x", { a: 1 });
      noopLogger.warn("x");
      noopLogger.error("x", { kind: "unauthorized" });
    }).not.toThrow();
  });
});

describe("redact", () => {
  it("replaces known sensitive keys with a redaction marker", () => {
    const result = redact({ clientSecret: "abc123", userId: "u1" });
    expect(result.clientSecret).toBe("[redacted]");
    expect(result.userId).toBe("u1");
  });

  it("redacts tokens, private keys, and cookies", () => {
    const result = redact({
      accessToken: "at",
      refreshToken: "rt",
      idToken: "it",
      privateKey: "pk",
      cookie: "c",
      password: "p",
    });
    expect(Object.values(result).every((v) => v === "[redacted]")).toBe(true);
  });

  it("leaves non-sensitive keys untouched", () => {
    const result = redact({ providerId: "google", sessionId: "s1", count: 3, ok: true, nothing: null });
    expect(result).toEqual({ providerId: "google", sessionId: "s1", count: 3, ok: true, nothing: null });
  });
});
