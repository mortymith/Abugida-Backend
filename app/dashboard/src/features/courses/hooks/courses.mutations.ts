import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '#/components/common/toast'
import { courseQueryKeys } from './courses.queries'
import * as serverFns from '../server/all'
import type { QueryKey } from '@tanstack/react-query'

function toMessage(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : 'Something went wrong'
  // Server-fn errors arrive as "Error: CODE: human message" — show the human part.
  const withoutCode = raw.replace(/^[A-Z_]+:\s*/, '')
  return withoutCode || raw
}

/** Standard mutation wrapper: toast on error, optional success toast, invalidation. */
export function useAppMutation<TInput, TOutput>(options: {
  mutationFn: (input: TInput) => Promise<TOutput>
  invalidate: QueryKey[]
  successToast?: string
  onError?: (message: string) => void
}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: async (output) => {
      await Promise.all(
        options.invalidate.map((key) => queryClient.invalidateQueries({ queryKey: key })),
      )
      if (options.successToast) toast.success(options.successToast)
      return output
    },
    onError: (cause) => {
      const message = toMessage(cause)
      if (options.onError) options.onError(message)
      else toast.error(message)
    },
  })
}

/** Re-exported server fns so components import from one place. */
export { serverFns }
export { courseQueryKeys }
