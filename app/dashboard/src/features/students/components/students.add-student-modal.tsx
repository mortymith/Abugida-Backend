import { useEffect, useState } from 'react'
import { Loader2Icon, MailIcon } from 'lucide-react'
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
import { Textarea } from '#/components/ui/textarea'
import { useCreateStudent } from '../hooks/students.mutations'

/**
 * S-4.1 Add Student state: collects name + email and creates an
 * invite-based account — students sign in via Google/Telegram and accounts
 * never store passwords.
 */
export function StudentsAddStudentModal({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string }>({})

  const createMutation = useCreateStudent()

  useEffect(() => {
    if (!open) {
      setName('')
      setEmail('')
      setNote('')
      setFieldErrors({})
    }
  }, [open])

  const submit = () => {
    const errors: typeof fieldErrors = {}
    if (!name.trim()) errors.name = 'Name is required'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errors.email = 'Enter a valid email'
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return

    createMutation.mutate(
      { name: name.trim(), email: email.trim(), note: note.trim() || undefined },
      {
        onSuccess: () => onOpenChange(false),
      },
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Student</DialogTitle>
          <DialogDescription>
            The student receives a sign-in invite — they complete registration with Google or
            Telegram. No passwords are stored.
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
            <Label htmlFor="add-student-name">
              Name{' '}
              <span aria-hidden className="text-destructive">
                *
              </span>
            </Label>
            <Input
              id="add-student-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Alemayehu Kebede"
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
            <Label htmlFor="add-student-email">
              Email{' '}
              <span aria-hidden className="text-destructive">
                *
              </span>
            </Label>
            <Input
              id="add-student-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="alemayehu@example.com"
              aria-invalid={fieldErrors.email != null}
            />
            {fieldErrors.email && (
              <p role="alert" className="text-sm text-destructive">
                {fieldErrors.email}
              </p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="add-student-note">Note (optional)</Label>
            <Textarea
              id="add-student-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Context for your team — stored in the audit trail."
              rows={2}
            />
          </div>

          <p className="flex items-start gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <MailIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
            The invite stays valid for 7 days. The account shows “Invite pending” until the student
            completes sign-in.
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending && (
                <Loader2Icon aria-hidden className="size-4 animate-spin" />
              )}
              Create Invite
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
