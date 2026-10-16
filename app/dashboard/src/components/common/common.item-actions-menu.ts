/**
 * S-7.10 Curriculum Item Actions Menu (spec 09 § S-7.10).
 * Three-case policy: absent (out of capability), disabled-with-reason
 * (state-blocked), replaced-with-explanation (surface locked).
 */

export type ItemKind = 'lesson' | 'quiz' | 'assignment'

export type MenuEntryId =
  | 'rename'
  | 'duplicate'
  | 'move_to_section'
  | 'move_up'
  | 'move_down'
  | 'unlock_rules'
  | 'preview_as_student'
  | 'view_analytics'
  | 'copy_markdown'
  | 'open_in_new_tab'
  | 'questions'
  | 'ai_draft_quiz'
  | 'grading'
  | 'archive'
  | 'delete'

export type MenuEntryState =
  { kind: 'available' } | { kind: 'disabled'; reason: string } | { kind: 'absent' }

export interface MenuEntry {
  readonly id: MenuEntryId
  readonly label: string
  readonly state: MenuEntryState
  readonly separatorBefore?: boolean
  readonly destructive?: boolean
}

export interface MenuItemMenuContext {
  readonly kind: ItemKind
  readonly isFirst: boolean
  readonly isLast: boolean
  readonly sectionCount: number
  readonly isLockedByReview: boolean
  readonly isArchived: boolean
  readonly canEdit: boolean
  readonly hasUnlockRules: boolean
}

export function buildItemActionsMenu(ctx: MenuItemMenuContext): MenuEntry[] {
  // Read-only role: menu not rendered
  if (!ctx.canEdit) return []

  // Locked by review: whole menu replaced with explanation
  if (ctx.isLockedByReview) {
    return [{ id: 'open_in_new_tab', label: 'Open in new tab', state: { kind: 'available' } }]
  }

  // Archived item: Restore · Duplicate · Delete permanently
  if (ctx.isArchived) {
    return [
      { id: 'duplicate', label: 'Duplicate…', state: { kind: 'available' } },
      {
        id: 'delete',
        label: 'Delete permanently',
        state: { kind: 'available' },
        separatorBefore: true,
        destructive: true,
      },
    ]
  }

  const entries: MenuEntry[] = [
    { id: 'rename', label: 'Rename…', state: { kind: 'available' } },
    { id: 'duplicate', label: 'Duplicate…', state: { kind: 'available' } },
  ]

  // Move to section: absent in single-section course
  if (ctx.sectionCount > 1) {
    entries.push({
      id: 'move_to_section',
      label: 'Move to section ▸',
      state: { kind: 'available' },
    })
  }

  // Move up: disabled with reason at first position
  entries.push({
    id: 'move_up',
    label: 'Move up',
    state: ctx.isFirst
      ? { kind: 'disabled', reason: 'Already first in this section' }
      : { kind: 'available' },
  })

  // Move down: disabled with reason at last position
  entries.push({
    id: 'move_down',
    label: 'Move down',
    state: ctx.isLast
      ? { kind: 'disabled', reason: 'Already last in this section' }
      : { kind: 'available' },
  })

  // Separator
  entries.push({
    id: 'unlock_rules',
    label: 'Unlock rules',
    state: { kind: 'available' },
    separatorBefore: true,
  })

  // Kind-specific entries
  if (ctx.kind === 'quiz') {
    entries.push({ id: 'questions', label: 'Questions', state: { kind: 'available' } })
    entries.push({ id: 'ai_draft_quiz', label: '✨ AI draft quiz', state: { kind: 'available' } })
  }
  if (ctx.kind === 'assignment') {
    entries.push({ id: 'grading', label: 'Grading', state: { kind: 'available' } })
  }

  entries.push({
    id: 'preview_as_student',
    label: 'Preview as student',
    state: { kind: 'available' },
  })
  entries.push({ id: 'view_analytics', label: 'View analytics', state: { kind: 'available' } })

  // Separator
  entries.push({
    id: 'copy_markdown',
    label: 'Copy Markdown',
    state: { kind: 'available' },
    separatorBefore: true,
  })
  entries.push({ id: 'open_in_new_tab', label: 'Open in new tab', state: { kind: 'available' } })

  // Danger zone — separator before archive
  entries.push({
    id: 'archive',
    label: 'Archive…',
    state: { kind: 'available' },
    separatorBefore: true,
  })
  entries.push({
    id: 'delete',
    label: 'Delete…',
    state: { kind: 'available' },
    destructive: true,
  })

  return entries
}

export function shouldFocusRename(entries: MenuEntry[]): boolean {
  // Focus lands on Rename, never Delete
  return entries.some((e) => e.id === 'rename' && e.state.kind === 'available')
}

export function isMenuReplacedByExplanation(ctx: MenuItemMenuContext): boolean {
  return ctx.isLockedByReview
}

export function reviewLockExplanation(): string {
  return 'Editing is locked while this course is in review'
}
