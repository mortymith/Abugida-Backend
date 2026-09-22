import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { completeTour, getTourState } from '../server/onboarding.tour'
import { REPLAY_TOUR_EVENT, TOUR_STEPS } from '../onboarding.steps'

const AUTO_LAUNCH_DELAY_MS = 800
const tourQueryKey = ['onboarding', 'tour'] as const

/**
 * S-7.6 Onboarding Tour controller (spec 09).
 *
 * Auto-launches once for users who never completed/skipped the tour
 * ("first login only"), supports replay from Help & Support via the
 * replay event, and records completion (`tour_completed_at`) on finish
 * or skip so it does not auto-launch again.
 */
export function useOnboardingTour() {
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const autoLaunched = useRef(false)

  const state = useQuery({
    queryKey: tourQueryKey,
    queryFn: getTourState,
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
  })

  const markCompleted = useMutation({
    mutationFn: completeTour,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: tourQueryKey })
    },
  })

  // Auto-launch: first session for a user who never finished the tour.
  useEffect(() => {
    if (autoLaunched.current) return
    if (!state.isSuccess) return
    if (state.data.tourCompleted) {
      autoLaunched.current = true
      return
    }
    autoLaunched.current = true
    const timer = setTimeout(() => {
      setStepIndex(0)
      setOpen(true)
    }, AUTO_LAUNCH_DELAY_MS)
    return () => clearTimeout(timer)
  }, [state.isSuccess, state.data])

  // Replay from Help & Support (S-7.4): always allowed, starts at step 1.
  useEffect(() => {
    const handleReplay = () => {
      setStepIndex(0)
      setOpen(true)
    }
    window.addEventListener(REPLAY_TOUR_EVENT, handleReplay)
    return () => window.removeEventListener(REPLAY_TOUR_EVENT, handleReplay)
  }, [])

  const finish = useCallback(() => {
    setOpen(false)
    // Fire-and-forget: a failed write must not trap the user in the tour.
    markCompleted.mutate()
  }, [markCompleted])

  const goNext = useCallback(() => {
    setStepIndex((current) => {
      if (current >= TOUR_STEPS.length - 1) {
        finish()
        return current
      }
      return current + 1
    })
  }, [finish])

  const goBack = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1))
  }, [])

  const skip = useCallback(() => {
    finish()
  }, [finish])

  const start = useCallback(() => {
    setStepIndex(0)
    setOpen(true)
  }, [])

  return {
    open,
    stepIndex,
    step: TOUR_STEPS[stepIndex],
    totalSteps: TOUR_STEPS.length,
    isCompleted: state.data?.tourCompleted ?? false,
    isLoading: state.isPending,
    goNext,
    goBack,
    skip,
    start,
  }
}
