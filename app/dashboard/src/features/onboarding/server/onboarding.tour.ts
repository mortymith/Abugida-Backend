import { createServerFn } from '@tanstack/react-start'

/**
 * Client-safe S-7.6 tour server functions. Impls are dynamically imported
 * so server-only code never enters the client bundle.
 */
export const getTourState = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ tourCompleted: boolean; completedAt: string | null }> => {
    const { getTourStateImpl } = await import('./onboarding.tour.impl.server')
    return getTourStateImpl()
  },
)

export const completeTour = createServerFn({ method: 'POST' }).handler(async () => {
  const { completeTourImpl } = await import('./onboarding.tour.impl.server')
  return completeTourImpl()
})
