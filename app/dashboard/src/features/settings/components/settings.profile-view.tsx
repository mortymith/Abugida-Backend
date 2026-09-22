import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, Cancel01Icon, Key01Icon } from '@hugeicons/core-free-icons'
import { Avatar, AvatarFallback, AvatarImage } from '#/components/ui/avatar'
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from '#/components/ui/input-otp'
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
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { profileQueryOptions, profileSecurityQueryOptions } from '../hooks/settings.queries'
import {
  useAccountLinkUrl,
  useChangePassword,
  useDisableMfa,
  useMarkAvatarUploaded,
  useRevokeOtherSessions,
  useRevokeSession,
  useStartMfaEnrollment,
  useUnlinkAccount,
  useUpdateProfile,
  useVerifyMfaEnrollment,
} from '../hooks/settings.mutations'
import { getAvatarUploadUrl } from '../server/all'
import { SaveBar } from './settings.setting-controls'
import { LANGUAGE_OPTIONS } from '../settings.constants'
import { toast } from '#/components/common/toast'

/**
 * S-6.5 My Profile & Account — the signed-in user's own record: identity,
 * avatar, preferences, connected accounts, two-factor enrollment, and
 * active sessions. Role is read-only (assigned in Team Management).
 */

function initialsOf(name: string | null): string {
  return name
    ? name
        .split(' ')
        .map((part) => part[0])
        .filter(Boolean)
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '??'
}

function deviceLabel(userAgent: string | null): string {
  if (!userAgent) return 'Unknown device'
  if (/iphone|ipad|ios/i.test(userAgent)) return 'iOS device'
  if (/android/i.test(userAgent)) return 'Android device'
  if (/macintosh|mac os/i.test(userAgent)) return 'Mac'
  if (/windows/i.test(userAgent)) return 'Windows PC'
  if (/linux/i.test(userAgent)) return 'Linux device'
  return 'Browser'
}

function IdentityCard() {
  const query = useQuery(profileQueryOptions())
  const update = useUpdateProfile()
  const markAvatar = useMarkAvatarUploaded()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [language, setLanguage] = useState('en')
  const [timezone, setTimezone] = useState('Africa/Addis_Ababa')
  const [loaded, setLoaded] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const profile = query.data
    if (profile && !loaded) {
      setName(profile.name ?? '')
      setLanguage(profile.languagePreference)
      setTimezone(profile.timezone)
      setLoaded(true)
    }
  }, [query.data, loaded])

  if (query.isPending) return <Skeleton className="h-80 w-full" />
  if (query.isError) {
    return <RetryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
  }

  const profile = query.data
  const avatarSrc = profile.avatarUrl ?? profile.image ?? undefined
  const dirty =
    name !== (profile.name ?? '') ||
    language !== profile.languagePreference ||
    timezone !== profile.timezone

  async function uploadAvatar(file: File) {
    setUploading(true)
    try {
      const { objectKey, uploadUrl } = await getAvatarUploadUrl({
        data: { fileName: file.name, contentType: file.type },
      })
      const response = await fetch(uploadUrl, {
        method: 'PUT',
        headers: { 'content-type': file.type },
        body: file,
      })
      if (!response.ok) throw new Error(`Upload failed (HTTP ${response.status})`)
      await markAvatar.mutateAsync(objectKey)
      toast.success('Photo updated.')
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : 'Upload failed. Retry?')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          <Avatar size="lg">
            {avatarSrc != null ? <AvatarImage src={avatarSrc} alt={profile.name ?? ''} /> : null}
            <AvatarFallback>{initialsOf(profile.name)}</AvatarFallback>
          </Avatar>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void uploadAvatar(file)
                event.target.value = ''
              }}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? 'Uploading…' : 'Change Photo'}
            </Button>
            <p className="text-muted-foreground mt-1 text-xs">PNG, JPEG, WebP, or GIF.</p>
          </div>
          <div className="ms-auto space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Email: </span>
              {profile.email ?? '—'}
              {profile.emailVerified ? (
                <Badge className="bg-success/15 text-success ml-2">Verified</Badge>
              ) : null}
            </p>
            <p>
              <span className="text-muted-foreground">Role: </span>
              <span className="capitalize">{profile.role}</span>
              <span className="text-muted-foreground"> (assigned by Admin)</span>
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              id="profile-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-language">Language</Label>
            <select
              id="profile-language"
              className="h-9 w-full rounded-md border bg-background px-2 text-sm"
              value={language}
              onChange={(event) => setLanguage(event.target.value)}
            >
              {LANGUAGE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="profile-timezone">Timezone</Label>
            <Input
              id="profile-timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
            />
          </div>
        </div>

        <SaveBar
          dirty={dirty}
          saving={update.isPending}
          error={update.isError ? 'Unable to update profile. Retry?' : null}
          onSave={() =>
            update.mutate({
              name: name.trim(),
              languagePreference: language,
              timezone: timezone.trim(),
            })
          }
          onCancel={() => {
            setName(profile.name ?? '')
            setLanguage(profile.languagePreference)
            setTimezone(profile.timezone)
          }}
        />
      </CardContent>
    </Card>
  )
}

