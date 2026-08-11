import { describe, it, expect } from "bun:test";
import { verifyRequestOrigin } from "../src/core/csrf";

const trustedOrigins = ["https://app.abugida.com"];

describe("verifyRequestOrigin", () => {
  it("allows safe methods through regardless of origin", () => {
    const result = verifyRequestOrigin(
      { method: "GET", headers: new Headers({ origin: "https://evil.example" }) },
      { trustedOrigins }
    );
    expect(result.ok).toBe(true);
  });

  it("allows a mutating request from a trusted Origin header", () => {
    const result = verifyRequestOrigin(
      { method: "POST", headers: new Headers({ origin: "https://app.abugida.com" }) },
      { trustedOrigins }
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a mutating request from an untrusted Origin header", () => {
    const result = verifyRequestOrigin(
      { method: "POST", headers: new Headers({ origin: "https://evil.example" }) },
      { trustedOrigins }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("csrf_mismatch");
  });

  it("rejects a mutating request with no Origin or Referer header", () => {
    const result = verifyRequestOrigin({ method: "DELETE", headers: new Headers() }, { trustedOrigins });
    expect(result.ok).toBe(false);
  });

  it("falls back to the Referer header's origin when Origin is absent", () => {
    const result = verifyRequestOrigin(
      { method: "PUT", headers: new Headers({ referer: "https://app.abugida.com/settings" }) },
      { trustedOrigins }
    );
    expect(result.ok).toBe(true);
  });

  it("respects a custom protected-methods list", () => {
    const result = verifyRequestOrigin(
      { method: "PATCH", headers: new Headers() },
      { trustedOrigins, methods: ["DELETE"] } // PATCH not in the list -> treated as safe
    );
    expect(result.ok).toBe(true);
  });
});
