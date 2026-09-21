import { describe, expect, test } from 'bun:test'
import {
  ASSET_MAX_SIZE_BYTES,
  ASSET_MIME_LIST,
  categoryForMime,
  extensionOf,
  formatBytes,
  formatStorageUsed,
  isSupportedAssetMime,
  isTranscribableCategory,
  resolveAssetMime,
  sanitizeFileName,
} from '#/features/library/library.asset-category'

describe('asset category & formatting (spec 05 S-3.1/S-3.2)', () => {
  test('mime → category mapping', () => {
    expect(categoryForMime('video/mp4')).toBe('video')
    expect(categoryForMime('image/png')).toBe('image')
    expect(categoryForMime('audio/mpeg')).toBe('audio')
    expect(categoryForMime('application/pdf')).toBe('document')
    expect(categoryForMime('text/plain')).toBe('other')
    expect(categoryForMime(null)).toBe('other')
  })

  test('supported mime whitelist matches the wireframe (MP4, PDF, PNG, JPG, MP3)', () => {
    expect(ASSET_MIME_LIST.sort()).toEqual([
      'application/pdf',
      'audio/mpeg',
      'image/jpeg',
      'image/png',
      'video/mp4',
    ])
    expect(isSupportedAssetMime('video/mp4')).toBe(true)
    expect(isSupportedAssetMime('video/webm')).toBe(false)
  })

  test('resolveAssetMime falls back to extension when client type is missing/generic', () => {
    expect(resolveAssetMime('lecture.MP4', '')).toBe('video/mp4')
    expect(resolveAssetMime('slide.pdf', null)).toBe('application/pdf')
    expect(resolveAssetMime('photo.jpeg', 'image/jpeg')).toBe('image/jpeg')
    expect(resolveAssetMime('unknown.xyz', 'application/octet-stream')).toBe(
      'application/octet-stream',
    )
  })

  test('extensionOf handles names without extensions', () => {
    expect(extensionOf('file.tar.gz')).toBe('gz')
    expect(extensionOf('no-extension')).toBe('')
  })

  test('formatBytes uses human units', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2.3 * 1024 * 1024)).toBe('2.3 MB')
    expect(formatBytes(12 * 1024 * 1024 * 1024)).toBe('12 GB')
  })

  test('formatStorageUsed labels zero usage', () => {
    expect(formatStorageUsed(0)).toBe('0 KB used')
    expect(formatStorageUsed(1024)).toBe('1 KB used')
  })

  test('sanitizeFileName strips path separators', () => {
    expect(sanitizeFileName('../../etc/passwd.pdf')).toBe('..-..-etc-passwd.pdf')
    expect(sanitizeFileName('a  b.png').length).toBeLessThanOrEqual(200)
  })

  test('upload limits match the spec (500MB)', () => {
    expect(ASSET_MAX_SIZE_BYTES).toBe(500 * 1024 * 1024)
  })

  test('transcribable categories are video and audio only', () => {
    expect(isTranscribableCategory('video')).toBe(true)
    expect(isTranscribableCategory('audio')).toBe(true)
    expect(isTranscribableCategory('image')).toBe(false)
    expect(isTranscribableCategory('document')).toBe(false)
  })
})
