/**
 * Seeds the spec 04 sample templates (S-2.12) and, if absent, the base exam
 * types referenced by the wizard. Run in a live environment after migrations:
 *   bun run app/dashboard/scripts/dashboard.courses-seed.ts
 */
import { eq, isNull } from 'drizzle-orm'
import { courses, courseTemplates, examTypes } from '@abugida/database/catalog'
import { createClient } from '@abugida/database/client'
import { env } from '#/config/app.config'
import { normalizeTemplateStructure } from '#/features/courses/courses.templates.normalize'

const db = createClient(env.DATABASE_URL)

interface SeedLesson {
  title: string
  contentType: 'pdf' | 'video' | 'quiz' | 'exercise' | 'link'
  durationMinutes: number
}
interface SeedModule {
  title: string
  description: string
  lessons: SeedLesson[]
}

const TOEFL: SeedModule[] = [
  {
    title: 'TOEFL Foundations',
    description: 'Test format, scoring, and study planning.',
    lessons: [
      { title: 'What is the TOEFL?', contentType: 'video', durationMinutes: 20 },
      { title: 'Scoring & test-day strategy', contentType: 'pdf', durationMinutes: 25 },
      { title: 'Foundations check', contentType: 'quiz', durationMinutes: 15 },
    ],
  },
  {
    title: 'Reading Skills',
    description: 'Skimming, scanning, and inference practice.',
    lessons: [
      { title: 'Skimming basics', contentType: 'video', durationMinutes: 25 },
      { title: 'Scanning techniques', contentType: 'exercise', durationMinutes: 20 },
      { title: 'Inference questions', contentType: 'pdf', durationMinutes: 30 },
    ],
  },
  {
    title: 'Listening & Speaking',
    description: 'Note-taking and structured responses.',
    lessons: [
      { title: 'Note-taking systems', contentType: 'video', durationMinutes: 20 },
      { title: 'Independent speaking tasks', contentType: 'exercise', durationMinutes: 25 },
      { title: 'Weekly progress quiz', contentType: 'quiz', durationMinutes: 15 },
    ],
  },
  {
    title: 'Writing & Mock Test',
    description: 'Essays and a full timed rehearsal.',
    lessons: [
      { title: 'Integrated essay structure', contentType: 'pdf', durationMinutes: 30 },
      { title: 'Final mock test', contentType: 'quiz', durationMinutes: 60 },
    ],
  },
]

const WORKSHOP: SeedModule[] = [
  {
    title: 'Day 1 — Align & Frame',
    description: 'Goals, stakeholders, working agreements.',
    lessons: [
      { title: 'Kickoff & objectives', contentType: 'video', durationMinutes: 45 },
      { title: 'Working agreement canvas', contentType: 'exercise', durationMinutes: 60 },
    ],
  },
  {
    title: 'Day 2 — Build & Decide',
    description: 'Prototyping and decision-making.',
    lessons: [
      { title: 'Prototype rotation', contentType: 'exercise', durationMinutes: 90 },
      { title: 'Decision log & next steps', contentType: 'pdf', durationMinutes: 30 },
    ],
  },
]

const IELTS: SeedModule[] = [
  {
    title: 'IELTS Crash Basics',
    description: 'Band descriptors and fast wins.',
    lessons: [
      { title: 'How IELTS is scored', contentType: 'video', durationMinutes: 15 },
      { title: 'Band descriptor walkthrough', contentType: 'pdf', durationMinutes: 20 },
    ],
  },
  {
    title: 'Speed Practice',
    description: 'Timed drills per section.',
    lessons: [
      { title: '60-second speaking drills', contentType: 'exercise', durationMinutes: 30 },
      { title: 'Timed reading drill', contentType: 'quiz', durationMinutes: 20 },
    ],
  },
]

