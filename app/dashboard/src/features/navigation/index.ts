export { SearchTrigger } from './components/navigation.search-trigger'
export { CreateCourseButton } from './components/navigation.create-course-button'
export { useBreadcrumbs } from './hooks/navigation.breadcrumbs'
export { useCommandPalette } from './hooks/navigation.command-palette'
export { NAV_ITEMS, getVisibleNavItems, type NavItem } from './navigation.config'
export {
  buildNavigationGroup,
  buildQuickActionGroup,
  buildResultsGroup,
  clearRecentSearches,
  readRecentSearches,
  rememberSearchTerm,
  QUICK_ACTIONS,
  RECENT_SEARCHES_KEY,
} from './navigation.palette'
