import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  cancelTeamInvitation,
  changePassword,
  createApiKey,
  createCustomRole,
  createDataRequest,
  disableMfa,
  eraseStudentData,
  completeDataExport,
  getAccountLinkUrl,
  inviteTeamMember,
  markAvatarUploaded,
  removeTeamMember,
  resetBranding,
  revokeApiKey,
  revokeOtherSessions,
  revokeSession,
  saveAnalyticsIntegration,
  saveBranding,
  saveEmailIntegration,
  saveGeneralSettings,
  savePaymentGatewayConfig,
  saveRetentionPolicy,
  saveRolePermissions,
  saveSecurityPolicies,
  saveWebhookEndpoint,
  deleteWebhookEndpoint,
  sendWebhookTestEvent,
  startMfaEnrollment,
  togglePaymentGateway,
  unlinkConnectedAccount,
  updateProfile,
  updateTeamMemberRole,
  verifyMfaEnrollment,
} from '../server/all'
import type { QueryKey } from '@tanstack/react-query'
import type {
  CancelInvitationInput,
  CreateApiKeyInput,
  CreateCustomRoleInput,
  CreateDataRequestInput,
  DisableTotpInput,
  InviteTeamMemberInput,
  RemoveTeamMemberInput,
  SaveAnalyticsIntegrationInput,
  SaveBrandingInput,
  SaveEmailIntegrationInput,
  SaveGeneralSettingsInput,
  SavePaymentGatewayConfigInput,
  SaveRetentionPolicyInput,
  SaveRolePermissionsInput,
  SaveSecurityPoliciesInput,
  SaveWebhookEndpointInput,
  TypedEraseInput,
  UnlinkAccountInput,
  UpdateProfileInput,
  UpdateTeamMemberRoleInput,
  VerifyTotpInput,
  ApiKeyIdInput,
  WebhookIdInput,
} from '../schemas/settings.schema'

/**
 * Mutation hooks for the Settings feature (spec 08). Every mutation funnels
 * through a shared wrapper that invalidates the given keys, toasts success,
 * and strips server error codes (`CODE: message`) — the established
 * students/courses/library convention.
 */

function stripErrorCode(message: string): string {
  return message.replace(/^[A-Z_]+:\s*/, '')
}

export function useSettingsMutation<TInput, TOutput>(options: {
  mutationFn: (input: TInput) => Promise<TOutput>
  invalidate: QueryKey[]
  successToast?: string
  onSuccess?: (output: TOutput, input: TInput) => void
}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: (output, input) => {
      options.invalidate.forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key })
      })
      if (options.successToast) toast.success(options.successToast)
      options.onSuccess?.(output, input)
    },
    onError: (cause) => {
      toast.error(
        cause instanceof Error ? stripErrorCode(cause.message) : 'Something went wrong. Retry?',
      )
    },
  })
}

// ── S-6.1 General ────────────────────────────────────────────────────────────

export function useSaveGeneralSettings() {
  return useSettingsMutation<SaveGeneralSettingsInput, { ok: true }>({
    mutationFn: (input) => saveGeneralSettings({ data: input }),
    invalidate: [['settings', 'general']],
    successToast: 'Settings saved successfully.',
  })
}

// ── S-6.2 Team ───────────────────────────────────────────────────────────────

export function useInviteTeamMember() {
  return useSettingsMutation<InviteTeamMemberInput, { ok: true }>({
    mutationFn: (input) => inviteTeamMember({ data: input }),
    invalidate: [['settings', 'team']],
    successToast: 'Invitation sent successfully.',
  })
}

export function useUpdateTeamMemberRole() {
  return useSettingsMutation<UpdateTeamMemberRoleInput, { ok: true }>({
    mutationFn: (input) => updateTeamMemberRole({ data: input }),
    invalidate: [
      ['settings', 'team'],
      ['settings', 'roles'],
    ],
    successToast: 'Role updated. Changes apply immediately.',
  })
}

export function useRemoveTeamMember() {
  return useSettingsMutation<RemoveTeamMemberInput, { ok: true }>({
    mutationFn: (input) => removeTeamMember({ data: input }),
    invalidate: [['settings', 'team']],
    successToast: 'Team member removed.',
  })
}

export function useCancelTeamInvitation() {
  return useSettingsMutation<CancelInvitationInput, { ok: true }>({
    mutationFn: (input) => cancelTeamInvitation({ data: input }),
    invalidate: [['settings', 'team']],
    successToast: 'Invitation cancelled.',
  })
}

// ── S-6.3 Integrations ───────────────────────────────────────────────────────

