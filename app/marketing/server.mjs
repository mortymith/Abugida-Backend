/**
 * Abugida marketing site production server (Bun)
 *
 * Serves the statically built Astro output from ./dist with correct MIME
 * types and basic caching. The build is fully static, so no SSR step or
 * node_modules are required at runtime.
 *
 * Environment variables:
 *   PORT   server port (default: 8080)
 *
 * Health contract:
 *   GET /health → 200 {"status":"ok"}
 */

import path from 'node:path'

const PORT = Number(process.env.PORT ?? 8080)
const DIST_DIR = './dist'

const log = {
  info: (message) => console.log(`[INFO] ${message}`),
  success: (message) => console.log(`[SUCCESS] ${message}`),
  error: (message) => console.log(`[ERROR] ${message}`),
}

async function serveFile(relPath, cacheControl) {
  const segments = relPath.split('/')
  if (segments.includes('..')) {
    return new Response('Not Found', { status: 404 })
  }

  const file = Bun.file(path.join(DIST_DIR, relPath))
  if (!(await file.exists())) {
    return new Response('Not Found', { status: 404 })
  }

  return new Response(file, {
    headers: { 'Cache-Control': cacheControl },
  })
}

const server = Bun.serve({
  port: PORT,
  routes: {
    '/health': () => Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } }),
    '/': () => serveFile('index.html', 'public, max-age=300'),
    '/*': (req) => {
      const url = new URL(req.url)
      let relPath = url.pathname.replace(/^\/+/, '')
      if (!relPath) relPath = 'index.html'
      if (relPath.endsWith('/')) relPath += 'index.html'

      // Hashed asset files are immutable; regular pages get a short TTL.
      const isAsset = /^_astro\//.test(relPath)
      const cacheControl = isAsset ? 'public, max-age=31536000, immutable' : 'public, max-age=300'

      return serveFile(relPath, cacheControl)
    },
  },
  error(error) {
    log.error(error instanceof Error ? error.message : String(error))
    return new Response('Internal Server Error', { status: 500 })
  },
})

log.success(`Marketing server listening on http://localhost:${server.port}`)
