import { eq } from 'drizzle-orm'
import { db } from './db'
import { users, userProfiles } from '../schema'

/**
 * Example: Creating a user with profile validation
 *
 * This demonstrates how to use the Zod schemas for input validation
 * before inserting into the database.
 */

// 1. Validate input using the insert schema
const userInput = {
  name: 'Abebe Kebede',
  phoneNumberEncrypted: Buffer.from('aes-256-gcm-ciphertext'),
  phoneNumberHash: 'sha256-hash-here',
  phoneNumberLast4: '1234',
}

const validated = users.insertUserSchema.parse(userInput)
console.log('Validated user:', validated)

// 2. Insert user
const [user] = await db.insert(users).values(validated).returning()
console.log('Created user:', user)

// 3. Validate and insert profile
const profileInput = {
  userId: user.id,
  educationSegment: 'toefl' as const,
  languagePreference: 'am',
  timezone: 'Africa/Addis_Ababa',
}

const validatedProfile = users.insertUserProfileSchema.parse(profileInput)
await db.insert(userProfiles).values(validatedProfile)
console.log('Created profile for user:', user.publicId)

// 4. Query user with profile
const [result] = await db
  .select()
  .from(users)
  .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
  .where(eq(users.id, user.id))

console.log('User with profile:', result)
