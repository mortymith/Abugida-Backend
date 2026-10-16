import { describe, expect, test } from 'bun:test'
import {
  EXPORT_DIRECT_DOWNLOAD_THRESHOLD_BYTES,
  EXPORT_RETENTION_DAYS,
  MAX_EXPORT_COURSES,
} from '#/features/analytics/analytics.metric-dictionary'
import {
  availableReportTypes,
  computeExportEstimate,
  computeExportExpiry,
  exceedsMaxCourses,
  exportExpiryLabel,
  FAILED_LABEL,
  isExportExpired,
  maxCoursesRefusalMessage,
  queuedPositionLabel,
  shouldShowRevenueReportType,
  shouldShowStudentLevelCheckbox,
  TRUE_EMPTY_LABEL,
} from '#/features/analytics/analytics.export-lifecycle'

describe('computeExportEstimate', () => {
  test('small export does not queue', () => {
    const est = computeExportEstimate(10, 5, 1)
    expect(est.willQueue).toBe(false)
    expect(est.estimatedSizeBytes).toBeLessThan(EXPORT_DIRECT_DOWNLOAD_THRESHOLD_BYTES)
  })
  test('large export queues', () => {
    const est = computeExportEstimate(1204, 24, 3)
    expect(est.willQueue).toBe(true)
    expect(est.label).toContain('queued job')
  })
  test('label includes student × item count', () => {
    const est = computeExportEstimate(50, 10, 2)
    expect(est.label).toContain('50')
    expect(est.label).toContain('10')
  })
})

describe('exceedsMaxCourses', () => {
  test('false at 25', () => expect(exceedsMaxCourses(25)).toBe(false))
  test('true at 26', () => expect(exceedsMaxCourses(26)).toBe(true))
})

describe('maxCoursesRefusalMessage', () => {
  test('names the limit', () => {
    expect(maxCoursesRefusalMessage()).toContain('25')
    expect(maxCoursesRefusalMessage()).toContain('maximum')
  })
})

describe('computeExportExpiry', () => {
  test('7 days from now', () => {
    const now = Date.parse('2026-01-15T12:00:00Z')
    const expiry = computeExportExpiry(now)
    expect(expiry.getTime() - now).toBe(EXPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000)
  })
})

describe('isExportExpired', () => {
  const now = Date.parse('2026-01-15T12:00:00Z')
  test('true when ready and past expiry', () => {
    expect(isExportExpired('ready', now - 1000, now)).toBe(true)
  })
  test('false when ready and before expiry', () => {
    expect(isExportExpired('ready', now + 1000, now)).toBe(false)
  })
  test('false when not ready', () => {
    expect(isExportExpired('queued', now - 99999, now)).toBe(false)
  })
  test('false when expiresAt is null', () => {
    expect(isExportExpired('ready', null, now)).toBe(false)
  })
})

describe('exportExpiryLabel', () => {
  const now = Date.parse('2026-01-15T12:00:00Z')
  test('days remaining for ready export', () => {
    const expiresAt = now + 3 * 24 * 60 * 60 * 1000
    expect(exportExpiryLabel('ready', expiresAt, now)).toContain('3 days')
  })
  test('expired label for expired export', () => {
    expect(exportExpiryLabel('expired', null, now)).toContain('expired')
  })
  test('empty for non-ready status', () => {
    expect(exportExpiryLabel('queued', null, now)).toBe('')
  })
})

describe('queuedPositionLabel', () => {
  test('names position and total', () => {
    expect(queuedPositionLabel(2, 3)).toContain('position 2 of 3')
    expect(queuedPositionLabel(2, 3)).toContain('notify you')
  })
})

describe('revenue redaction', () => {
  test('revenue report type shown when canViewRevenue', () => {
    expect(shouldShowRevenueReportType(true)).toBe(true)
  })
  test('revenue report type absent when !canViewRevenue', () => {
    expect(shouldShowRevenueReportType(false)).toBe(false)
  })
  test('student-level checkbox shown when canReadStudents', () => {
    expect(shouldShowStudentLevelCheckbox(true)).toBe(true)
  })
  test('student-level checkbox absent when !canReadStudents', () => {
    expect(shouldShowStudentLevelCheckbox(false)).toBe(false)
  })
  test('availableReportTypes includes revenue when canViewRevenue', () => {
    expect(availableReportTypes(true)).toContain('revenue_report')
  })
  test('availableReportTypes excludes revenue when !canViewRevenue', () => {
    expect(availableReportTypes(false)).not.toContain('revenue_report')
  })
})

describe('labels', () => {
  test('FAILED_LABEL mentions nothing was shared', () => {
    expect(FAILED_LABEL).toContain('nothing was shared')
  })
  test('TRUE_EMPTY_LABEL mentions nothing to export', () => {
    expect(TRUE_EMPTY_LABEL).toContain('Nothing to export')
  })
  test('MAX_EXPORT_COURSES is 25', () => {
    expect(MAX_EXPORT_COURSES).toBe(25)
  })
})
