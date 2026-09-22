import { createServerFn } from '@tanstack/react-start'
import { supportTicketSchema } from '../schemas/support.schema'

/**
 * Client-safe S-7.4 support server functions. The impl is dynamically
 * imported so server-only code never enters the client bundle.
 */
export const submitSupportTicket = createServerFn({ method: 'POST' })
  .validator((input: unknown) => supportTicketSchema.parse(input))
  .handler(async ({ data }): Promise<{ publicId: string }> => {
    const { submitSupportTicketImpl } = await import('./support.ticket.impl.server')
    return submitSupportTicketImpl(data)
  })
