/**
 * Seeds spec 06 demo data: students, enrollments + activity, a cohort,
 * enrollment requests + waitlist, badges, and a message thread. Run in a
 * live environment after migrations:
 *   bun run app/dashboard/scripts/dashboard.students-seed.ts
 *
 * Idempotent per email — re-running updates rather than duplicating.
 */
import { eq, isNull, and, sql } from 'drizzle-orm'
import {
  awardedBadges,
  badges,
  cohortMembers,
  cohorts,
  enrollments,
  enrollmentRequests,
  lessonCompletions,
  quizAttempts,
  studentTags,
  waitlistEntries,
} from '@abugida/database/learning'
import { courses, lessons, modules } from '@abugida/database/catalog'
import { messageThreads, messages } from '@abugida/database/ops'
import { users, verification } from '@abugida/database/auth'
import { createClient } from '@abugida/database/client'
import { env } from '#/config/app.config'

const db = createClient(env.DATABASE_URL)

const DEMO_STUDENTS = [
  { name: 'Alemayehu Kebede', email: 'alemayehu.demo@abugida.test', progress: 68, daysAgo: 40 },
  { name: 'Tigist Mekonnen', email: 'tigist.demo@abugida.test', progress: 45, daysAgo: 25 },
  { name: 'Daniel Wolde', email: 'daniel.demo@abugida.test', progress: 82, daysAgo: 60 },
  { name: 'Sara Bekele', email: 'sara.demo@abugida.test', progress: 23, daysAgo: 12 },
  { name: 'Meron Haile', email: 'meron.demo@abugida.test', progress: 10, daysAgo: 3 },
]

const DEMO_BADGES = [
  {
    name: 'First Steps',
    icon: '🥇',
    triggerKind: 'first_lesson' as const,
    description: 'Completed your first lesson — the journey begins!',
  },
  {
    name: '7-Day Streak',
    icon: '🔥',
    triggerKind: 'streak' as const,
    description: 'Seven consecutive days of learning.',
    days: 7,
  },
  {
    name: 'Perfect Score',
    icon: '💯',
    triggerKind: 'quiz_perfect' as const,
    description: 'Scored 100% on a quiz.',
  },
  {
    name: 'Course Complete',
    icon: '🏆',
    triggerKind: 'course_completed' as const,
    description: 'Completed any course end to end.',
  },
]

async function ensureStudent(input: {
  name: string
  email: string
  daysAgo: number
}): Promise<string> {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, input.email))
    .limit(1)
  const found = existing.at(0)
  if (found) return found.id

  const inserted = await db
    .insert(users)
    .values({
      name: input.name,
      email: input.email,
      emailVerified: false,
      accountStatus: 'pending_verification',
      createdAt: new Date(Date.now() - input.daysAgo * 86_400_000),
    })
    .returning({ id: users.id })
  const row = inserted.at(0)
  if (!row) throw new Error('seed: failed to create student')
  await db.insert(verification).values({
    id: crypto.randomUUID(),
    identifier: input.email,
    value: crypto.randomUUID().replaceAll('-', '') + crypto.randomUUID().replaceAll('-', ''),
    expiresAt: new Date(Date.now() + 7 * 86_400_000),
  })
  return row.id
}

