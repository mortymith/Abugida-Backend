/**
 * @module middleware/tanstack/client
 *
 * Client-safe TanStack Start integration. Import this from React components
 * and client-side code. This module has NO server-only dependencies.
 */

import { createAuthClient as createBetterAuthReactClient } from 'better-auth/react'

// ---------------------------------------------------------------------------
// Client-side: React hooks
// ---------------------------------------------------------------------------

export interface AuthClientOptions {
  /** Optional auth origin. When omitted, the client uses the current browser origin. */
  baseUrl?: string
  /** Auth endpoint path, such as `/auth`. */
  basePath?: string
}

/**
 * Creates the client-side auth object used inside React components. Exposes
 * `useSession()`, `signIn.social({ provider })`, and `signOut()`.
 *
 * @example
 * ```tsx
 * const authClient = createAuthClient({ basePath: "/auth" });
 *
 * function LoginButton() {
 *   const { data: session } = authClient.useSession();
 *   if (session) return <button onClick={() => authClient.signOut()}>Sign out</button>;
 *   return <button onClick={() => authClient.signIn.social({ provider: "google" })}>Sign in</button>;
 * }
 * ```
 */
export function createAuthClient(options: AuthClientOptions) {
  return createBetterAuthReactClient({
    baseURL: options.baseUrl,
    basePath: options.basePath,
  })
}
