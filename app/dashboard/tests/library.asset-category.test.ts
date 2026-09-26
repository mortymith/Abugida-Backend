import { describe, expect, test } from 'bun:test'
import {
  ASSET_MAX_SIZE_BYTES,
  ASSET_MIME_LIST,
  ASSET_OBJECT_KEY_PREFIX,
  categoryForMime,
  extensionOf,
  formatBytes,
  formatStorageUsed,
  isLibraryObjectKey,
  isSupportedAssetMime,
  isTranscribableCategory,
  pickerCategoryFilter,
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

describe('library object key guard (upload completion integrity)', () => {
  test('accepts keys minted by the library presign flow', () => {
    expect(isLibraryObjectKey(`${ASSET_OBJECT_KEY_PREFIX}9f1c-uuid.mp4`)).toBe(true)
    expect(
      isLibraryObjectKey(
        `${ASSET_OBJECT_KEY_PREFIX}versions/3f2504e0-4f89-41d3-9a0c-0305e82c3301/2-uuid.pdf`,
      ),
    ).toBe(true)
    // Surrounding whitespace is tolerated (the value is trimmed first).
    expect(isLibraryObjectKey(`  ${ASSET_OBJECT_KEY_PREFIX}abc.png  `)).toBe(true)
  })

  test('rejects keys outside the library namespace', () => {
    expect(isLibraryObjectKey('courses/thumb.png')).toBe(false)
    expect(isLibraryObjectKey('uploads/abc.mp4')).toBe(false)
    expect(isLibraryObjectKey('asset-library')).toBe(false)
    expect(isLibraryObjectKey('')).toBe(false)
    expect(isLibraryObjectKey('   ')).toBe(false)
  })

  test('rejects traversal that would escape the prefix', () => {
    expect(isLibraryObjectKey(`${ASSET_OBJECT_KEY_PREFIX}../../secrets/key`)).toBe(false)
    expect(isLibraryObjectKey(`${ASSET_OBJECT_KEY_PREFIX}a/../../b`)).toBe(false)
    expect(isLibraryObjectKey(`${ASSET_OBJECT_KEY_PREFIX}a\\b`)).toBe(false)
  })

  test('a key that merely starts with the prefix text is not enough', () => {
    expect(isLibraryObjectKey(`${ASSET_OBJECT_KEY_PREFIX}../evil.mp4`)).toBe(false)
    expect(isLibraryObjectKey('asset-library-evil/x.mp4')).toBe(false)
  })
})

describe('pickerCategoryFilter (lesson media picker, spec 04 S-2.7 → spec 05 S-3.1)', () => {
  test('pushes a single accepted category down to the server', () => {
    expect(pickerCategoryFilter(['video'])).toEqual({ category: 'video', filterLocally: false })
    expect(pickerCategoryFilter(['document'])).toEqual({
      category: 'document',
      filterLocally: false,
    })
    expect(pickerCategoryFilter(['image'])).toEqual({ category: 'image', filterLocally: false })
    expect(pickerCategoryFilter(['audio'])).toEqual({ category: 'audio', filterLocally: false })
  })

  test('falls back to a local filter when several categories are accepted', () => {
    // Regression: filtering after server pagination made a page of 12 videos
    // look like "No matching assets" for a video-or-pdf slot.
    expect(pickerCategoryFilter(['video', 'document'])).toEqual({
      category: undefined,
      filterLocally: true,
    })
  })

  test('"other" has no server filter, so it always falls back locally', () => {
    expect(pickerCategoryFilter(['other'])).toEqual({ category: undefined, filterLocally: false })
  })

  test('an empty category list is not narrowed and not locally filtered', () => {
    expect(pickerCategoryFilter([])).toEqual({ category: undefined, filterLocally: false })
  })
})
