import { describe, expect, test } from 'bun:test'
import {
  AUTHENTICATOR_APPS,
  BACKUP_CODE_COUNT,
  ENROLLMENT_STEPS,
  backupCodesAnnouncement,
  backupCodesFileName,
  extractTotpSecret,
  formatBackupCodeFile,
  formatManualKey,
  nextStep,
  parseOtpauthLabel,
  partialFailureMessage,
  stepAnnouncement,
  stillOffNotice,
  stripKeySeparators,
  verifyFailureMessage,
} from '#/features/auth/auth.mfa-enrollment'

/**
 * S-0.4 MFA enrollment.
 *
 * The invariant under test: **the toggle does not flip until the confirmation
 * code verifies.** `nextStep` is the only thing that advances the machine, so
 * asserting it cannot advance unverified is asserting the spec's acceptance
 * criterion 1 directly.
 */

const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP'

describe('step machine', () => {
  test('has three steps', () => {
    expect(ENROLLMENT_STEPS).toEqual(['scan', 'confirm', 'backup_codes'])
  })

  test('scan always advances to confirm', () => {
    expect(nextStep('scan', false)).toBe('confirm')
  })

  test('confirm only advances to the backup codes once verified', () => {
    // Spec acceptance criterion 1: a failing code leaves MFA off.
    expect(nextStep('confirm', false)).toBe('confirm')
    expect(nextStep('confirm', true)).toBe('backup_codes')
  })

  test('the backup-code screen is terminal', () => {
    expect(nextStep('backup_codes', true)).toBe('backup_codes')
    expect(nextStep('backup_codes', false)).toBe('backup_codes')
  })

  test('every step change is announced', () => {
    for (const step of ENROLLMENT_STEPS) {
      const announcement = stepAnnouncement(step)
      expect(announcement.length).toBeGreaterThan(0)
      // A screen-reader user must never be left guessing which step they are on.
      if (step !== 'backup_codes') expect(announcement).toContain('Step')
    }
  })
})

describe('manual key formatting', () => {
  test('groups the whole secret in fours — the shape the spec draws', () => {
    expect(formatManualKey(SECRET)).toBe('JBSW-Y3DP-EHPK-3PXP-JBSW-Y3DP-EHPK-3PXP')
  })

  test('round-trips: a user can type the key back in and still enrol', () => {
    // The spec writes the key as `XXXX-XXXX-XXXX`, which is a *grouping*, not
    // a length — a TOTP secret is 32 base32 characters. Printing only 12 would
    // hand out a key that silently fails, so the full secret is grouped instead
    // and stripping the separators must recover it exactly.
    expect(stripKeySeparators(formatManualKey(SECRET))).toBe(SECRET)
  })

  test('tolerates a lower-case or already-grouped secret', () => {
    expect(formatManualKey(SECRET.toLowerCase())).toBe(formatManualKey(SECRET))
    expect(formatManualKey('JBSW-Y3DP')).toBe('JBSW-Y3DP')
  })

  test('never emits a trailing separator', () => {
    expect(formatManualKey('JBSWY3DPEH')).not.toMatch(/-$/)
  })
})

describe('otpauth URI', () => {
  const uri =
    'otpauth://totp/Abugida%20Academy:rick%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=Abugida%20Academy'

  test('extracts the shared secret', () => {
    expect(extractTotpSecret(uri)).toBe('JBSWY3DPEHPK3PXP')
  })

  test('extracts the issuer an authenticator app displays', () => {
    expect(parseOtpauthLabel(uri)).toBe('Abugida Academy')
  })

  test('returns empty rather than throwing on a malformed URI', () => {
    expect(extractTotpSecret('not-a-uri')).toBe('')
    expect(parseOtpauthLabel('not-a-uri')).toBeNull()
  })
})

describe('enrolment states', () => {
  test('a failing code never implies MFA is on', () => {
    expect(stillOffNotice(false)).toBe('Two-factor is still off. Closing this page leaves it off.')
    expect(stillOffNotice(true)).toBeNull()
  })

  test('a wrong code and a clock skew are different messages', () => {
    // The two feel identical to the user but need different fixes.
    expect(verifyFailureMessage('invalid')).toContain("didn't work")
    expect(verifyFailureMessage('clock_skew')).toContain('clock')
    expect(verifyFailureMessage('clock_skew')).not.toBe(verifyFailureMessage('invalid'))
  })

  test('a failed backup-code generation is called out, not hidden', () => {
    expect(partialFailureMessage()).toContain("couldn't be generated")
  })
})

describe('backup codes', () => {
  const codes = Array.from({ length: BACKUP_CODE_COUNT }, (_, i) => `code-${i}`)

  test('the spec issues ten', () => {
    expect(BACKUP_CODE_COUNT).toBe(10)
  })

  test('the count is announced for screen readers', () => {
    expect(backupCodesAnnouncement(codes)).toBe('10 backup codes.')
  })

  test('the download names every code and warns about regeneration', () => {
    const file = formatBackupCodeFile(codes)
    for (const code of codes) expect(file).toContain(code)
    expect(file).toContain('works once')
    expect(file).toContain('invalidates')
  })

  test('the file name is dated so a saved copy is identifiable', () => {
    expect(backupCodesFileName(new Date('2026-09-30T12:00:00Z'))).toBe(
      'abugida-backup-codes-2026-09-30.txt',
    )
  })
})

describe('authenticator apps', () => {
  test('names the apps the spec lists', () => {
    const labels = AUTHENTICATOR_APPS.map((app) => app.label)
    expect(labels).toContain('Google Authenticator')
    expect(labels).toContain('Authy')
    expect(labels).toContain('1Password')
    expect(labels).toContain('Aegis')
  })
})
