/**
 * Example: wiring @abugida/auth into a Hono API.
 *
 * Run with: bun run examples/hono-example.ts
 */

import { Hono } from 'hono'
import { createAbugidaAuth } from '@abugida/auth'
import { resolveAuthEnv } from '@abugida/auth/env'
import {
  mountAuthRoutes,
  withSession,
  requireSession,
  type HonoAuthVariables,
} from '@abugida/auth/hono'
import { createClient } from '@abugida/database'

const db = createClient(process.env.DATABASE_URL!)

// One call. The schema comes from @abugida/database, the plugin registry and
// every policy default from this package; the environment below is the whole
// surface an app supplies.
export const auth = createAbugidaAuth({
  env: resolveAuthEnv({
    ENVIRONMENT: process.env.NODE_ENV,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET, // openssl rand -hex 32
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3000',
    WEB_APP_URL: process.env.WEB_APP_URL ?? 'http://localhost:5173',
    // Telegram OIDC (oauth.telegram.org) — BotFather > Bot Settings > Web
    // Login. The client secret is NOT the bot token.
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    TELEGRAM_OIDC_CLIENT_ID: process.env.TELEGRAM_OIDC_CLIENT_ID,
    TELEGRAM_OIDC_CLIENT_SECRET: process.env.TELEGRAM_OIDC_CLIENT_SECRET,
  }),
  db,
})

const app = new Hono<{ Variables: HonoAuthVariables }>()

// Mounts /auth/login, /auth/callback/:provider, /auth/logout, /auth/session, ...
mountAuthRoutes(app, auth)

// Optional: attach session to every request without blocking anonymous ones.
app.use('*', withSession(auth))

app.get('/', (c) => c.json({ user: c.get('user') }))

// Protected route.
app.get('/me', requireSession(auth), (c) => c.json({ user: c.get('user') }))

export default app
