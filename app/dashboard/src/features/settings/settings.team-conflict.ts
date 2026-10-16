/**
 * S-6.2 Team conflict logic (spec 08 § S-6.2). Member row conflict,
 * self-approval guard, last-admin guard, sign-in method derivation.
 */

export interface MemberRow {
  readonly userId: string
  readonly name: string
  readonly email: string | null
  readonly role: string
  readonly rowVersion: number
  readonly roleChangedAt: number | null
  readonly roleChangedBy: string | null
}

export type SignInMethod = 'google' | 'telegram' | 'google+telegram' | 'none'

/**
 * Derive the sign-in method from linked provider accounts. The spec:
 * "Sign-in method renders Google / Telegram / Google + Telegram, derived
 * from the linked provider accounts."
 */
export function deriveSignInMethod(hasGoogle: boolean, hasTelegram: boolean): SignInMethod {
  if (hasGoogle && hasTelegram) return 'google+telegram'
  if (hasGoogle) return 'google'
  if (hasTelegram) return 'telegram'
  return 'none'
}

/**
 * The sign-in method label for the table column.
 */
export function signInMethodLabel(method: SignInMethod): string {
  switch (method) {
    case 'google':
      return 'Google'
    case 'telegram':
      return 'Telegram'
    case 'google+telegram':
      return 'Google + Telegram'
    case 'none':
      return '—'
  }
}

/**
 * Whether a member can be removed. The spec: "A member cannot be removed
 * if they are the last Admin, or the actor; both are blocked with a named
 * reason."
 */
export function canRemoveMember(
  member: MemberRow,
  actorId: string,
  adminCount: number,
): { permitted: boolean; reason: string | null } {
  if (member.userId === actorId) {
    return { permitted: false, reason: 'You cannot remove yourself from the team.' }
  }
  if (member.role === 'admin' || member.role === 'owner') {
    if (adminCount <= 1) {
      return {
        permitted: false,
        reason: 'This is the last Admin — add a second admin before removing them.',
      }
    }
  }
  return { permitted: true, reason: null }
}

/**
 * Whether the acting user's row is read-only (self-approval guard).
 */
export function isSelfRowReadOnly(member: MemberRow, actorId: string): boolean {
  return member.userId === actorId
}

/**
 * The conflict label for a role change made by another Admin.
 */
export function roleConflictLabel(
  member: MemberRow,
  actorName: string,
  now: number,
): string | null {
  if (!member.roleChangedAt || !member.roleChangedBy) return null
  const minutesAgo = Math.round((now - member.roleChangedAt) / (60 * 1000))
  if (minutesAgo <= 0) return null
  const noun = minutesAgo === 1 ? 'minute' : 'minutes'
  return `Changed by ${actorName} ${minutesAgo} ${noun} ago — Review changes / Keep mine.`
}

/**
 * The email cell label. The spec: "A member with no address renders — in
 * the Email column. Never an empty cell."
 */
export function emailCellLabel(email: string | null): string {
  return email ?? '—'
}
