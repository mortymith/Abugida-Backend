/**
 * Unit tests for storage key generators.
 */

import { describe, test, expect } from 'bun:test'
import {
  course,
  courseThumbnail,
  courseVideo,
  courseDocument,
  courseAudio,
  courseSubtitle,
  courseVideosPrefix,
} from '../../src/keys/courses.ts'
import { user, userAvatar, userProfile, userProfilePrefix } from '../../src/keys/users.ts'
import {
  organization,
  organizationLogo,
  organizationBanner,
  organizationBannersPrefix,
} from '../../src/keys/organizations.ts'
import { exportKey, exportData } from '../../src/keys/exports.ts'
import { temp, tempFile, tempPrefix } from '../../src/keys/temp.ts'

describe('Course keys', () => {
  test('should generate course base key', () => {
    expect(course('abc123')).toBe('courses/abc123')
  })

  test('should generate thumbnail key', () => {
    expect(courseThumbnail('abc123', 'img1')).toBe('courses/abc123/thumbnails/img1.webp')
  })

  test('should generate video key', () => {
    expect(courseVideo('abc123', 'vid1')).toBe('courses/abc123/videos/vid1.mp4')
  })

  test('should generate document key', () => {
    expect(courseDocument('abc123', 'doc1')).toBe('courses/abc123/documents/doc1.pdf')
  })

  test('should generate audio key', () => {
    expect(courseAudio('abc123', 'aud1')).toBe('courses/abc123/audio/aud1.mp3')
  })

  test('should generate subtitle key', () => {
    expect(courseSubtitle('abc123', 'sub1')).toBe('courses/abc123/subtitles/sub1.vtt')
  })

  test('should generate videos prefix', () => {
    expect(courseVideosPrefix('abc123')).toBe('courses/abc123/videos/')
  })
})

describe('User keys', () => {
  test('should generate user base key', () => {
    expect(user('u1')).toBe('users/u1')
  })

  test('should generate avatar key with default extension', () => {
    expect(userAvatar('u1')).toBe('users/u1/avatar.webp')
  })

  test('should generate avatar key with custom extension', () => {
    expect(userAvatar('u1', 'png')).toBe('users/u1/avatar.png')
  })

  test('should generate profile key', () => {
    expect(userProfile('u1', 'profile1')).toBe('users/u1/profile/profile1')
  })

  test('should generate profile prefix', () => {
    expect(userProfilePrefix('u1')).toBe('users/u1/profile/')
  })
})

describe('Organization keys', () => {
  test('should generate org base key', () => {
    expect(organization('org1')).toBe('organizations/org1')
  })

  test('should generate logo key', () => {
    expect(organizationLogo('org1')).toBe('organizations/org1/logo.webp')
  })

  test('should generate banner key', () => {
    expect(organizationBanner('org1', 'banner1')).toBe('organizations/org1/banners/banner1')
  })

  test('should generate banners prefix', () => {
    expect(organizationBannersPrefix('org1')).toBe('organizations/org1/banners/')
  })
})

describe('Export keys', () => {
  test('should generate export base key', () => {
    expect(exportKey('exp1')).toBe('exports/exp1')
  })

  test('should generate export data key with json', () => {
    expect(exportData('exp1', 'json')).toBe('exports/exp1/data.json')
  })

  test('should generate export data key with csv', () => {
    expect(exportData('exp1', 'csv')).toBe('exports/exp1/data.csv')
  })
})

describe('Temp keys', () => {
  test('should generate temp base key', () => {
    expect(temp('sess1')).toBe('temp/sess1')
  })

  test('should generate temp file key', () => {
    expect(tempFile('sess1', 'upload.bin')).toBe('temp/sess1/upload.bin')
  })

  test('should generate temp prefix', () => {
    expect(tempPrefix('sess1')).toBe('temp/sess1/')
  })
})
