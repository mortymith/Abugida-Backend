import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import type { Register } from '@tanstack/react-router'
import type { RequestHandler } from '@tanstack/react-start/server'
import { env } from '../config/app.config'

const startHandler = createStartHandler(defaultStreamHandler)

const fetch: RequestHandler<Register> = async (...args) => {
  console.log('Incoming request URL:', args[0].url)
  const request = args[0]
  const url = new URL(request.url)

  if (url.pathname.startsWith(env.AUTH_BASE_PATH)) {
    console.log('Auth route triggered:', url.pathname, 'method:', request.method)
    const { auth } = await import('../config/auth.config')
    try {
      const authResponse = await auth.raw.handler(request)
      console.log('Auth handler response status:', authResponse.status)
      return authResponse
    } catch (err) {
      console.error('Auth handler error:', err)
      return new Response('Internal Server Error', { status: 500 })
    }
  }

  return startHandler(...args)
}

export type ServerEntry = { fetch: RequestHandler<Register> }

export function createServerEntry(entry: ServerEntry): ServerEntry {
  return {
    async fetch(...args) {
      return await entry.fetch(...args)
    },
  }
}

export default createServerEntry({ fetch })
