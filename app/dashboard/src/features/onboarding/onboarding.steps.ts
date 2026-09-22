/**
 * S-7.6 Onboarding Tour step definitions (spec 09).
 *
 * The tour spotlights the sidebar entries for the five core screens called
 * out by the spec (S-1.1 Dashboard, S-2.1 Courses, S-4.1 Students, S-5.1
 * Analytics, S-6.1 Settings). Targets resolve to `[data-tour-target]`
 * attributes rendered by the app sidebar, so steps survive markup changes
 * as long as the stable attribute names do.
 */

export interface TourStep {
  id: string
  /** `[data-tour-target]` attribute value to spotlight. */
  target: string
  title: string
  body: string
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'dashboard',
    target: 'nav-dashboard',
    title: 'This is your Dashboard',
    body: 'Track revenue, enrollments, and activity across your workspace at a glance.',
  },
  {
    id: 'courses',
    target: 'nav-courses',
    title: 'Create and manage courses',
    body: 'Build curricula with modules, lessons, and quizzes, then submit them for review.',
  },
  {
    id: 'students',
    target: 'nav-students',
    title: 'Your student directory',
    body: 'Enroll students, organize cohorts, and follow engagement from one place.',
  },
  {
    id: 'analytics',
    target: 'nav-analytics',
    title: 'Analytics and revenue',
    body: 'See completion, drop-off, and revenue reports — exportable to CSV.',
  },
  {
    id: 'settings',
    target: 'nav-settings',
    title: 'Workspace settings',
    body: 'Configure team roles, integrations, branding, and privacy for your workspace.',
  },
]

/** Window event used by Help & Support to replay the tour (S-7.4 ↔ S-7.6). */
export const REPLAY_TOUR_EVENT = 'abugida:replay-tour'

export function replayTour(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(REPLAY_TOUR_EVENT))
}
