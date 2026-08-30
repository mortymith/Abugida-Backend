import { describe, it, expect } from 'bun:test'
import { insertFileMetadataSchema } from '../../schema/shared'

describe('shared schemas', () => {
  describe('file metadata', () => {
    const validFile = {
      objectKey: 'uploads/course-1/lesson-1/video.mp4',
      bucketName: 'abugida-content',
      originalFilename: 'video.mp4',
      mimeType: 'video/mp4',
      fileSizeBytes: 1048576,
      checksumSha256: 'a'.repeat(64),
      isPublic: false,
    }

    it('accepts valid file metadata insert', () => {
      const result = insertFileMetadataSchema.safeParse(validFile)
      expect(result.success).toBe(true)
    })

    it('requires objectKey', () => {
      const result = insertFileMetadataSchema.safeParse({
        bucketName: 'test',
      })
      expect(result.success).toBe(false)
    })

    it('validates objectKey max length', () => {
      expect(
        insertFileMetadataSchema.safeParse({
          ...validFile,
          objectKey: 'x'.repeat(501),
        }).success,
      ).toBe(false)
    })

    it('validates bucketName max length', () => {
      expect(
        insertFileMetadataSchema.safeParse({
          ...validFile,
          bucketName: 'x'.repeat(101),
        }).success,
      ).toBe(false)
    })

    it('validates originalFilename max length', () => {
      expect(
        insertFileMetadataSchema.safeParse({
          ...validFile,
          originalFilename: 'x'.repeat(501),
        }).success,
      ).toBe(false)
    })

    it('validates mimeType max length', () => {
      expect(
        insertFileMetadataSchema.safeParse({
          ...validFile,
          mimeType: 'x'.repeat(101),
        }).success,
      ).toBe(false)
    })

    it('validates fileSizeBytes min', () => {
      expect(
        insertFileMetadataSchema.safeParse({
          ...validFile,
          fileSizeBytes: -1,
        }).success,
      ).toBe(false)
    })

    it('validates checksumSha256 length', () => {
      expect(
        insertFileMetadataSchema.safeParse({
          ...validFile,
          checksumSha256: 'abc',
        }).success,
      ).toBe(false)
    })

    it('validates encryptionKeyReference max length', () => {
      expect(
        insertFileMetadataSchema.safeParse({
          ...validFile,
          encryptionKeyReference: 'x'.repeat(501),
        }).success,
      ).toBe(false)
    })

    it('accepts minimal file metadata', () => {
      const result = insertFileMetadataSchema.safeParse({
        objectKey: 'test-file',
        bucketName: 'test-bucket',
      })
      expect(result.success).toBe(true)
    })
  })
})
