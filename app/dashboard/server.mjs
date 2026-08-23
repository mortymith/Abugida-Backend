/**
 * TanStack Start production server (Bun)
 *
 * Serves the Vite-built dashboard:
 *   - static assets from ./dist/client (preloaded into memory with ETag and
 *     gzip support; larger files served on-demand from disk)
 *   - every other route forwarded to the SSR handler in ./dist/server/server.js
 *
 * Environment variables:
 *   PORT                          server port (default: 8080)
 *   ASSET_PRELOAD_MAX_SIZE        preload threshold in bytes (default: 5 MiB)
 *   ASSET_PRELOAD_ENABLE_ETAG     set "false" to disable ETags
 *   ASSET_PRELOAD_ENABLE_GZIP     set "false" to disable gzip
 *   ASSET_PRELOAD_VERBOSE_LOGGING set "true" for per-asset logging
 *
 * Built for the official Bun deployment of TanStack Start. See
 * https://tanstack.com/start/latest/docs/framework/react/guide/hosting
 */

import path from 'node:path'

const PORT = Number(process.env.PORT ?? 8080)
const CLIENT_DIR = './dist/client'
const SERVER_ENTRY = './dist/server/server.js'
const MAX_PRELOAD_BYTES = Number(process.env.ASSET_PRELOAD_MAX_SIZE ?? 5 * 1024 * 1024)
const VERBOSE = process.env.ASSET_PRELOAD_VERBOSE_LOGGING === 'true'
const ENABLE_ETAG = (process.env.ASSET_PRELOAD_ENABLE_ETAG ?? 'true') === 'true'
const ENABLE_GZIP = (process.env.ASSET_PRELOAD_ENABLE_GZIP ?? 'true') === 'true'
const GZIP_MIN_BYTES = Number(process.env.ASSET_PRELOAD_GZIP_MIN_SIZE ?? 1024)
const GZIP_TYPES = [
  'text/',
  'application/javascript',
  'application/json',
  'application/xml',
  'image/svg+xml',
]

const log = {
  info: (message) => console.log(`[INFO] ${message}`),
  success: (message) => console.log(`[SUCCESS] ${message}`),
  warning: (message) => console.log(`[WARNING] ${message}`),
  error: (message) => console.log(`[ERROR] ${message}`),
}

const isCompressible = (mimeType) =>
  GZIP_TYPES.some((type) => (type.endsWith('/') ? mimeType.startsWith(type) : mimeType === type))

const computeEtag = (bytes) => `W/"${Bun.hash(bytes).toString(16)}-${bytes.byteLength}"`

function responseFor(asset) {
  return (req) => {
    const headers = {
      'Content-Type': asset.type,
      'Cache-Control': asset.immutable
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=3600',
    }

    if (ENABLE_ETAG && asset.etag) {
      if (req.headers.get('if-none-match') === asset.etag) {
        return new Response(null, { status: 304, headers: { ETag: asset.etag } })
      }
      headers.ETag = asset.etag
    }

    if (ENABLE_GZIP && asset.gz && req.headers.get('accept-encoding')?.includes('gzip')) {
      headers['Content-Encoding'] = 'gzip'
      return new Response(asset.gz, { status: 200, headers })
    }

    return new Response(asset.raw, { status: 200, headers })
  }
}

async function loadStaticRoutes() {
  const routes = {}
  let preloadedBytes = 0

  for await (const relative of new Bun.Glob('**/*').scan({ cwd: CLIENT_DIR })) {
    const file = Bun.file(path.join(CLIENT_DIR, relative))
    if (!(await file.exists()) || file.size === 0) continue

    const route = `/${relative.split(path.sep).join(path.posix.sep)}`
    const type = file.type || 'application/octet-stream'

    if (file.size <= MAX_PRELOAD_BYTES) {
      const raw = new Uint8Array(await file.arrayBuffer())
      const gz =
        ENABLE_GZIP && raw.byteLength >= GZIP_MIN_BYTES && isCompressible(type)
          ? Bun.gzipSync(raw)
          : undefined
      routes[route] = responseFor({
        raw,
        gz,
        type,
        immutable: true,
        etag: ENABLE_ETAG ? computeEtag(raw) : undefined,
      })
      preloadedBytes += raw.byteLength
    } else {
      routes[route] = () =>
        new Response(Bun.file(path.join(CLIENT_DIR, relative)), {
          headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=3600' },
        })
    }
  }

  log.success(`Preloaded ${(preloadedBytes / 1024 / 1024).toFixed(2)} MB of static assets`)
  return routes
}

async function main() {
  const { default: handler } = await import(SERVER_ENTRY)

  const routes = await loadStaticRoutes()
  routes['/health'] = () =>
    Response.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } })

  const server = Bun.serve({
    port: PORT,
    routes: {
      ...routes,
      '/*': (req) => {
        try {
          return handler.fetch(req)
        } catch (error) {
          log.error(error instanceof Error ? error.message : String(error))
          return new Response('Internal Server Error', { status: 500 })
        }
      },
    },
    error(error) {
      log.error(error instanceof Error ? error.message : String(error))
      return new Response('Internal Server Error', { status: 500 })
    },
  })

  log.success(`Dashboard server listening on http://localhost:${server.port}`)
}

main().catch((error) => {
  log.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
