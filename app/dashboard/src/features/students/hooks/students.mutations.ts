import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import type { QueryKey } from '@tanstack/react-query'
import {
  addStudentTag,
  approveRequest,
  awardBadge,
  broadcastMessage,
  bulkApproveRequests,
  createCohort,
  createStudent,
  deleteCohort,
  deleteRule,
  denyRequest,
  duplicateRule,
  evaluateBadges,
  markThreadRead,
  promoteFromWaitlist,
  removeStudentTag,
  runRule,
  saveBadge,
  saveRule,
  sendMessage,
  setBadgeStatus,
  setRuleStatus,
  setStudentStatus,
  unenrollStudent,
  updateCohort,
  updateCohortMembers,
  updateStudent,
  enrollStudents,
} from '../server/all'
import type {
  AddTagInput,
  BadgeAwardInput,
  BroadcastInput,
  CreateStudentInput,
  BadgeSaveInput,
  BadgeStatusChangeInput,
  BulkApproveInput,
  CohortCreateInput,
  CohortMembersUpdateInput,
  CohortPublicIdInput,
  CohortUpdateWithIdInput,
  PromoteWaitlistInput,
  RequestDecisionInput,
  RuleRunInput,
  RuleSaveInput,
  RuleStatusChangeInput,
  SendMessageInput,
  StudentStatusInput,
  UpdateStudentInput,
  UnenrollInput,
  BulkEnrollInput,
} from '../schemas/students.schema'
import { studentsQueryKeys } from './students.queries'

/**
 * Mutation hooks for the Students feature. Every mutation funnels through a
 * shared wrapper that invalidates the given keys, toasts success, and strips
 * server error codes (`CODE: message`) — matching the courses/library
 * conventions. Optimistic updates are limited to read-state changes
 * (messaging) where rollback is trivial.
 */

function stripErrorCode(message: string): string {
  return message.replace(/^[A-Z_]+:\s*/, '')
}

export function useStudentsMutation<TInput, TOutput>(options: {
  mutationFn: (input: TInput) => Promise<TOutput>
  invalidate: QueryKey[]
  successToast?: string
  onSuccess?: (output: TOutput, input: TInput) => void
  onSettled?: () => void
}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: (output, input) => {
      options.invalidate.forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key })
      })
      if (options.successToast) toast.success(options.successToast)
      options.onSuccess?.(output, input)
    },
    onError: (cause) => {
      toast.error(
        cause instanceof Error ? stripErrorCode(cause.message) : 'Something went wrong. Retry?',
      )
    },
    onSettled: () => options.onSettled?.(),
  })
}

// ── Directory (S-4.1) ───────────────────────────────────────────────────

export function useCreateStudent() {
  return useStudentsMutation<CreateStudentInput & { note?: string }, { id: string }>({
    mutationFn: (input) => createStudent({ data: input }),
    invalidate: [['students']],
    successToast: 'Invite created — the student can now sign in with Google or Telegram.',
  })
}

export function useUpdateStudent() {
  return useStudentsMutation<UpdateStudentInput, { ok: boolean }>({
    mutationFn: (input) => updateStudent({ data: input }),
    invalidate: [['students']],
    successToast: 'Student updated.',
  })
}

export function useSetStudentStatus() {
  return useStudentsMutation<StudentStatusInput, { ok: boolean }>({
    mutationFn: (input) => setStudentStatus({ data: input }),
    invalidate: [['students']],
    successToast: 'Status updated.',
  })
}

export function useEnrollStudents() {
  return useStudentsMutation<BulkEnrollInput, { enrolled: number; skipped: number }>({
    mutationFn: (input) => enrollStudents({ data: input }),
    invalidate: [['students']],
    onSuccess: (output) => {
      toast.success(
        output.skipped > 0
          ? `Enrolled ${output.enrolled} — ${output.skipped} skipped (already enrolled).`
          : `Enrolled ${output.enrolled} ${output.enrolled === 1 ? 'student' : 'students'}.`,
      )
    },
  })
}

export function useUnenrollStudent() {
  return useStudentsMutation<UnenrollInput, { ok: boolean }>({
    mutationFn: (input) => unenrollStudent({ data: input }),
    invalidate: [['students']],
    successToast: 'Enrollment removed.',
  })
}

export function useAddStudentTag() {
  return useStudentsMutation<AddTagInput, { ok: boolean }>({
    mutationFn: (input) => addStudentTag({ data: input }),
    invalidate: [
      ['students', 'profile'],
      ['students', 'reference'],
    ],
    successToast: 'Tag added.',
  })
}

