import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { Settings01Icon } from '@hugeicons/core-free-icons'
import { Button } from '#/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '#/components/ui/card'
import { Badge } from '#/components/ui/badge'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Skeleton } from '#/components/ui/skeleton'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { integrationsQueryOptions } from '../hooks/settings.queries'
import {
  useSaveAnalyticsIntegration,
  useSaveEmailIntegration,
  useSavePaymentGatewayConfig,
  useTogglePaymentGateway,
} from '../hooks/settings.mutations'
import { CheckboxRow, SaveBar } from './settings.setting-controls'

/**
 * S-6.3 Integrations — payment gateways, email service, sign-in providers,
 * and analytics (admin only). Payment rows render the platform's real
 * gateways; credentials are write-only; test-send is only offered when the
 * email infrastructure can actually deliver (it cannot today — the button
 * is replaced with an explanatory note rather than a fake success).
 */

function EmailSection() {
  const query = useQuery(integrationsQueryOptions())
  const save = useSaveEmailIntegration()
  const [provider, setProvider] = useState<'sendgrid' | 'smtp'>('smtp')
  const [fromAddress, setFromAddress] = useState('')
  const [smtpHost, setSmtpHost] = useState('')
  const [smtpPort, setSmtpPort] = useState('587')
  const [smtpUser, setSmtpUser] = useState('')
  const [smtpPassword, setSmtpPassword] = useState('')
  const [sendGridKey, setSendGridKey] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const email = query.data?.email
    if (email && !loaded) {
      setProvider(email.provider ?? 'smtp')
      setFromAddress(email.fromAddress ?? '')
      setSmtpHost(email.smtpHost ?? '')
      setSmtpPort(email.smtpPort != null ? String(email.smtpPort) : '587')
      setSmtpUser(email.smtpUser ?? '')
      setLoaded(true)
    }
  }, [query.data, loaded])

  if (query.isPending) return <Skeleton className="h-64 w-full" />

  const email = query.data?.email
  const dirty =
    provider !== (email?.provider ?? 'smtp') ||
    fromAddress !== (email?.fromAddress ?? '') ||
    smtpHost !== (email?.smtpHost ?? '') ||
    smtpPort !== (email?.smtpPort != null ? String(email.smtpPort) : '587') ||
    smtpUser !== (email?.smtpUser ?? '') ||
    sendGridKey !== '' ||
    smtpPassword !== ''

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Service</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email-provider">Provider</Label>
            <select
              id="email-provider"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={provider}
              onChange={(event) => setProvider(event.target.value as 'sendgrid' | 'smtp')}
            >
              <option value="smtp">SMTP</option>
              <option value="sendgrid">SendGrid</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-from">From Address</Label>
            <Input
              id="email-from"
              type="email"
              value={fromAddress}
              onChange={(event) => setFromAddress(event.target.value)}
              placeholder="no-reply@abugida.com"
            />
          </div>
        </div>
        {provider === 'smtp' ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="smtp-host">SMTP Host</Label>
              <Input
                id="smtp-host"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-port">Port</Label>
              <Input
                id="smtp-port"
                type="number"
                value={smtpPort}
                onChange={(e) => setSmtpPort(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-user">SMTP User</Label>
              <Input
                id="smtp-user"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="smtp-password">SMTP Password</Label>
              <Input
                id="smtp-password"
                type="password"
                value={smtpPassword}
                onChange={(e) => setSmtpPassword(e.target.value)}
                placeholder={email?.hasSmtpPassword ? 'Saved — enter to replace' : ''}
                autoComplete="new-password"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="sendgrid-key">SendGrid API Key</Label>
            <Input
              id="sendgrid-key"
              type="password"
              value={sendGridKey}
              onChange={(e) => setSendGridKey(e.target.value)}
              placeholder={email?.hasSendGridKey ? 'Saved — enter to replace' : ''}
              autoComplete="new-password"
            />
          </div>
        )}
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          error={save.isError ? 'Unable to save email configuration. Retry?' : null}
          onSave={() =>
            save.mutate({
              provider,
              fromAddress: fromAddress.trim(),
              smtpHost: provider === 'smtp' ? smtpHost.trim() || null : null,
              smtpPort: provider === 'smtp' && smtpPort ? Number(smtpPort) : null,
              smtpUser: provider === 'smtp' ? smtpUser.trim() || null : null,
              smtpPassword: provider === 'smtp' && smtpPassword ? smtpPassword : null,
              sendGridKey: provider === 'sendgrid' && sendGridKey ? sendGridKey : null,
            })
          }
          onCancel={() => setLoaded(false)}
        />
        <p className="text-muted-foreground text-xs">
          Test Email Sending: test deliveries become available once an email provider is connected
          at the server runtime. Saving here stores the configuration; delivery requires the mail
          service to be deployed.
        </p>
      </CardContent>
    </Card>
  )
}

