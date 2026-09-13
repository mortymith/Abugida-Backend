import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { HugeiconsIcon } from '@hugeicons/react'
import { LockKeyholeIcon } from '@hugeicons/core-free-icons'

import { useSession } from '#/features/auth/hooks/auth.session'
import { MfaInput } from '#/features/auth/components/auth.mfa-input'
import { Input } from '#/components/ui/input'
import { Button } from '#/components/ui/button'
import { Field, FieldLabel } from '#/components/ui/field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '#/components/ui/tabs'
import { Spinner } from '#/components/ui/spinner'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { ErrorMessage } from '#/components/common/error-message'
import { verifyMfa } from '#/server/functions/auth.mfa-verify'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_auth/mfa')({
  component: MfaPage,
})

const MAX_ATTEMPTS = 5

function MfaPage() {
  const navigate = useNavigate()
  const { data: session } = useSession()
  const [mode, setMode] = useState<'totp' | 'backup'>('totp')
  const [code, setCode] = useState('')
  const [backupCode, setBackupCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempts, setAttempts] = useState(0)

  const locked = attempts >= MAX_ATTEMPTS

  useEffect(() => {
    if (session) {
      navigate({ to: '/dashboard' })
    }
  }, [session, navigate])

  const handleVerify = async (value: string) => {
    if (!value.trim() || loading || locked) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      await verifyMfa({ data: { code: value } })
      navigate({ to: '/dashboard' })
    } catch {
      const nextAttempts = attempts + 1
      setAttempts(nextAttempts)
      if (nextAttempts >= MAX_ATTEMPTS) {
        setError('Maximum attempts reached. Contact your workspace Admin to regain access.')
      } else {
        setError(
          mode === 'totp' ? "That code didn't work. Try again." : 'Invalid backup code. Try again.',
        )
        if (mode === 'totp') {
          setCode('')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleCodeChange = (value: string) => {
    setCode(value)
    // Auto-submit as soon as all six digits are entered
    if (value.length === 6) {
      void handleVerify(value)
    }
  }

  const handleModeChange = (nextMode: 'totp' | 'backup') => {
    setMode(nextMode)
    setError(null)
  }

  const remainingAttempts = MAX_ATTEMPTS - attempts

  return (
    <Card>
      <CardHeader>
        <div className="mb-1 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <HugeiconsIcon icon={LockKeyholeIcon} size={20} strokeWidth={1.5} />
        </div>
        <CardTitle className="text-lg font-semibold">Multi-factor authentication</CardTitle>
        <CardDescription>
          {mode === 'totp'
            ? 'Enter the 6-digit code from your authenticator app.'
            : 'Enter one of your backup codes to verify your identity.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-5">
        <Tabs value={mode} onValueChange={(value) => handleModeChange(value as 'totp' | 'backup')}>
          <TabsList className="w-full">
            <TabsTrigger value="totp">Authenticator app</TabsTrigger>
            <TabsTrigger value="backup">Backup code</TabsTrigger>
          </TabsList>

          <TabsContent value="totp" className="flex flex-col gap-4 pt-4">
            {error && <ErrorMessage message={error} />}

            <MfaInput value={code} onChange={handleCodeChange} disabled={loading || locked} />

            {attempts > 0 && !locked && (
              <p className="text-center text-xs text-muted-foreground">
                Codes rotate every 30 seconds — wait for the next one before retrying.
              </p>
            )}
          </TabsContent>

          <TabsContent value="backup" className="flex flex-col gap-4 pt-4">
            {error && <ErrorMessage message={error} />}

            <Field data-invalid={error && attempts > 0 ? true : undefined}>
              <FieldLabel htmlFor="backup-code">Backup code</FieldLabel>
              <Input
                id="backup-code"
                type="text"
                autoComplete="off"
                placeholder="Enter a backup code"
                value={backupCode}
                onChange={(e) => setBackupCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    void handleVerify(backupCode)
                  }
                }}
                className="h-11 font-mono"
                disabled={loading || locked}
              />
            </Field>

            <Button
              size="lg"
              className="w-full"
              onClick={() => void handleVerify(backupCode)}
              disabled={loading || locked || !backupCode.trim()}
            >
              {loading ? (
                <>
                  <Spinner data-icon="inline-start" />
                  Verifying…
                </>
              ) : (
                'Verify backup code'
              )}
            </Button>
          </TabsContent>
        </Tabs>

        {attempts > 0 && (
          <div className="flex items-center justify-center gap-2" aria-live="polite">
            <div className="flex gap-1" aria-hidden="true">
              {Array.from({ length: MAX_ATTEMPTS }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'size-2 rounded-full transition-all duration-300',
                    i < attempts ? 'bg-destructive' : 'bg-muted-foreground/20',
                  )}
                />
              ))}
            </div>
            <span className="text-xs font-medium text-muted-foreground">
              {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
            </span>
          </div>
        )}

        {mode === 'backup' && (
          <p className="text-center text-xs text-muted-foreground">
            Lost all your backup codes?{' '}
            <span className="font-semibold text-foreground">Contact your workspace Admin.</span>
          </p>
        )}
      </CardContent>
    </Card>
  )
}
