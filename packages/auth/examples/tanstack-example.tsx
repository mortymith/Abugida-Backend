/**
 * Example: wiring @abugida/auth into a TanStack Start app.
 */

import { createFileRoute } from "@tanstack/react-router";
import { drizzle } from "drizzle-orm/node-postgres";
import { createAuth } from "@abugida/auth";
import { createAuthServerFunctions, requireAuthBeforeLoad, createAuthClient } from "@abugida/auth/tanstack";
import { authSchema } from "./fixtures/schema";

// --- app/lib/auth.server.ts ------------------------------------------------

const db = drizzle(process.env.DATABASE_URL!);

export const auth = createAuth({
  environment: (process.env.NODE_ENV as "development" | "production" | "test") ?? "development",
  baseUrl: process.env.AUTH_BASE_URL ?? "http://localhost:3000",
  secret: process.env.AUTH_SECRET!,
  database: { db, schema: authSchema, provider: "pg" },
  providers: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});

export const authServerFns = createAuthServerFunctions(auth);
// authServerFns.getServerSession()                        -> ResolvedSession | null (cached, cheap)
// authServerFns.refreshServerSession()                    -> ResolvedSession | null (bypasses the 60s cache)
// authServerFns.getServerAccessToken({ data: { providerId: "google" } }) -> string | null (auto-refreshes)

// --- app/lib/auth.client.ts -------------------------------------------------

export const authClient = createAuthClient({ baseUrl: import.meta.env.VITE_AUTH_BASE_URL });

// --- app/routes/dashboard.tsx ------------------------------------------------

export const Route = createFileRoute("/dashboard")({
  // Redirects to /login if there's no session; makes `session` available to
  // the loader/component via context.
  beforeLoad: requireAuthBeforeLoad(authServerFns, { loginPath: "/login" }),
  loader: async () => authServerFns.getServerSession(),
  component: DashboardPage,
});

function DashboardPage() {
  // useSession() re-hydrates client-side and stays in sync after sign-out.
  const { data: session } = authClient.useSession();

  if (!session) return null;

  return (
    <div>
      <p>Signed in as {session.user.email}</p>
      <button onClick={() => authClient.signOut()}>Sign out</button>
    </div>
  );
}

// --- app/routes/login.tsx ----------------------------------------------------

export function LoginButtons() {
  return (
    <div>
      <button onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/dashboard" })}>
        Continue with Google
      </button>
      <button onClick={() => authClient.signIn.social({ provider: "apple", callbackURL: "/dashboard" })}>
        Continue with Apple
      </button>
    </div>
  );
}
