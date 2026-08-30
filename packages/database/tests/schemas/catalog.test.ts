import { describe, it, expect } from 'bun:test'
import {
  insertExamTypeSchema,
  insertCourseSchema,
  insertModuleSchema,
  insertLessonSchema,
  insertBundleSchema,
  insertBundleCourseSchema,
  insertCourseTagSchema,
  insertCourseTagAssignmentSchema,
  insertCourseStatsSchema,
  insertCourseStatsHistorySchema,
  courseStatusEnum,
  bundleStatusEnum,
  contentTypeEnum,
} from '../../schema/catalog'

describe('catalog schemas', () => {
  describe('exam types', () => {
    const validExamType = {
      name: 'TOEFL',
      slug: 'toefl',
      description: 'Test of English as a Foreign Language',
      depth: 0,
      sortOrder: 0,
      isActive: true,
    }

    it('accepts valid exam type insert', () => {
      const result = insertExamTypeSchema.safeParse(validExamType)
      expect(result.success).toBe(true)
    })

    it('validates slug format', () => {
      expect(
        insertExamTypeSchema.safeParse({ ...validExamType, slug: 'Invalid Slug' }).success,
      ).toBe(false)
      expect(
        insertExamTypeSchema.safeParse({ ...validExamType, slug: 'valid-slug-123' }).success,
      ).toBe(true)
    })

    it('validates name max length', () => {
      expect(
        insertExamTypeSchema.safeParse({ ...validExamType, name: 'x'.repeat(101) }).success,
      ).toBe(false)
    })

    it('validates depth min', () => {
      expect(insertExamTypeSchema.safeParse({ ...validExamType, depth: -1 }).success).toBe(false)
    })

    it('validates sortOrder min', () => {
      expect(insertExamTypeSchema.safeParse({ ...validExamType, sortOrder: -1 }).success).toBe(
        false,
      )
    })
  })

  describe('courses', () => {
    const validCourse = {
      examTypeId: 1,
      title: 'Introduction to TOEFL',
      slug: 'intro-to-toefl',
      description: 'A beginner course',
      status: 'draft' as const,
      priceAmount: 500,
      priceCurrency: 'ETB',
      isFree: false,
      version: 1,
      rowVersion: 1,
      sortOrder: 0,
    }

    it('accepts valid course insert', () => {
      const result = insertCourseSchema.safeParse(validCourse)
      expect(result.success).toBe(true)
    })

    it('requires examTypeId', () => {
      const result = insertCourseSchema.safeParse({
        title: 'Test',
        slug: 'test',
        status: 'draft',
      })
      expect(result.success).toBe(false)
    })

    it('validates slug format', () => {
      expect(insertCourseSchema.safeParse({ ...validCourse, slug: 'Invalid Slug' }).success).toBe(
        false,
      )
      expect(
        insertCourseSchema.safeParse({ ...validCourse, slug: 'valid-course-slug' }).success,
      ).toBe(true)
    })

    it('validates title max length', () => {
      expect(insertCourseSchema.safeParse({ ...validCourse, title: 'x'.repeat(301) }).success).toBe(
        false,
      )
    })

    it('validates priceAmount min', () => {
      expect(insertCourseSchema.safeParse({ ...validCourse, priceAmount: -1 }).success).toBe(false)
    })

    it('validates priceCurrency format', () => {
      expect(insertCourseSchema.safeParse({ ...validCourse, priceCurrency: 'ET' }).success).toBe(
        false,
      )
      expect(insertCourseSchema.safeParse({ ...validCourse, priceCurrency: 'ETB' }).success).toBe(
        true,
      )
    })

    it('validates version min', () => {
      expect(insertCourseSchema.safeParse({ ...validCourse, version: 0 }).success).toBe(false)
    })

    it('validates rowVersion min', () => {
      expect(insertCourseSchema.safeParse({ ...validCourse, rowVersion: 0 }).success).toBe(false)
    })

    it('validates sortOrder min', () => {
      expect(insertCourseSchema.safeParse({ ...validCourse, sortOrder: -1 }).success).toBe(false)
    })

    it('accepts all course statuses', () => {
      for (const status of courseStatusEnum.options) {
        const result = insertCourseSchema.safeParse({ ...validCourse, status })
        expect(result.success).toBe(true)
      }
    })

    it('accepts free course', () => {
      const result = insertCourseSchema.safeParse({
        ...validCourse,
        isFree: true,
        priceAmount: null,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('modules', () => {
    const validModule = {
      courseId: 1,
      title: 'Introduction Module',
      sortOrder: 0,
      estimatedDurationMinutes: 60,
      isPreviewAvailable: false,
      rowVersion: 1,
    }

    it('accepts valid module insert', () => {
      const result = insertModuleSchema.safeParse(validModule)
      expect(result.success).toBe(true)
    })

    it('requires courseId', () => {
      const result = insertModuleSchema.safeParse({
        title: 'Test',
        sortOrder: 0,
        rowVersion: 1,
      })
      expect(result.success).toBe(false)
    })

    it('validates sortOrder min', () => {
      expect(insertModuleSchema.safeParse({ ...validModule, sortOrder: -1 }).success).toBe(false)
    })

    it('validates title max length', () => {
      expect(insertModuleSchema.safeParse({ ...validModule, title: 'x'.repeat(301) }).success).toBe(
        false,
      )
    })

    it('validates estimatedDurationMinutes positive', () => {
      expect(
        insertModuleSchema.safeParse({
          ...validModule,
          estimatedDurationMinutes: 0,
        }).success,
      ).toBe(false)
    })
  })

  describe('lessons', () => {
    const validLesson = {
      moduleId: 1,
      courseId: 1,
      title: 'Introduction to TOEFL',
      contentType: 'video' as const,
      durationSeconds: 300,
      isDownloadable: true,
      downloadSizeLimitBytes: 524288000,
      rowVersion: 1,
    }

    it('accepts valid lesson insert', () => {
      const result = insertLessonSchema.safeParse(validLesson)
      expect(result.success).toBe(true)
    })

    it('requires moduleId and courseId', () => {
      const result = insertLessonSchema.safeParse({
        title: 'Test',
        contentType: 'video',
        rowVersion: 1,
      })
      expect(result.success).toBe(false)
    })

    it('validates all content types', () => {
      for (const contentType of contentTypeEnum.options) {
        const result = insertLessonSchema.safeParse({ ...validLesson, contentType })
        expect(result.success).toBe(true)
      }
    })

    it('validates title max length', () => {
      expect(insertLessonSchema.safeParse({ ...validLesson, title: 'x'.repeat(301) }).success).toBe(
        false,
      )
    })

    it('validates fileSizeBytes min', () => {
      expect(insertLessonSchema.safeParse({ ...validLesson, fileSizeBytes: -1 }).success).toBe(
        false,
      )
    })

    it('validates durationSeconds min', () => {
      expect(insertLessonSchema.safeParse({ ...validLesson, durationSeconds: -1 }).success).toBe(
        false,
      )
    })

    it('validates pageCount positive', () => {
      expect(insertLessonSchema.safeParse({ ...validLesson, pageCount: 0 }).success).toBe(false)
    })

    it('validates downloadSizeLimitBytes min', () => {
      expect(
        insertLessonSchema.safeParse({
          ...validLesson,
          downloadSizeLimitBytes: -1,
        }).success,
      ).toBe(false)
    })
  })

  describe('course bundles', () => {
    const validBundle = {
      examTypeId: 1,
      title: 'TOEFL Complete Package',
      slug: 'toefl-complete',
      priceAmount: 1500,
      originalPriceAmount: 2000,
      discountPercentage: 25,
      status: 'draft' as const,
      rowVersion: 1,
      sortOrder: 0,
    }

    it('accepts valid bundle insert', () => {
      const result = insertBundleSchema.safeParse(validBundle)
      expect(result.success).toBe(true)
    })

    it('validates slug format', () => {
      expect(insertBundleSchema.safeParse({ ...validBundle, slug: 'Invalid Bundle' }).success).toBe(
        false,
      )
    })

    it('validates priceAmount min', () => {
      expect(insertBundleSchema.safeParse({ ...validBundle, priceAmount: -1 }).success).toBe(false)
    })

    it('validates originalPriceAmount min', () => {
      expect(
        insertBundleSchema.safeParse({
          ...validBundle,
          originalPriceAmount: -1,
        }).success,
      ).toBe(false)
    })

    it('validates discountPercentage range', () => {
      expect(
        insertBundleSchema.safeParse({
          ...validBundle,
          discountPercentage: -1,
        }).success,
      ).toBe(false)
      expect(
        insertBundleSchema.safeParse({
          ...validBundle,
          discountPercentage: 101,
        }).success,
      ).toBe(false)
      expect(
        insertBundleSchema.safeParse({
          ...validBundle,
          discountPercentage: 50,
        }).success,
      ).toBe(true)
    })

    it('accepts all bundle statuses', () => {
      for (const status of bundleStatusEnum.options) {
        const result = insertBundleSchema.safeParse({ ...validBundle, status })
        expect(result.success).toBe(true)
      }
    })
  })

  describe('bundle courses', () => {
    it('accepts valid bundle course insert', () => {
      const result = insertBundleCourseSchema.safeParse({
        bundleId: 1,
        courseId: 1,
        sortOrder: 0,
        isIncluded: true,
      })
      expect(result.success).toBe(true)
    })

    it('validates sortOrder min', () => {
      const result = insertBundleCourseSchema.safeParse({
        bundleId: 1,
        courseId: 1,
        sortOrder: -1,
        isIncluded: true,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('course tags', () => {
    it('accepts valid tag insert', () => {
      const result = insertCourseTagSchema.safeParse({
        name: 'TOEFL Prep',
        slug: 'toefl-prep',
      })
      expect(result.success).toBe(true)
    })

    it('validates slug format', () => {
      const result = insertCourseTagSchema.safeParse({
        name: 'Test',
        slug: 'Invalid Tag',
      })
      expect(result.success).toBe(false)
    })

    it('validates name max length', () => {
      const result = insertCourseTagSchema.safeParse({
        name: 'x'.repeat(101),
        slug: 'test',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('course tag assignments', () => {
    it('accepts valid assignment insert', () => {
      const result = insertCourseTagAssignmentSchema.safeParse({
        courseId: 1,
        tagId: 1,
      })
      expect(result.success).toBe(true)
    })
  })

  describe('course stats', () => {
    it('accepts valid stats insert', () => {
      const result = insertCourseStatsSchema.safeParse({
        courseId: 1,
        totalEnrollments: 100,
        activeStudents7d: 50,
        downloads30d: 30,
        purchaseCount: 80,
        averageRating: 4.5,
        ratingCount: 40,
      })
      expect(result.success).toBe(true)
    })

    it('validates totalEnrollments min', () => {
      const result = insertCourseStatsSchema.safeParse({
        courseId: 1,
        totalEnrollments: -1,
      })
      expect(result.success).toBe(false)
    })

    it('validates averageRating range', () => {
      expect(insertCourseStatsSchema.safeParse({ courseId: 1, averageRating: 0 }).success).toBe(
        false,
      )
      expect(insertCourseStatsSchema.safeParse({ courseId: 1, averageRating: 6 }).success).toBe(
        false,
      )
      expect(insertCourseStatsSchema.safeParse({ courseId: 1, averageRating: 3 }).success).toBe(
        true,
      )
    })
  })

  describe('course stats history', () => {
    it('accepts valid history insert', () => {
      const result = insertCourseStatsHistorySchema.safeParse({
        courseId: 1,
        snapshotDate: new Date('2026-01-01'),
        totalEnrollments: 100,
      })
      expect(result.success).toBe(true)
    })

    it('requires snapshotDate', () => {
      const result = insertCourseStatsHistorySchema.safeParse({
        courseId: 1,
      })
      expect(result.success).toBe(false)
    })
  })
})
