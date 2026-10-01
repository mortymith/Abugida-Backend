import { useEffect, useSyncExternalStore, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Building03Icon, CheckmarkBadge03Icon, ChevronDownIcon } from '@hugeicons/core-free-icons'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Button } from '#/components/ui/button'
import { useOnline } from '#/hooks/use-online'
import {
  canSwitchWorkspace,
  useSwitchWorkspace,
  useWorkspaceContext,
  workspaceRoleLabel,
} from '#/features/workspaces'
import type { PlatformRole } from '#/features/auth'
import { trackNavEvent } from '#/features/navigation'

/**
 * Open state for the workspace menu, shared by its two entry points: the header
 * button and the avatar-menu item. A tiny external store rather than context
 * because the two live in different subtrees (the header and the sidebar
 * drawer) and only need one boolean.
 */
let openState = false
const listeners = new Set<() => void>()

function setOpen(next: boolean) {
  if (openState === next) return
  openState = next
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** `open` starts `false` on the server so SSR and hydration agree. */
export function useWorkspaceSwitcherOpen() {
  const open = useSyncExternalStore(
    subscribe,
    () => openState,
    () => false,
  )
  return { open, setOpen }
}

/**
 * S-13.2 Workspace Switcher, as the shell uses it.
 *
 * Two placements, one implementation: the **header button** (desktop — the
 * leftmost header element, because the workspace scopes everything below it) and
 * the **first row of the mobile drawer**, above the nav items.
 *
 * Both are governed by the same rule — the control is **absent for a
 * single-workspace user**, never disabled, because there is nothing to switch to
 * (spec 11 case 1) — and the avatar menu reads the same predicate, so no entry
 * point can claim a switcher the others do not have.
 *
 * `⌘/Ctrl+Shift+O` opens it from anywhere, including the item editor.
 */
export function WorkspaceSwitcher() {
  const context = useWorkspaceContext()
  const active = context.workspaces.find((workspace) => workspace.isActive)
  const [announcement, setAnnouncement] = useState('')

  if (!active) return null

  if (!canSwitchWorkspace(context)) {
    // Nothing to switch to: the scope is plain text, with no control at all.
    return (
      <p className="flex min-w-0 items-center gap-2 truncate text-sm">
        <span className="truncate font-medium">{active.name}</span>
        <RoleBadge role={active.platformRole} />
      </p>
    )
  }

  return (
    <>
      <SwitcherTrigger
        active={active}
        className="max-w-[28ch] justify-start gap-2"
        onSwitched={(name) => setAnnouncement(`Now viewing ${name}.`)}
      />
      {/* The destination is announced politely: a role swap is exactly the kind
          of change a screen-reader user must not discover silently. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  )
}

/** The mobile drawer's first row: workspace name, role badge, switcher. */
export function WorkspaceSwitcherRow() {
  const context = useWorkspaceContext()
  const active = context.workspaces.find((workspace) => workspace.isActive)
  const [announcement, setAnnouncement] = useState('')

  if (!active) return null

  if (!canSwitchWorkspace(context)) {
    return (
      <p className="flex items-center gap-2 px-2 py-1 text-sm">
        <span className="truncate font-medium">{active.name}</span>
        <RoleBadge role={active.platformRole} />
      </p>
    )
  }

  return (
    <>
      <SwitcherTrigger
        active={active}
        className="mt-1 w-full justify-start gap-2 px-2"
        onSwitched={(name) => setAnnouncement(`Now viewing ${name}.`)}
      />
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </>
  )
}

function SwitcherTrigger({
  active,
  className,
  onSwitched,
}: {
  active: { id: string; name: string; slug: string; platformRole: PlatformRole }
  className?: string
  onSwitched?: (name: string) => void
}) {
  const context = useWorkspaceContext()
  const online = useOnline()
  const switchWorkspace = useSwitchWorkspace()
  const { open, setOpen: setOpenState } = useWorkspaceSwitcherOpen()

  // `⌘/Ctrl+Shift+O` opens the switcher from anywhere in the app. Registered
  // only when the control exists, so the shortcut and the button share one
  // predicate: a single-workspace user has neither.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase()
      if (key !== 'o' || !(event.metaKey || event.ctrlKey) || !event.shiftKey) return
      event.preventDefault()
      setOpenState(true)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [setOpenState])

  // Switching reissues the session cookie, so it needs a connection — blocked
  // with a reason rather than failing silently (S-13.2 Offline).
  const blocked = !online

  function handleSelect(organizationId: string, name: string, from: string) {
    if (blocked) return
    switchWorkspace.mutate(organizationId, {
      onSuccess: () => {
        trackNavEvent('nav.workspace_switched', { from, to: name })
        onSwitched?.(name)
      },
    })
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className={className}
            aria-label={`Switch workspace. Currently ${active.name}`}
          />
        }
      >
        <HugeiconsIcon icon={Building03Icon} strokeWidth={2} />
        <span className="truncate font-medium">{active.name}</span>
        <RoleBadge role={active.platformRole} />
        <HugeiconsIcon icon={ChevronDownIcon} strokeWidth={2} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
        {blocked ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            You’re offline — switching needs a connection.
          </p>
        ) : null}
        {context.workspaces.map((workspace) => (
          <DropdownMenuItem
            key={workspace.id}
            // The active row is marked, not selected: it is a separate marker,
            // never a check-only control (S-13.2).
            aria-current={workspace.isActive ? 'true' : undefined}
            disabled={workspace.isActive || blocked || switchWorkspace.isPending}
            onClick={() => handleSelect(workspace.id, workspace.name, active.slug)}
          >
            {workspace.isActive ? (
              <HugeiconsIcon icon={CheckmarkBadge03Icon} strokeWidth={2} />
            ) : (
              <span className="size-4" aria-hidden="true" />
            )}
            <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {workspaceRoleLabel(workspace.platformRole)}
            </span>
          </DropdownMenuItem>
        ))}
        <p className="px-2 pt-1.5 text-xs text-muted-foreground">
          Every screen reloads against the workspace you switch to.
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * The member role for the **active workspace**, as a text pill. Never
 * colour-coded: roles are not statuses, and purple is reserved for active
 * navigation and primary actions (spec 11 § Status Colour Mapping).
 */
function RoleBadge({ role }: { role: PlatformRole }) {
  return (
    <span className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {workspaceRoleLabel(role)}
    </span>
  )
}
