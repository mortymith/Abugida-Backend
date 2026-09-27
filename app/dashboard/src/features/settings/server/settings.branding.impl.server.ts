/**
 * Server-only implementation of S-6.4 Branding. Brand values live in
 * system_configs (category 'branding'); logo/favicon files are stored via
 * @abugida/storage presigned uploads with keys under `branding/`, and read
 * URLs are resolved server-side (never raw bucket keys in client state).
 * Never import from client code.
 */
import { createStorage, configFromEnv, hasEnvConfig } from '@abugida/storage'
import {
  readConfigKeys,
  requireSettingsAdmin,
  upsertConfigKey,
  writeAudit,
} from './settings.server-helpers.server'
import type { BrandingSettings, BrandingUploadUrl } from '../settings.types'
import type { BrandingUploadInput, SaveBrandingInput } from '../schemas/settings.schema'

const BRANDING_KEY = 'branding.settings'

interface StoredBranding {
  companyName?: string
  logoObjectKey?: string
  faviconObjectKey?: string
  primaryColor?: string
  secondaryColor?: string
  backgroundColor?: string
  customCss?: string
}

const UPLOAD_TTL_SECONDS = 900
const READ_TTL_SECONDS = 3600

function getStorage() {
  if (!hasEnvConfig()) {
    throw new Error(
      'STORAGE_NOT_CONFIGURED: set STORAGE_* env vars to enable branding uploads (see .env.example)',
    )
  }
  return createStorage(configFromEnv())
}

async function readAssetUrl(objectKey: string | null | undefined): Promise<string | null> {
  if (!objectKey || !hasEnvConfig()) return null
  try {
    const storage = createStorage(configFromEnv())
    const url = await storage.presignedDownload(objectKey, { expiresIn: READ_TTL_SECONDS })
    return url.url
  } catch {
    return null
  }
}

export async function getBrandingImpl(): Promise<BrandingSettings> {
  await requireSettingsAdmin()

  const stored = (await readConfigKeys([BRANDING_KEY]))[BRANDING_KEY] as StoredBranding | undefined
  const value: StoredBranding = stored ?? {}

  const [logoUrl, faviconUrl] = await Promise.all([
    readAssetUrl(value.logoObjectKey),
    readAssetUrl(value.faviconObjectKey),
  ])

  const anyValue = [
    value.companyName,
    value.logoObjectKey,
    value.faviconObjectKey,
    value.primaryColor,
    value.secondaryColor,
    value.backgroundColor,
    value.customCss,
  ].some((item) => item != null && item !== '')

  return {
    companyName: value.companyName ?? null,
    logoObjectKey: value.logoObjectKey ?? null,
    logoUrl,
    faviconObjectKey: value.faviconObjectKey ?? null,
    faviconUrl,
    primaryColor: value.primaryColor ?? null,
    secondaryColor: value.secondaryColor ?? null,
    backgroundColor: value.backgroundColor ?? null,
    customCss: value.customCss ?? null,
    availability: anyValue ? 'ok' : 'no_data',
  }
}

export async function saveBrandingImpl(input: SaveBrandingInput): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()

  const value: StoredBranding = {
    companyName: input.companyName,
    logoObjectKey: input.logoObjectKey ?? undefined,
    faviconObjectKey: input.faviconObjectKey ?? undefined,
    primaryColor: input.primaryColor ?? undefined,
    secondaryColor: input.secondaryColor ?? undefined,
    backgroundColor: input.backgroundColor ?? undefined,
    customCss: input.customCss ?? undefined,
  }
  await upsertConfigKey({
    key: BRANDING_KEY,
    value,
    category: 'branding',
    description: 'Platform branding: logo, colors, favicon, custom CSS (S-6.4)',
  })

  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: { screen: 'S-6.4', action: 'save_branding' },
  })
  return { ok: true }
}

export async function resetBrandingImpl(): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()

  await upsertConfigKey({
    key: BRANDING_KEY,
    value: {},
    category: 'branding',
    description: 'Platform branding: logo, colors, favicon, custom CSS (S-6.4)',
  })

  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: { screen: 'S-6.4', action: 'reset_branding' },
  })
  return { ok: true }
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/x-icon': 'ico',
}

export async function getBrandingUploadUrlImpl(
  input: BrandingUploadInput,
): Promise<BrandingUploadUrl> {
  await requireSettingsAdmin()

  const extension = ALLOWED_IMAGE_TYPES[input.contentType]
  if (!extension) throw new Error('UNSUPPORTED_MEDIA_TYPE: use PNG, JPEG, WebP, SVG, or ICO')
  if (input.kind === 'logo' && input.contentType === 'image/x-icon') {
    throw new Error('UNSUPPORTED_MEDIA_TYPE: logos must be PNG, JPEG, WebP, or SVG')
  }

  const objectKey = `branding/${input.kind}-${globalThis.crypto.randomUUID()}.${extension}`

  const storage = getStorage()
  const presigned = await storage.presignedUpload(objectKey, {
    expiresIn: UPLOAD_TTL_SECONDS,
    contentType: input.contentType,
  })
  return { objectKey, uploadUrl: presigned.url, expiresIn: UPLOAD_TTL_SECONDS }
}

/** Short-lived read URL for a branding asset; keys are validated by prefix. */
export async function getBrandingAssetUrlImpl(objectKey: string): Promise<{ url: string | null }> {
  await requireSettingsAdmin()
  if (!objectKey.startsWith('branding/')) throw new Error('FORBIDDEN_KEY')
  return { url: await readAssetUrl(objectKey) }
}