export function useRemoveStudentTag() {
  return useStudentsMutation<AddTagInput, { ok: boolean }>({
    mutationFn: (input) => removeStudentTag({ data: input }),
    invalidate: [
      ['students', 'profile'],
      ['students', 'reference'],
    ],
  })
}

// ── Cohorts (S-4.4) ─────────────────────────────────────────────────────

export function useCreateCohort() {
  return useStudentsMutation<CohortCreateInput, { publicId: string }>({
    mutationFn: (input) => createCohort({ data: input }),
    invalidate: [['students', 'cohorts'], studentsQueryKeys.tags()],
    successToast: 'Cohort created.',
  })
}

export function useUpdateCohort() {
  return useStudentsMutation<CohortUpdateWithIdInput, { ok: boolean }>({
    mutationFn: (input) => updateCohort({ data: input }),
    invalidate: [
      ['students', 'cohorts'],
      ['students', 'cohort-members'],
    ],
    successToast: 'Cohort updated.',
  })
}

export function useDeleteCohort() {
  return useStudentsMutation<CohortPublicIdInput, { ok: boolean }>({
    mutationFn: (input) => deleteCohort({ data: input }),
    invalidate: [['students', 'cohorts']],
    successToast: 'Cohort deleted.',
  })
}

export function useUpdateCohortMembers() {
  return useStudentsMutation<CohortMembersUpdateInput, { added: number; removed: number }>({
    mutationFn: (input) => updateCohortMembers({ data: input }),
    invalidate: [
      ['students', 'cohorts'],
      ['students', 'cohort-members'],
    ],
    successToast: 'Cohort membership updated.',
  })
}

// ── Messaging (S-4.5) ───────────────────────────────────────────────────

export function useSendMessage() {
  return useStudentsMutation<SendMessageInput, { threadPublicId: string; messagePublicId: string }>(
    {
      mutationFn: (input) => sendMessage({ data: input }),
      invalidate: [
        ['students', 'threads'],
        ['students', 'thread-messages'],
        ['students', 'student-threads'],
      ],
    },
  )
}

export function useBroadcastMessage() {
  return useStudentsMutation<BroadcastInput, { created: number; broadcastGroupId: string }>({
    mutationFn: (input) => broadcastMessage({ data: input }),
    invalidate: [['students', 'threads']],
    onSuccess: (output) => {
      toast.success(`Message sent to ${output.created} students.`)
    },
  })
}

/** Optimistically clears the unread dot; rollback restores the counter. */
export function useMarkThreadRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { threadPublicId: string }) => markThreadRead({ data: input }),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ['students', 'threads'] })
      const snapshots = queryClient.getQueriesData<{
        items: Array<{ publicId: string; unreadStaffCount: number }>
      }>({
        queryKey: ['students', 'threads'],
      })
      for (const [key, value] of snapshots) {
        if (!value) continue
        queryClient.setQueryData(key, {
          ...value,
          items: value.items.map((thread) =>
            thread.publicId === input.threadPublicId ? { ...thread, unreadStaffCount: 0 } : thread,
          ),
        })
      }
      return { snapshots }
    },
    onError: (_cause, _input, context) => {
      context?.snapshots.forEach(([key, value]) => queryClient.setQueryData(key, value))
      toast.error('Could not mark the thread as read. Retry?')
    },
  })
}

// ── Requests / waitlist (S-4.6) ─────────────────────────────────────────

export function useApproveRequest() {
  return useStudentsMutation<RequestDecisionInput, { ok: boolean }>({
    mutationFn: (input) => approveRequest({ data: input }),
    invalidate: [['students', 'requests'], ['students', 'waitlist'], ['students']],
    successToast: 'Request approved — student enrolled.',
  })
}

export function useDenyRequest() {
  return useStudentsMutation<RequestDecisionInput, { ok: boolean }>({
    mutationFn: (input) => denyRequest({ data: input }),
    invalidate: [['students', 'requests']],
    successToast: 'Request denied.',
  })
}

export function useBulkApproveRequests() {
  return useStudentsMutation<BulkApproveInput, { approved: number; failed: number }>({
    mutationFn: (input) => bulkApproveRequests({ data: input }),
    invalidate: [['students', 'requests'], ['students', 'waitlist'], ['students']],
    onSuccess: (output) => {
      toast.success(
        output.failed > 0
          ? `Approved ${output.approved} — ${output.failed} could not be processed.`
          : `Approved ${output.approved} requests.`,
      )
    },
  })
}

