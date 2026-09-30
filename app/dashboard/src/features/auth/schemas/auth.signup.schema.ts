import { z } from 'zod'

/**
 * S-0.2 sign-up schemas.
 *
 * `PrimaryUseCase` is the one field with downstream meaning: it decides whether
 * the Getting Started Checklist shows a payment task at all. The options are
 * the spec's three; see `onboarding.checklist.ts` for what each one implies.
 */
export const SignupWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Workspace name must be at least 2 characters')
    .max(80, 'Workspace name must be 80 characters or fewer'),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(63, 'Subdomain must be at most 63 characters')
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
      'Subdomain can only contain lowercase letters, numbers, and hyphens',
    ),
  useCase: z.enum(['sell_courses', 'run_courses', 'train_employees'], {
    error: 'Select a primary use case to continue.',
  }),
})

export type SignupWorkspaceInput = z.infer<typeof SignupWorkspaceSchema>

/** Derive a subdomain from a workspace name, until the user edits it. */
export function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}

export const MfaCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
})

export type MfaCodeInput = z.infer<typeof MfaCodeSchema>

export const BackupCodeSchema = z.object({
  code: z.string().min(1, 'Backup code is required'),
})

export type BackupCodeInput = z.infer<typeof BackupCodeSchema>
