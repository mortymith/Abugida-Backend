import { insertUserSchema } from '../schema/auth'
import { insertCourseSchema } from '../schema/catalog'
import { insertPurchaseSchema } from '../schema/finance'
import { insertEnrollmentSchema } from '../schema/learning'
import { insertAuditLogSchema } from '../schema/ops'

/**
 * Example: Using Zod schemas for API input validation
 *
 * This demonstrates how to use the exported Zod schemas
 * for validating incoming API requests.
 */

// 1. Validate user registration input
function validateUserInput(body: unknown) {
  const result = insertUserSchema.safeParse(body)

  if (!result.success) {
    console.error('Validation errors:', result.error.flatten())
    return null
  }

  return result.data
}

// 2. Validate course creation input
function validateCourseInput(body: unknown) {
  const result = insertCourseSchema.safeParse(body)

  if (!result.success) {
    console.error('Validation errors:', result.error.flatten())
    return null
  }

  return result.data
}

// 3. Validate purchase input
function validatePurchaseInput(body: unknown) {
  const result = insertPurchaseSchema.safeParse(body)

  if (!result.success) {
    console.error('Validation errors:', result.error.flatten())
    return null
  }

  return result.data
}

// 4. Validate enrollment input
function validateEnrollmentInput(body: unknown) {
  const result = insertEnrollmentSchema.safeParse(body)

  if (!result.success) {
    console.error('Validation errors:', result.error.flatten())
    return null
  }

  return result.data
}

// 5. Validate audit log input
function validateAuditLogInput(body: unknown) {
  const result = insertAuditLogSchema.safeParse(body)

  if (!result.success) {
    console.error('Validation errors:', result.error.flatten())
    return null
  }

  return result.data
}

// Usage examples:
const validUser = validateUserInput({
  name: 'Abebe Kebede',
  phoneNumberEncrypted: Buffer.from('aes-256-gcm-ciphertext'),
  phoneNumberHash: 'abc123',
  phoneNumberLast4: '1234',
})
console.log('Valid user:', validUser)

const invalidUser = validateUserInput({
  name: 'x'.repeat(101), // too long
})
console.log('Invalid user:', invalidUser) // null

const validCourse = validateCourseInput({
  examTypeId: 1,
  title: 'TOEFL Basics',
  slug: 'toefl-basics',
})
console.log('Valid course:', validCourse)

const validPurchase = validatePurchaseInput({
  studentId: 1,
  courseId: 1,
  purchaseOptionId: 1,
  paymentGatewayId: 1,
  amount: 500,
})
console.log('Valid purchase:', validPurchase)
