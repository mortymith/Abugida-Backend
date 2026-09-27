import { createServerFn } from '@tanstack/react-start'
import { templatePublicIdSchema, templateSaveSchema } from '../schemas/marketing.schema'

/** Client-safe S-8.2 Email Template Editor server functions. */

export const listTemplates = createServerFn({ method: 'GET' }).handler(async () => {
  const { listTemplatesImpl } = await import('./marketing.templates.impl.server')
  return listTemplatesImpl()
})

export const getTemplate = createServerFn({ method: 'GET' })
  .validator((input: unknown) => templatePublicIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { getTemplateImpl } = await import('./marketing.templates.impl.server')
    return getTemplateImpl(data)
  })

export const saveTemplate = createServerFn({ method: 'POST' })
  .validator((input: unknown) => templateSaveSchema.parse(input))
  .handler(async ({ data }) => {
    const { saveTemplateImpl } = await import('./marketing.templates.impl.server')
    return saveTemplateImpl(data)
  })

export const getPrebuiltLibrary = createServerFn({ method: 'GET' }).handler(async () => {
  const { getPrebuiltLibraryImpl } = await import('./marketing.templates.impl.server')
  return getPrebuiltLibraryImpl()
})

export const createFromPrebuilt = createServerFn({ method: 'POST' })
  .validator((input: unknown) => input as { key: string })
  .handler(async ({ data }) => {
    const { createFromPrebuiltImpl } = await import('./marketing.templates.impl.server')
    return createFromPrebuiltImpl(data)
  })

export const sendTestTemplate = createServerFn({ method: 'POST' })
  .validator((input: unknown) => templatePublicIdSchema.parse(input))
  .handler(async ({ data }) => {
    const { sendTestTemplateImpl } = await import('./marketing.templates.impl.server')
    return sendTestTemplateImpl(data)
  })

export const getPreviewSample = createServerFn({ method: 'GET' }).handler(async () => {
  const { getPreviewSampleImpl } = await import('./marketing.templates.impl.server')
  return getPreviewSampleImpl()
})
