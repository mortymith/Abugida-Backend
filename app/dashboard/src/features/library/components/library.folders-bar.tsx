import { useEffect, useMemo, useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { useCreateFolder, useDeleteFolder, useRenameFolder } from '../hooks/library.mutations'
import { describeFolderDelete, viewAfterFolderDelete } from '../library.folder-tree'
import type { LibraryFolderNode } from '../library.types'

/**
 * S-3.4 folder strip: breadcrumbs + "All Assets"/"Uncategorized" views +
 * folder chips (click to drill in, drop targets for asset cards, ⋯ menu for
 * rename/delete). "+ New Folder" opens an inline prompt dialog.
 *
 * Rename/delete live in `FolderActionsMenu`, which is rendered in two places:
 * on the folder chips *and* on the breadcrumb steps. The breadcrumb copy is
 * what makes the folder you are currently inside manageable — inside a folder
 * the chips only list its children, so without it there was no affordance to
 * rename or delete the folder the user is actually looking at.
 */
export function LibraryFoldersBar({
  folders,
  trail,
  activeFolder,
  canEdit,
  onSelectFolder,
}: {
  folders: LibraryFolderNode[]
  trail: { publicId: string; name: string }[]
  /** 'all' | 'root' | folder public id */
  activeFolder: string
  canEdit: boolean
  onSelectFolder: (folder: string) => void
}) {
  const createFolder = useCreateFolder()
  const renameFolder = useRenameFolder()
  const deleteFolder = useDeleteFolder()
  const [newFolderOpen, setNewFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renameTarget, setRenameTarget] = useState<LibraryFolderNode | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<LibraryFolderNode | null>(null)

  // The breadcrumb only carries ids + names; the actions menu needs the full
  // node (asset count drives the delete impact copy, name seeds the input).
  const folderByPublicId = useMemo(
    () => new Map(folders.map((folder) => [folder.publicId, folder])),
    [folders],
  )

  const trailIds = new Set(trail.map((step) => step.publicId))
  // Inside a folder, show its direct children; at root show root folders.
  const visibleFolders =
    activeFolder === 'all' || activeFolder === 'root'
      ? folders.filter((folder) => folder.parentId === null)
      : folders.filter(
          (folder) => folder.parentId === activeFolder || trailIds.has(folder.publicId),
        )

  function setFolder(next: string) {
    onSelectFolder(next)
  }

  function startRename(folder: LibraryFolderNode) {
    setRenameTarget(folder)
    setRenameValue(folder.name)
  }

  function startDelete(folder: LibraryFolderNode) {
    setDeleteTarget(folder)
  }

  function closeNewFolder() {
    setNewFolderOpen(false)
    setNewFolderName('')
  }

  function closeRename() {
    setRenameTarget(null)
    setRenameValue('')
  }

  const childCount = deleteTarget
    ? folders.filter((folder) => folder.parentId === deleteTarget.publicId).length
    : 0

  return (
    <section aria-label="Folders">
      <nav aria-label="Folder breadcrumb" className="flex flex-wrap items-center gap-1 text-sm">
        <button
          type="button"
          onClick={() => setFolder('all')}
          className={
            activeFolder === 'all'
              ? 'font-semibold text-foreground'
              : 'text-muted-foreground hover:underline'
          }
        >
          Content Library
        </button>
        {trail.map((step) => {
          const node = folderByPublicId.get(step.publicId)
          return (
            <span key={step.publicId} className="flex items-center gap-1">
              <span aria-hidden="true" className="text-muted-foreground">
                ▸
              </span>
              <button
                type="button"
                onClick={() => setFolder(step.publicId)}
                className={
                  step.publicId === activeFolder
                    ? 'font-semibold text-foreground'
                    : 'text-muted-foreground hover:underline'
                }
              >
                {step.name}
              </button>
              {canEdit && node ? (
                <FolderActionsMenu
                  folder={node}
                  onRename={() => startRename(node)}
                  onDelete={() => startDelete(node)}
                />
              ) : null}
            </span>
          )
        })}
        <span className="ml-auto" />
        {canEdit ? (
          <Button size="sm" variant="outline" onClick={() => setNewFolderOpen(true)}>
            + New Folder
          </Button>
        ) : null}
      </nav>

      <div className="mt-2 flex flex-wrap gap-2">
        <FolderChip
          label="Uncategorized"
          publicId="root"
          active={activeFolder === 'root'}
          onSelect={() => setFolder('root')}
          canEdit={false}
          // "Uncategorized" is a real destination (the drag handler maps
          // `folder:root` → folderId null), so it stays a drop target even
          // though it has no rename/delete actions of its own.
          droppable={canEdit}
        />
        {visibleFolders.map((folder) => (
          <FolderChip
            key={folder.publicId}
            label={`${folder.name} (${folder.assetCount})`}
            publicId={folder.publicId}
            active={activeFolder === folder.publicId}
            onSelect={() => setFolder(folder.publicId)}
            canEdit={canEdit}
            onRename={() => startRename(folder)}
            onDelete={() => startDelete(folder)}
          />
        ))}
      </div>

      {newFolderOpen ? (
        <NameDialog
          title="New folder"
          label="Folder name"
          value={newFolderName}
          onValueChange={setNewFolderName}
          pending={createFolder.isPending}
          onCancel={closeNewFolder}
          onSubmit={(name) => {
            createFolder.mutate(
              {
                name,
                parentId: activeFolder !== 'all' && activeFolder !== 'root' ? activeFolder : null,
              },
              { onSuccess: closeNewFolder },
            )
          }}
        />
      ) : null}

      {renameTarget ? (
        <NameDialog
          key={renameTarget.publicId}
          title="Rename folder"
          label="Folder name"
          value={renameValue}
          onValueChange={setRenameValue}
          pending={renameFolder.isPending}
          onCancel={closeRename}
          onSubmit={(name) => {
            renameFolder.mutate(
              { folderPublicId: renameTarget.publicId, name },
              // Only close on success: a name clash leaves the dialog open
              // with the rejected value so the user can adjust it.
              { onSuccess: closeRename },
            )
          }}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={`Delete folder “${deleteTarget?.name ?? ''}”?`}
        body={describeFolderDelete(deleteTarget?.assetCount ?? 0, childCount)}
        confirmLabel="Delete folder"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return
          const next = viewAfterFolderDelete(trail, activeFolder, deleteTarget.publicId)
          await deleteFolder.mutateAsync({ folderPublicId: deleteTarget.publicId })
          if (next) setFolder(next)
          setDeleteTarget(null)
        }}
      />
    </section>
  )
}

function FolderChip({
  label,
  publicId,
  active,
  onSelect,
  canEdit,
  droppable: droppableEnabled = canEdit,
  onRename,
  onDelete,
}: {
  label: string
  publicId: string
  active: boolean
  onSelect: () => void
  canEdit: boolean
  /** Whether assets can be dragged onto this chip (defaults to the edit role). */
  droppable?: boolean
  onRename?: () => void
  onDelete?: () => void
}) {
  const droppable = useDroppable({ id: `folder:${publicId}`, disabled: !droppableEnabled })
  const showActions = canEdit && publicId !== 'root' && onRename != null && onDelete != null
  return (
    <span
      ref={droppable.setNodeRef}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm transition-colors ${
        active ? 'border-primary bg-primary/10 font-medium' : 'bg-card'
      } ${droppable.isOver ? 'border-primary bg-primary/20 ring-2 ring-ring' : ''}`}
    >
      <button type="button" onClick={onSelect} className="focus-visible:outline-hidden">
        📁 {label}
      </button>
      {showActions ? (
        <FolderActionsMenu
          label={label}
          onRename={onRename}
          onDelete={onDelete}
          triggerClassName="ml-1 rounded px-1 text-muted-foreground hover:bg-muted"
        />
      ) : null}
    </span>
  )
}

/**
 * The "⋯" menu for a single folder.
 *
 * NOTE: Base UI's `Menu.Item` takes `onClick` — it has no `onSelect` prop
 * (that is Radix's API). Passing `onSelect` spreads it onto the underlying
 * `<div>` as a DOM `select` listener, which only fires on text selection, so
 * every action in the menu silently did nothing.
 */
function FolderActionsMenu({
  folder,
  label,
  onRename,
  onDelete,
  triggerClassName = 'rounded px-1 text-muted-foreground hover:bg-muted',
}: {
  folder?: LibraryFolderNode
  label?: string
  onRename: () => void
  onDelete: () => void
  triggerClassName?: string
}) {
  const accessibleLabel = folder
    ? `Folder actions for ${folder.name}`
    : `Folder actions for ${label ?? 'folder'}`
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={triggerClassName}
            aria-label={accessibleLabel}
            // The chip wraps a droppable node; keep the click from reaching it.
            onClick={(event) => event.stopPropagation()}
          >
            ⋯
          </button>
        }
      />
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={onRename}>Rename</DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onDelete}>
          Delete folder
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NameDialog({
  title,
  label,
  value,
  onValueChange,
  pending,
  onCancel,
  onSubmit,
}: {
  title: string
  label: string
  value: string
  onValueChange: (value: string) => void
  pending: boolean
  onCancel: () => void
  onSubmit: (name: string) => void
}) {
  // Escape closes — matching the Dialog-based flows elsewhere in the app.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !pending) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onCancel, pending])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel()
      }}
    >
      <form
        className="w-full max-w-sm rounded-xl border bg-card p-4 shadow-lg"
        onSubmit={(event) => {
          event.preventDefault()
          const name = value.trim()
          // A no-op rename would still round-trip and toast "Folder renamed."
          if (name) onSubmit(name)
        }}
      >
        <h2 className="mb-3 text-sm font-semibold">{title}</h2>
        <Input
          autoFocus
          value={value}
          aria-label={label}
          onChange={(event) => onValueChange(event.target.value)}
          maxLength={120}
          disabled={pending}
          placeholder="e.g. TOEFL Speaking"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending || value.trim().length === 0}>
            {pending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </form>
    </div>
  )
}
