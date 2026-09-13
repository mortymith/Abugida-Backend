import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'

import { SignupStep1 } from '#/features/auth/components/auth.signup-step-1'
import { SignupStep2 } from '#/features/auth/components/auth.signup-step-2'
import { SignupStep3 } from '#/features/auth/components/auth.signup-step-3'
import { Stepper } from '#/components/ui/stepper'
import { Badge } from '#/components/ui/badge'
import { HugeiconsIcon } from '@hugeicons/react'
import { SparklesIcon } from '@hugeicons/core-free-icons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card'
import { signupOrganization } from '#/server/functions/auth.signup'
import type { WorkspaceInput } from '#/features/auth/schemas/auth.signup.schema'

export const Route = createFileRoute('/_auth/signup')({
  component: SignupPage,
})

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
    description: 'Your workspace is ready. Here are a few ideas to get you started.',
  },
}

const STEP_KEY = ['Account', 'Workspace', 'Start'] as const

function SignupPage() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [slugError, setSlugError] = useState<string | null>(null)

  const handleStep1Complete = () => {
    setCurrentStep(2)
  }

  const handleStep2Complete = async (data: WorkspaceInput) => {
    setLoading(true)
    setServerError(null)
    setSlugError(null)

    try {
      await signupOrganization({ data })
      setCurrentStep(3)
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      if (/subdomain|slug|taken|already exist/i.test(message)) {
        setSlugError('That subdomain is already taken. Try another one.')
      } else {
        setServerError(
          message && !/internal server error/i.test(message)
            ? message
            : "We couldn't create your workspace. Please try again in a moment.",
        )
      }
    } finally {
      setLoading(false)
    }
  }

  const handleStep3Complete = () => {
    navigate({ to: '/dashboard' })
  }

  const meta = STEP_META[STEP_KEY[currentStep - 1]]

  return (
    <div className="flex flex-col gap-6">
      <Stepper steps={[...STEPS]} currentStep={currentStep} className="justify-center" />

      <Card>
        <CardHeader className="text-center">
          {currentStep === 1 && (
            <Badge variant="secondary" className="justify-self-center">
              <HugeiconsIcon icon={SparklesIcon} data-icon="inline-start" />
              Getting started
            </Badge>
          )}
          <CardTitle className="text-lg font-semibold">{meta.title}</CardTitle>
          <CardDescription>{meta.description}</CardDescription>
        </CardHeader>

        <CardContent>
          {currentStep === 1 && <SignupStep1 onComplete={handleStep1Complete} />}
          {currentStep === 2 && (
            <SignupStep2
              onComplete={handleStep2Complete}
              loading={loading}
              serverError={serverError}
              slugError={slugError}
            />
          )}
          {currentStep === 3 && <SignupStep3 onComplete={handleStep3Complete} />}
        </CardContent>
      </Card>

      <p className="text-center text-sm text-muted-foreground">
        Already have a workspace?{' '}
        <Link
          to="/login"
          className="font-semibold text-foreground underline-offset-4 transition-colors hover:underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  )
}
