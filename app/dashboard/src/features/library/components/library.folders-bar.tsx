import { useState } from 'react'
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
import type { LibraryFolderNode } from '../library.types'

/**
 * S-3.4 folder strip: breadcrumbs + "All Assets"/"Uncategorized" views +
 * folder chips (click to drill in, drop targets for asset cards, ⋯ menu for
 * rename/delete). "+ New Folder" opens an inline prompt dialog.
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
        {trail.map((step) => (
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
          </span>
        ))}
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
          onRename={() => undefined}
          onDelete={() => undefined}
        />
        {visibleFolders.map((folder) => (
          <FolderChip
            key={folder.publicId}
            label={`${folder.name} (${folder.assetCount})`}
            publicId={folder.publicId}
            active={activeFolder === folder.publicId}
            onSelect={() => setFolder(folder.publicId)}
            canEdit={canEdit}
            onRename={() => {
              setRenameTarget(folder)
              setRenameValue(folder.name)
            }}
            onDelete={() => setDeleteTarget(folder)}
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
          onCancel={() => {
            setNewFolderOpen(false)
            setNewFolderName('')
          }}
          onSubmit={() => {
            createFolder.mutate(
              {
                name: newFolderName,
                parentId: activeFolder !== 'all' && activeFolder !== 'root' ? activeFolder : null,
              },
              {
                onSuccess: () => {
                  setNewFolderOpen(false)
                  setNewFolderName('')
                },
              },
            )
          }}
        />
      ) : null}

      {renameTarget ? (
        <NameDialog
          title="Rename folder"
          label="Folder name"
          value={renameValue}
          onValueChange={setRenameValue}
          pending={renameFolder.isPending}
          onCancel={() => setRenameTarget(null)}
          onSubmit={() => {
            renameFolder.mutate(
              { folderPublicId: renameTarget.publicId, name: renameValue },
              { onSuccess: () => setRenameTarget(null) },
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
        body={
          deleteTarget && deleteTarget.assetCount > 0
            ? `Move ${deleteTarget.assetCount} asset${deleteTarget.assetCount === 1 ? '' : 's'} to Uncategorized? Subfolders move to this folder's parent.`
            : 'Subfolders move to this folder\u2019s parent.'
        }
        confirmLabel="Delete folder"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteFolder.mutateAsync({ folderPublicId: deleteTarget.publicId })
          if (deleteTarget.publicId === activeFolder) setFolder('all')
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
  onRename,
  onDelete,
}: {
  label: string
  publicId: string
  active: boolean
  onSelect: () => void
  canEdit: boolean
  onRename: () => void
  onDelete: () => void
}) {
  const droppable = useDroppable({ id: `folder:${publicId}`, disabled: !canEdit })
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
      {canEdit && publicId !== 'root' ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="ml-1 rounded px-1 text-muted-foreground hover:bg-muted"
                aria-label={`Folder actions for ${label}`}
              >
                ⋯
              </button>
            }
          />
          <DropdownMenuContent align="start">
            <DropdownMenuItem onSelect={onRename}>Rename</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              Delete folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </span>
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
  onSubmit: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <form
        className="w-full max-w-sm rounded-xl border bg-card p-4 shadow-lg"
        onSubmit={(event) => {
          event.preventDefault()
          if (value.trim()) onSubmit()
        }}
      >
        <h2 className="mb-3 text-sm font-semibold">{title}</h2>
        <Input
          autoFocus
          value={value}
          aria-label={label}
          onChange={(event) => onValueChange(event.target.value)}
          maxLength={120}
          placeholder="e.g. TOEFL Speaking"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={pending || value.trim().length === 0}>
            Save
          </Button>
        </div>
      </form>
    </div>
  )
}
