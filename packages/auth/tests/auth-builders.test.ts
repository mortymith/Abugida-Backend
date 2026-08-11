import { describe, it, expect } from "bun:test";
import {
  buildProviderRegistry,
  buildSocialProviders,
  buildSessionOptions,
  buildAdvancedOptions,
  buildRateLimitOptions,
} from "../src/core/auth";
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

describe("buildProviderRegistry", () => {
  it("always registers apple and google", () => {
    const registry = buildProviderRegistry(baseConfig());
    expect(registry.get("apple")?.id).toBe("apple");
    expect(registry.get("google")?.id).toBe("google");
  });

  it("registers custom providers alongside the built-ins", () => {
    const registry = buildProviderRegistry(
      baseConfig({
        providers: {
          custom: {
            github: {
              definition: {
                id: "github",
                name: "GitHub",
                scopes: ["read:user"],
                toBetterAuthConfig: (c: { clientId: string }) => ({ clientId: c.clientId }),
                validateCredentials: () => undefined,
              },
              credentials: { clientId: "gh-id" },
            },
          },
        },
      })
    );
    expect(registry.get("github")?.name).toBe("GitHub");
  });
});

describe("buildSocialProviders", () => {
  it("only includes providers present in config", () => {
    const config = baseConfig(); // google only
    const registry = buildProviderRegistry(config);
    const social = buildSocialProviders(config, registry);
    expect(Object.keys(social)).toEqual(["google"]);
  });

  it("includes both apple and google when both are configured", () => {
    const config = baseConfig({
      providers: {
        google: { clientId: "id.apps.googleusercontent.com", clientSecret: "secret" },
        apple: {
          clientId: "com.abugida.web",
          teamId: "ABCDE12345",
          keyId: "KEYID1234",
          privateKey: "-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----",
        },
      },
    });
    const registry = buildProviderRegistry(config);
    const social = buildSocialProviders(config, registry);
    expect(Object.keys(social).sort()).toEqual(["apple", "google"]);
  });
});

describe("buildSessionOptions", () => {
  it("maps expiresInSeconds/updateAgeSeconds to better-auth's expiresIn/updateAge", () => {
    const options = buildSessionOptions(baseConfig({ session: { expiresInSeconds: 100, updateAgeSeconds: 10 } }));
    expect(options.expiresIn).toBe(100);
    expect(options.updateAge).toBe(10);
  });

  it("always enables a bounded cookie cache", () => {
    const options = buildSessionOptions(baseConfig());
    expect(options.cookieCache).toEqual({ enabled: true, maxAge: 60 });
  });
});

describe("buildAdvancedOptions", () => {
  it("forces secure cookies in production even without an explicit setting", () => {
    const options = buildAdvancedOptions(baseConfig({ environment: "production" }));
    expect(options.useSecureCookies).toBe(true);
  });

  it("does not force secure cookies in development", () => {
    const options = buildAdvancedOptions(baseConfig({ environment: "development" }));
    expect(options.useSecureCookies).toBe(false);
  });

  it("respects an explicit cookie.secure override", () => {
    const options = buildAdvancedOptions(
      baseConfig({ environment: "development", session: { cookie: { secure: true } } })
    );
    expect(options.useSecureCookies).toBe(true);
  });

  it("defaults httpOnly to true and sameSite to lax", () => {
    const options = buildAdvancedOptions(baseConfig());
    expect(options.defaultCookieAttributes.httpOnly).toBe(true);
    expect(options.defaultCookieAttributes.sameSite).toBe("lax");
  });
});

describe("buildRateLimitOptions", () => {
  it("returns undefined when no rate limit is configured", () => {
    expect(buildRateLimitOptions(baseConfig({ rateLimit: undefined }))).toBeUndefined();
  });

  it("maps windowSeconds/max to better-auth's window/max shape", () => {
    const options = buildRateLimitOptions(baseConfig({ rateLimit: { max: 5, windowSeconds: 30 } }));
    expect(options).toEqual({ enabled: true, window: 30, max: 5 });
  });
});