async function main(): Promise<void> {
  const published = await db
    .select({ id: courses.id, publicId: courses.publicId, title: courses.title })
    .from(courses)
    .where(and(eq(courses.status, 'published'), isNull(courses.deletedAt)))
    .orderBy(courses.sortOrder)
    .limit(3)
  if (published.length === 0) {
    console.log('No published courses found — run the courses seed first.')
    return
  }
  const primary = published[0]

  const studentIds: string[] = []
  for (const demo of DEMO_STUDENTS) {
    studentIds.push(await ensureStudent(demo))
  }

  // Enrollments with staggered progress + recent activity.
  for (let i = 0; i < studentIds.length; i += 1) {
    // Loop bounds + modulo guarantee these indices exist.
    const studentId = studentIds[i]
    const course = published[i % published.length]
    const progress = DEMO_STUDENTS[i]?.progress ?? 0
    const existing = await db
      .select({ id: enrollments.id })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, studentId),
          eq(enrollments.courseId, course.id),
          isNull(enrollments.deletedAt),
        ),
      )
      .limit(1)
    if (existing.length > 0) continue

    const isCompleted = progress >= 100
    const inserted = await db
      .insert(enrollments)
      .values({
        studentId,
        courseId: course.id,
        enrollmentSource: 'admin_grant',
        progressPercentage: String(Math.min(progress, 100)),
        isCompleted,
        completedAt: isCompleted ? new Date() : null,
        lastAccessedAt: new Date(Date.now() - (i % 3) * 86_400_000),
      })
      .returning({ id: enrollments.id })
    const enrollment = inserted.at(0)
    if (!enrollment) continue

    // Lesson completions for the streak/progress surfaces.
    const lessonRows = await db
      .select({ id: lessons.id, courseId: lessons.courseId })
      .from(lessons)
      .innerJoin(modules, eq(modules.id, lessons.moduleId))
      .where(and(eq(modules.courseId, course.id), isNull(lessons.deletedAt)))
      .orderBy(lessons.sortOrder)
      .limit(Math.max(1, Math.round(progress / 10)))

    for (let l = 0; l < lessonRows.length; l += 1) {
      const lesson = lessonRows[l]
      const completedAt = new Date(Date.now() - (l % 6) * 86_400_000)
      await db
        .insert(lessonCompletions)
        .values({
          studentId,
          lessonId: lesson.id,
          enrollmentId: enrollment.id,
          isCompleted: true,
          completedAt,
          timeSpentSeconds: 600 + l * 120,
          createdAt: completedAt,
        })
        .onConflictDoNothing()
    }

    // One quiz attempt for the per-course "last quiz" card.
    const firstLesson = lessonRows.at(0)
    if (firstLesson) {
      await db.insert(quizAttempts).values({
        studentId,
        lessonId: firstLesson.id,
        attemptNumber: 1,
        totalQuestions: 10,
        correctAnswers: Math.round((progress / 100) * 10),
        quizScorePercentage: String(Math.min(progress, 100)),
        isPassed: progress >= 70,
        startedAt: new Date(Date.now() - 2 * 86_400_000),
        completedAt: new Date(Date.now() - 86_400_000),
      })
    }
  }

  // Cohort with the first three students.
  const cohortExists = await db
    .select({ id: cohorts.id })
    .from(cohorts)
    .where(and(eq(cohorts.name, 'TOEFL Jan 2026'), isNull(cohorts.deletedAt)))
    .limit(1)
  if (cohortExists.length === 0) {
    const inserted = await db
      .insert(cohorts)
      .values({
        name: 'TOEFL Jan 2026',
        description: 'Evening TOEFL prep group — January intake.',
        startedAt: '2026-01-15',
      })
      .returning({ id: cohorts.id })
    const cohort = inserted.at(0)
    if (cohort) {
      await db
        .insert(cohortMembers)
        .values(studentIds.slice(0, 3).map((studentId) => ({ cohortId: cohort.id, studentId })))
        .onConflictDoNothing()
    }
  }

  // Badge catalogue + one award.
  for (const badge of DEMO_BADGES) {
    const exists = await db
      .select({ id: badges.id })
      .from(badges)
      .where(and(eq(badges.name, badge.name), isNull(badges.deletedAt)))
      .limit(1)
    if (exists.length > 0) continue
    await db.insert(badges).values({
      name: badge.name,
      icon: badge.icon,
      description: badge.description,
      triggerKind: badge.triggerKind,
      triggerConfig: 'days' in badge && badge.days != null ? { days: badge.days } : {},
    })
  }
  const firstSteps = await db
    .select({ id: badges.id })
    .from(badges)
    .where(and(eq(badges.name, 'First Steps'), isNull(badges.deletedAt)))
    .limit(1)
  const firstBadge = firstSteps.at(0)
  const firstStudentId = studentIds.at(0)
  if (firstBadge && firstStudentId) {
    await db
      .insert(awardedBadges)
      .values({ badgeId: firstBadge.id, studentId: firstStudentId, source: 'automatic' })
      .onConflictDoNothing()
  }

  // Enrollment request + waitlist entries for the requests screen.
  const requestCourse = published[1] ?? primary
  for (const demo of DEMO_STUDENTS.slice(3)) {
    const studentId = await ensureStudent(demo)
    const pending = await db
      .select({ id: enrollmentRequests.id })
      .from(enrollmentRequests)
      .where(
        and(
          eq(enrollmentRequests.studentId, studentId),
          eq(enrollmentRequests.courseId, requestCourse.id),
          eq(enrollmentRequests.status, 'pending'),
        ),
      )
      .limit(1)
    if (pending.length === 0) {
      await db.insert(enrollmentRequests).values({
        studentId,
        courseId: requestCourse.id,
        note: 'Please enroll me — preparing for the March exam.',
      })
    }
    const waiting = await db
      .select({ id: waitlistEntries.id })
      .from(waitlistEntries)
      .where(
        and(
          eq(waitlistEntries.studentId, studentId),
          eq(waitlistEntries.courseId, requestCourse.id),
          eq(waitlistEntries.status, 'waiting'),
        ),
      )
      .limit(1)
    if (waiting.length === 0) {
      const position = await db
        .select({ next: sql<number>`COALESCE(MAX(${waitlistEntries.position}), 0)::int + 1` })
        .from(waitlistEntries)
        .where(eq(waitlistEntries.courseId, requestCourse.id))
      await db.insert(waitlistEntries).values({
        courseId: requestCourse.id,
        studentId,
        position: Number(position.at(0)?.next ?? 1),
      })
    }
  }

  // A direct thread with one message from the demo staff user (admin).
  const threadStudent = studentIds.at(0)
  if (threadStudent) {
    const threadExists = await db
      .select({ id: messageThreads.id })
      .from(messageThreads)
      .where(eq(messageThreads.studentId, threadStudent))
      .limit(1)
    if (threadExists.length === 0) {
      const inserted = await db
        .insert(messageThreads)
        .values({
          studentId: threadStudent,
          kind: 'direct',
          subject: 'Welcome to Abugida Academy!',
          lastMessageAt: new Date(),
          lastMessagePreview: 'Welcome aboard — your first lesson is ready whenever you are.',
        })
        .returning({ id: messageThreads.id })
      const thread = inserted.at(0)
      if (thread) {
        const staff = await db.select({ id: users.id }).from(users).limit(1)
        const staffId = staff.at(0)?.id
        if (staffId) {
          await db.insert(messages).values({
            threadId: thread.id,
            senderId: staffId,
            body: 'Welcome aboard — your first lesson is ready whenever you are.',
          })
        }
      }
    }
  }

  // Student tags for the tag_added rule trigger.
  const corporateStudentId = studentIds.at(1)
  if (corporateStudentId) {
    await db
      .insert(studentTags)
      .values({ studentId: corporateStudentId, tag: 'acme-2026' })
      .onConflictDoNothing()
  }

  console.log('Students seed complete.')
}

void main()
