import { useState } from 'react'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import type { LibraryFolderNode } from '../library.types'

/**
 * "Move to folder…" dialog (S-3.4 context menu): lists the folder tree with
 * an Uncategorized option. Accessible alternative to drag-and-drop. The
 * caller executes the move with its own asset ids.
 */
export function LibraryMoveDialog({
  open,
  onOpenChange,
  folders,
  assetCount,
  currentFolderId,
  pending,
  onMove,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  folders: LibraryFolderNode[]
  assetCount: number
  /** View the assets currently live in ('all'/'root'/folder publicId). */
  currentFolderId: string
  pending: boolean
  onMove: (folderId: string | null) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Remounted per open so the destination resets to the current view —
          `useState(currentFolderId)` only seeded on first mount, and this
          component stays mounted across opens. */}
      <DialogContent className="max-w-sm" key={`${currentFolderId}:${assetCount}`}>
        <MoveDialogBody
          folders={folders}
          assetCount={assetCount}
          currentFolderId={currentFolderId}
          pending={pending}
          onOpenChange={onOpenChange}
          onMove={onMove}
        />
      </DialogContent>
    </Dialog>
  )
}

function MoveDialogBody({
  folders,
  assetCount,
  currentFolderId,
  pending,
  onOpenChange,
  onMove,
}: {
  folders: LibraryFolderNode[]
  assetCount: number
  currentFolderId: string
  pending: boolean
  onOpenChange: (open: boolean) => void
  onMove: (folderId: string | null) => void
}) {
  // 'all' is not a destination — it means "everywhere", which is not a move.
  const [target, setTarget] = useState<string>(currentFolderId === 'all' ? 'root' : currentFolderId)

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          Move {assetCount} asset{assetCount === 1 ? '' : 's'} to…
        </DialogTitle>
      </DialogHeader>
      <fieldset className="flex max-h-64 flex-col gap-1 overflow-y-auto">
        <legend className="sr-only">Destination folder</legend>
        <MoveOption
          groupName="library-move-target"
          label="Uncategorized"
          value="root"
          checked={target === 'root'}
          onChecked={() => setTarget('root')}
        />
        {folders.map((folder) => (
          <MoveOption
            key={folder.publicId}
            groupName="library-move-target"
            label={`${folder.name} (${folder.assetCount})`}
            value={folder.publicId}
            checked={target === folder.publicId}
            onChecked={() => setTarget(folder.publicId)}
          />
        ))}
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={pending}
          onClick={() => onMove(target === 'root' ? null : target)}
        >
          Move
        </Button>
      </div>
    </>
  )
}

function MoveOption({
  groupName,
  label,
  value,
  checked,
  onChecked,
}: {
  /** Shared `name` so the options form one real radio group (arrow-key nav). */
  groupName: string
  label: string
  value: string
  checked: boolean
  onChecked: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
      <input
        type="radio"
        name={groupName}
        value={value}
        checked={checked}
        onChange={onChecked}
        className="size-3.5 accent-primary"
      />
      📁 {label}
    </label>
  )
}
