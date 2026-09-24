import { z } from 'zod'

export const WorkspaceSchema = z.object({
  name: z.string().min(2, 'Workspace name must be at least 2 characters'),
  slug: z
    .string()
    .min(3, 'Subdomain must be at least 3 characters')
    .max(63, 'Subdomain must be at most 63 characters')
    .regex(
      /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/,
      'Subdomain can only contain lowercase letters, numbers, and hyphens',
    ),
  useCase: z.enum(['language_courses', 'corporate_training', 'other'], {
    error: 'Select a primary use case to continue.',
  }),
})

export type WorkspaceInput = z.infer<typeof WorkspaceSchema>

export const MfaCodeSchema = z.object({
  code: z.string().length(6, 'Code must be exactly 6 digits').regex(/^\d+$/, 'Code must be digits'),
})

export type MfaCodeInput = z.infer<typeof MfaCodeSchema>

export const BackupCodeSchema = z.object({
  code: z.string().min(1, 'Backup code is required'),
})

export type BackupCodeInput = z.infer<typeof BackupCodeSchema>
