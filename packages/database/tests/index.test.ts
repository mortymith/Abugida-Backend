import { describe, it, expect } from 'bun:test'
import * as db from '../index'

describe('package barrel exports', () => {
  describe('schema tables', () => {
    it('exports auth tables', () => {
      expect(db.users).toBeDefined()
      expect(db.userProfiles).toBeDefined()
      expect(db.devices).toBeDefined()
      expect(db.userConsents).toBeDefined()
      expect(db.loginAttempts).toBeDefined()
    })

    it('exports catalog tables', () => {
      expect(db.courses).toBeDefined()
      expect(db.modules).toBeDefined()
      expect(db.lessons).toBeDefined()
      expect(db.examTypes).toBeDefined()
      expect(db.courseTags).toBeDefined()
      expect(db.courseBundles).toBeDefined()
      expect(db.bundleCourses).toBeDefined()
      expect(db.courseStats).toBeDefined()
    })

    it('exports finance tables', () => {
      expect(db.purchases).toBeDefined()
      expect(db.purchaseOptions).toBeDefined()
      expect(db.purchaseTransactions).toBeDefined()
      expect(db.paymentGateways).toBeDefined()
      expect(db.contentLicenses).toBeDefined()
      expect(db.contentLicenseGrants).toBeDefined()
    })

    it('exports learning tables', () => {
      expect(db.enrollments).toBeDefined()
      expect(db.lessonCompletions).toBeDefined()
      expect(db.quizQuestions).toBeDefined()
      expect(db.quizAttempts).toBeDefined()
      expect(db.quizAnswers).toBeDefined()
      expect(db.courseReviews).toBeDefined()
    })

    it('exports ops tables', () => {
      expect(db.auditLogs).toBeDefined()
      expect(db.roles).toBeDefined()
      expect(db.principals).toBeDefined()
      expect(db.courseRoles).toBeDefined()
      expect(db.permissionsReference).toBeDefined()
      expect(db.securityEvents).toBeDefined()
      expect(db.featureFlags).toBeDefined()
      expect(db.outboxEvents).toBeDefined()
      expect(db.webhookEvents).toBeDefined()
      expect(db.systemConfigs).toBeDefined()
      expect(db.apiKeys).toBeDefined()
    })

    it('exports shared tables', () => {
      expect(db.fileMetadata).toBeDefined()
    })
  })

  describe('Zod insert schemas', () => {
    it('exports insert schemas for all domains', () => {
      expect(db.insertUserSchema).toBeDefined()
      expect(db.insertCourseSchema).toBeDefined()
      expect(db.insertPurchaseSchema).toBeDefined()
      expect(db.insertEnrollmentSchema).toBeDefined()
      expect(db.insertAuditLogSchema).toBeDefined()
      expect(db.insertFileMetadataSchema).toBeDefined()
    })
  })

  describe('Zod select schemas', () => {
    it('exports select schemas for all domains', () => {
      expect(db.selectUserSchema).toBeDefined()
      expect(db.selectCourseSchema).toBeDefined()
      expect(db.selectPurchaseSchema).toBeDefined()
      expect(db.selectEnrollmentSchema).toBeDefined()
      expect(db.selectAuditLogSchema).toBeDefined()
      expect(db.selectFileMetadataSchema).toBeDefined()
    })
  })

  describe('Zod update schemas', () => {
    it('exports update schemas for all domains', () => {
      expect(db.updateUserSchema).toBeDefined()
      expect(db.updateCourseSchema).toBeDefined()
      expect(db.updatePurchaseSchema).toBeDefined()
      expect(db.updateEnrollmentSchema).toBeDefined()
      expect(db.updateFileMetadataSchema).toBeDefined()
    })
  })

  describe('enums', () => {
    it('exports zod enums', () => {
      expect(db.accountStatusEnum).toBeDefined()
      expect(db.courseStatusEnum).toBeDefined()
      expect(db.purchaseStatusEnum).toBeDefined()
      expect(db.enrollmentSourceEnum).toBeDefined()
      expect(db.auditActionEnum).toBeDefined()
    })

    it('exports pgEnums', () => {
      expect(db.accountStatusPgEnum).toBeDefined()
      expect(db.courseStatusPgEnum).toBeDefined()
      expect(db.purchaseStatusPgEnum).toBeDefined()
      expect(db.enrollmentSourcePgEnum).toBeDefined()
      expect(db.auditActionPgEnum).toBeDefined()
    })
  })

  describe('relations', () => {
    it('exports relations for tables', () => {
      expect(db.usersRelations).toBeDefined()
      expect(db.coursesRelations).toBeDefined()
      expect(db.purchasesRelations).toBeDefined()
      expect(db.enrollmentsRelations).toBeDefined()
    })
  })

  describe('client', () => {
    it('exports createClient function', () => {
      expect(typeof db.createClient).toBe('function')
    })
  })

  describe('custom types', () => {
    it('exports bytea custom type', () => {
      expect(db.bytea).toBeDefined()
    })

    it('exports tsvector custom type', () => {
      expect(db.tsvector).toBeDefined()
    })
  })
})
