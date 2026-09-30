import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowRight02Icon, RefreshIcon } from '@hugeicons/core-free-icons'

import { Button } from '#/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '#/components/ui/input-group'
import { Spinner } from '#/components/ui/spinner'
import { ErrorMessage } from '#/components/common/error-message'
import { SignupWorkspaceSchema, slugFromName } from '#/features/auth/schemas/auth.signup.schema'
import type { SignupWorkspaceInput } from '#/features/auth/schemas/auth.signup.schema'
import { checkSubdomainAvailable } from '#/features/auth/server/auth.signup'
import { PRIMARY_USE_CASE_OPTIONS } from '#/features/onboarding/onboarding.checklist'

interface SignupStep2Props {
  onSubmit: (data: SignupWorkspaceInput) => void
  onBack?: () => void
  /** Provisioning is a write and is never queued — it is blocked while offline. */
  online: boolean
  pending?: boolean
  /** Screen-level failure, e.g. a plan limit or a 5xx with a request ID. */
  serverError?: string | null
  /** Server-confirmed collision. Operable suggestions come with it. */
  slugTaken?: { suggestions: string[] } | null
  /** Set when the sign-in session expired between steps. */
  sessionExpired?: boolean
}

/**
 * S-0.2 step 1 (Account & Org).
 *
 * Three things the spec is strict about and this form honours:
 *
 *  - **Primary Use Case is a radio group, not a multi-select.** One Tab stop,
 *    arrow keys to choose — the payment/no-payment answer is a single decision
 *    and must not read as "pick several".
 *  - **A slow subdomain check never blanks the form.** Only the subdomain field
 *    shows a pending state; the step indicator and everything already typed stay
 *    exactly where they are.
 *  - **A taken subdomain is a field error with operable suggestions**, never a
 *    screen-level failure — the rest of the step survives.
 */