function SecurityCard() {
  const query = useQuery(profileSecurityQueryOptions())
  const unlink = useUnlinkAccount()
  const link = useAccountLinkUrl()
  const revokeSession = useRevokeSession()
  const revokeOthers = useRevokeOtherSessions()
  const startMfa = useStartMfaEnrollment()
  const verifyMfa = useVerifyMfaEnrollment()
  const disableMfa = useDisableMfa()
  const changePassword = useChangePassword()

  const [unlinkTarget, setUnlinkTarget] = useState<{
    accountId: string
    providerId: string
  } | null>(null)
  const [sessionToRevoke, setSessionToRevoke] = useState<string | null>(null)
  const [mfaStep, setMfaStep] = useState<'idle' | 'enroll'>('idle')
  const [totpUri, setTotpUri] = useState('')
  const [secret, setSecret] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[]>([])
  const [totpCode, setTotpCode] = useState('')
  const [disableOpen, setDisableOpen] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')

  const [qrImg, setQrImg] = useState<string | null>(null)

  useEffect(() => {
    if (!totpUri) {
      setQrImg(null)
      return
    }
    let cancelled = false
    QRCode.toDataURL(totpUri, { width: 160, margin: 1 })
      .then((url) => {
        if (!cancelled) setQrImg(url)
      })
      .catch(() => {
        if (!cancelled) setQrImg(null)
      })
    return () => {
      cancelled = true
    }
  }, [totpUri])

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState<string | null>(null)

  if (query.isPending) return <Skeleton className="h-80 w-full" />
  if (query.isError) {
    return <RetryErrorState onRetry={() => void query.refetch()} isRetrying={query.isFetching} />
  }

  const security = query.data
  const providers = security.connectedAccounts.filter(
    (account) => account.providerId !== 'credential',
  )
  const lastProvider = !security.hasCredentialAccount && providers.length <= 1

  async function handleStartMfa() {
    try {
      const enrollment = await startMfa.mutateAsync(undefined)
      setTotpUri(enrollment.totpUri)
      setSecret(enrollment.secret)
      setBackupCodes(enrollment.backupCodes)
      setMfaStep('enroll')
    } catch (cause) {
      toast.error(
        cause instanceof Error
          ? cause.message.replace(/^[A-Z_]+:\s*/, '')
          : 'Unable to start MFA setup.',
      )
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Security</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        <section aria-labelledby="connected-accounts" className="space-y-3">
          <h3 id="connected-accounts" className="text-sm font-semibold">
            Connected accounts
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {providers.length === 0 && !security.hasCredentialAccount ? (
              <p className="text-muted-foreground text-sm">No connected sign-in methods.</p>
            ) : null}
            {providers.map((account) => (
              <Badge key={account.accountId} variant="secondary" className="capitalize">
                {account.providerId} ✓
              </Badge>
            ))}
            {security.hasCredentialAccount ? (
              <Badge variant="secondary">
                <HugeiconsIcon icon={Key01Icon} className="mr-1 inline size-3" /> Password
              </Badge>
            ) : null}
            <div className="ms-auto flex flex-wrap gap-2">
              {security.linkableProviders
                .filter((provider) => provider.configured)
                .filter(
                  (provider) =>
                    !providers.some(
                      (account) =>
                        account.providerId === provider.provider ||
                        (provider.provider === 'telegram' && account.providerId === 'telegram'),
                    ),
                )
                .map((provider) => (
                  <Button
                    key={provider.provider}
                    variant="outline"
                    size="sm"
                    onClick={() => link.mutate(provider.provider)}
                  >
                    Link {provider.provider === 'telegram' ? 'Telegram' : 'Google'}
                  </Button>
                ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {providers.map((account) => (
              <Button
                key={`unlink-${account.accountId}`}
                variant="ghost"
                size="sm"
                disabled={lastProvider}
                title={
                  lastProvider
                    ? 'You need at least one sign-in method to access your account.'
                    : undefined
                }
                onClick={() =>
                  setUnlinkTarget({ accountId: account.accountId, providerId: account.providerId })
                }
              >
                <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3.5" />
                Unlink {account.providerId}
              </Button>
            ))}
          </div>
        </section>

        <section aria-labelledby="mfa-section" className="space-y-3">
          <h3 id="mfa-section" className="text-sm font-semibold">
            Two-Factor Authentication
          </h3>
          {security.twoFactorEnabled ? (
            <div className="space-y-2">
              <Badge className="bg-success/15 text-success">Enabled</Badge>
              <div>
                <Button variant="outline" size="sm" onClick={() => setDisableOpen(true)}>
                  Disable 2FA
                </Button>
              </div>
            </div>
          ) : mfaStep === 'enroll' ? (
            <div className="space-y-4 rounded-md border p-4">
              <p className="text-sm">
                Scan this QR code with your authenticator app (Google Authenticator, 1Password,
                Authy), or enter the key manually.
              </p>
              {qrImg ? (
                <img
                  src={qrImg}
                  alt="TOTP QR code"
                  width={160}
                  height={160}
                  className="rounded border bg-white p-1"
                />
              ) : (
                <p className="text-muted-foreground text-xs">
                  QR unavailable — use the manual key below.
                </p>
              )}
              <div className="space-y-1">
                <Label htmlFor="totp-secret">Manual key</Label>
                <Input
                  id="totp-secret"
                  readOnly
                  value={secret}
                  className="max-w-xs font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label>Enter the 6-digit code to confirm</Label>
                <InputOTP maxLength={6} value={totpCode} onChange={setTotpCode}>
                  <InputOTPGroup>
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <InputOTPSlot key={index} index={index} />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              {backupCodes.length > 0 ? (
                <div className="rounded bg-muted p-3 text-xs">
                  <p className="font-medium">Backup codes (store safely — shown once):</p>
                  <p className="mt-1 font-mono">{backupCodes.join(' · ')}</p>
                </div>
              ) : null}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={totpCode.length < 6 || verifyMfa.isPending}
                  onClick={async () => {
                    try {
                      await verifyMfa.mutateAsync({ code: totpCode })
                      setMfaStep('idle')
                      setTotpCode('')
                    } catch {
                      /* toast handled by mutation */
                    }
                  }}
                >
                  Verify & Enable
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setMfaStep('idle')}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Badge variant="secondary">Not enabled</Badge>
              <Button size="sm" variant="outline" onClick={() => void handleStartMfa()}>
                Set Up
              </Button>
            </div>
          )}
        </section>

        <section aria-labelledby="sessions-section" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 id="sessions-section" className="text-sm font-semibold">
              Active Sessions{' '}
              <span className="text-muted-foreground font-normal">
                ({security.sessions.length} {security.sessions.length === 1 ? 'device' : 'devices'})
              </span>
            </h3>
            {security.sessions.length > 1 ? (
              <Button variant="outline" size="sm" onClick={() => revokeOthers.mutate(undefined)}>
                Sign Out Other Sessions
              </Button>
            ) : null}
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Device</TableHead>
                  <TableHead>IP address</TableHead>
                  <TableHead>Signed in</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {security.sessions.map((session) => (
                  <TableRow key={session.token}>
                    <TableCell>
                      {deviceLabel(session.userAgent)}
                      {session.isCurrent ? (
                        <Badge className="ml-2 bg-success/15 text-success">This device</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{session.ipAddress ?? '—'}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(session.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {!session.isCurrent ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSessionToRevoke(session.token)}
                        >
                          Sign Out
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <section aria-labelledby="password-section" className="space-y-3">
          <h3 id="password-section" className="text-sm font-semibold">
            Password
          </h3>
          {!security.hasCredentialAccount ? (
            <p className="text-muted-foreground text-sm">
              You sign in with a linked provider and have no password set.
            </p>
          ) : (
            <div className="grid max-w-xl gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm new</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="sm:col-span-3">
                {passwordError ? (
                  <p className="text-destructive mb-2 text-sm" role="alert">
                    {passwordError}
                  </p>
                ) : null}
                <Button
                  size="sm"
                  disabled={
                    changePassword.isPending ||
                    currentPassword === '' ||
                    newPassword === '' ||
                    confirmPassword === ''
                  }
                  onClick={async () => {
                    setPasswordError(null)
                    if (newPassword !== confirmPassword) {
                      setPasswordError('Passwords do not match')
                      return
                    }
                    if (
                      newPassword.length < 8 ||
                      !/[a-z]/.test(newPassword) ||
                      !/[A-Z]/.test(newPassword) ||
                      !/[0-9]/.test(newPassword)
                    ) {
                      setPasswordError('Use at least 8 characters with upper, lower, and a number')
                      return
                    }
                    try {
                      await changePassword.mutateAsync({
                        currentPassword,
                        newPassword,
                        confirmNewPassword: confirmPassword,
                      })
                      setCurrentPassword('')
                      setNewPassword('')
                      setConfirmPassword('')
                    } catch {
                      /* toast handled by mutation */
                    }
                  }}
                >
                  {changePassword.isPending ? 'Changing…' : 'Change Password'}
                </Button>
              </div>
            </div>
          )}
        </section>
      </CardContent>

      <ConfirmDialog
        open={unlinkTarget != null}
        onOpenChange={(open) => {
          if (!open) setUnlinkTarget(null)
        }}
        title={`Unlink ${unlinkTarget?.providerId ?? ''}?`}
        body={
          lastProvider
            ? 'You need at least one sign-in method to access your account.'
            : 'You can no longer sign in with this provider unless you link it again.'
        }
        confirmLabel="Unlink"
        onConfirm={async () => {
          if (!unlinkTarget) return
          await unlink.mutateAsync(unlinkTarget)
          setUnlinkTarget(null)
        }}
      />

      <ConfirmDialog
        open={sessionToRevoke != null}
        onOpenChange={(open) => {
          if (!open) setSessionToRevoke(null)
        }}
        title="Sign out this device?"
        body="The target device is signed out immediately. Any unsaved work is lost."
        confirmLabel="Sign Out Device"
        onConfirm={async () => {
          if (!sessionToRevoke) return
          await revokeSession.mutateAsync({ token: sessionToRevoke })
          setSessionToRevoke(null)
        }}
      />

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Disable two-factor authentication?</DialogTitle>
            <DialogDescription>
              Your account will be protected by your sign-in provider or password only. Enter your
              password to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="disable-2fa-password">Password</Label>
            <Input
              id="disable-2fa-password"
              type="password"
              value={disablePassword}
              onChange={(event) => setDisablePassword(event.target.value)}
              autoComplete="current-password"
            />
            {disableMfa.isError ? (
              <p className="text-destructive text-sm" role="alert">
                Password check failed. Retry?
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDisableOpen(false)
                setDisablePassword('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={disablePassword === '' || disableMfa.isPending}
              onClick={async () => {
                try {
                  await disableMfa.mutateAsync({ password: disablePassword })
                  setDisableOpen(false)
                  setDisablePassword('')
                } catch {
                  /* error shown inline */
                }
              }}
            >
              {disableMfa.isPending ? 'Disabling…' : 'Disable 2FA'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}

export function ProfileView() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">My Profile</h1>
        <p className="text-muted-foreground text-sm">
          Personal account settings for your signed-in user.
        </p>
      </header>
      <IdentityCard />
      <SecurityCard />
      <p className="text-muted-foreground flex items-center gap-1 text-xs">
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-3" />
        Roles are workspace-wide and managed by Admins in Team Management.
      </p>
    </div>
  )
}
