import { describe, expect, test } from 'bun:test'
import {
  computeContactAvailability,
  CONTACT_CHANNEL_LABELS,
  hasAnyContact,
  hasVerifiedContact,
  noContactBadgeLabel,
  primaryContactChannel,
  secondaryContactValue,
  shouldShowSendEnrollmentLink,
  verifiedMarker,
} from '#/features/students/students.contact-channels'
import type { StudentContactInfo } from '#/features/students/students.contact-channels'

const FULL_PROFILE: StudentContactInfo = {
  telegramHandle: '@alemayehu',
  telegramVerified: true,
  email: 'a@b.com',
  emailVerified: true,
  phoneLast4: '1234',
}

const NO_TELEGRAM: StudentContactInfo = {
  telegramHandle: null,
  telegramVerified: false,
  email: 'a@b.com',
  emailVerified: true,
  phoneLast4: null,
}

const NO_CONTACT: StudentContactInfo = {
  telegramHandle: null,
  telegramVerified: false,
  email: null,
  emailVerified: false,
  phoneLast4: null,
}

describe('CONTACT_CHANNEL_LABELS', () => {
  test('three channels: telegram, email, phone', () => {
    expect(Object.keys(CONTACT_CHANNEL_LABELS)).toEqual(['telegram', 'email', 'phone'])
  })
})

describe('computeContactAvailability', () => {
  test('all available + verified for full profile', () => {
    const avail = computeContactAvailability(FULL_PROFILE)
    expect(avail.every((a) => a.kind === 'available')).toBe(true)
    expect(avail.every((a) => a.kind === 'available' && a.verified)).toBe(true)
  })

  test('telegram unavailable when no handle', () => {
    const avail = computeContactAvailability(NO_TELEGRAM)
    const telegram = avail.find((a) => a.channel === 'telegram')
    expect(telegram?.kind).toBe('unavailable')
  })

  test('all unavailable for no-contact profile', () => {
    const avail = computeContactAvailability(NO_CONTACT)
    expect(avail.every((a) => a.kind === 'unavailable')).toBe(true)
  })
})

describe('hasVerifiedContact', () => {
  test('true when Telegram verified', () => {
    expect(hasVerifiedContact(FULL_PROFILE)).toBe(true)
  })
  test('true when email verified and no Telegram', () => {
    expect(hasVerifiedContact(NO_TELEGRAM)).toBe(true)
  })
  test('false when no contact at all', () => {
    expect(hasVerifiedContact(NO_CONTACT)).toBe(false)
  })
})

describe('hasAnyContact', () => {
  test('true when any channel has a value', () => {
    expect(hasAnyContact(FULL_PROFILE)).toBe(true)
    expect(hasAnyContact(NO_TELEGRAM)).toBe(true)
  })
  test('false when no contact at all', () => {
    expect(hasAnyContact(NO_CONTACT)).toBe(false)
  })
})

describe('primaryContactChannel', () => {
  test('Telegram-first when handle exists', () => {
    const primary = primaryContactChannel(FULL_PROFILE)
    expect(primary.channel).toBe('telegram')
    expect(primary.value).toBe('@alemayehu')
  })
  test('email when no Telegram', () => {
    const primary = primaryContactChannel(NO_TELEGRAM)
    expect(primary.channel).toBe('email')
  })
  test('null when no contact', () => {
    const primary = primaryContactChannel(NO_CONTACT)
    expect(primary.channel).toBeNull()
  })
})

describe('secondaryContactValue', () => {
  test('email when available', () => {
    expect(secondaryContactValue(FULL_PROFILE)).toBe('a@b.com')
  })
  test('— when no email and no phone', () => {
    const noEmailNoPhone: StudentContactInfo = {
      telegramHandle: '@a',
      telegramVerified: true,
      email: null,
      emailVerified: false,
      phoneLast4: null,
    }
    expect(secondaryContactValue(noEmailNoPhone)).toBe('—')
  })
})

describe('shouldShowSendEnrollmentLink', () => {
  test('false when has verified contact', () => {
    expect(shouldShowSendEnrollmentLink(FULL_PROFILE)).toBe(false)
  })
  test('true when no verified contact', () => {
    expect(shouldShowSendEnrollmentLink(NO_CONTACT)).toBe(true)
  })
})

describe('noContactBadgeLabel', () => {
  test('null when has any contact', () => {
    expect(noContactBadgeLabel(FULL_PROFILE)).toBeNull()
  })
  test('badge text when no contact', () => {
    expect(noContactBadgeLabel(NO_CONTACT)).toBe('No linked contact')
  })
})

describe('verifiedMarker', () => {
  test('✔ for verified', () => {
    const avail = computeContactAvailability(FULL_PROFILE)
    const telegram = avail.find((a) => a.channel === 'telegram')!
    expect(verifiedMarker(telegram)).toBe('✔')
  })
  test('— for unverified', () => {
    const unverifiedProfile: StudentContactInfo = {
      telegramHandle: '@a',
      telegramVerified: false,
      email: null,
      emailVerified: false,
      phoneLast4: null,
    }
    const avail = computeContactAvailability(unverifiedProfile)
    const telegram = avail.find((a) => a.channel === 'telegram')!
    expect(verifiedMarker(telegram)).toBe('—')
  })
  test('null for unavailable', () => {
    const avail = computeContactAvailability(NO_CONTACT)
    const telegram = avail.find((a) => a.channel === 'telegram')!
    expect(verifiedMarker(telegram)).toBeNull()
  })
})
