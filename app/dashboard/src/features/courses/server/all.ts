/**
 * Client-safe barrel of the courses feature's server functions. Wrappers
 * only — impl modules are dynamically imported inside handlers and never
 * enter the client bundle.
 */
export { getCourseCatalog } from './courses.catalog'
export { getCourseFormReference } from './courses.reference'
export {
  createCourseDraft,
  getCourseDetails,
  saveCourseDetails,
  saveCourseTitle,
} from './courses.details'
export {
  createLesson,
  createModule,
  deleteLesson,
  deleteModule,
  getCurriculum,
  renameLesson,
  renameModule,
  saveCurriculumOrder,
} from './courses.curriculum'
export { getCoursePricing, saveCoursePricing } from './courses.pricing'
export { archiveCourse, deleteCourse, duplicateCourse, publishCourse } from './courses.lifecycle'
export { getImageReadUrl, getImageUploadUrl } from './courses.storage'
export { getQuizForLesson, saveQuiz } from './courses.quiz'
export {
  auditLessonReferences,
  confirmServerBody,
  exportLessonMarkdown,
  getLessonForEdit,
  getLessonServerRowVersion,
  migrateLessonBodyToMarkdown,
  recordLessonConflictOverride,
  saveLesson,
  submitLessonForReview,
  validateLessonMarkdown,
} from './courses.lessons'
export { duplicateLesson } from './courses.duplication'
export { getUnlockRules, saveUnlockRules } from './courses.unlock-rules'
export {
  decideReview,
  getPendingReviewCount,
  getReviewLessonPreview,
  getReviewQueue,
  setApprovalGate,
  submitForReview,
} from './courses.reviews'
export { getCourseTemplates, saveCourseAsTemplate, useTemplate } from './courses.templates'
export { parseImportFile, runImport, undoImport, validateImport } from './courses.import'
export {
  expandOutlineModule,
  generateCourseOutline,
  generateQuizDraft,
  regenerateOutlineModule,
  regenerateQuizQuestion,
} from './courses.ai'
export {
  attachSessionRecording,
  cancelLiveSession,
  getLiveSessions,
  saveLiveSession,
} from './courses.live-sessions'
export { getCompletionSettings, saveCompletionSettings } from './courses.completion'
export { getCourseAnalytics, getCourseStudents } from './courses.students'
export { getPublishReadiness } from './courses.readiness'
export {
  approveCourseReview,
  decideCourseReview,
  restoreCourse,
  setItemVisibility,
  submitCourseForReview,
  unpublishCourse,
  withdrawCourseReview,
} from './courses.lifecycle'