export function useSaveEmailIntegration() {
  return useSettingsMutation<SaveEmailIntegrationInput, { ok: true }>({
    mutationFn: (input) => saveEmailIntegration({ data: input }),
    invalidate: [['settings', 'integrations']],
    successToast: 'Email service configuration saved.',
  })
}

export function useSaveAnalyticsIntegration() {
  return useSettingsMutation<SaveAnalyticsIntegrationInput, { ok: true }>({
    mutationFn: (input) => saveAnalyticsIntegration({ data: input }),
    invalidate: [['settings', 'integrations']],
    successToast: 'Config saved.',
  })
}

export function useTogglePaymentGateway() {
  return useSettingsMutation<{ publicId: string; isEnabled: boolean }, { ok: true }>({
    mutationFn: (input) => togglePaymentGateway({ data: input }),
    invalidate: [['settings', 'integrations']],
    successToast: 'Gateway updated.',
  })
}

export function useSavePaymentGatewayConfig() {
  return useSettingsMutation<SavePaymentGatewayConfigInput, { ok: true }>({
    mutationFn: (input) => savePaymentGatewayConfig({ data: input }),
    invalidate: [['settings', 'integrations']],
    successToast: 'Gateway configuration saved.',
  })
}

// ── S-6.4 Branding ───────────────────────────────────────────────────────────

export function useSaveBranding() {
  return useSettingsMutation<SaveBrandingInput, { ok: true }>({
    mutationFn: (input) => saveBranding({ data: input }),
    invalidate: [['settings', 'branding']],
    successToast: 'Branding updated successfully.',
  })
}

export function useResetBranding() {
  return useSettingsMutation<void, { ok: true }>({
    mutationFn: () => resetBranding(),
    invalidate: [['settings', 'branding']],
    successToast: 'Branding reset to default.',
  })
}

// ── S-6.5 Profile ────────────────────────────────────────────────────────────

export function useUpdateProfile() {
  return useSettingsMutation<UpdateProfileInput, { ok: true }>({
    mutationFn: (input) => updateProfile({ data: input }),
    invalidate: [['settings', 'profile']],
    successToast: 'Profile updated.',
  })
}

export function useChangePassword() {
  return useSettingsMutation<
    { currentPassword: string; newPassword: string; confirmNewPassword: string },
    { ok: true }
  >({
    mutationFn: ({ currentPassword, newPassword }) =>
      changePassword({ data: { currentPassword, newPassword, confirmNewPassword: newPassword } }),
    invalidate: [],
    successToast: 'Password changed.',
  })
}

export function useRevokeSession() {
  return useSettingsMutation<{ token: string }, { ok: true }>({
    mutationFn: (input) => revokeSession({ data: input }),
    invalidate: [['settings', 'profile-security']],
    successToast: 'Session revoked. The device is signed out.',
  })
}

export function useRevokeOtherSessions() {
  return useSettingsMutation<void, { ok: true }>({
    mutationFn: () => revokeOtherSessions(),
    invalidate: [['settings', 'profile-security']],
    successToast: 'All other sessions signed out.',
  })
}

export function useUnlinkAccount() {
  return useSettingsMutation<UnlinkAccountInput, { ok: true }>({
    mutationFn: (input) => unlinkConnectedAccount({ data: input }),
    invalidate: [['settings', 'profile-security']],
    successToast: 'Sign-in method removed.',
  })
}

export function useAccountLinkUrl() {
  return useSettingsMutation<'google' | 'telegram', { url: string | null }>({
    mutationFn: (provider) => getAccountLinkUrl({ data: provider }),
    invalidate: [],
    onSuccess: (output) => {
      if (output.url) {
        window.location.href = output.url
      } else {
        toast.error('This provider is not configured on the server yet.')
      }
    },
  })
}

export function useStartMfaEnrollment() {
  return useSettingsMutation<
    void,
    {
      totpUri: string
      secret: string
      backupCodes: string[]
    }
  >({
    mutationFn: () => startMfaEnrollment(),
    invalidate: [],
  })
}

export function useVerifyMfaEnrollment() {
  return useSettingsMutation<VerifyTotpInput, { ok: true }>({
    mutationFn: (input) => verifyMfaEnrollment({ data: input }),
    invalidate: [['settings', 'profile-security']],
    successToast: 'Two-factor authentication enabled.',
  })
}

export function useDisableMfa() {
  return useSettingsMutation<DisableTotpInput, { ok: true }>({
    mutationFn: (input) => disableMfa({ data: input }),
    invalidate: [['settings', 'profile-security']],
    successToast: 'Two-factor authentication disabled.',
  })
}

