/**
 * S-7.12 Form & Data Primitives: StatusPill token mapping (spec 09 § S-7.12,
 * spec 11 § Status Colour Mapping).
 *
 * The spec: "Rendered as fill + text + tint, never coloured text alone."
 * Palette hues are gone — types map to the Part 11 fill/text/tint triples.
 */

export type StatusPillType =
  'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'archived' | 'ai'

export interface StatusPillTokens {
  readonly fill: string // CSS custom property name, e.g. '--color-success-fill'
  readonly text: string // CSS custom property name, e.g. '--color-success-text'
  readonly tint: string // CSS custom property name, e.g. '--color-success-tint'
}

export const STATUS_PILL_TOKENS: Record<StatusPillType, StatusPillTokens> = {
  success: {
    fill: '--color-success-fill',
    text: '--color-success-text',
    tint: '--color-success-tint',
  },
  info: { fill: '--color-info-fill', text: '--color-info-text', tint: '--color-info-tint' },
  warning: {
    fill: '--color-warning-fill',
    text: '--color-warning-text',
    tint: '--color-warning-tint',
  },
  danger: { fill: '--color-danger-fill', text: '--color-danger-text', tint: '--color-danger-tint' },
  neutral: {
    fill: '--color-neutral-fill',
    text: '--color-neutral-text',
    tint: '--color-neutral-tint',
  },
  archived: {
    fill: '--color-archived-fill',
    text: '--color-archived-text',
    tint: '--color-archived-tint',
  },
  ai: { fill: '--color-ai-fill', text: '--color-ai-text', tint: '--color-ai-tint' },
}

export const STATUS_PILL_LABELS: Record<StatusPillType, string> = {
  success: 'Success',
  info: 'Info',
  warning: 'Warning',
  danger: 'Danger',
  neutral: 'Neutral',
  archived: 'Archived',
  ai: 'AI',
}

export function getStatusPillTokens(type: StatusPillType): StatusPillTokens {
  return STATUS_PILL_TOKENS[type]
}

export function getStatusPillLabel(type: StatusPillType): string {
  return STATUS_PILL_LABELS[type]
}

/**
 * Course lifecycle → StatusPill type mapping (spec 11 § Status Colour
 * Mapping + DESIGN.md §3.4).
 */
export const COURSE_STATUS_TO_PILL: Record<string, StatusPillType> = {
  draft: 'neutral',
  in_review: 'info',
  approved: 'success',
  published: 'success',
  archived: 'archived',
}

/**
 * Lesson review status → StatusPill type mapping (spec 11).
 */
export const REVIEW_STATUS_TO_PILL: Record<string, StatusPillType> = {
  draft: 'neutral',
  in_review: 'info',
  changes_requested: 'warning',
  approved: 'success',
}
