/**
 * Seed demo notifications for the Notifications Center (S-1.4) so the read
 * path, unread badge, tabs, and optimistic mark-as-read can be exercised
 * without wiring producers.
 *
 * Usage (requires DATABASE_URL in the dashboard .env):
 *   bun run app/dashboard/scripts/dashboard.seed.ts
 *
 * Producers (enrollment/purchase/publish processors) will replace seeding as
 * the platform's event flows land.
 */
import { createClient } from '@abugida/database/client'
import { notifications } from '@abugida/database/ops'
import { users } from '@abugida/database/auth'
import { eq } from '@abugida/database'
import { env } from '#/config/app.config'

const db = createClient(env.DATABASE_URL)

// Seeds the first registered user so QA can seed right after signing up.
const first = (await db.select({ id: users.id }).from(users).limit(1)).at(0)
if (first === undefined) {
  throw new Error('No users found — sign up first, then re-run this script.')
}
const userId = first.id

const existing = await db
  .select({ id: notifications.id })
  .from(notifications)
  .where(eq(notifications.userId, userId))
  .limit(1)

if (existing.length > 0) {
  console.log('Notifications already exist for this user — skipping seed.')
  process.exit(0)
}

await db.insert(notifications).values([
  {
    userId,
    type: 'enrollment',
    title: 'New enrollment: Tigist M. joined "IELTS Advanced"',
    body: '2 minutes ago',
    linkEntityType: 'student',
    linkEntityPublicId: 'demo-student',
  },
  {
    userId,
    type: 'payment',
    title: 'Payment failed for Alemayehu K.\u2019s subscription',
    body: 'Check the Revenue Analytics page for details.',
    linkEntityType: 'revenue',
    linkEntityPublicId: '-',
  },
  {
    userId,
    type: 'publish',
    title: '"Grammar Basics" was published',
    body: 'The course is now live for students.',
    linkEntityType: 'course',
    linkEntityPublicId: 'demo-course',
  },
  {
    userId,
    type: 'team_invite',
    title: 'Jane Smith invited you to review "TOEFL Complete"',
    body: 'Requested 1 day ago.',
    linkEntityType: 'team',
    linkEntityPublicId: 'demo-team',
  },
  {
    userId,
    type: 'mention',
    title: 'You were mentioned in a course review comment',
    body: 'Alemayehu K. mentioned you in "TOEFL Complete".',
    linkEntityType: 'course',
    linkEntityPublicId: 'demo-course',
  },
])

console.log(`Seeded 5 demo notifications for user ${userId}.`)
process.exit(0)
