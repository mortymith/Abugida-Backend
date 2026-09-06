/**
 * Example: wiring @abugida/auth into a Hono API.
 *
 * Run with: bun run examples/hono-example.ts
 */

import { Hono } from 'hono'
import { createAuth } from '@abugida/auth'
import {
  mountAuthRoutes,
  withSession,
  requireSession,
  type HonoAuthVariables,
} from '@abugida/auth/hono'
import { authSchema, createClient } from '@abugida/database'

const db = createClient(process.env.DATABASE_URL!)

export const auth = createAuth({
  environment: (process.env.NODE_ENV as 'development' | 'production' | 'test') ?? 'development',
  baseUrl: process.env.AUTH_BASE_URL ?? 'http://localhost:3000',
  secret: process.env.AUTH_SECRET!, // openssl rand -hex 32
  database: { db, schema: authSchema, provider: 'pg' },
  providers: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    telegram: {
      // Telegram OIDC (oauth.telegram.org) — BotFather > Bot Settings >
      // Web Login. The client secret is NOT the bot token.
      clientId: process.env.TELEGRAM_OIDC_CLIENT_ID!,
      clientSecret: process.env.TELEGRAM_OIDC_CLIENT_SECRET!,
    },
  },
  cors: { origins: [process.env.WEB_APP_URL ?? 'http://localhost:5173'], credentials: true },
  rateLimit: { max: 20, windowSeconds: 60 },
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
