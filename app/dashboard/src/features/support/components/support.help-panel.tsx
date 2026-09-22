import { useMemo, useState } from 'react'
import { useLocation } from '@tanstack/react-router'
import { useMutation } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { Search01Icon, ArrowRight01Icon, Cancel01Icon } from '@hugeicons/core-free-icons'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { Spinner } from '#/components/ui/spinner'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '#/components/ui/sheet'
import { toast } from '#/components/common/toast'
import { submitSupportTicket } from '../server/support.ticket'
import { supportTicketSchema } from '../schemas/support.schema'
import type { SupportTicketInput } from '../schemas/support.schema'
import { replayTour } from '#/features/onboarding'
import {
  HELP_ARTICLES,
  moduleForPath,
  popularArticlesForModule,
  searchHelpArticles,
} from '../support.kb'
import type { HelpArticle } from '../support.kb'

type PanelView = 'browse' | 'article' | 'contact'

/**
 * S-7.4 Help & Support slide-over (spec 09): searchable knowledge base with
 * module-aware popular articles, inline article reading, and a contact-
 * support form that submits a ticket with the current screen attached.
 * Opened from the "?" trigger available on every screen (S-A.1).
 */
export function HelpPanel({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const location = useLocation()
  const currentModule = moduleForPath(location.pathname)

  const [query, setQuery] = useState('')
  const [view, setView] = useState<PanelView>('browse')
  const [openArticle, setOpenArticle] = useState<HelpArticle | null>(null)
  const [form, setForm] = useState<Pick<SupportTicketInput, 'category' | 'subject' | 'message'>>({
    category: 'question',
    subject: '',
    message: '',
  })
  const [validationError, setValidationError] = useState<string | null>(null)

  const results = useMemo(() => searchHelpArticles(query), [query])
  const popular = useMemo(() => popularArticlesForModule(currentModule), [currentModule])

  const submit = useMutation({
    mutationFn: async (input: SupportTicketInput) => {
      return submitSupportTicket({ data: input })
    },
    onSuccess: () => {
      // Spec S-7.4 "Ticket Submitted" state.
      toast.success("We'll get back to you within one business day.")
      setForm({ category: 'question', subject: '', message: '' })
      setView('browse')
      onOpenChange(false)
    },
    onError: (cause) => {
      toast.error(cause instanceof Error ? cause.message : 'Could not send the ticket. Retry?', {
        action: { label: 'Retry', onClick: () => submit.mutate(submitTicketInput()) },
      })
    },
  })

  function submitTicketInput(): SupportTicketInput {
    return {
      category: form.category,
      subject: form.subject,
      message: form.message,
      currentScreen: location.pathname,
    }
  }

  function handleContactSubmit() {
    const parsed = supportTicketSchema.safeParse({
      category: form.category,
      subject: form.subject,
      message: form.message,
      currentScreen: location.pathname,
    })
    if (!parsed.success) {
      setValidationError(parsed.error.issues[0]?.message ?? 'Check the highlighted fields.')
      return
    }
    setValidationError(null)
    submit.mutate(parsed.data)
  }

  function resetToBrowse() {
    setView('browse')
    setOpenArticle(null)
    setValidationError(null)
  }

  const listArticles = query.trim() ? results : popular

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) resetToBrowse()
        onOpenChange(next)
      }}
    >
      <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Help &amp; Support</SheetTitle>
          <SheetDescription>
            Search help articles or contact support with your current screen attached.
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pb-4">
          {view === 'contact' ? (
            <form
              className="flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault()
                handleContactSubmit()
              }}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Contact Support</h3>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={resetToBrowse}
                  aria-label="Back to help articles"
                >
                  <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
                </Button>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="help-category">Category</Label>
                <select
                  id="help-category"
                  className="h-9 w-full rounded-lg border bg-input/30 px-3 text-sm"
                  value={form.category}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      category: event.target.value as SupportTicketInput['category'],
                    }))
                  }
                >
                  <option value="question">Question</option>
                  <option value="bug">Something is broken</option>
                  <option value="billing">Billing</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="help-subject">Subject</Label>
                <Input
                  id="help-subject"
                  value={form.subject}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, subject: event.target.value }))
                  }
                  placeholder="What do you need help with?"
                  aria-invalid={Boolean(validationError)}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="help-message">Message</Label>
                <Textarea
                  id="help-message"
                  value={form.message}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, message: event.target.value }))
                  }
                  placeholder="Describe what happened and what you expected."
                  rows={5}
                  aria-invalid={Boolean(validationError)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Submitting from <span className="font-mono">{location.pathname}</span> — attached
                automatically so support has context.
              </p>
              {validationError ? (
                <p className="text-destructive text-sm" role="alert">
                  {validationError}
                </p>
              ) : null}
              <Button type="submit" disabled={submit.isPending}>
                {submit.isPending ? <Spinner className="size-4" /> : null}
                Submit ticket
              </Button>
            </form>
          ) : (
            <>
              {view === 'article' && openArticle ? (
                <article className="flex flex-col gap-2" aria-live="polite">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-start px-2"
                    onClick={resetToBrowse}
                  >
                    ← Back to help
                  </Button>
                  <h3 className="text-base font-semibold">{openArticle.title}</h3>
                  <p className="text-sm text-muted-foreground">{openArticle.summary}</p>
                  <p className="text-sm leading-relaxed">{openArticle.body}</p>
                </article>
              ) : (
                <>
                  <div className="relative">
                    <HugeiconsIcon
                      icon={Search01Icon}
                      strokeWidth={2}
                      className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                    />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search help articles…"
                      className="pl-9"
                      aria-label="Search help articles"
                    />
                  </div>

                  <section className="flex flex-col gap-2" aria-label="Help articles">
                    <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      {query.trim() ? 'Matches' : `Popular · ${currentModule}`}
                    </h3>
                    {listArticles.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No matching articles. Try a different term or contact support.
                      </p>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {listArticles.map((article) => (
                          <li key={article.id}>
                            <Button
                              variant="ghost"
                              className="h-auto w-full justify-start gap-2 px-2 py-2 text-left"
                              onClick={() => {
                                setOpenArticle(article)
                                setView('article')
                              }}
                            >
                              <span className="flex-1">
                                <span className="block text-sm font-medium">{article.title}</span>
                                <span className="block text-xs text-muted-foreground">
                                  {article.summary}
                                </span>
                              </span>
                              <HugeiconsIcon
                                icon={ArrowRight01Icon}
                                strokeWidth={2}
                                className="size-4 shrink-0 text-muted-foreground"
                              />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>

                  <section className="mt-auto flex flex-col gap-2 border-t pt-4">
                    <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                      Still stuck?
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button size="sm" onClick={() => setView('contact')}>
                        Contact Support
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setOpenArticle(HELP_ARTICLES[0] ?? null)
                          setView('article')
                        }}
                      >
                        Getting-started guide
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          onOpenChange(false)
                          replayTour()
                        }}
                      >
                        Replay the product tour
                      </Button>
                    </div>
                  </section>
                </>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
