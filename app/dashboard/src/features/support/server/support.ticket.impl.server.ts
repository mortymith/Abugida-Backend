/**
 * Server-only implementation of S-7.4 support tickets (spec 09). Every
 * signed-in role may submit; the row records the submitting user and the
 * screen it was raised from. Never import from client code.
 */
import { supportTickets } from '@abugida/database/ops'
import { db } from '#/config/db.config'
import { getRequest } from '@tanstack/react-start/server'
import { auth } from '#/config/auth.server'
import type { SupportTicketInput } from '../schemas/support.schema'

export interface SubmittedTicket {
  publicId: string
}

export async function submitSupportTicketImpl(input: SupportTicketInput): Promise<SubmittedTicket> {
  const request = getRequest()
  const session = await auth.getSession(request.headers)
  if (!session.ok) throw new Error('UNAUTHORIZED')

  const rows = await db
    .insert(supportTickets)
    .values({
      userId: session.value.user.id,
      category: input.category,
      subject: input.subject,
      message: input.message,
      currentScreen: input.currentScreen ?? null,
      status: 'open',
    })
    .returning({ publicId: supportTickets.publicId })
  const row = rows.at(0)

  if (!row) throw new Error('Could not submit the ticket. Retry?')
  return { publicId: row.publicId }
}
