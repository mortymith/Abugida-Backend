import { describe, it, expect } from "bun:test";
import { validateAuthConfig, withDefaults } from "../src/config";
import type { AuthConfig } from "../src/core/types";

function baseConfig(overrides: Partial<AuthConfig> = {}): AuthConfig {
  return {
    environment: "development",
    baseUrl: "http://localhost:3000",
    secret: "a".repeat(32),
    database: { db: {}, schema: { user: {}, session: {}, account: {}, verification: {} }, provider: "pg" },
    providers: {
      google: { clientId: "id.apps.googleusercontent.com", clientSecret: "secret" },
    },
    ...overrides,
  };
}

describe("validateAuthConfig", () => {
  it("accepts a minimal valid config", () => {
    expect(() => validateAuthConfig(baseConfig())).not.toThrow();
  });

  it("rejects a secret shorter than 32 characters", () => {
    expect(() => validateAuthConfig(baseConfig({ secret: "too-short" }))).toThrow();
  });

  it("rejects a non-URL baseUrl", () => {
    expect(() => validateAuthConfig(baseConfig({ baseUrl: "not-a-url" }))).toThrow();
  });

  it("rejects config with zero providers configured", () => {
    expect(() => validateAuthConfig(baseConfig({ providers: {} }))).toThrow();
  });

  it("rejects a missing database schema", () => {
    // @ts-expect-error - intentionally malformed for the test
    expect(() => validateAuthConfig(baseConfig({ database: { db: {}, provider: "pg" } }))).toThrow();
  });

  it("rejects insecure cookies in production", () => {
    expect(() =>
      validateAuthConfig(baseConfig({ environment: "production", session: { cookie: { secure: false } } }))
    ).toThrow();
  });

  it("allows insecure cookies in development", () => {
    expect(() =>
      validateAuthConfig(baseConfig({ environment: "development", session: { cookie: { secure: false } } }))
    ).not.toThrow();
  });
});

describe("withDefaults", () => {
  it("defaults the session cookie name", () => {
    const resolved = withDefaults(baseConfig());
    expect(resolved.session?.cookie?.name).toBe("abugida.session");
  });

  it("marks cookies secure by default in production", () => {
    const resolved = withDefaults(baseConfig({ environment: "production" }));
    expect(resolved.session?.cookie?.secure).toBe(true);
  });

  it("defaults rate limiting when unset", () => {
    const resolved = withDefaults(baseConfig());
    expect(resolved.rateLimit).toEqual({ max: 20, windowSeconds: 60 });
  });

  it("preserves an explicit rate limit override", () => {
    const resolved = withDefaults(baseConfig({ rateLimit: { max: 5, windowSeconds: 10 } }));
    expect(resolved.rateLimit).toEqual({ max: 5, windowSeconds: 10 });
  });
});
