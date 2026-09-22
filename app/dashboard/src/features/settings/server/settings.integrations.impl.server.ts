/**
 * Server-only implementation of S-6.3 Integrations. Payment gateways read
 * the real finance.payment_gateways rows (the platform's sole live provider
 * is Telebirr — the enum and API describe it as the only method, so the UI
 * renders actual rows rather than the wireframe's aspirational list).
 * Email/analytics configs live in system_configs; credentials are write-only.
 * Auth-provider availability reflects the real server configuration (env
 * presence) — never the secret values. Never import from client code.
 */
import { asc, eq, isNull } from '@abugida/database'
import { paymentGateways } from '@abugida/database/finance'
import { db } from '#/config/db.config'
import {
  readConfigKeys,
  requireSettingsAdmin,
  upsertConfigKey,
  writeAudit,
} from './settings.server-helpers.server'
import { authServerConfigSummary } from './settings.provider-config.server'
import type {
  AnalyticsIntegration,
  EmailIntegration,
  IntegrationsPage,
  PaymentGatewayItem,
} from '../settings.types'
import type {
  SaveAnalyticsIntegrationInput,
  SaveEmailIntegrationInput,
  SavePaymentGatewayConfigInput,
  TogglePaymentGatewayInput,
} from '../schemas/settings.schema'

const EMAIL_KEY = 'integrations.email'
const ANALYTICS_KEY = 'integrations.analytics'

interface StoredEmailConfig {
  provider?: 'sendgrid' | 'smtp'
  fromAddress?: string | null
  smtpHost?: string | null
  smtpPort?: number | null
  smtpUser?: string | null
}

interface StoredAnalyticsConfig {
  googleAnalyticsId?: string | null
  mixpanelToken?: string | null
}

export async function getIntegrationsImpl(): Promise<IntegrationsPage> {
  await requireSettingsAdmin()

  const [gatewayRows, config] = await Promise.all([
    db
      .select()
      .from(paymentGateways)
      .where(isNull(paymentGateways.deletedAt))
      .orderBy(asc(paymentGateways.displayName)),
    readConfigKeys([EMAIL_KEY, ANALYTICS_KEY]),
  ])

  const gateways: PaymentGatewayItem[] = gatewayRows.map((row) => ({
    publicId: row.publicId,
    providerName: row.providerName ?? 'unknown',
    displayName: row.displayName,
    isEnabled: row.isEnabled,
    requiresDisclosure: row.requiresDisclosure,
    disclosureText: row.disclosureText,
    configured: Object.keys(row.apiConfig ?? {}).length > 0,
  }))

  const email = (config[EMAIL_KEY] ?? {}) as StoredEmailConfig
  const credentials = await readConfigKeys([
    'integrations.email.sendgrid_key',
    'integrations.email.smtp_password',
  ])
  const emailIntegration: EmailIntegration = {
    provider: email.provider ?? null,
    fromAddress: email.fromAddress ?? null,
    smtpHost: email.smtpHost ?? null,
    smtpPort: email.smtpPort ?? null,
    smtpUser: email.smtpUser ?? null,
    hasSendGridKey: credentials['integrations.email.sendgrid_key'] != null,
    hasSmtpPassword: credentials['integrations.email.smtp_password'] != null,
    availability: 'ok',
  }

  const analyticsStored = (config[ANALYTICS_KEY] ?? {}) as StoredAnalyticsConfig
  const analytics: AnalyticsIntegration = {
    googleAnalyticsId: analyticsStored.googleAnalyticsId ?? null,
    mixpanelToken: analyticsStored.mixpanelToken ?? null,
    availability: 'ok',
  }

  return {
    paymentGateways: gateways,
    paymentAvailability: gateways.length === 0 ? 'no_data' : 'ok',
    email: emailIntegration,
    analytics,
    authProviders: authServerConfigSummary(),
  }
}

export async function togglePaymentGatewayImpl(
  input: TogglePaymentGatewayInput,
): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()

  await db
    .update(paymentGateways)
    .set({ isEnabled: input.isEnabled, updatedAt: new Date() })
    .where(eq(paymentGateways.publicId, input.publicId))

  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: {
      screen: 'S-6.3',
      action: 'toggle_payment_gateway',
      gatewayPublicId: input.publicId,
      isEnabled: input.isEnabled,
    },
  })
  return { ok: true }
}

export async function savePaymentGatewayConfigImpl(
  input: SavePaymentGatewayConfigInput,
): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()

  await db
    .update(paymentGateways)
    .set({
      displayName: input.displayName,
      requiresDisclosure: input.requiresDisclosure,
      disclosureText: input.disclosureText,
      updatedAt: new Date(),
    })
    .where(eq(paymentGateways.publicId, input.publicId))

  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: {
      screen: 'S-6.3',
      action: 'configure_payment_gateway',
      gatewayPublicId: input.publicId,
    },
  })
  return { ok: true }
}

export async function saveEmailIntegrationImpl(
  input: SaveEmailIntegrationInput,
): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()

  // Non-secret fields are readable back; credentials are write-only keys.
  await upsertConfigKey({
    key: EMAIL_KEY,
    value: {
      provider: input.provider,
      fromAddress: input.fromAddress,
      smtpHost: input.smtpHost ?? null,
      smtpPort: input.smtpPort ?? null,
      smtpUser: input.smtpUser ?? null,
    } satisfies StoredEmailConfig,
    category: 'integrations',
    description: 'Email delivery service configuration (S-6.3)',
  })
  if (input.sendGridKey) {
    await upsertConfigKey({
      key: 'integrations.email.sendgrid_key',
      value: input.sendGridKey,
      category: 'integrations',
      description: 'SendGrid API key (write-only)',
      isEncrypted: true,
    })
  }
  if (input.smtpPassword) {
    await upsertConfigKey({
      key: 'integrations.email.smtp_password',
      value: input.smtpPassword,
      category: 'integrations',
      description: 'SMTP password (write-only)',
      isEncrypted: true,
    })
  }

  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: { screen: 'S-6.3', action: 'save_email_integration', provider: input.provider },
  })
  return { ok: true }
}

export async function saveAnalyticsIntegrationImpl(
  input: SaveAnalyticsIntegrationInput,
): Promise<{ ok: true }> {
  const adminId = await requireSettingsAdmin()

  await upsertConfigKey({
    key: ANALYTICS_KEY,
    value: {
      googleAnalyticsId: input.googleAnalyticsId,
      mixpanelToken: input.mixpanelToken,
    } satisfies StoredAnalyticsConfig,
    category: 'integrations',
    description: 'Product analytics integrations (S-6.3)',
  })

  await writeAudit({
    actorId: adminId,
    action: 'admin_action',
    resourceType: 'user_account',
    metadata: { screen: 'S-6.3', action: 'save_analytics_integration' },
  })
  return { ok: true }
}
