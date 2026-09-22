import { useEffect, useState } from 'react'
import { Loader2Icon } from 'lucide-react'
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
import { useUpdateStudent } from '../hooks/students.mutations'

/**
 * S-4.2 Edit Mode: inline edit for name and email. Phone numbers are
 * encrypted at rest upstream and currently read-only (displayed as ••••).
 */
export function StudentsProfileEditDialog({
  open,
  onOpenChange,
  profile,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  profile: { id: string; name: string; email: string }
}) {
  const [name, setName] = useState(profile.name)
  const [email, setEmail] = useState(profile.email)
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({})

  const updateMutation = useUpdateStudent()

  useEffect(() => {
    if (open) {
      setName(profile.name)
      setEmail(profile.email)
      setFieldErrors({})
    }
  }, [open, profile.name, profile.email])

  const submit = () => {
    const errors: typeof fieldErrors = {}
    if (!name.trim()) errors.name = 'Name is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    updateMutation.mutate(
      { studentId: profile.id, name: name.trim(), email: email.trim() },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Student</DialogTitle>
          <DialogDescription>
            Phone numbers are managed by the learner's account and can't be edited here.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            submit()
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="edit-student-name">
              Name{' '}
              <span aria-hidden className="text-destructive">
                *
              </span>
            </Label>
            <Input
              id="edit-student-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={fieldErrors.name != null}
              autoFocus
            />
            {fieldErrors.name && (
              <p role="alert" className="text-sm text-destructive">
                {fieldErrors.name}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="edit-student-email">
              Email{' '}
              <span aria-hidden className="text-destructive">
                *
              </span>
            </Label>
            <Input
              id="edit-student-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={fieldErrors.email != null}
            />
            {fieldErrors.email && (
              <p role="alert" className="text-sm text-destructive">
                {fieldErrors.email}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending && (
                <Loader2Icon aria-hidden className="size-4 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