function SignupStep2({
  onSubmit,
  onBack,
  online,
  pending,
  serverError,
  slugTaken,
  sessionExpired,
}: SignupStep2Props) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<SignupWorkspaceInput>({
    resolver: zodResolver(SignupWorkspaceSchema),
    defaultValues: { name: '', slug: '', useCase: undefined },
    mode: 'onBlur',
  })

  const [checking, setChecking] = useState(false)
  const slugEdited = useRef(false)

  const workspaceName = watch('name')
  const workspaceSlug = watch('slug')
  const selectedUseCase = watch('useCase')

  // `register()` must be called once per field, and its ref has to reach the
  // input — that ref is how React Hook Form learns the field's value. So the
  // handlers are pulled out here and the rest of the registration is spread
  // onto the input untouched. (Overriding the ref looks harmless and is not:
  // the form then validates `undefined` and reports the field as empty no
  // matter what the user typed.)
  const { onChange: onNameChange, ...nameField } = register('name')
  const { onChange: onSlugChange, ...slugField } = register('slug')

  function handleNameChange(event: React.ChangeEvent<HTMLInputElement>) {
    onNameChange(event)
    const previousDerived = slugFromName(workspaceName)

    // Keep the subdomain in step with the name until the user edits it, so a
    // slow check never fights the user's typing.
    if (!slugEdited.current || workspaceSlug === previousDerived) {
      slugEdited.current = false
      setValue('slug', slugFromName(event.target.value), { shouldValidate: false })
    }
  }

  function handleSlugChange(event: React.ChangeEvent<HTMLInputElement>) {
    slugEdited.current = true
    onSlugChange(event)
  }

  // Debounced availability check. A collision found here is advisory; the
  // authoritative answer is the server's response on submit.
  useEffect(() => {
    const slug = workspaceSlug.trim()
    if (!slug || slug.length < 3 || !online) return

    let cancelled = false
    setChecking(true)

    const timer = window.setTimeout(() => {
      void checkSubdomainAvailable({ data: { slug } })
        .then((result) => {
          if (cancelled) return
          if (!result.available) {
            setError('slug', { type: 'server', message: 'That subdomain is already taken.' })
          } else {
            clearErrors('slug')
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (!cancelled) setChecking(false)
        })
    }, 400)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      setChecking(false)
    }
  }, [workspaceSlug, online, setError, clearErrors])

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {sessionExpired ? (
        <ErrorMessage message="Your sign-in took too long. Sign in again — your workspace name is kept." />
      ) : serverError ? (
        <ErrorMessage message={serverError} />
      ) : null}

      <FieldGroup className="gap-5">
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
          <Input
            id="workspace-name"
            placeholder={import.meta.env.VITE_APP_NAME}
            autoComplete="organization"
            // Spec: "On arrival focus lands on the Workspace Name field."
            // `autoFocus` does this without taking the registration's ref away
            // the way a custom `ref` prop would.
            autoFocus
            {...nameField}
            onChange={handleNameChange}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={errors.name ? 'workspace-name-error' : undefined}
          />
          {errors.name ? (
            <FieldError id="workspace-name-error">{errors.name.message}</FieldError>
          ) : null}
        </Field>

        <Field data-invalid={errors.slug || slugTaken ? true : undefined}>
          <FieldLabel htmlFor="workspace-slug">Workspace URL</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="workspace-slug"
              placeholder="abugida"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              {...slugField}
              onChange={handleSlugChange}
              aria-invalid={errors.slug ? true : undefined}
              aria-describedby="workspace-slug-help"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText className="font-mono text-xs">
                .{import.meta.env.VITE_WORKSPACE_DOMAIN}
              </InputGroupText>
            </InputGroupAddon>
          </InputGroup>

          {errors.slug ? (
            <FieldError id="workspace-slug-error">{errors.slug.message}</FieldError>
          ) : slugTaken ? (
            <div className="flex flex-col gap-1.5">
              <FieldError id="workspace-slug-error">
                That subdomain is already taken. Try one of these:
              </FieldError>
              <div className="flex flex-wrap gap-1.5">
                {slugTaken.suggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="font-mono"
                    onClick={() => {
                      setValue('slug', suggestion, { shouldValidate: true })
                      clearErrors('slug')
                    }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <FieldDescription id="workspace-slug-help">
              {checking ? (
                <span className="inline-flex items-center gap-1.5">
                  <Spinner className="size-3" />
                  Checking availability…
                </span>
              ) : workspaceSlug ? (
                <>
                  Your workspace will live at{' '}
                  <span className="font-medium text-foreground">
                    {workspaceSlug}.{import.meta.env.VITE_WORKSPACE_DOMAIN}
                  </span>
                </>
              ) : (
                'Lowercase letters, numbers and hyphens.'
              )}
            </FieldDescription>
          )}
        </Field>

        <fieldset>
          <legend className="mb-2 text-sm font-medium">Primary use case</legend>
          <div
            role="radiogroup"
            aria-label="Primary use case"
            className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          >
            {PRIMARY_USE_CASE_OPTIONS.map((option) => {
              const checked = selectedUseCase === option.value
              return (
                <label
                  key={option.value}
                  className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3 text-left transition-colors focus-within:ring-[3px] focus-within:ring-ring/50 ${
                    checked
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-border hover:bg-accent/40'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="useCase"
                      value={option.value}
                      checked={checked}
                      onChange={() =>
                        setValue('useCase', option.value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                      className="size-4 accent-primary"
                    />
                    <span className="text-sm font-semibold leading-tight">{option.label}</span>
                  </span>
                  <span className="text-xs leading-relaxed text-muted-foreground">
                    {option.description}
                  </span>
                </label>
              )
            })}
          </div>
          {errors.useCase ? <FieldError>{errors.useCase.message}</FieldError> : null}
        </fieldset>
      </FieldGroup>

      <div className="flex gap-2">
        {onBack ? (
          <Button type="button" variant="outline" size="lg" onClick={onBack} disabled={pending}>
            Back
          </Button>
        ) : null}
        <Button
          type="submit"
          size="lg"
          className="flex-1"
          disabled={pending || !online || !selectedUseCase}
        >
          {pending ? (
            <>
              <Spinner data-icon="inline-start" />
              Setting up your workspace…
            </>
          ) : (
            <>
              Continue
              <HugeiconsIcon icon={ArrowRight02Icon} data-icon="inline-end" />
            </>
          )}
        </Button>
      </div>

      {!online ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <HugeiconsIcon icon={RefreshIcon} className="size-3.5" aria-hidden="true" />
          We'll finish creating your workspace when you're back.
        </p>
      ) : null}
    </form>
  )
}

export { SignupStep2 }
