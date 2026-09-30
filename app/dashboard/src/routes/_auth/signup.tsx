import { useCallback, useEffect, useRef, useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { HugeiconsIcon } from '@hugeicons/react'
import { SparklesIcon, Tick04Icon } from '@hugeicons/core-free-icons'

import { SignupStep1 } from '#/features/auth/components/auth.signup-step-1'
import { SignupStep2 } from '#/features/auth/components/auth.signup-step-2'
import { SignupStep3 } from '#/features/auth/components/auth.signup-step-3'
import { Stepper } from '#/components/ui/stepper'
import { Badge } from '#/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { useSession } from '#/features/auth/hooks/auth.session'
import { useOnline } from '#/hooks/use-online'
import { getSignupProviders, provisionWorkspace } from '#/features/auth/server/auth.signup'
import type { SignupWorkspaceInput } from '#/features/auth/schemas/auth.signup.schema'
import type { ProvisionResult } from '#/features/auth/server/auth.signup'

const STEPS = ['Account', 'Workspace', 'Start'] as const

const STEP_META: Record<(typeof STEPS)[number], { title: string; description: string }> = {
  Account: {
    title: 'Create your workspace',
    description: 'Sign in with a trusted provider to set up the first admin account.',
  },
  Workspace: {
    title: 'Set up your workspace',
    description: 'Tell us what your organization does — you can change this later.',
  },
  Start: {
    title: "You're all set!",
    description: 'Your workspace is ready. Here are what to do next.',
  },
}

/**
 * S-0.2 Organization Sign-Up & Onboarding.
 *
 * The wizard owns the spec's step contract: focus moves to the step's first
 * field on every change, the step is announced in a polite live region, **Back**
 * never discards entered data, and the session expiry path preserves the
 * workspace name rather than starting over.
 */
export const Route = createFileRoute('/_auth/signup')({
  component: SignupPage,
})

function SignupPage() {
  const navigate = useNavigate()
  const online = useOnline()
  const { data: session, isPending: isSessionPending } = useSession()

  const [step, setStep] = useState(1)
  const [provisioning, setProvisioning] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [slugTaken, setSlugTaken] = useState<{ suggestions: string[] } | null>(null)
  const [sessionExpired, setSessionExpired] = useState(false)
  const [created, setCreated] = useState<{ name: string; useCase: string } | null>(null)
  const draftRef = useRef<SignupWorkspaceInput | null>(null)

  const providers = useQuery({
    queryKey: ['auth', 'signup-providers'],
    queryFn: getSignupProviders,
    staleTime: 60_000,
    retry: false,
  })

  // The provider round-trip has completed — skip past step 1 rather than making
  // the user click "Continue" into a form they have already unlocked.
  useEffect(() => {
    if (session) setStep((current) => (current === 1 ? 2 : current))
  }, [session])

  const handleProvision = useCallback(
    async (data: SignupWorkspaceInput) => {
      // Provisioning is a write and is never queued — the button is disabled
      // offline instead, so no half-created `organizations` row is possible.
      if (!online) {
        setServerError("You're offline. We'll finish creating your workspace when you're back.")
        return
      }

      // Back must never discard entered data.
      draftRef.current = data
      setProvisioning(true)
      setServerError(null)
      setSlugTaken(null)
      setSessionExpired(false)

      try {
        const result: ProvisionResult = await provisionWorkspace({ data })

        switch (result.status) {
          case 'created':
            setCreated({ name: result.organizationName, useCase: data.useCase })
            setStep(3)
            return
          case 'slug_taken':
            // A conflict on the only contended field. The rest of the step is
            // untouched and the suggestions are one click away.
            setSlugTaken({ suggestions: result.suggestions })
            return
          case 'unauthenticated':
            setSessionExpired(true)
            return
          case 'workspace_limit':
            // Partial failure: the workspace exists, the plan does not allow a
            // second one. Never a half-created row.
            setServerError(
              `Your workspace is ready, but the plan allows 1. Your previous workspace is ${result.existingWorkspaceName ?? 'already set up'}.`,
            )
            return
          case 'server_error':
            setServerError(
              `We couldn't create your workspace — nothing was saved. Try again. Reference: ${result.requestId}`,
            )
        }
      } finally {
        setProvisioning(false)
      }
    },
    [online],
  )

  const meta = STEP_META[STEPS[step - 1] ?? 'Account']
  const announcement = `Step ${step} of ${STEPS.length}: ${meta.title}`

  return (
    <div className="flex flex-col gap-6">
      {/* The step is announced so a screen-reader user is never left guessing. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      <Stepper steps={[...STEPS]} currentStep={step} className="justify-center" />

      <Card>
        <CardHeader className="text-center">
          {step === 1 ? (
            <Badge variant="secondary" className="justify-self-center">
              <HugeiconsIcon icon={SparklesIcon} data-icon="inline-start" />
              Getting started
            </Badge>
          ) : null}
          {step === 3 ? (
            <div className="relative mx-auto mb-3 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <HugeiconsIcon icon={Tick04Icon} size={28} strokeWidth={1.5} aria-hidden="true" />
            </div>
          ) : null}
          <CardTitle className="text-lg font-semibold">{meta.title}</CardTitle>
          <CardDescription>{meta.description}</CardDescription>
        </CardHeader>

        <CardContent>
          {isSessionPending ? (
            <div className="flex min-h-40 items-center justify-center" aria-busy="true">
              <span className="sr-only">Checking your session</span>
            </div>
          ) : step === 1 ? (
            <SignupStep1
              availableProviders={providers.data ?? null}
              online={online}
              onSignedIn={() => undefined}
            />
          ) : step === 2 ? (
            <SignupStep2
              onSubmit={(data) => void handleProvision(data)}
              onBack={session ? () => setStep(1) : undefined}
              online={online}
              pending={provisioning}
              serverError={serverError}
              slugTaken={slugTaken}
              sessionExpired={sessionExpired}
            />
          ) : (
            <SignupStep3
              useCase={created?.useCase ?? 'run_courses'}
              onComplete={() => navigate({ to: '/dashboard' })}
            />
          )}
        </CardContent>
      </Card>

      {step === 1 ? (
        <p className="text-center text-sm text-muted-foreground">
          Already have a workspace?{' '}
          <Link
            to="/login"
            className="font-semibold text-foreground underline-offset-4 transition-colors hover:underline"
          >
            Sign in
          </Link>
        </p>
      ) : null}
    </div>
  )
}
