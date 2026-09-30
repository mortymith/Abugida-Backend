/**
 * Example: wiring @abugida/auth into a TanStack Start app.
 */

import { createFileRoute } from '@tanstack/react-router'
import { createAbugidaAuth } from '@abugida/auth'
import { resolveAuthEnv } from '@abugida/auth/env'
import {
  createAuthServerFunctions,
  requireAuthBeforeLoad,
  createAuthClient,
} from '@abugida/auth/tanstack'
import { createClient } from '@abugida/database'

// --- app/lib/auth.server.ts ------------------------------------------------

const db = createClient(process.env.DATABASE_URL!)

export const auth = createAbugidaAuth({
  env: resolveAuthEnv({
    ENVIRONMENT: process.env.NODE_ENV,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET, // openssl rand -hex 32
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
  }),
  db,
})

export const authServerFns = createAuthServerFunctions(auth)
// authServerFns.getServerSession()                        -> ResolvedSession | null (cached, cheap)
// authServerFns.refreshServerSession()                    -> ResolvedSession | null (bypasses the 60s cache)
// authServerFns.getServerAccessToken({ data: { providerId: "google" } }) -> string | null (auto-refreshes)

// --- app/lib/auth.client.ts -------------------------------------------------

export const authClient = createAuthClient({ basePath: import.meta.env.VITE_AUTH_BASE_PATH })

// --- app/routes/dashboard.tsx ------------------------------------------------

export const Route = createFileRoute('/dashboard')({
  // Redirects to /login if there's no session; makes `session` available to
  // the loader/component via context.
  beforeLoad: requireAuthBeforeLoad(authServerFns, { loginPath: '/login' }),
  loader: async () => authServerFns.getServerSession(),
  component: DashboardPage,
})

function DashboardPage() {
  // useSession() re-hydrates client-side and stays in sync after sign-out.
  const { data: session } = authClient.useSession()

  if (!session) return null

  return (
    <div>
      <p>Signed in as {session.user.email}</p>
      <button onClick={() => authClient.signOut()}>Sign out</button>
    </div>
  )
}

// --- app/routes/login.tsx ----------------------------------------------------

export function LoginButtons() {
  return (
    <div>
      <button
        onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: '/dashboard' })}
      >
        Continue with Google
      </button>
      <button
        onClick={() =>
          authClient.signIn.social({ provider: 'telegram-oidc', callbackURL: '/dashboard' })
        }
      >
        Continue with Telegram
      </button>
    </div>
  )
}
