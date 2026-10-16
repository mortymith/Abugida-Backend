/**
 * S-7.12 / Spec 11 § Status Colour Mapping: StatusPill token mapping.
 * Every status is a fill/text/tint triple — never coloured text alone.
 * No hardcoded hex values — all tokens are CSS custom property names.
 */

export type StatusPillType =
  'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'archived' | 'ai'

export interface StatusPillTokens {
  readonly fill: string
  readonly text: string
  readonly tint: string
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

/**
 * Course lifecycle → StatusPill type mapping (spec 11 + DESIGN.md §3.4).
 */
export const COURSE_STATUS_TO_PILL: Record<string, StatusPillType> = {
  draft: 'neutral',
  in_review: 'info',
  approved: 'success',
  published: 'success',
  archived: 'archived',
}

/**
 * Lesson review status → StatusPill type.
 */
export const REVIEW_STATUS_TO_PILL: Record<string, StatusPillType> = {
  draft: 'neutral',
  in_review: 'info',
  changes_requested: 'warning',
  approved: 'success',
}

export function getStatusPillTokens(type: StatusPillType): StatusPillTokens {
  return STATUS_PILL_TOKENS[type]
}

export function getStatusPillLabel(type: StatusPillType): string {
  return STATUS_PILL_LABELS[type]
}
