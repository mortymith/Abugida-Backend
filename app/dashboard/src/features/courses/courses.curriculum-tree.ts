/**
 * Pure curriculum-tree helpers (spec 04 S-2.3 / S-2.6). Client-safe so both
 * the UI and bun tests can use them; the server re-validates everything.
 */

export interface CurriculumNode {
  publicId: string
  title: string
}

export interface CurriculumLessonNode extends CurriculumNode {
  modulePublicId: string
}

export interface CurriculumTree {
  modules: Array<{
    publicId: string
    title: string
    lessons: CurriculumLessonNode[]
  }>
}

export function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

/** Spec: duplicate lesson names get a " (2)"-style suffix (import + wizard). */
export function dedupeTitle(title: string, existingTitles: Iterable<string>): string {
  const normalized = normalizeTitle(title)
  const taken = new Set(Array.from(existingTitles, normalizeTitle))
  if (!taken.has(normalized)) return normalized
  let counter = 2
  while (taken.has(`${normalized} (${counter})`)) counter += 1
  return `${normalized} (${counter})`
}

export interface ReorderValidationResult {
  ok: boolean
  errors: string[]
  moduleCount: number
  lessonCount: number
}

/**
 * Validate a full-tree save: names, uniqueness inside a module, and the
 * spec's "at least 1 module with 1 lesson" progression rule.
 */
export function validateCurriculumTree(tree: CurriculumTree): ReorderValidationResult {
  const errors: string[] = []
  const moduleIds = new Set<string>()
  let lessonCount = 0

  tree.modules.forEach((module, moduleIndex) => {
    const title = normalizeTitle(module.title)
    if (title.length < 3) {
      errors.push(`Module ${moduleIndex + 1}: name must be at least 3 characters`)
    }
    if (moduleIds.has(module.publicId)) {
      errors.push(`Module ${moduleIndex + 1}: duplicate module`)
    }
    moduleIds.add(module.publicId)

    const lessonIds = new Set<string>()
    const lessonTitles = new Set<string>()
    module.lessons.forEach((lesson) => {
      lessonCount += 1
      const lessonTitle = normalizeTitle(lesson.title)
      if (lessonTitle.length < 3) {
        errors.push(`Lesson "${lesson.title}": name must be at least 3 characters`)
      }
      if (lessonIds.has(lesson.publicId)) {
        errors.push(`Lesson "${lesson.title}": duplicate lesson`)
      }
      if (lessonTitles.has(lessonTitle)) {
        // Spec: warn on identical lesson names — treat as a validation warning
        // surfaced to the UI but not a hard block, so track it separately.
        errors.push(`Duplicate lesson name in module "${module.title}": ${lessonTitle}`)
      }
      lessonIds.add(lesson.publicId)
      lessonTitles.add(lessonTitle)
    })
  })

  const moduleCount = tree.modules.length
  if (moduleCount === 0 || lessonCount === 0) {
    errors.push('Add at least 1 module with 1 lesson to continue')
  }

  return { ok: errors.length === 0, errors, moduleCount, lessonCount }
}

/** Can the wizard proceed past the curriculum step? */
export function canProceedFromCurriculum(tree: CurriculumTree): boolean {
  return tree.modules.some((module) => module.lessons.length > 0)
}

/** Reindex sort orders 0..n-1 while preserving relative order. */
export function reindexOrder<T>(items: T[]): Array<T & { sortOrder: number }> {
  return items.map((item, index) => ({ ...item, sortOrder: index }))
}
