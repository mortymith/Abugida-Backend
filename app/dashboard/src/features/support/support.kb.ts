/**
 * S-7.4 Help & Support — read-only knowledge base (spec 09).
 *
 * Articles are static content authored with the product; the panel writes
 * only `support_tickets` (spec: "Read-only knowledge base; writes
 * support_tickets"). Search and module ranking are pure functions so the
 * panel stays client-only and the logic is unit-testable.
 */

export type HelpModule =
  'dashboard' | 'courses' | 'content-library' | 'students' | 'analytics' | 'settings' | 'general'

export interface HelpArticle {
  id: string
  title: string
  summary: string
  body: string
  module: HelpModule
  keywords: string[]
}

export const HELP_ARTICLES: readonly HelpArticle[] = [
  {
    id: 'getting-started',
    title: 'Getting started with Abugida',
    summary:
      'A five-minute orientation to the dashboard: navigation, search, and your first course.',
    body: 'The sidebar groups the workspace into Dashboard, Courses, Content Library, Students, Analytics, and Settings. Press ⌘K (or Ctrl+K) anywhere to jump between screens or run quick actions. To publish your first course, start with Create Course, add modules and lessons, then submit it for review from the course detail page.',
    module: 'general',
    keywords: ['onboarding', 'tour', 'orientation', 'navigation', 'first course', 'intro'],
  },
  {
    id: 'create-course',
    title: 'How to create a course',
    summary: 'Create a blank course, start from a template, or generate a draft with AI.',
    body: 'Use Create Course in the header and pick Blank, From Template, or With AI. The wizard walks through basics, curriculum, pricing, and publishing. Courses stay in Draft until review approval when your workspace requires approval.',
    module: 'courses',
    keywords: ['course', 'create', 'wizard', 'template', 'ai', 'publish'],
  },
  {
    id: 'curriculum-lessons',
    title: 'Building a curriculum with modules and lessons',
    summary: 'Add modules, order lessons with drag-and-drop, and attach quizzes or media.',
    body: 'Open a course and edit its curriculum to add modules and lessons. Lessons support video, PDF, exercise, link, and quiz content; media is referenced from the Content Library so assets stay shared and deduplicated. Drag rows to reorder, then save the curriculum order.',
    module: 'courses',
    keywords: ['curriculum', 'module', 'lesson', 'quiz', 'media', 'reorder'],
  },
  {
    id: 'duplicate-lesson',
    title: 'Duplicating a lesson into another course',
    summary: 'Reuse proven lessons across courses without copy-paste mistakes.',
    body: 'From a lesson row or the lesson editor, choose Duplicate to another course. Content and the attached quiz are copied (the quiz copy is independent and unlinked from the original analytics); unlock rules are never copied because cross-course references would be invalid.',
    module: 'courses',
    keywords: ['duplicate', 'copy', 'lesson', 'quiz', 'reuse'],
  },
  {
    id: 'upload-assets',
    title: 'Uploading and organizing content assets',
    summary: 'Upload videos, documents, and images once, then reference them in any lesson.',
    body: 'The Content Library holds every uploaded asset with folders for organization. Uploads process asynchronously and show progress; once ready, an asset can be attached to lessons from the lesson editor.',
    module: 'content-library',
    keywords: ['upload', 'asset', 'library', 'media', 'folder', 'video'],
  },
  {
    id: 'manage-students',
    title: 'Managing students, cohorts, and enrollments',
    summary: 'Invite or enroll students, group them into cohorts, and track engagement.',
    body: 'The Students area covers the directory, enrollments, cohorts, badges, and messaging. Enrollment requests from the marketing site land in Requests for approval. Cohorts let you schedule and price a shared start date for a group.',
    module: 'students',
    keywords: ['student', 'enroll', 'cohort', 'badge', 'messaging', 'directory'],
  },
  {
    id: 'reading-analytics',
    title: 'Reading the analytics and revenue reports',
    summary: 'Track enrollments, completion, drop-off, and revenue across courses.',
    body: 'Analytics aggregates enrollment, completion, and quiz performance per course, plus revenue over time. Export any report to CSV for deeper analysis; exports reflect your current filters.',
    module: 'analytics',
    keywords: ['analytics', 'revenue', 'report', 'export', 'csv', 'completion'],
  },
  {
    id: 'workspace-settings',
    title: 'Workspace settings, roles, and branding',
    summary: 'Configure the platform name, team roles, integrations, and branding.',
    body: 'Settings is admin-only except for My Profile. General covers platform defaults; Team manages members and invitations; Roles defines the permission matrix; Branding controls logo and colors; Privacy documents your data practices and handles data requests.',
    module: 'settings',
    keywords: ['settings', 'roles', 'team', 'branding', 'integrations', 'privacy', 'profile'],
  },
]

export const POPULAR_ARTICLE_LIMIT = 3

/** Case-insensitive match across title, summary, and keywords, best-first. */
export function searchHelpArticles(
  query: string,
  articles: readonly HelpArticle[] = HELP_ARTICLES,
): HelpArticle[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const scored: Array<{ article: HelpArticle; score: number }> = []
  for (const article of articles) {
    const title = article.title.toLowerCase()
    const summary = article.summary.toLowerCase()
    const keywords = article.keywords.join(' ').toLowerCase()
    let score = 0
    if (title.includes(needle)) score += 3
    if (keywords.includes(needle)) score += 2
    if (summary.includes(needle)) score += 1
    if (score > 0) scored.push({ article, score })
  }
  return scored.sort((a, b) => b.score - a.score).map(({ article }) => article)
}

/** Module articles first (stable order), then general ones, capped. */
export function popularArticlesForModule(
  module: HelpModule,
  articles: readonly HelpArticle[] = HELP_ARTICLES,
): HelpArticle[] {
  const inModule = articles.filter((article) => article.module === module)
  const general = articles.filter(
    (article) => article.module !== module && article.module === 'general',
  )
  return [...inModule, ...general].slice(0, POPULAR_ARTICLE_LIMIT)
}

/** Map the current route to the help module shown in the panel. */
export function moduleForPath(path: string): HelpModule {
  const segment = path.split('/').filter(Boolean)[0] ?? ''
  switch (segment) {
    case '':
    case 'dashboard':
      return 'dashboard'
    case 'courses':
      return 'courses'
    case 'content-library':
      return 'content-library'
    case 'students':
      return 'students'
    case 'analytics':
      return 'analytics'
    case 'settings':
      return 'settings'
    default:
      return 'general'
  }
}