export function usePromoteFromWaitlist() {
  return useStudentsMutation<PromoteWaitlistInput, { promoted: { studentName: string } | null }>({
    mutationFn: (input) => promoteFromWaitlist({ data: input }),
    invalidate: [['students', 'waitlist'], ['students']],
    onSuccess: (output) => {
      if (output.promoted) {
        toast.success(`${output.promoted.studentName} was promoted from the waitlist.`)
      } else {
        toast.info('No students are waiting on this course.')
      }
    },
  })
}

// ── Badges (S-4.7) ──────────────────────────────────────────────────────

export function useSaveBadge() {
  return useStudentsMutation<BadgeSaveInput, { publicId: string; created: boolean }>({
    mutationFn: (input) => saveBadge({ data: input }),
    invalidate: [
      ['students', 'badges'],
      ['students', 'badge-history'],
    ],
    onSuccess: (output) => {
      toast.success(output.created ? 'Badge created.' : 'Badge updated.')
    },
  })
}

export function useSetBadgeStatus() {
  return useStudentsMutation<BadgeStatusChangeInput, { ok: boolean }>({
    mutationFn: (input) => setBadgeStatus({ data: input }),
    invalidate: [['students', 'badges']],
    successToast: 'Badge updated.',
  })
}

export function useEvaluateBadges() {
  return useStudentsMutation<void, { evaluated: number; awarded: number }>({
    mutationFn: () => evaluateBadges(),
    invalidate: [
      ['students', 'badges'],
      ['students', 'badge-history'],
    ],
    onSuccess: (output) => {
      toast.success(
        `Evaluated ${output.evaluated} trigger${output.evaluated === 1 ? '' : 's'} — ${output.awarded} badge${output.awarded === 1 ? '' : 's'} awarded.`,
      )
    },
  })
}

export function useAwardBadge() {
  return useStudentsMutation<BadgeAwardInput, { awarded: number }>({
    mutationFn: (input) => awardBadge({ data: input }),
    invalidate: [['students', 'badges'], ['students', 'badge-history'], ['students']],
    onSuccess: (output) => {
      toast.success(
        output.awarded > 0
          ? `Badge awarded to ${output.awarded} ${output.awarded === 1 ? 'student' : 'students'}.`
          : 'No new awards (some students already hold this badge).',
      )
    },
  })
}

// ── Rules (S-4.8) ───────────────────────────────────────────────────────

export function useSaveRule() {
  return useStudentsMutation<RuleSaveInput, { publicId: string }>({
    mutationFn: (input) => saveRule({ data: input }),
    invalidate: [['students', 'rules']],
    successToast: 'Rule saved.',
  })
}

export function useSetRuleStatus() {
  return useStudentsMutation<RuleStatusChangeInput, { ok: boolean }>({
    mutationFn: (input) => setRuleStatus({ data: input }),
    invalidate: [['students', 'rules']],
    successToast: 'Rule updated.',
  })
}

export function useDeleteRule() {
  return useStudentsMutation<RuleRunInput, { ok: boolean }>({
    mutationFn: (input) => deleteRule({ data: input }),
    invalidate: [['students', 'rules']],
    successToast: 'Rule deleted.',
  })
}

export function useDuplicateRule() {
  return useStudentsMutation<RuleRunInput, { publicId: string }>({
    mutationFn: (input) => duplicateRule({ data: input }),
    invalidate: [['students', 'rules']],
    successToast: 'Rule duplicated as a draft.',
  })
}

export function useRunRule() {
  return useStudentsMutation<
    RuleRunInput,
    { matched: number; enrolled: number; skipped: number; failed: number }
  >({
    mutationFn: (input) => runRule({ data: input }),
    invalidate: [
      ['students', 'rules'],
      ['students', 'rule-runs'],
    ],
    onSuccess: (output) => {
      toast.success(
        `Run finished: ${output.enrolled} enrolled, ${output.skipped} skipped, ${output.failed} failed.`,
      )
    },
  })
}

/** Live student search shared by pickers (badges manual award, cohorts). */
export function useStudentSearch(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ['students', 'search', q] as const,
    queryFn: async () => {
      const { listCohortCandidateStudents } = await import('../server/all')
      return listCohortCandidateStudents({ data: q })
    },
    enabled,
    staleTime: 30_000,
  })
}
