/**
 * @module providers/google
 *
 * Google OAuth 2.0 provider. better-auth ships a built-in "google" social
 * provider handling the authorization-code exchange and refresh-token
 * rotation; this module validates credentials and normalizes multi-client
 * setups (web + iOS + Android sharing one backend, a common pattern for
 * mobile apps that verify a Google `id_token` issued to a native client).
 */

import type { AuthProviderDefinition, GoogleProviderCredentials } from "../core/types";
import { assertNonEmpty, invalidCredential } from "./base";

export const googleProvider: AuthProviderDefinition<GoogleProviderCredentials> = {
  id: "google",
  name: "Google",
  scopes: ["profile", "email"],

  validateCredentials(credentials) {
    assertNonEmpty("google", "clientId", credentials.clientId);
    assertNonEmpty("google", "clientSecret", credentials.clientSecret);

    if (!credentials.clientId.endsWith(".apps.googleusercontent.com")) {
      invalidCredential(
        "google",
        "clientId",
        'Google client IDs are expected to end in ".apps.googleusercontent.com" — double check the value from Google Cloud Console.'
      );
    }
  },

  toBetterAuthConfig(credentials) {
    this.validateCredentials(credentials);

    return {
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      redirectURI: credentials.redirectUri,
      scope: ["profile", "email"],
      accessType: credentials.accessType ?? "offline", // required to receive refresh_token
      prompt: credentials.prompt ?? "select_account",
      // Accept id_tokens minted for sibling client IDs (e.g. native iOS/Android
      // clients that authenticate the user on-device and hand the backend an
      // id_token to verify) in addition to the primary web client id.
      overrideUserInfoOnSignIn: true,
      additionalClientIds: credentials.additionalClientIds ?? [],
    };
  },
};
