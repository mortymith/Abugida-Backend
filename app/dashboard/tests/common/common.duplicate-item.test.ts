import { describe, expect, test } from 'bun:test'
import {
  duplicateDialogTitle,
  duplicateSourceLabel,
  duplicateSourcePath,
  duplicateSuccessActionLabel,
  duplicateSuccessToast,
  nameConflictLabel,
  sectionDuplicateSummary,
  shouldDisableUnlockRulesCopy,
} from '#/components/common/common.duplicate-item'
import type { DuplicateConfig } from '#/components/common/common.duplicate-item'

const itemConfig: DuplicateConfig = {
  subject: 'item',
  sourceTitle: 'Skimming Basics',
  sourceKind: 'lesson',
  sourceCourseName: 'TOEFL Complete',
  sourceSectionName: 'S2 Reading Skills',
  target: 'this_course',
  targetSectionName: 'S2 Reading Skills',
  position: 'after_source',
  includeContent: true,
  includeQuiz: false,
  publishImmediately: false,
}
const sectionConfig: DuplicateConfig = {
  ...itemConfig,
  subject: 'section',
  sourceTitle: 'S2 Reading Skills',
  sourceKind: 'section',
  itemCount: 14,
}

describe('duplicateDialogTitle', () => {
  test('includes source title', () => {
    expect(duplicateDialogTitle(itemConfig)).toContain('Skimming Basics')
  })
})
describe('duplicateSourceLabel', () => {
  test('item label includes kind', () => {
    expect(duplicateSourceLabel(itemConfig)).toContain('item · lesson')
  })
  test('section label includes item count', () => {
    expect(duplicateSourceLabel(sectionConfig)).toContain('14 items')
  })
})
describe('duplicateSourcePath', () => {
  test('course ▸ section', () => {
    expect(duplicateSourcePath(itemConfig)).toBe('TOEFL Complete ▸ S2 Reading Skills')
  })
})
describe('nameConflictLabel', () => {
  test('names the conflict + copy suffix', () => {
    const label = nameConflictLabel('Skimming Basics')
    expect(label).toContain('already exists')
    expect(label).toContain('(copy)')
  })
})
describe('sectionDuplicateSummary', () => {
  test('plural items', () => {
    expect(sectionDuplicateSummary(14)).toContain('14 items')
  })
  test('singular item', () => {
    expect(sectionDuplicateSummary(1)).toContain('1 item')
  })
})
describe('shouldDisableUnlockRulesCopy', () => {
  test('always true (never copied)', () => {
    expect(shouldDisableUnlockRulesCopy()).toBe(true)
  })
})
describe('duplicateSuccessToast', () => {
  test('returns Duplicated.', () => expect(duplicateSuccessToast()).toBe('Duplicated.'))
})
describe('duplicateSuccessActionLabel', () => {
  test('returns Open the copy', () => expect(duplicateSuccessActionLabel()).toBe('Open the copy'))
})
