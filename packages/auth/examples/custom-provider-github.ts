/**
 * Example: adding a brand-new OAuth provider (GitHub) without modifying
 * @abugida/auth itself. This is the concrete proof for the extensibility
 * requirement — implement `AuthProviderDefinition`, pass it into
 * `providers.custom`, done.
 */

import type { AuthProviderDefinition, BaseProviderCredentials } from "@abugida/auth";
import { assertNonEmpty } from "@abugida/auth/providers"; // re-exported validation helper
import { createAuth } from "@abugida/auth";

interface GithubCredentials extends BaseProviderCredentials {
  clientId: string;
  clientSecret: string;
}

const githubProvider: AuthProviderDefinition<GithubCredentials> = {
  id: "github",
  name: "GitHub",
  scopes: ["read:user", "user:email"],

  validateCredentials(credentials) {
    assertNonEmpty("github", "clientId", credentials.clientId);
    assertNonEmpty("github", "clientSecret", credentials.clientSecret);
  },

  toBetterAuthConfig(credentials) {
    this.validateCredentials(credentials);
    return {
      clientId: credentials.clientId,
      clientSecret: credentials.clientSecret,
      redirectURI: credentials.redirectUri,
      scope: ["read:user", "user:email"],
    };
  },
};

export const auth = createAuth({
  environment: "development",
  baseUrl: "http://localhost:3000",
  secret: process.env.AUTH_SECRET!,
  database: {
    db: {} /* your drizzle instance */,
    schema: {} as never /* your injected schema */,
    provider: "pg",
  },
  providers: {
    // Apple/Google still work side by side with a custom provider:
    google: { clientId: process.env.GOOGLE_CLIENT_ID!, clientSecret: process.env.GOOGLE_CLIENT_SECRET! },
    custom: {
      github: {
        definition: githubProvider,
        credentials: {
          clientId: process.env.GITHUB_CLIENT_ID!,
          clientSecret: process.env.GITHUB_CLIENT_SECRET!,
        },
      },
    },
  },
});

// Client-side, this is now indistinguishable from a built-in provider:
//   authClient.signIn.social({ provider: "github" })
