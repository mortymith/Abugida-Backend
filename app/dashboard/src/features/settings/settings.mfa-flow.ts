/**
 * S-6.5 MFA flow logic (spec 08 § S-6.5). Three-step inline flow, backup
 * codes, unlink-provider guard.
 */

export type MfaFlowStep = 'choose_method' | 'scan_or_copy' | 'confirm'

export type MfaState =
  | { readonly kind: 'off' }
  | { readonly kind: 'mid_flow'; readonly step: MfaFlowStep }
  | { readonly kind: 'enabled'; readonly enrolledAt: number }

export const BACKUP_CODE_COUNT = 10

/**
 * Whether 2FA is off during mid-flow. The spec: "Closing or navigating
 * away mid-flow leaves 2FA off and says so: 'Setup wasn't finished —
 * two-factor is still off.' A half-enrolled credential is never left in
 * a state that prompts for a code at sign-in."
 */
export function isMfaOffDuringFlow(state: MfaState): boolean {
  return state.kind === 'mid_flow'
}

/**
 * The mid-flow warning label.
 */
export function mfaMidFlowWarning(): string {
  return "Setup wasn't finished — two-factor is still off."
}

/**
 * Whether the user can unlink a provider. The spec: "Removing the last
 * connected provider is blocked: 'You need at least one sign-in method
 * to access your account.'"
 */
export function canUnlinkProvider(connectedCount: number): {
  permitted: boolean
  reason: string | null
} {
  if (connectedCount <= 1) {
    return {
      permitted: false,
      reason: 'You need at least one sign-in method to access your account.',
    }
  }
  return { permitted: true, reason: null }
}

/**
 * Generate 10 single-use backup codes. Each is an 8-character alphanumeric
 * string (unambiguous alphabet, same as enrollment invites).
 */
export function generateBackupCodes(): string[] {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const codes: string[] = []
  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    let code = ''
    for (let j = 0; j < 8; j++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)]
    }
    codes.push(code)
  }
  return codes
}

/**
 * The backup-codes warning shown before navigating away. The spec:
 * "Leaving the page after that copy is the user's responsibility, and
 * the UI says so once, plainly."
 */
export function backupCodesWarning(): string {
  return 'These codes are shown once. Save them now — you will not see them again.'
}

/**
 * Whether a 6-digit TOTP code is valid format.
 */
export function isValidTotpCode(code: string): boolean {
  return /^\d{6}$/.test(code)
}