export function useMarkAvatarUploaded() {
  return useSettingsMutation<string, { ok: true }>({
    mutationFn: (objectKey) => markAvatarUploaded({ data: objectKey }),
    invalidate: [['settings', 'profile']],
  })
}

// ── S-6.7 API & Webhooks ─────────────────────────────────────────────────────

export function useCreateApiKey() {
  return useSettingsMutation<CreateApiKeyInput, { publicId: string; key: string; name: string }>({
    mutationFn: (input) => createApiKey({ data: input }),
    invalidate: [['settings', 'api-keys']],
  })
}

export function useRevokeApiKey() {
  return useSettingsMutation<ApiKeyIdInput, { ok: true }>({
    mutationFn: (input) => revokeApiKey({ data: input }),
    invalidate: [['settings', 'api-keys']],
    successToast: 'API key revoked.',
  })
}

export function useSaveWebhookEndpoint() {
  return useSettingsMutation<SaveWebhookEndpointInput, { ok: true; publicId: string }>({
    mutationFn: (input) => saveWebhookEndpoint({ data: input }),
    invalidate: [['settings', 'webhooks']],
    successToast: 'Webhook saved.',
  })
}

export function useDeleteWebhookEndpoint() {
  return useSettingsMutation<WebhookIdInput, { ok: true }>({
    mutationFn: (input) => deleteWebhookEndpoint({ data: input }),
    invalidate: [['settings', 'webhooks']],
    successToast: 'Webhook removed.',
  })
}

export function useSendWebhookTestEvent() {
  return useSettingsMutation<
    WebhookIdInput,
    {
      delivery: {
        status: string
        responseStatus: number | null
        lastError: string | null
      }
    }
  >({
    mutationFn: (input) => sendWebhookTestEvent({ data: input }),
    invalidate: [['settings', 'webhooks']],
    onSuccess: (output) => {
      if (output.delivery.status === 'sent') {
        toast.success('Test successful')
      } else {
        toast.error(
          `Test failed${output.delivery.lastError ? `: ${output.delivery.lastError}` : '.'}`,
        )
      }
    },
  })
}

// ── S-6.8 Security ───────────────────────────────────────────────────────────

export function useSaveSecurityPolicies() {
  return useSettingsMutation<SaveSecurityPoliciesInput, { ok: true }>({
    mutationFn: (input) => saveSecurityPolicies({ data: input }),
    invalidate: [['settings', 'security-policies']],
    successToast: 'Security policy updated.',
  })
}

// ── S-6.9 Roles ──────────────────────────────────────────────────────────────

export function useSaveRolePermissions() {
  return useSettingsMutation<SaveRolePermissionsInput, { ok: true }>({
    mutationFn: (input) => saveRolePermissions({ data: input }),
    invalidate: [['settings', 'roles']],
    successToast: 'Permissions updated. Changes apply immediately.',
  })
}

export function useCreateCustomRole() {
  return useSettingsMutation<CreateCustomRoleInput, { ok: true; publicId: string | null }>({
    mutationFn: (input) => createCustomRole({ data: input }),
    invalidate: [['settings', 'roles']],
    successToast: 'Custom role created.',
  })
}

// ── S-6.10 Privacy ───────────────────────────────────────────────────────────

export function useSaveRetentionPolicy() {
  return useSettingsMutation<SaveRetentionPolicyInput, { ok: true }>({
    mutationFn: (input) => saveRetentionPolicy({ data: input }),
    invalidate: [['settings', 'privacy']],
    successToast: 'Retention policy updated.',
  })
}

export function useCreateDataRequest() {
  return useSettingsMutation<CreateDataRequestInput, { ok: true }>({
    mutationFn: (input) => createDataRequest({ data: input }),
    invalidate: [['settings', 'data-requests']],
    successToast: 'Data request recorded.',
  })
}

export function useCompleteDataExport() {
  return useSettingsMutation<string, { fileName: string; json: string }>({
    mutationFn: (publicId) => completeDataExport({ data: { publicId } }),
    invalidate: [['settings', 'data-requests']],
    onSuccess: (output) => {
      const blob = new Blob([output.json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = output.fileName
      anchor.click()
      URL.revokeObjectURL(url)
      toast.success('Export archive downloaded.')
    },
  })
}

export function useEraseStudentData() {
  return useSettingsMutation<TypedEraseInput, { ok: true }>({
    mutationFn: (input) => eraseStudentData({ data: input }),
    invalidate: [['settings', 'data-requests']],
    successToast: 'Student data erased. Financial records were retained per tax rules.',
  })
}
