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
export { courseQueryKeys, pendingReviewCountQueryOptions } from './hooks/courses.queries'
export type { AiQuizQuestionDraft } from './courses.types'
