import { queryOptions } from '@tanstack/react-query'
import {
  getBadgeHistory,
  getBadges,
  getCohortMembers,
  getCohorts,
  getDirectoryPage,
  getDirectoryStats,
  getEnrollmentRequests,
  getRuleRuns,
  getRules,
  getStudentActivity,
  getStudentCourses,
  getStudentProfile,
  getStudentProgress,
  getStudentThreads,
  getStudentsReference,
  getThreadMessages,
  getThreads,
  getWaitlistOverview,
  listCohortCandidateStudents,
  listEnrollableCourses,
} from '../server/all'
import type {
  BadgeHistoryQuery,
  CohortsQuery,
  DirectoryQuery,
  RequestsQuery,
  RuleRunsQuery,
  StudentIdInput,
  ThreadMessagesQuery,
  ThreadsQuery,
} from '../schemas/students.schema'

/**
 * TanStack Query factories for the Students feature (spec 06). Routes warm
 * these caches via loaders (`ensureQueryData`); components subscribe with
 * `useQuery` so SSR + client refetches share one cache entry per key.
 */

export const studentsQueryKeys = {
  directory: (query: DirectoryQuery) => ['students', 'directory', query] as const,
  stats: () => ['students', 'stats'] as const,
  profile: (studentId: string) => ['students', 'profile', studentId] as const,
  courses: (studentId: string) => ['students', 'courses', studentId] as const,
  activity: (studentId: string) => ['students', 'activity', studentId] as const,
  progress: (studentId: string) => ['students', 'progress', studentId] as const,
  tags: () => ['students', 'reference'] as const,
  cohorts: (query: CohortsQuery) => ['students', 'cohorts', query] as const,
  cohortMembers: (cohortPublicId: string) =>
    ['students', 'cohort-members', cohortPublicId] as const,
  cohortCandidates: (q: string) => ['students', 'cohort-candidates', q] as const,
  threads: (query: ThreadsQuery) => ['students', 'threads', query] as const,
  threadMessages: (query: ThreadMessagesQuery) => ['students', 'thread-messages', query] as const,
  studentThreads: (studentId: string) => ['students', 'student-threads', studentId] as const,
  requests: (query: RequestsQuery) => ['students', 'requests', query] as const,
  waitlist: () => ['students', 'waitlist'] as const,
  badges: () => ['students', 'badges'] as const,
  badgeHistory: (query: BadgeHistoryQuery) => ['students', 'badge-history', query] as const,
  rules: () => ['students', 'rules'] as const,
  ruleRuns: (query: RuleRunsQuery) => ['students', 'rule-runs', query] as const,
  enrollableCourses: () => ['students', 'enrollable-courses'] as const,
}

const STALE = {
  directory: 15_000,
  stats: 60_000,
  profile: 20_000,
  courses: 20_000,
  activity: 20_000,
  progress: 20_000,
  cohorts: 30_000,
  threads: 10_000,
  requests: 15_000,
  badges: 30_000,
  rules: 30_000,
  reference: 120_000,
}

export function directoryQueryOptions(query: DirectoryQuery) {
  return queryOptions({
    queryKey: studentsQueryKeys.directory(query),
    queryFn: () => getDirectoryPage({ data: query }),
    staleTime: STALE.directory,
  })
}

export function directoryStatsQueryOptions() {
  return queryOptions({
    queryKey: studentsQueryKeys.stats(),
    queryFn: async () => await getDirectoryStats(),
    staleTime: STALE.stats,
  })
}

export function studentProfileQueryOptions(input: StudentIdInput) {
  return queryOptions({
    queryKey: studentsQueryKeys.profile(input.studentId),
    queryFn: () => getStudentProfile({ data: input }),
    staleTime: STALE.profile,
  })
}

export function studentCoursesQueryOptions(input: StudentIdInput) {
  return queryOptions({
    queryKey: studentsQueryKeys.courses(input.studentId),
    queryFn: () => getStudentCourses({ data: input }),
    staleTime: STALE.courses,
  })
}

