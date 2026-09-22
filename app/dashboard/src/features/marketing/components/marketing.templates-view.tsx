import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { FileEditIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { FileTextIcon, PlusIcon } from 'lucide-react'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { Button, buttonVariants } from '#/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '#/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Skeleton } from '#/components/ui/skeleton'
import { cn } from '#/lib/utils'
import { useRole } from '#/features/auth'
import { templatesQueryOptions } from '../hooks/marketing.queries'
import { useCreateFromPrebuilt } from '../hooks/marketing.mutations'

/**
 * S-8.2 Email Templates: template list with last-updated and usage counts,
 * plus the pre-built library (Welcome, Announcement, Reminder, Promotion,
 * Certificate Issued, Re-engagement) where each entry starts a new copy.
 */
export function TemplatesView() {
  const role = useRole()
  const canWrite = role === 'admin' || role === 'editor'
  const navigate = useNavigate()

  const templatesQuery = useQuery(templatesQueryOptions())
  const createFromPrebuilt = useCreateFromPrebuilt()
  const [libraryOpen, setLibraryOpen] = useState(false)

  const items = templatesQuery.data?.items ?? []

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Email Templates</h1>
          <p className="text-sm text-muted-foreground">
            Pre-built, customizable templates with merge tags, live preview, and versioned
            publishes.
          </p>
        </div>
        {canWrite && (
          <DropdownMenu open={libraryOpen} onOpenChange={setLibraryOpen}>
            <DropdownMenuTrigger
              render={
                <Button>
                  <PlusIcon aria-hidden /> New from pre-built library
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Pre-built library</DropdownMenuLabel>
              {[
                { key: 'welcome', name: 'Welcome' },
                { key: 'announcement', name: 'Course Announcement' },
                { key: 'reminder', name: 'Lesson Reminder' },
                { key: 'promotion', name: 'Promotion' },
                { key: 'certificate_issued', name: 'Certificate Issued' },
                { key: 're_engagement', name: 'Re-engagement' },
              ].map((entry) => (
                <DropdownMenuItem
                  key={entry.key}
                  onSelect={() =>
                    void createFromPrebuilt.mutateAsync({ key: entry.key }).catch(() => undefined)
                  }
                >
                  {entry.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() =>
                  void navigate({
                    to: '/marketing/templates/$templateId',
                    params: { templateId: 'new' },
                  })
                }
              >
                Blank canvas
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {templatesQuery.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-36 w-full" />
          ))}
        </div>
      ) : templatesQuery.isError ? (
        <RetryErrorState onRetry={() => void templatesQuery.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FileTextIcon className="size-10 text-muted-foreground" aria-hidden />}
          title="No templates yet"
          description="Start from a pre-built template — Welcome, Announcement, Reminder, Promotion, Certificate Issued, or Re-engagement."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((template) => (
            <Card key={template.publicId}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <HugeiconsIcon icon={FileEditIcon} size={16} aria-hidden />
                  {template.name}
                </CardTitle>
                <CardDescription className="capitalize">
                  {template.kind.replace(/_/g, ' ')}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="line-clamp-2">{template.subject ?? 'No subject drafted yet'}</p>
              </CardContent>
              <CardFooter className="justify-between text-xs text-muted-foreground">
                <span>
                  v{template.currentVersion} · used by {template.usageCount} campaign
                  {template.usageCount === 1 ? '' : 's'}
                </span>
                {canWrite ? (
                  <Link
                    to="/marketing/templates/$templateId"
                    params={{ templateId: template.publicId }}
                    className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                  >
                    Edit
                  </Link>
                ) : (
                  <Link
                    to="/marketing/templates/$templateId"
                    params={{ templateId: template.publicId }}
                    className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
                  >
                    View
                  </Link>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
