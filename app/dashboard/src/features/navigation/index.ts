export { CreateCourseButton } from './components/navigation.create-course-button'
export {
  buildModuleCrumbs,
  buildWorkspaceCrumbs,
  buildWorkspaceTabLinks,
  useBreadcrumbs,
  type BreadcrumbCrumb,
  type WorkspaceTabLink,
} from './navigation.breadcrumbs'
export { useCourseWorkspace, type CourseWorkspaceContext } from './navigation.course-workspace'
export {
  BADGE_CAP,
  CREATE_COURSE_ROLES,
  NAV_GROUPS,
  NAV_ITEMS,
  REVIEW_ROLES,
  badgeAccessibleName,
  canCreateCourse,
  canReview,
  canSeeRevenue,
  formatBadgeCount,
  getActiveNavItemId,
  getVisibleNavGroups,
  getVisibleNavItems,
  isNavItemActive,
  type NavGroup,
  type NavItem,
} from './navigation.config'
export { NAV_EVENT, trackNavEvent, type NavEventName } from './navigation.events'
export {
  RESUME_MAX_AGE_MS,
  resolveResumeDecision,
  resumeLabel,
  type CourseWorkspacePreference,
  type ResumeDecision,
} from './navigation.resume'
export {
  clearCourseWorkspacePreference,
  readCourseWorkspacePreference,
  rememberCourseWorkspace,
  useResumePreference,
} from './navigation.resume-preference'
export { useResumeDecision } from './hooks/navigation.resume-target'
export { SIDEBAR_STATE_COOKIE, readSidebarOpen } from './navigation.sidebar-preference'
export { getSidebarOpenState } from './navigation.sidebar-state'
export { PRODUCT_NAME, buildDocumentTitle, composeAnnouncement } from './navigation.page-title'
export {
  buildNavigationGroup,
  buildQuickActionGroup,
  buildResultsGroup,
  commandItemValue,
  QUICK_ACTIONS,
  type CommandPaletteGroup,
} from './navigation.palette'
