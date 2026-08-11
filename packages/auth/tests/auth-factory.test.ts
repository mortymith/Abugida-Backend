import { describe, it, expect } from "bun:test";
import { createAuth } from "../src/core/auth";
import { noopLogger } from "../src/core/logger";
import type { AuthConfig } from "../src/core/types";

function invalidConfig(): AuthConfig {
  return {
    environment: "development",
    baseUrl: "http://localhost:3000",
    secret: "too-short", // fails validation before any DB/adapter code runs
    database: { db: {}, schema: { user: {}, session: {}, account: {}, verification: {} }, provider: "pg" },
    providers: { google: { clientId: "id.apps.googleusercontent.com", clientSecret: "secret" } },
  };
}

describe("createAuth", () => {
  it("throws a config_invalid AuthError before constructing the underlying betterAuth instance", () => {
    expect(() => createAuth(invalidConfig())).toThrow();
  });

  it("logs the validation failure through a caller-supplied logger", () => {
    const events: string[] = [];
    const logger = {
      ...noopLogger,
      error: (message: string) => events.push(message),
    };

    expect(() => createAuth({ ...invalidConfig(), logger })).toThrow();
    expect(events.length).toBeGreaterThan(0);
  });

  it("rejects config with no providers configured at all", () => {
    const config = invalidConfig();
    config.secret = "a".repeat(32);
    config.providers = {};
    expect(() => createAuth(config)).toThrow();
  });
});
