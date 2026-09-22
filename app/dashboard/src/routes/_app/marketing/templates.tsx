import { createFileRoute } from '@tanstack/react-router'
import { TemplatesView } from '#/features/marketing'

/** S-8.2 Email Templates — list with the pre-built library. */
export const Route = createFileRoute('/_app/marketing/templates')({
  component: TemplatesView,
})
