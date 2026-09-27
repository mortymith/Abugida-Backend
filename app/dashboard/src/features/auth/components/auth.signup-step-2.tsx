import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowRight02Icon,
  Book02Icon,
  Briefcase02Icon,
  Settings02Icon,
} from '@hugeicons/core-free-icons'

import { WorkspaceSchema } from '#/features/auth/schemas/auth.signup.schema'
import type { WorkspaceInput } from '#/features/auth/schemas/auth.signup.schema'
import { Button } from '#/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '#/components/ui/field'
import { Input } from '#/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '#/components/ui/input-group'
import { ToggleGroup, ToggleGroupItem } from '#/components/ui/toggle-group'
import { Spinner } from '#/components/ui/spinner'
import { ErrorMessage } from '#/components/common/error-message'

interface SignupStep2Props {
  onComplete: (data: WorkspaceInput) => void
  loading?: boolean
  /** General error surfaced from the server, shown in an alert */
  serverError?: string | null
  /** Server error about the subdomain (e.g. already taken), shown inline under the URL field */
  slugError?: string | null
}

const USE_CASES = [
  { value: 'language_courses', label: 'Language Courses', icon: Book02Icon },
  { value: 'corporate_training', label: 'Corporate Training', icon: Briefcase02Icon },
  { value: 'other', label: 'Other', icon: Settings02Icon },
] as const

function generateSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}

function SignupStep2({ onComplete, loading, serverError, slugError }: SignupStep2Props) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<WorkspaceInput>({
    resolver: zodResolver(WorkspaceSchema),
    defaultValues: {
      name: '',
      slug: '',
      useCase: undefined,
    },
  })

  const workspaceName = watch('name')
  const workspaceSlug = watch('slug')
  const selectedUseCase = watch('useCase')

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    register('name').onChange(e)
    if (!watch('slug') || watch('slug') === generateSlug(workspaceName)) {
      setValue('slug', generateSlug(name), { shouldValidate: true })
    }
  }

  const onSubmit = (data: WorkspaceInput) => {
    onComplete(data)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
      {serverError && <ErrorMessage message={serverError} />}

      <FieldGroup className="gap-5">
        <Field data-invalid={errors.name ? true : undefined}>
          <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
          <Input
            id="workspace-name"
            placeholder={import.meta.env.VITE_APP_NAME}
            autoComplete="organization"
            {...register('name')}
            onChange={handleNameChange}
            aria-invalid={errors.name ? true : undefined}
          />
          {errors.name && <FieldError>{errors.name.message}</FieldError>}
        </Field>

        <Field data-invalid={errors.slug || slugError ? true : undefined}>
          <FieldLabel htmlFor="workspace-slug">Workspace URL</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id="workspace-slug"
              placeholder="abugida"
              autoComplete="off"
              className="font-mono"
              {...register('slug')}
              aria-invalid={errors.slug ? true : undefined}
            />
            <InputGroupAddon align="inline-end">
              <InputGroupText className="font-mono text-xs">
                .{import.meta.env.VITE_WORKSPACE_DOMAIN}
              </InputGroupText>
            </InputGroupAddon>
          </InputGroup>
          {errors.slug ? (
            <FieldError>{errors.slug.message}</FieldError>
          ) : slugError ? (
            <FieldError>{slugError}</FieldError>
          ) : (
            workspaceName &&
            workspaceSlug && (
              <FieldDescription>
                Your workspace will live at{' '}
                <span className="font-medium text-foreground">
                  {workspaceSlug}.{import.meta.env.VITE_WORKSPACE_DOMAIN}
                </span>
              </FieldDescription>
            )
          )}
        </Field>

        <Field data-invalid={errors.useCase ? true : undefined}>
          <FieldLabel htmlFor="workspace-use-case">Primary use case</FieldLabel>
          <ToggleGroup
            id="workspace-use-case"
            variant="outline"
            value={[selectedUseCase]}
            onValueChange={(groupValue) => {
              setValue('useCase', groupValue[0] as unknown as WorkspaceInput['useCase'], {
                shouldDirty: true,
                shouldValidate: true,
              })
            }}
            className="grid w-full grid-cols-3 gap-2"
          >
            {USE_CASES.map((useCase) => {
              const isSelected = selectedUseCase === useCase.value
              return (
                <ToggleGroupItem
                  key={useCase.value}
                  value={useCase.value}
                  aria-invalid={errors.useCase ? true : undefined}
                  className="h-auto w-full flex-col gap-1.5 rounded-xl px-3 py-3.5 hover:bg-transparent data-pressed:border-primary data-pressed:bg-primary/5 data-pressed:text-primary"
                >
                  <HugeiconsIcon
                    icon={useCase.icon}
                    size={20}
                    strokeWidth={1.5}
                    className={isSelected ? 'text-primary' : 'text-muted-foreground/70'}
                  />
                  <span className="text-xs font-semibold leading-tight">{useCase.label}</span>
                </ToggleGroupItem>
              )
            })}
          </ToggleGroup>
          {errors.useCase && <FieldError>{errors.useCase.message}</FieldError>}
        </Field>
      </FieldGroup>

      <Button type="submit" size="lg" className="w-full" disabled={loading || !selectedUseCase}>
        {loading ? (
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
    </form>
  )
}

export { SignupStep2 }
