import { createFileRoute } from '@tanstack/react-router'
import { TemplateEditorView } from '#/features/marketing'

/**
 * S-8.2 Email Template Editor. `new` starts a blank canvas; an existing
 * template public id loads its draft for editing and versioned publish.
 */
export const Route = createFileRoute('/_app/marketing/templates/$templateId')({
  component: TemplateEditorPage,
})

function TemplateEditorPage() {
  const { templateId } = Route.useParams()
  return <TemplateEditorView templateId={templateId} />
}
