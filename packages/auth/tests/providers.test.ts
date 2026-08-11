import { describe, it, expect } from "bun:test";
import { appleProvider } from "../src/providers/apple";
import { googleProvider } from "../src/providers/google";
import type { AppleProviderCredentials, GoogleProviderCredentials } from "../src/core/types";

const validApple: AppleProviderCredentials = {
  clientId: "com.abugida.web",
  teamId: "ABCDE12345",
  keyId: "KEYID1234",
  privateKey: "-----BEGIN PRIVATE KEY-----\nfakekeydata\n-----END PRIVATE KEY-----",
};

const validGoogle: GoogleProviderCredentials = {
  clientId: "1234567890-abcdefg.apps.googleusercontent.com",
  clientSecret: "shh-its-a-secret",
};

describe("appleProvider.validateCredentials", () => {
  it("accepts a well-formed credential set", () => {
    expect(() => appleProvider.validateCredentials(validApple)).not.toThrow();
  });

  it("rejects a missing clientId", () => {
    expect(() => appleProvider.validateCredentials({ ...validApple, clientId: "" })).toThrow();
  });

  it("rejects a teamId that isn't 10 characters", () => {
    expect(() => appleProvider.validateCredentials({ ...validApple, teamId: "short" })).toThrow();
  });

  it("rejects a private key that isn't PEM-encoded", () => {
    expect(() => appleProvider.validateCredentials({ ...validApple, privateKey: "not-a-pem-key" })).toThrow();
  });
});

describe("appleProvider.toBetterAuthConfig", () => {
  it("requests name and email scopes", () => {
    const config = appleProvider.toBetterAuthConfig(validApple);
    expect(config.scope).toEqual(["name", "email"]);
  });

  it("provides a lazily-evaluated clientSecret rather than a static string", () => {
    const config = appleProvider.toBetterAuthConfig(validApple);
    expect(typeof config.clientSecret).toBe("function");
  });

  it("passes through the native app bundle identifier when present", () => {
    const config = appleProvider.toBetterAuthConfig({ ...validApple, appBundleIdentifier: "com.abugida.ios" });
    expect(config.appBundleIdentifier).toBe("com.abugida.ios");
  });
});

describe("googleProvider.validateCredentials", () => {
  it("accepts a well-formed credential set", () => {
    expect(() => googleProvider.validateCredentials(validGoogle)).not.toThrow();
  });

  it("rejects a missing clientSecret", () => {
    expect(() => googleProvider.validateCredentials({ ...validGoogle, clientSecret: "" })).toThrow();
  });

  it("rejects a clientId not shaped like a Google OAuth client id", () => {
    expect(() => googleProvider.validateCredentials({ ...validGoogle, clientId: "not-a-google-id" })).toThrow();
  });
});

describe("googleProvider.toBetterAuthConfig", () => {
  it("defaults accessType to offline so refresh tokens are issued", () => {
    const config = googleProvider.toBetterAuthConfig(validGoogle);
    expect(config.accessType).toBe("offline");
  });

  it("respects an explicit accessType override", () => {
    const config = googleProvider.toBetterAuthConfig({ ...validGoogle, accessType: "online" });
    expect(config.accessType).toBe("online");
  });

  it("forwards additionalClientIds for multi-client (web + mobile) setups", () => {
    const config = googleProvider.toBetterAuthConfig({
      ...validGoogle,
      additionalClientIds: ["ios-client-id", "android-client-id"],
    });
    expect(config.additionalClientIds).toEqual(["ios-client-id", "android-client-id"]);
  });
});
