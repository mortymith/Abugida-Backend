import { createServerFn } from '@tanstack/react-start'
import {
  broadcastPreviewSchema,
  broadcastSchema,
  markThreadReadInput,
  sendMessageSchema,
  threadMessagesQuerySchema,
  threadsQuerySchema,
} from '../schemas/students.schema'

/**
 * Client-safe S-4.5 Messaging Center server functions. All handlers gate on
 * the messaging role (admin/support) inside the impl.
 */

export const getThreads = createServerFn({ method: 'GET' })
  .validator((input: unknown) => threadsQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { getThreadsImpl } = await import('./students.messaging.impl.server')
    return getThreadsImpl(data)
  })

export const getThreadMessages = createServerFn({ method: 'GET' })
  .validator((input: unknown) => threadMessagesQuerySchema.parse(input))
  .handler(async ({ data }) => {
    const { getThreadMessagesImpl } = await import('./students.messaging.impl.server')
    return getThreadMessagesImpl(data)
  })

export const sendMessage = createServerFn({ method: 'POST' })
  .validator((input: unknown) => sendMessageSchema.parse(input))
  .handler(async ({ data }) => {
    const { sendMessageImpl } = await import('./students.messaging.impl.server')
    return sendMessageImpl(data)
  })

export const previewBroadcast = createServerFn({ method: 'GET' })
  .validator((input: unknown) => broadcastPreviewSchema.parse(input))
  .handler(async ({ data }) => {
    const { previewBroadcastImpl } = await import('./students.messaging.impl.server')
    return previewBroadcastImpl(data)
  })

export const broadcastMessage = createServerFn({ method: 'POST' })
  .validator((input: unknown) => broadcastSchema.parse(input))
  .handler(async ({ data }) => {
    const { broadcastImpl } = await import('./students.messaging.impl.server')
    return broadcastImpl(data)
  })

export const markThreadRead = createServerFn({ method: 'POST' })
  .validator((input: unknown) => markThreadReadInput.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const { markThreadReadImpl } = await import('./students.messaging.impl.server')
    return markThreadReadImpl(data)
  })

export const searchAttachableEntities = createServerFn({ method: 'GET' })
  .validator((input: unknown) => (typeof input === 'string' ? { q: input } : { q: '' }))
  .handler(async ({ data }) => {
    const { searchAttachableEntitiesImpl } = await import('./students.messaging.impl.server')
    return searchAttachableEntitiesImpl(data.q)
  })
