import { queryOptions } from '@tanstack/react-query'
import {
  getApiKeys,
  getAuditLog,
  getBillingPage,
  getBranding,
  getConsentLog,
  getDataRequests,
  getGeneralSettings,
  getGeneralSettingsReference,
  getIntegrations,
  getPrivacyPage,
  getProfile,
  getProfileSecurity,
  getRolesPage,
  getSecurityPolicies,
  getTeamPage,
  getWebhookEndpoints,
} from '../server/all'
import type { AuditLogQuery } from '../schemas/settings.schema'

/**
 * TanStack Query factories for the Settings feature (spec 08). Routes warm
 * these caches via loaders; components subscribe with `useQuery` so SSR +
 * client refetches share one cache entry per key.
 */

export const settingsQueryKeys = {
  general: () => ['settings', 'general'] as const,
  generalReference: () => ['settings', 'general-reference'] as const,
  team: () => ['settings', 'team'] as const,
  integrations: () => ['settings', 'integrations'] as const,
  branding: () => ['settings', 'branding'] as const,
  profile: () => ['settings', 'profile'] as const,
  profileSecurity: () => ['settings', 'profile-security'] as const,
  billing: () => ['settings', 'billing'] as const,
  apiKeys: () => ['settings', 'api-keys'] as const,
  webhooks: () => ['settings', 'webhooks'] as const,
  securityPolicies: () => ['settings', 'security-policies'] as const,
  auditLog: (query: AuditLogQuery) => ['settings', 'audit-log', query] as const,
  roles: () => ['settings', 'roles'] as const,
  privacy: () => ['settings', 'privacy'] as const,
  dataRequests: () => ['settings', 'data-requests'] as const,
  consentLog: (page?: number) => ['settings', 'consent-log', page ?? 1] as const,
}

const STALE = {
  settings: 30_000,
  reference: 300_000,
  audit: 15_000,
  profile: 15_000,
} as const

export function generalSettingsQueryOptions() {
  return queryOptions({
    queryKey: settingsQueryKeys.general(),
    queryFn: () => getGeneralSettings(),
    staleTime: STALE.settings,
  })
}

export function generalSettingsReferenceQueryOptions() {
  return queryOptions({
    queryKey: settingsQueryKeys.generalReference(),
    queryFn: () => getGeneralSettingsReference(),
    staleTime: STALE.reference,
  })
}

export function teamQueryOptions() {
  return queryOptions({
    queryKey: settingsQueryKeys.team(),
    queryFn: () => getTeamPage(),
    staleTime: STALE.settings,
  })
}

export function integrationsQueryOptions() {
  return queryOptions({
    queryKey: settingsQueryKeys.integrations(),
    queryFn: () => getIntegrations(),
    staleTime: STALE.settings,
  })
}

export function brandingQueryOptions() {
  return queryOptions({
    queryKey: settingsQueryKeys.branding(),
    queryFn: () => getBranding(),
    staleTime: STALE.settings,
  })
}

export function profileQueryOptions() {
  return queryOptions({
    queryKey: settingsQueryKeys.profile(),
    queryFn: () => getProfile(),
    staleTime: STALE.profile,
  })
}

export function profileSecurityQueryOptions() {
  return queryOptions({
    queryKey: settingsQueryKeys.profileSecurity(),
    queryFn: () => getProfileSecurity(),
    staleTime: STALE.profile,
  })
}

export function billingQueryOptions() {
  return queryOptions({
    queryKey: settingsQueryKeys.billing(),
    queryFn: () => getBillingPage(),
    staleTime: STALE.settings,
  })
}

export function apiKeysQueryOptions() {
  return queryOptions({
    queryKey: settingsQueryKeys.apiKeys(),
    queryFn: () => getApiKeys(),
    staleTime: STALE.settings,
  })
}

export function webhooksQueryOptions() {
  return queryOptions({
    queryKey: settingsQueryKeys.webhooks(),
    queryFn: () => getWebhookEndpoints(),
    staleTime: STALE.settings,
  })
}

export function securityPoliciesQueryOptions() {
  return queryOptions({
    queryKey: settingsQueryKeys.securityPolicies(),
    queryFn: () => getSecurityPolicies(),
    staleTime: STALE.settings,
  })
}

export function auditLogQueryOptions(query: AuditLogQuery) {
  return queryOptions({
    queryKey: settingsQueryKeys.auditLog(query),
    queryFn: () => getAuditLog({ data: query }),
    staleTime: STALE.audit,
  })
}

export function rolesQueryOptions() {
  return queryOptions({
    queryKey: settingsQueryKeys.roles(),
    queryFn: () => getRolesPage(),
    staleTime: STALE.settings,
  })
}

export function privacyQueryOptions() {
  return queryOptions({
    queryKey: settingsQueryKeys.privacy(),
    queryFn: () => getPrivacyPage(),
    staleTime: STALE.settings,
  })
}

export function dataRequestsQueryOptions() {
  return queryOptions({
    queryKey: settingsQueryKeys.dataRequests(),
    queryFn: () => getDataRequests(),
    staleTime: STALE.settings,
  })
}

export function consentLogQueryOptions(page?: number) {
  return queryOptions({
    queryKey: settingsQueryKeys.consentLog(page),
    queryFn: () => getConsentLog({ data: { page } }),
    staleTime: STALE.settings,
  })
}