function AnalyticsSection() {
  const query = useQuery(integrationsQueryOptions())
  const save = useSaveAnalyticsIntegration()
  const [gaId, setGaId] = useState('')
  const [mixpanel, setMixpanel] = useState('')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const analytics = query.data?.analytics
    if (analytics && !loaded) {
      setGaId(analytics.googleAnalyticsId ?? '')
      setMixpanel(analytics.mixpanelToken ?? '')
      setLoaded(true)
    }
  }, [query.data, loaded])

  if (query.isPending) return <Skeleton className="h-40 w-full" />

  const analytics = query.data?.analytics
  const dirty =
    gaId !== (analytics?.googleAnalyticsId ?? '') || mixpanel !== (analytics?.mixpanelToken ?? '')

  return (
    <Card>
      <CardHeader>
        <CardTitle>Analytics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ga-id">Google Analytics</Label>
            <Input
              id="ga-id"
              value={gaId}
              onChange={(event) => setGaId(event.target.value)}
              placeholder="G-XXXXXXXXXX"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mixpanel-token">Mixpanel Project Token</Label>
            <Input
              id="mixpanel-token"
              value={mixpanel}
              onChange={(event) => setMixpanel(event.target.value)}
              placeholder="Project Token"
            />
          </div>
        </div>
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          error={save.isError ? 'Unable to save analytics configuration. Retry?' : null}
          onSave={() =>
            save.mutate({
              googleAnalyticsId: gaId.trim() || null,
              mixpanelToken: mixpanel.trim() || null,
            })
          }
          onCancel={() => setLoaded(false)}
        />
      </CardContent>
    </Card>
  )
}

function PaymentSection() {
  const query = useQuery(integrationsQueryOptions())
  const toggle = useTogglePaymentGateway()
  const saveConfig = useSavePaymentGatewayConfig()
  const [editing, setEditing] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [requiresDisclosure, setRequiresDisclosure] = useState(false)
  const [disclosureText, setDisclosureText] = useState('')

  if (query.isPending) return <Skeleton className="h-40 w-full" />
  if (query.isError) {
    return <RetryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
  }

  const gateways = query.data.paymentGateways

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment Gateways</CardTitle>
      </CardHeader>
      <CardContent>
        {gateways.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No payment gateways are registered yet. The platform adds gateway rows when a provider
            is provisioned (Telebirr is provisioned with the API).
          </p>
        ) : (
          <div className="divide-y">
            {gateways.map((gateway) => (
              <div key={gateway.publicId} className="flex flex-wrap items-center gap-3 py-3">
                <Badge
                  className={
                    gateway.isEnabled
                      ? 'bg-success/15 text-success'
                      : 'bg-muted text-muted-foreground'
                  }
                >
                  {gateway.isEnabled ? 'Active' : 'Inactive'}
                </Badge>
                <span className="font-medium">{gateway.displayName}</span>
                <span className="text-muted-foreground text-xs capitalize">
                  {gateway.providerName}
                </span>
                <div className="ms-auto flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(gateway.publicId)
                      setDisplayName(gateway.displayName)
                      setRequiresDisclosure(gateway.requiresDisclosure)
                      setDisclosureText(gateway.disclosureText ?? '')
                    }}
                  >
                    <HugeiconsIcon icon={Settings01Icon} strokeWidth={2} /> Configure
                  </Button>
                  <Button
                    variant={gateway.isEnabled ? 'destructive' : 'default'}
                    size="sm"
                    onClick={() =>
                      toggle.mutate({ publicId: gateway.publicId, isEnabled: !gateway.isEnabled })
                    }
                  >
                    {gateway.isEnabled ? 'Disable' : 'Activate'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {editing != null ? (
          <div className="border-t pt-4">
            <h3 className="mb-3 text-sm font-semibold">Configure Gateway</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="gateway-name">Display Name</Label>
                <Input
                  id="gateway-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                />
              </div>
            </div>
            <CheckboxRow
              id="gateway-disclosure"
              label="Requires disclosure text"
              description="Show payment disclosure to students at checkout."
              checked={requiresDisclosure}
              onChange={setRequiresDisclosure}
            />
            {requiresDisclosure ? (
              <div className="space-y-2">
                <Label htmlFor="disclosure-text">Disclosure Text</Label>
                <Input
                  id="disclosure-text"
                  value={disclosureText}
                  onChange={(event) => setDisclosureText(event.target.value)}
                />
              </div>
            ) : null}
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  saveConfig.mutate(
                    {
                      publicId: editing,
                      displayName: displayName.trim() || 'Unnamed gateway',
                      requiresDisclosure,
                      disclosureText: requiresDisclosure ? disclosureText.trim() || null : null,
                    },
                    { onSuccess: () => setEditing(null) },
                  )
                }}
                disabled={saveConfig.isPending}
              >
                Save Configuration
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

function AuthProvidersSection() {
  const query = useQuery(integrationsQueryOptions())
  if (query.isPending) return <Skeleton className="h-32 w-full" />

  const providers = query.data?.authProviders ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Authentication (sign-in)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="divide-y">
          {providers.map((provider) => (
            <div key={provider.provider} className="flex items-center gap-3 py-2">
              <Badge
                className={
                  provider.configured
                    ? 'bg-success/15 text-success'
                    : 'bg-muted text-muted-foreground'
                }
              >
                {provider.configured ? 'Active' : 'Not configured'}
              </Badge>
              <span className="font-medium capitalize">{provider.provider}</span>
              {provider.provider === 'telegram' ? (
                <span>Telegram Login</span>
              ) : (
                <span>Google OAuth</span>
              )}
            </div>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          Providers are configured server-side with the auth environment (client id/secret). Status
          above reflects the live server configuration; secrets are never rendered.
        </p>
      </CardContent>
    </Card>
  )
}

export function IntegrationsView() {
  const query = useQuery(integrationsQueryOptions())

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Integrations</h1>
        <p className="text-muted-foreground text-sm">
          Configure external integrations: payment gateways, email, sign-in providers, and
          analytics.
        </p>
      </header>
      {query.isError ? (
        <RetryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
      ) : null}
      <PaymentSection />
      <EmailSection />
      <AuthProvidersSection />
      <AnalyticsSection />
    </div>
  )
}
