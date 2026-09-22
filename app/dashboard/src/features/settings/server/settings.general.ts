import { createServerFn } from '@tanstack/react-start'
import type {
  GeneralSettings,
  GeneralSettingsReference,
  GeneralSettingsSaveResult,
} from '../settings.types'
import { saveGeneralSettingsSchema } from '../schemas/settings.schema'

/**
 * Client-safe S-6.1 General Settings server functions. Impls are dynamically
 * imported so server-only code never enters the client bundle.
 */

export const getGeneralSettings = createServerFn({ method: 'GET' }).handler(
  async (): Promise<GeneralSettings> => {
    const { getGeneralSettingsImpl } = await import('./settings.general.impl.server')
    return getGeneralSettingsImpl()
  },
)

export const getGeneralSettingsReference = createServerFn({ method: 'GET' }).handler(
  async (): Promise<GeneralSettingsReference> => {
    const { getGeneralSettingsReferenceImpl } = await import('./settings.general.impl.server')
    return getGeneralSettingsReferenceImpl()
  },
)

export const saveGeneralSettings = createServerFn({ method: 'POST' })
  .validator((input: unknown) => saveGeneralSettingsSchema.parse(input))
  .handler(async ({ data }): Promise<GeneralSettingsSaveResult> => {
    const { saveGeneralSettingsImpl } = await import('./settings.general.impl.server')
    return saveGeneralSettingsImpl(data)
  })