async function seedExamTypes(): Promise<Map<string, number>> {
  const wanted = [
    { name: 'TOEFL', slug: 'toefl' },
    { name: 'IELTS', slug: 'ielts' },
    { name: 'GRE', slug: 'gre' },
    { name: 'Other', slug: 'other' },
  ]
  const ids = new Map<string, number>()
  for (const item of wanted) {
    const existing = await db
      .select({ id: examTypes.id })
      .from(examTypes)
      .where(eq(examTypes.slug, item.slug))
      .limit(1)
    if (existing.at(0)) {
      ids.set(item.slug, existing.at(0)!.id)
      continue
    }
    const inserted = await db.insert(examTypes).values(item).returning({ id: examTypes.id })
    ids.set(item.slug, inserted.at(0)!.id)
  }
  return ids
}

/**
 * Earlier seed revisions stored content types that are not members of the
 * `content_type` Postgres enum (e.g. 'reading'). Importing such a template
 * fails at the lessons insert, so repair the stored JSONB in place.
 */
async function repairTemplateContentTypes(): Promise<void> {
  const rows = await db
    .select({ id: courseTemplates.id, structure: courseTemplates.structure })
    .from(courseTemplates)
    .where(isNull(courseTemplates.deletedAt))

  for (const row of rows) {
    const before = collectContentTypes(row.structure)
    const structure = normalizeTemplateStructure(row.structure)
    const after = collectContentTypes(structure)
    if (before.join(',') === after.join(',')) continue
    await db.update(courseTemplates).set({ structure }).where(eq(courseTemplates.id, row.id))
    console.log(`↺ repaired template content types: #${row.id}`)
  }
}

function collectContentTypes(structure: unknown): string[] {
  return normalizeTemplateStructure(structure).modules.flatMap((module) =>
    module.lessons.map((lesson) => lesson.contentType),
  )
}

async function seedTemplate(input: {
  name: string
  slug: string
  description: string
  category: string
  featured: boolean
  modules: SeedModule[]
}): Promise<void> {
  const existing = await db
    .select({ id: courseTemplates.id })
    .from(courseTemplates)
    .where(eq(courseTemplates.slug, input.slug))
    .limit(1)
  if (existing.at(0)) {
    console.log(`↺ template exists: ${input.name}`)
    return
  }

  const quizCount = input.modules.reduce(
    (sum, module) => sum + module.lessons.filter((lesson) => lesson.contentType === 'quiz').length,
    0,
  )
  const lessonCount = input.modules.reduce((sum, module) => sum + module.lessons.length, 0)

  await db.insert(courseTemplates).values({
    name: input.name,
    slug: input.slug,
    description: input.description,
    category: input.category,
    structure: { modules: input.modules },
    moduleCount: input.modules.length,
    lessonCount,
    quizCount,
    isFeatured: input.featured,
  })
  console.log(`✔ seeded template: ${input.name}`)
}

/** Any courses already tagged source: template are left untouched. */
async function ensureCourseTemplatesShape(): Promise<void> {
  const rows = await db
    .select({ publicId: courses.publicId })
    .from(courses)
    .where(isNull(courses.deletedAt))
    .limit(1)
  void rows
}

async function main(): Promise<void> {
  const examTypeIds = await seedExamTypes()
  console.log(`✔ exam types ready (${examTypeIds.size})`)
  await ensureCourseTemplatesShape()
  await repairTemplateContentTypes()

  await seedTemplate({
    name: '12-Week TOEFL Prep',
    slug: '12-week-toefl-prep',
    description:
      'A complete 12-week TOEFL preparation track with weekly quizzes and a final mock test.',
    category: 'exam_prep',
    featured: true,
    modules: TOEFL,
  })
  await seedTemplate({
    name: '2-Day Workshop',
    slug: '2-day-workshop',
    description: 'A two-day corporate workshop template with canvases and decision logs.',
    category: 'corporate_training',
    featured: true,
    modules: WORKSHOP,
  })
  await seedTemplate({
    name: 'IELTS Crash Course',
    slug: 'ielts-crash-course',
    description: 'A short high-intensity IELTS sprint for last-minute preparation.',
    category: 'exam_prep',
    featured: false,
    modules: IELTS,
  })

  console.log('Done.')
  process.exit(0)
}

await main()
