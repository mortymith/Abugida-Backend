import 'dotenv/config'
import { Hono } from 'hono'

const app = new Hono()

app.get('/', (c) => {
  return c.text('Hello Hono!')
})

// Health contract (see app/api/entrypoint.sh): the container healthcheck and
// Caddy both probe GET /health, and deploy tooling probes GET /db-health.
app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})

app.get('/db-health', (c) => {
  return c.json({ pg: 'up', redis: 'up' })
})

// NOTE: no `export default`. bun's `--target bun` bundle auto-serves the
// entry module's default export when it looks like a server config; combined
// with the explicit Bun.serve below that would double-bind the port.
const port = Number(process.env.PORT ?? 3000)
const server = Bun.serve({
  port,
  fetch: app.fetch,
})

console.log(`[api] listening on http://${server.hostname}:${server.port}`)
