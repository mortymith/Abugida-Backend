import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { PlusSignIcon, Delete02Icon, Cancel01Icon, Copy01Icon } from '@hugeicons/core-free-icons'
import { Badge } from '#/components/ui/badge'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '#/components/ui/table'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { apiKeysQueryOptions, webhooksQueryOptions } from '../hooks/settings.queries'
import {
  useCreateApiKey,
  useDeleteWebhookEndpoint,
  useRevokeApiKey,
  useSaveWebhookEndpoint,
  useSendWebhookTestEvent,
} from '../hooks/settings.mutations'
import { WEBHOOK_EVENT_TYPES } from '../settings.constants'
import type { WebhookEndpointItem } from '../settings.types'
import { toast } from '#/components/common/toast'

/**
 * S-6.7 API & Webhooks — API keys (one-time reveal) and outbound webhook
 * endpoints with real signed test deliveries and delivery logs.
 */

function ApiKeysSection() {
  const query = useQuery(apiKeysQueryOptions())
  const create = useCreateApiKey()
  const revoke = useRevokeApiKey()

  const [createOpen, setCreateOpen] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [nameError, setNameError] = useState<string | null>(null)
  const [created, setCreated] = useState<{ key: string; name: string } | null>(null)
  const [revokeTarget, setRevokeTarget] = useState<{ publicId: string; name: string } | null>(null)

  if (query.isPending) return <Skeleton className="h-56 w-full" />
  if (query.isError) {
    return <RetryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
  }

  const keys = query.data

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>API Keys</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setKeyName('')
            setNameError(null)
            setCreateOpen(true)
          }}
        >
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} /> Generate New Key
        </Button>
      </CardHeader>
      <CardContent>
        {keys.length === 0 ? (
          <EmptyState
            variant="compact"
            title="No API keys yet"
            description="Generate a key to let external systems call the Abugida API."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Key (masked)</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keys.map((apiKey) => (
                  <TableRow key={apiKey.publicId}>
                    <TableCell className="font-medium">{apiKey.name}</TableCell>
                    <TableCell className="font-mono text-xs">{apiKey.maskedKey}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(apiKey.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {apiKey.isActive ? (
                        <Badge className="bg-success/15 text-success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Revoked</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {apiKey.isActive ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setRevokeTarget({ publicId: apiKey.publicId, name: apiKey.name })
                          }
                        >
                          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" />
                          Revoke
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate New Key</DialogTitle>
            <DialogDescription>
              Give the key a name so you can recognize it later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="api-key-name">Key name</Label>
            <Input
              id="api-key-name"
              value={keyName}
              onChange={(event) => setKeyName(event.target.value)}
              placeholder="Zapier"
              autoFocus
            />
            {nameError ? (
              <p className="text-destructive text-sm" role="alert">
                {nameError}
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={keyName.trim() === '' || create.isPending}
              onClick={async () => {
                if (keyName.trim() === '') {
                  setNameError('Name is required')
                  return
                }
                try {
                  const result = await create.mutateAsync({ name: keyName.trim(), scopes: [] })
                  setCreated({ key: result.key, name: result.name })
                  setCreateOpen(false)
                  setKeyName('')
                } catch {
                  /* toast handled by mutation */
                }
              }}
            >
              {create.isPending ? 'Generating…' : 'Generate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={created != null} onOpenChange={(open) => !open && setCreated(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Copy this key now — you won't see it again.</DialogTitle>
            <DialogDescription>
              Key for “{created?.name}”. Store it in a password manager; only a masked prefix is
              kept on the server.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="bg-muted min-w-0 flex-1 overflow-x-auto rounded px-2 py-2 font-mono text-xs">
              {created?.key}
            </code>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Copy key"
              onClick={async () => {
                if (!created) return
                await navigator.clipboard.writeText(created.key)
                toast.success('Key copied to clipboard.')
              }}
            >
              <HugeiconsIcon icon={Copy01Icon} strokeWidth={2} />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreated(null)}>I've Saved It</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={revokeTarget != null}
        onOpenChange={(open) => {
          if (!open) setRevokeTarget(null)
        }}
        title={`Revoke key “${revokeTarget?.name ?? ''}”?`}
        body="Requests signed with this key stop working immediately. This cannot be undone."
        confirmLabel="Revoke Key"
        onConfirm={async () => {
          if (!revokeTarget) return
          await revoke.mutateAsync({ publicId: revokeTarget.publicId })
          setRevokeTarget(null)
        }}
      />
    </Card>
  )
}

function WebhooksSection() {
  const query = useQuery(webhooksQueryOptions())
  const save = useSaveWebhookEndpoint()
  const remove = useDeleteWebhookEndpoint()
  const sendTest = useSendWebhookTestEvent()

  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<WebhookEndpointItem | null>(null)
  const [url, setUrl] = useState('https://')
  const [eventType, setEventType] = useState<string>(WEBHOOK_EVENT_TYPES[0])
  const [urlError, setUrlError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<WebhookEndpointItem | null>(null)
  const [logsFor, setLogsFor] = useState<string | null>(null)

  if (query.isPending) return <Skeleton className="h-56 w-full" />
  if (query.isError) {
    return <RetryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
  }

  const endpoints = query.data

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle>Webhooks</CardTitle>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null)
            setUrl('https://')
            setEventType(WEBHOOK_EVENT_TYPES[0])
            setUrlError(null)
            setEditOpen(true)
          }}
        >
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} /> Add Webhook
        </Button>
      </CardHeader>
      <CardContent>
        {endpoints.length === 0 ? (
          <EmptyState
            variant="compact"
            title="No webhooks yet"
            description="Add an endpoint to receive events like enrollment.created in external systems."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>Target URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-56 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {endpoints.map((endpoint) => (
                  <TableRow key={endpoint.publicId}>
                    <TableCell className="font-mono text-xs">{endpoint.eventType}</TableCell>
                    <TableCell className="max-w-64 truncate font-mono text-xs">
                      {endpoint.url}
                    </TableCell>
                    <TableCell>
                      {endpoint.isActive ? (
                        <Badge className="bg-success/15 text-success">Active</Badge>
                      ) : (
                        <Badge variant="secondary">Paused</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={sendTest.isPending}
                          onClick={() => sendTest.mutate({ publicId: endpoint.publicId })}
                        >
                          {sendTest.isPending && sendTest.variables.publicId === endpoint.publicId
                            ? 'Sending…'
                            : 'Send Test'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Toggle delivery logs"
                          onClick={() =>
                            setLogsFor(logsFor === endpoint.publicId ? null : endpoint.publicId)
                          }
                        >
                          Logs
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Edit webhook ${endpoint.url}`}
                          onClick={() => {
                            setEditing(endpoint)
                            setUrl(endpoint.url)
                            setEventType(endpoint.eventType)
                            setUrlError(null)
                            setEditOpen(true)
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Delete webhook ${endpoint.url}`}
                          onClick={() => setDeleteTarget(endpoint)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {logsFor != null ? <WebhookDeliveryLog publicId={logsFor} /> : null}
      </CardContent>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Webhook' : 'Add Webhook'}</DialogTitle>
            <DialogDescription>
              Events POST as JSON with an HMAC-SHA256 signature header (
              <code>x-abugida-signature</code>) so receivers can verify authenticity.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-url">Target URL</Label>
              <Input
                id="webhook-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://crm.example.com/hooks/abugida"
              />
              {urlError ? (
                <p className="text-destructive text-sm" role="alert">
                  {urlError}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-event">Event</Label>
              <select
                id="webhook-event"
                className="h-9 w-full rounded-md border bg-background px-2 text-sm"
                value={eventType}
                onChange={(event) => setEventType(event.target.value)}
              >
                {WEBHOOK_EVENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={save.isPending}
              onClick={async () => {
                let parsed: URL
                try {
                  parsed = new URL(url.trim())
                } catch {
                  setUrlError('Enter a valid URL')
                  return
                }
                if (parsed.protocol !== 'https:') {
                  setUrlError('Webhook targets must use HTTPS')
                  return
                }
                setUrlError(null)
                try {
                  await save.mutateAsync({
                    publicId: editing?.publicId ?? null,
                    url: url.trim(),
                    eventType,
                    isActive: editing?.isActive ?? true,
                  })
                  setEditOpen(false)
                } catch {
                  /* toast handled by mutation */
                }
              }}
            >
              {save.isPending ? 'Saving…' : 'Save Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title="Delete this webhook?"
        body={`Deliveries to ${deleteTarget?.url ?? ''} stop immediately. Past delivery logs remain.`}
        confirmLabel="Delete Webhook"
        onConfirm={async () => {
          if (!deleteTarget) return
          await remove.mutateAsync({ publicId: deleteTarget.publicId })
          setDeleteTarget(null)
        }}
      />
    </Card>
  )
}

function WebhookDeliveryLog({ publicId }: { publicId: string }) {
  const deliveriesQuery = useQuery({
    queryKey: ['settings', 'webhook-deliveries', publicId],
    queryFn: async () => {
      const { getWebhookDeliveries } = await import('../server/all')
      return getWebhookDeliveries({ data: { publicId } })
    },
  })

  if (deliveriesQuery.isPending) return <Skeleton className="mt-4 h-32 w-full" />
  if (deliveriesQuery.isError) {
    return (
      <div className="mt-4">
        <RetryErrorState
          title="Unable to load delivery logs. Retry?"
          onRetry={() => void deliveriesQuery.refetch()}
          isRetrying={deliveriesQuery.isFetching}
        />
      </div>
    )
  }

  const deliveries = deliveriesQuery.data

  return (
    <div className="mt-4 rounded-md border p-3">
      <h4 className="mb-2 text-sm font-medium">Delivery Logs</h4>
      {deliveries.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No deliveries recorded yet. Use “Send Test” to make a real signed delivery.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((delivery) => (
                <TableRow key={delivery.publicId}>
                  <TableCell className="text-xs">
                    {new Date(delivery.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{delivery.eventType}</TableCell>
                  <TableCell>
                    <Badge
                      className={
                        delivery.status === 'sent'
                          ? 'bg-success/15 text-success'
                          : delivery.status === 'pending'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-destructive/15 text-destructive'
                      }
                    >
                      {delivery.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{delivery.responseStatus ?? '—'}</TableCell>
                  <TableCell className="max-w-48 truncate text-xs">
                    {delivery.lastError ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

export function ApiWebhooksView() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">API & Webhooks</h1>
        <p className="text-muted-foreground text-sm">
          Manage API keys and outbound webhooks for integrating Abugida with external systems.
        </p>
      </header>
      <ApiKeysSection />
      <WebhooksSection />
    </div>
  )
}
