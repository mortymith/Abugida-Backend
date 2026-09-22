import { toast as sonnerToast } from 'sonner'

/**
 * S-7.2 Toast policy (spec 09): success auto-dismisses after 5 seconds,
 * warnings and errors require manual dismissal, info uses the library
 * default. Errors/warnings may carry a `[Retry] [Dismiss]` action.
 *
 * The helpers live in one place so features never hardcode durations and
 * the spec behavior cannot drift between screens. They intentionally
 * mirror the `sonner` API shape (message + options) as a drop-in policy.
 */
export type ToastKind = 'success' | 'info' | 'warning' | 'error'

/** Sonner option overrides derived purely from the spec policy. */
export function toastDurationMs(kind: ToastKind): number {
  switch (kind) {
    case 'success':
      return 5000
    case 'info':
      // Spec does not pin info; keep the library default (4s).
      return 4000
    case 'warning':
    case 'error':
      // Manual dismiss required (spec S-7.2).
      return Number.POSITIVE_INFINITY
  }
}

type ToastOptions = Parameters<typeof sonnerToast.success>[1]

function show(
  kind: ToastKind,
  message: string,
  options?: ToastOptions,
): ReturnType<typeof sonnerToast.success> {
  const policy = { duration: toastDurationMs(kind) }
  return sonnerToast[kind](message, { ...policy, ...options })
}

export const toast = {
  success: (message: string, options?: ToastOptions) => show('success', message, options),
  info: (message: string, options?: ToastOptions) => show('info', message, options),
  warning: (message: string, options?: ToastOptions) => show('warning', message, options),
  error: (message: string, options?: ToastOptions) => show('error', message, options),
}
