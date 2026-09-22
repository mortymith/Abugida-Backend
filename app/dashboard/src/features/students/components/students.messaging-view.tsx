import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Loader2Icon, MegaphoneIcon, SearchIcon, SendIcon } from 'lucide-react'
import { useRole } from '#/features/auth'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { Button } from '#/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Skeleton } from '#/components/ui/skeleton'
import { Textarea } from '#/components/ui/textarea'
import { cn } from '#/lib/utils'
import {
  cohortsQueryOptions,
  studentProfileQueryOptions,
  threadMessagesQueryOptions,
  threadsQueryOptions,
} from '../hooks/students.queries'
import { useBroadcastMessage, useMarkThreadRead, useSendMessage } from '../hooks/students.mutations'
import { previewBroadcast } from '../server/all'
import type { MessageItem, MessageThreadItem } from '../students.types'

/**
 * S-4.5 Messaging Center: threaded conversations with unread indicators,
 * optimistic reply sending, and broadcast composition to a cohort.
 * Accessible to admin + support only (spec 11).
 */
export function StudentsMessagingView({
  query,
  initialStudentId,
  initialCohortPublicId,
}: {
  query: { q?: string; filter?: string; page?: number }
  initialStudentId?: string
  initialCohortPublicId?: string
}) {
  const role = useRole()
  const canMessage = role === 'admin' || role === 'support'
  const navigate = useNavigate()

  const [thread, setThread] = useState<MessageThreadItem | null>(null)
  const [broadcastOpen, setBroadcastOpen] = useState(false)
  const [searchDraft, setSearchDraft] = useState(query.q ?? '')

  const threadsQuery = useQuery({
    ...threadsQueryOptions({
      q: query.q,
      filter: query.filter === 'unread' || query.filter === 'broadcast' ? query.filter : undefined,
      page: query.page,
    }),
    enabled: canMessage,
  })

  const patchSearch = (patch: { q?: string; filter?: string }) => {
    void navigate({
      to: '/students/messaging',
      search: {
        q: patch.q ?? query.q,
        filter: (patch.filter ?? query.filter) as 'all' | 'unread' | 'broadcast' | undefined,
        student: initialStudentId,
        page: undefined,
      },
    })
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if ((searchDraft.trim() || undefined) !== (query.q ?? undefined)) {
        patchSearch({ q: searchDraft.trim() || undefined })
      }
      return undefined
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchDraft])

  // Deep-link from a profile: open the student's most recent thread.
  const items = threadsQuery.data?.items ?? []
  useEffect(() => {
    if (initialStudentId && thread == null && items.length > 0) {
      const match = items.find((item) => item.studentId === initialStudentId)
      if (match) setThread(match)
    }
  }, [initialStudentId, thread, items])

  if (!canMessage) {
    return (
      <EmptyState
        variant="standard"
        title="Messaging is available to Admin and Support roles"
        description="Ask an administrator if you need access to student conversations."
      />
    )
  }

  const activeFilter = query.filter ?? 'all'

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Messaging</h1>
          <p className="text-sm text-muted-foreground">
            Reply to student threads or broadcast an announcement to a cohort.
          </p>
        </div>
        <Button variant="outline" onClick={() => setBroadcastOpen(true)}>
          <MegaphoneIcon aria-hidden /> New Broadcast
        </Button>
      </div>

      <div className="flex w-full flex-col gap-4 lg:flex-row">
        {/* Thread list */}
        <div className="flex min-h-[60vh] w-full flex-col rounded-lg border lg:max-w-sm">
          <div className="border-b p-3">
            <div className="relative">
              <SearchIcon
                aria-hidden
                className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search students…"
                aria-label="Search threads"
                className="pl-8"
              />
            </div>
            <div className="mt-2 flex gap-1" role="tablist" aria-label="Thread filters">
              {(['all', 'unread', 'broadcast'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  role="tab"
                  aria-selected={activeFilter === filter}
                  onClick={() => patchSearch({ filter: filter === 'all' ? undefined : filter })}
                  className={cn(
                    'rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors',
                    activeFilter === filter
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {threadsQuery.isPending ? (
              <div className="p-3" role="status" aria-label="Loading threads">
                {Array.from({ length: 6 }).map((_, index) => (
                  <Skeleton key={index} className="mb-2 h-14 w-full" />
                ))}
              </div>
            ) : threadsQuery.isError ? (
              <RetryErrorState
                title="Unable to load threads"
                description="Retry?"
                onRetry={() => void threadsQuery.refetch()}
                isRetrying={threadsQuery.isFetching}
              />
            ) : items.length === 0 ? (
              <EmptyState
                variant="standard"
                title="No conversations yet"
                description="Threads start when you message a student from their profile or broadcast to a cohort."
              />
            ) : (
              <ul role="list">
                {items.map((item) => (
                  <li key={item.publicId}>
                    <button
                      type="button"
                      onClick={() => setThread(item)}
                      aria-current={thread?.publicId === item.publicId ? 'true' : undefined}
                      className={cn(
                        'flex w-full items-start justify-between gap-2 border-b px-3 py-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        thread?.publicId === item.publicId && 'bg-muted',
                      )}
                    >
                      <span className="min-w-0">
                        <span
                          className={cn(
                            'block truncate text-sm',
                            item.unreadStaffCount > 0 ? 'font-bold' : 'font-medium',
                          )}
                        >
                          {item.kind === 'broadcast' && (
                            <span className="mr-1" aria-label="broadcast thread">
                              📣
                            </span>
                          )}
                          {item.studentName}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.lastMessagePreview ?? item.subject ?? ''}
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <time className="text-[10px] text-muted-foreground">
                          {relativeDay(item.lastMessageAt)}
                        </time>
                        {item.unreadStaffCount > 0 && (
                          <span
                            aria-label={`${item.unreadStaffCount} unread`}
                            className="size-2 rounded-full bg-primary"
                          />
                        )}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Conversation pane */}
        <div className="flex min-h-[60vh] w-full flex-1 flex-col rounded-lg border">
          {thread == null ? (
            initialStudentId != null ? (
              <StartThreadPane
                studentId={initialStudentId}
                onStarted={(created) => {
                  setThread({
                    publicId: created,
                    studentId: initialStudentId,
                    studentName: '',
                    studentEmail: '',
                    kind: 'direct',
                    subject: null,
                    lastMessageAt: new Date().toISOString(),
                    lastMessagePreview: null,
                    unreadStaffCount: 0,
                  })
                  void navigate({ to: '/students/messaging', search: {} })
                }}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
                Select a thread to read the conversation.
              </div>
            )
          ) : (
            <ThreadPane
              key={thread.publicId}
              thread={thread}
              onThreadOpened={(updated) => setThread(updated)}
            />
          )}
        </div>
      </div>

      <StudentsBroadcastDialog
        open={broadcastOpen}
        onOpenChange={setBroadcastOpen}
        initialCohortPublicId={initialCohortPublicId}
      />
    </div>
  )
}

function relativeDay(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return '1d'
  if (days < 7) return `${days}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Starts a first conversation with a student (profile deep link). */
function StartThreadPane({
  studentId,
  onStarted,
}: {
  studentId: string
  onStarted: (threadPublicId: string) => void
}) {
  const profileQuery = useQuery(studentProfileQueryOptions({ studentId }))
  const sendMutation = useSendMessage()
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  const send = () => {
    const message = body.trim()
    if (!message) return
    sendMutation.mutate(
      { studentId, subject: subject.trim() || null, body: message, attachments: [] },
      { onSuccess: (result) => onStarted(result.threadPublicId) },
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-4 py-3">
        <p className="font-semibold">{profileQuery.data?.name ?? 'New conversation'}</p>
        <p className="text-xs text-muted-foreground">{profileQuery.data?.email ?? ''}</p>
      </div>
      <div className="flex flex-1 flex-col justify-center gap-3 p-4">
        <p className="text-sm text-muted-foreground">
          No conversation with this student yet — start one.
        </p>
        <Input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Subject (optional)"
          aria-label="Subject"
        />
        <Textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
              event.preventDefault()
              send()
            }
          }}
          placeholder="Write the first message… (⌘+Enter to send)"
          aria-label="First message"
          rows={5}
        />
        <Button className="w-fit" disabled={!body.trim() || sendMutation.isPending} onClick={send}>
          <SendIcon aria-hidden /> Send
        </Button>
      </div>
    </div>
  )
}

/** One conversation: messages + optimistic reply composer. */
function ThreadPane({
  thread,
  onThreadOpened,
}: {
  thread: MessageThreadItem
  onThreadOpened: (thread: MessageThreadItem) => void
}) {
  const messagesQuery = useQuery(threadMessagesQueryOptions({ threadPublicId: thread.publicId }))
  const markRead = useMarkThreadRead()
  const sendMutation = useSendMessage()
  const [draft, setDraft] = useState('')
  const [pendingMessage, setPendingMessage] = useState<{ id: string; body: string } | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const messages = useMemo(() => {
    const rows = messagesQuery.data?.items ?? []
    return [...rows].reverse()
  }, [messagesQuery.data])

  useEffect(() => {
    // Opening a thread clears its unread dot (optimistic + server).
    if (thread.unreadStaffCount > 0) {
      markRead.mutate({ threadPublicId: thread.publicId })
      onThreadOpened({ ...thread, unreadStaffCount: 0 })
    }
  }, [thread.publicId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, pendingMessage])

  const send = () => {
    const body = draft.trim()
    if (!body) return
    const optimisticId = `pending-${Date.now()}`
    setPendingMessage({ id: optimisticId, body })
    setDraft('')
    sendMutation.mutate(
      { threadPublicId: thread.publicId, body, attachments: [] },
      {
        onSuccess: () => setPendingMessage(null),
        onError: () => {
          setPendingMessage(null)
          setDraft(body)
        },
      },
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b px-4 py-3">
        <p className="font-semibold">{thread.studentName}</p>
        <p className="text-xs text-muted-foreground">
          {thread.studentEmail}
          {thread.subject ? ` · ${thread.subject}` : ''}
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {messagesQuery.isPending ? (
          <div role="status" aria-label="Loading messages">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="mb-2 h-12 w-2/3" />
            ))}
          </div>
        ) : messagesQuery.isError ? (
          <RetryErrorState
            title="Unable to load messages"
            description="Retry?"
            onRetry={() => void messagesQuery.refetch()}
            isRetrying={messagesQuery.isFetching}
          />
        ) : messages.length === 0 && pendingMessage == null ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No messages yet — say hello!
          </p>
        ) : (
          <>
            {messagesQuery.data.hasNextPage && (
              <p className="text-center text-xs text-muted-foreground">
                Showing the most recent messages.
              </p>
            )}
            {messages.map((message) => (
              <MessageBubble key={message.publicId} message={message} />
            ))}
            {pendingMessage && (
              <div className="flex justify-end">
                <div className="max-w-[75%] rounded-lg rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground opacity-70">
                  {pendingMessage.body}
                  <span className="ml-2 text-xs">sending…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault()
          send()
        }}
      >
        <Textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              send()
            }
          }}
          placeholder="Reply: type a message…"
          aria-label="Reply message"
          rows={2}
          className="min-h-0 flex-1 resize-none"
        />
        <Button
          type="submit"
          size="icon"
          aria-label="Send"
          disabled={!draft.trim() || sendMutation.isPending}
        >
          <SendIcon aria-hidden />
        </Button>
      </form>
    </div>
  )
}

function MessageBubble({ message }: { message: MessageItem }) {
  const isStaff = message.isStaff
  return (
    <div className={cn('flex', isStaff ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-lg px-3.5 py-2 text-sm',
          isStaff
            ? 'rounded-br-sm bg-primary text-primary-foreground'
            : 'rounded-bl-sm border bg-background',
        )}
      >
        <p className="whitespace-pre-wrap">{message.body}</p>
        {message.attachments.length > 0 && (
          <ul className="mt-1.5 space-y-1 border-t border-white/20 pt-1.5 text-xs">
            {message.attachments.map((attachment, index) => (
              <li key={`${message.publicId}-${index}`}>🔗 {attachment.label}</li>
            ))}
          </ul>
        )}
        <time className="mt-1 block text-[10px] opacity-70">
          {new Date(message.createdAt).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </time>
      </div>
    </div>
  )
}

/** Broadcast composition with cohort picker + S-7.1 confirmation. */
function StudentsBroadcastDialog({
  open,
  onOpenChange,
  initialCohortPublicId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialCohortPublicId?: string
}) {
  const [cohortPublicId, setCohortPublicId] = useState(initialCohortPublicId ?? '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [preview, setPreview] = useState<{ recipientCount: number; cohortName: string } | null>(
    null,
  )
  const [previewLoading, setPreviewLoading] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [previewError, setPreviewError] = useState(false)

  const cohortsQuery = useQuery({ ...cohortsQueryOptions({}), enabled: open })
  const broadcastMutation = useBroadcastMessage()

  useEffect(() => {
    if (open) {
      setCohortPublicId(initialCohortPublicId ?? '')
    } else {
      setSubject('')
      setBody('')
      setPreview(null)
      setPreviewError(false)
    }
  }, [open, initialCohortPublicId])

  const reviewRecipients = async () => {
    setPreviewLoading(true)
    setPreviewError(false)
    try {
      const result = await previewBroadcast({ data: { cohortPublicId } })
      setPreview(result)
      setConfirmOpen(true)
    } catch {
      setPreviewError(true)
    } finally {
      setPreviewLoading(false)
    }
  }

  const send = () => {
    if (!preview) return
    broadcastMutation.mutate(
      {
        cohortPublicId,
        subject: subject.trim(),
        body: body.trim(),
        attachments: [],
        confirmedCount: preview.recipientCount,
      },
      {
        onSuccess: () => {
          setConfirmOpen(false)
          onOpenChange(false)
        },
        onError: () => setConfirmOpen(false),
      },
    )
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>New Broadcast</DialogTitle>
            <DialogDescription>
              Each student in the cohort receives their own copy of the message.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void reviewRecipients()
            }}
          >
            <div className="grid gap-2">
              <Label htmlFor="broadcast-cohort">
                Cohort{' '}
                <span aria-hidden className="text-destructive">
                  *
                </span>
              </Label>
              <select
                id="broadcast-cohort"
                value={cohortPublicId}
                onChange={(event) => {
                  setCohortPublicId(event.target.value)
                  setPreview(null)
                }}
                className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                required
              >
                <option value="">Select a cohort…</option>
                {(cohortsQuery.data?.items ?? []).map((cohort) => (
                  <option key={cohort.publicId} value={cohort.publicId}>
                    {cohort.name} ({cohort.memberCount} students)
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="broadcast-subject">
                Subject{' '}
                <span aria-hidden className="text-destructive">
                  *
                </span>
              </Label>
              <Input
                id="broadcast-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Module 2 live session this Friday"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="broadcast-body">
                Message{' '}
                <span aria-hidden className="text-destructive">
                  *
                </span>
              </Label>
              <Textarea
                id="broadcast-body"
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={4}
                required
              />
            </div>
            {previewError && (
              <p role="alert" className="text-sm text-destructive">
                Could not load the recipient list. Retry?
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!cohortPublicId || !subject.trim() || !body.trim() || previewLoading}
              >
                {previewLoading && <Loader2Icon aria-hidden className="size-4 animate-spin" />}
                Review Recipients
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Broadcast confirmation (S-7.1): "Send to N students in …?" */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          preview
            ? `Send to ${preview.recipientCount} students in ${preview.cohortName}?`
            : 'Send broadcast?'
        }
        body="Each student receives an individual copy in their conversation."
        confirmLabel="Send Broadcast"
        onConfirm={send}
      />
    </>
  )
}
