import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import type { Register } from '@tanstack/react-router'
import type { RequestHandler } from '@tanstack/react-start/server'
import { env } from '../config/app.config'

const startHandler = createStartHandler(defaultStreamHandler)

const fetch: RequestHandler<Register> = async (...args) => {
  const request = args[0]
  const url = new URL(request.url)

  if (url.pathname.startsWith(env.AUTH_BASE_PATH)) {
    const { auth } = await import('../config/auth.config')
    return auth.raw.handler(request)
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
