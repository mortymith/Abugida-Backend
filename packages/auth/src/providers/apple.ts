/**
 * @module providers/apple
 *
 * Sign in with Apple. better-auth's built-in "apple" social provider already
 * handles the OAuth redirect + id_token verification dance; this module is
 * responsible for:
 *   - validating the credential shape at startup (fail fast, not at request time)
 *   - generating the ES256 client-secret JWT Apple requires in place of a
 *     static client secret
 *   - normalizing the `name`/`email` scopes and native-app (bundle id) case
 */

import { SignJWT, importPKCS8 } from "jose";
import type { AppleProviderCredentials, AuthProviderDefinition } from "../core/types";
import { assertNonEmpty, invalidCredential } from "./base";

const APPLE_TOKEN_AUDIENCE = "https://appleid.apple.com";
const DEFAULT_CLIENT_SECRET_TTL_SECONDS = 15_777_000; // Apple's documented max (~6 months)

/**
 * Generates the short-lived ES256 JWT Apple uses as the OAuth client_secret.
 * Cached per-process by better-auth's provider layer; regenerate whenever it
 * is close to `clientSecretTtlSeconds` expiry.
 */
export async function generateAppleClientSecret(credentials: AppleProviderCredentials): Promise<string> {
  const ttl = credentials.clientSecretTtlSeconds ?? DEFAULT_CLIENT_SECRET_TTL_SECONDS;

  let privateKey: CryptoKey;
  try {
    privateKey = await importPKCS8(credentials.privateKey, "ES256");
  } catch (cause) {
    invalidCredential(
      "apple",
      "privateKey",
      "Apple private key could not be parsed as PKCS#8. Check the .p8 file contents.",
      cause
    );
  }

  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: credentials.keyId })
    .setIssuer(credentials.teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .setAudience(APPLE_TOKEN_AUDIENCE)
    .setSubject(credentials.clientId)
    .sign(privateKey);
}

export const appleProvider: AuthProviderDefinition<AppleProviderCredentials> = {
  id: "apple",
  name: "Apple",
  scopes: ["name", "email"],

  validateCredentials(credentials) {
    assertNonEmpty("apple", "clientId", credentials.clientId);
    assertNonEmpty("apple", "teamId", credentials.teamId);
    assertNonEmpty("apple", "keyId", credentials.keyId);
    assertNonEmpty("apple", "privateKey", credentials.privateKey);

    if (credentials.teamId.length !== 10) {
      invalidCredential("apple", "teamId", "Apple Team ID must be exactly 10 characters.");
    }
    if (!credentials.privateKey.includes("BEGIN PRIVATE KEY")) {
      invalidCredential(
        "apple",
        "privateKey",
        "Expected a PKCS#8 PEM-encoded private key (the raw .p8 file contents)."
      );
    }
  },

  toBetterAuthConfig(credentials) {
    this.validateCredentials(credentials);

    // better-auth's apple provider accepts a static clientSecret OR a
    // clientSecret-generating function; we always generate dynamically so
    // rotation of the .p8 key never requires redeploying a stale secret.
    return {
      clientId: credentials.clientId,
      clientSecret: () => generateAppleClientSecret(credentials),
      // Native app flows (Sign in with Apple SDK on iOS/macOS) present a
      // different `aud` in the id_token — better-auth needs the bundle id
      // to accept those tokens alongside the web Services ID.
      appBundleIdentifier: credentials.appBundleIdentifier,
      redirectURI: credentials.redirectUri,
      scope: ["name", "email"],
      // Apple-specific: only sends the user's name on the FIRST authorization.
      // Consumers must persist it from the initial callback — better-auth
      // does this automatically via the `account`/`user` tables.
      mapProfileToUser: (profile: { email?: string; name?: { firstName?: string; lastName?: string } }) => ({
        email: profile.email,
        name: profile.name ? [profile.name.firstName, profile.name.lastName].filter(Boolean).join(" ") : undefined,
      }),
    };
  },
};
