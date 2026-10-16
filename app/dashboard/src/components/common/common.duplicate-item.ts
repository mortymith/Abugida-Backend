/**
 * S-7.7 Duplicate Item Modal logic (spec 09 § S-7.7).
 * Generalised from lesson-only to item + section, same-course + cross-course.
 */

export type DuplicateTarget = 'this_course' | 'another_course'
export type DuplicatePosition = 'end_of_section' | 'after_source'
export type DuplicateSubject = 'item' | 'section'

export interface DuplicateConfig {
  readonly subject: DuplicateSubject
  readonly sourceTitle: string
  readonly sourceKind: ItemKind | 'section'
  readonly sourceCourseName: string
  readonly sourceSectionName: string
  readonly target: DuplicateTarget
  readonly targetSectionName: string
  readonly position: DuplicatePosition
  readonly includeContent: boolean
  readonly includeQuiz: boolean
  readonly publishImmediately: boolean
  readonly itemCount?: number // for section duplication
}

export type ItemKind = 'lesson' | 'quiz' | 'assignment'

export function duplicateDialogTitle(config: DuplicateConfig): string {
  if (config.subject === 'section') {
    return `Duplicate "${config.sourceTitle}"`
  }
  return `Duplicate "${config.sourceTitle}"`
}

export function duplicateSourceLabel(config: DuplicateConfig): string {
  if (config.subject === 'section') {
    return `${config.sourceTitle}  (section · ${config.itemCount ?? 0} items)`
  }
  return `${config.sourceTitle}  (item · ${config.sourceKind})`
}

export function duplicateSourcePath(config: DuplicateConfig): string {
  return `${config.sourceCourseName} ▸ ${config.sourceSectionName}`
}

export function nameConflictLabel(sourceTitle: string): string {
  return `"${sourceTitle}" already exists in this section → saved as "${sourceTitle} (copy)"`
}

export function sectionDuplicateSummary(itemCount: number): string {
  const noun = itemCount === 1 ? 'item' : 'items'
  return `Copying 1 section and ${itemCount} ${noun}…`
}

export function shouldDisableUnlockRulesCopy(): boolean {
  // Unlock rules are never copied. The static text says so — no checkbox.
  return true
}

export function shouldDisablePublishImmediately(config: DuplicateConfig): {
  disabled: boolean
  reason: string | null
} {
  if (config.target === 'another_course') {
    return { disabled: false, reason: null }
  }
  return { disabled: false, reason: null }
}

export function duplicateSuccessToast(): string {
  return 'Duplicated.'
}

export function duplicateSuccessActionLabel(): string {
  return 'Open the copy'
}
