/**
 * Courses feature (spec 04) — public API. Routes and other features import
 * through this barrel only.
 */
export { CoursesCatalog } from './components/courses.catalog-view'
export { CourseWizard } from './components/courses.course-wizard'
export { CourseDetail } from './components/courses.detail-view'
export { LessonEditor } from './components/courses.lesson-editor'
export { QuizBuilderModal } from './components/courses.quiz-builder'
export { AiQuizModal } from './components/courses.ai-quiz-modal'
export { ReviewsQueue } from './components/courses.reviews-queue'
export { TemplateGallery } from './components/courses.template-gallery'
export { StatusPill } from './components/courses.status-pill'
export { MarkdownPreview } from './components/courses.markdown-preview'
export { courseQueryKeys, pendingReviewCountQueryOptions } from './hooks/courses.queries'
export {
  LESSON_MIN_TEXT_LENGTH,
  auditMarkdown,
  normalizeMarkdown,
  roundTrip,
  summarizeMarkdown,
} from './courses.markdown'
export { convertLegacyHtmlToMarkdown } from './courses.legacy-html'
export {
  CURRICULUM_ITEM_CONTENT_TYPES,
  CURRICULUM_ITEM_KIND_LABELS,
  CURRICULUM_ITEM_KIND_SCREENS,
  CURRICULUM_ITEM_KINDS,
  CURRICULUM_TAB,
  COURSE_LIFECYCLE_LABELS,
  COURSE_LIFECYCLE_ORDER,
  COURSE_LIFECYCLE_STATES,
  COURSE_LIFECYCLE_TRANSITIONS,
  DEFAULT_WORKSPACE_TAB,
  SAVE_STATE_EXTENSIONS,
  SAVE_STATE_EXTENSION_LABELS,
  SAVE_STATE_LABELS,
  SAVE_STATES,
  WORKSPACE_TAB_LABELS,
  WORKSPACE_TABS,
  buildCourseWorkspaceHref,
  buildLessonAliasHref,
  canTransitionCourseLifecycle,
  deriveCurriculumItemKind,
  isCourseLifecycleState,
  isCourseVisibleToStudents,
  isCourseWorkspaceTab,
  isCurriculumItemKind,
  isSaveState,
  isUnresolvedSaveState,
  normalizeItemPublicId,
  parseCourseWorkspaceSearch,
  saveStateBlocksNavigation,
  serializeCourseWorkspaceSearch,
} from './courses.workspace'
export type {
  AnySaveState,
  CourseLifecycleState,
  CourseWorkspaceSearchInput,
  CourseWorkspaceSearchParams,
  CourseWorkspaceTab,
  CurriculumItemKind,
  RawCourseWorkspaceSearch,
  SaveState,
  SaveStateExtension,
} from './courses.workspace'
export { validateLessonMarkdown } from './schemas/courses.markdown.schema'
export type { AiQuizQuestionDraft } from './courses.types'
export type { MarkdownIssue, MarkdownSummary } from './courses.markdown'
export type { MarkdownValidation } from './schemas/courses.markdown.schema'

// `courses.markdown-editor` is intentionally NOT exported: it constructs a
// Tiptap instance, which is browser-only, and must not reach an SSR path
// (spec 12 § 6.2).
