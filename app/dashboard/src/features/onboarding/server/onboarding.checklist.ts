import { createServerFn } from '@tanstack/react-start'

/**
 * Client-safe S-0.2 checklist server function. The impl is dynamically imported
 * so server-only code never enters the client bundle.
 */
export const getChecklist = createServerFn({ method: 'GET' }).handler(async () => {
  const { getChecklistImpl } = await import('./onboarding.checklist.impl.server')
  return getChecklistImpl()
})