export function studentActivityQueryOptions(input: StudentIdInput) {
  return queryOptions({
    queryKey: studentsQueryKeys.activity(input.studentId),
    queryFn: () => getStudentActivity({ data: input }),
    staleTime: STALE.activity,
  })
}

export function studentProgressQueryOptions(input: StudentIdInput) {
  return queryOptions({
    queryKey: studentsQueryKeys.progress(input.studentId),
    queryFn: () => getStudentProgress({ data: input }),
    staleTime: STALE.progress,
  })
}

export function studentsReferenceQueryOptions() {
  return queryOptions({
    queryKey: studentsQueryKeys.tags(),
    queryFn: async () => await getStudentsReference(),
    staleTime: STALE.reference,
  })
}

export function cohortsQueryOptions(query: CohortsQuery) {
  return queryOptions({
    queryKey: studentsQueryKeys.cohorts(query),
    queryFn: () => getCohorts({ data: query }),
    staleTime: STALE.cohorts,
  })
}

export function cohortMembersQueryOptions(cohortPublicId: string) {
  return queryOptions({
    queryKey: studentsQueryKeys.cohortMembers(cohortPublicId),
    queryFn: () => getCohortMembers({ data: { cohortPublicId } }),
    staleTime: STALE.cohorts,
  })
}

export function cohortCandidatesQueryOptions(q: string) {
  return queryOptions({
    queryKey: studentsQueryKeys.cohortCandidates(q),
    queryFn: () => listCohortCandidateStudents({ data: q }),
    staleTime: STALE.reference,
  })
}

export function threadsQueryOptions(query: ThreadsQuery) {
  return queryOptions({
    queryKey: studentsQueryKeys.threads(query),
    queryFn: () => getThreads({ data: query }),
    staleTime: STALE.threads,
  })
}

export function threadMessagesQueryOptions(query: ThreadMessagesQuery) {
  return queryOptions({
    queryKey: studentsQueryKeys.threadMessages(query),
    queryFn: () => getThreadMessages({ data: query }),
    staleTime: 0,
  })
}

export function studentThreadsQueryOptions(studentId: string) {
  return queryOptions({
    queryKey: studentsQueryKeys.studentThreads(studentId),
    queryFn: () => getStudentThreads({ data: { studentId } }),
    staleTime: STALE.threads,
  })
}

export function enrollmentRequestsQueryOptions(query: RequestsQuery) {
  return queryOptions({
    queryKey: studentsQueryKeys.requests(query),
    queryFn: () => getEnrollmentRequests({ data: query }),
    staleTime: STALE.requests,
  })
}

export function waitlistOverviewQueryOptions() {
  return queryOptions({
    queryKey: studentsQueryKeys.waitlist(),
    queryFn: async () => await getWaitlistOverview(),
    staleTime: STALE.requests,
  })
}

export function badgesQueryOptions() {
  return queryOptions({
    queryKey: studentsQueryKeys.badges(),
    queryFn: async () => await getBadges(),
    staleTime: STALE.badges,
  })
}

export function badgeHistoryQueryOptions(query: BadgeHistoryQuery) {
  return queryOptions({
    queryKey: studentsQueryKeys.badgeHistory(query),
    queryFn: () => getBadgeHistory({ data: query }),
    staleTime: STALE.badges,
  })
}

export function rulesQueryOptions() {
  return queryOptions({
    queryKey: studentsQueryKeys.rules(),
    queryFn: async () => await getRules(),
    staleTime: STALE.rules,
  })
}

export function ruleRunsQueryOptions(query: RuleRunsQuery) {
  return queryOptions({
    queryKey: studentsQueryKeys.ruleRuns(query),
    queryFn: () => getRuleRuns({ data: query }),
    staleTime: 0,
  })
}

export function enrollableCoursesQueryOptions() {
  return queryOptions({
    queryKey: studentsQueryKeys.enrollableCourses(),
    queryFn: async () => await listEnrollableCourses(),
    staleTime: STALE.reference,
  })
}
