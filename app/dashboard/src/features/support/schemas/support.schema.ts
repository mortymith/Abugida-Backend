import { z } from 'zod'

/** S-7.4 Contact-support form (writes `support_tickets`, spec 09). */
export const supportTicketSchema = z.object({
  category: z.enum(['question', 'bug', 'billing', 'other']).default('question'),
  subject: z
    .string()
    .trim()
    .min(3, 'Add a short subject (at least 3 characters)')
    .max(200, 'Keep the subject under 200 characters'),
  message: z
    .string()
    .trim()
    .min(10, 'Describe the issue in at least 10 characters')
    .max(5000, 'Keep the message under 5000 characters'),
  /** Screen the reporter was on (auto-attached, never user-edited). */
  currentScreen: z.string().trim().max(300).nullish(),
})

export type SupportTicketInput = z.infer<typeof supportTicketSchema>
