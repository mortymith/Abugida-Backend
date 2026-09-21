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
  const [target, setTarget] = useState<string>(currentFolderId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Move {assetCount} asset{assetCount === 1 ? '' : 's'} to…
          </DialogTitle>
        </DialogHeader>
        <fieldset className="flex max-h-64 flex-col gap-1 overflow-y-auto">
          <legend className="sr-only">Destination folder</legend>
          <MoveOption
            label="Uncategorized"
            value="root"
            checked={target === 'root'}
            onChecked={() => setTarget('root')}
          />
          {folders.map((folder) => (
            <MoveOption
              key={folder.publicId}
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
      </DialogContent>
    </Dialog>
  )
}

function MoveOption({
  label,
  value,
  checked,
  onChecked,
}: {
  label: string
  value: string
  checked: boolean
  onChecked: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-accent">
      <input
        type="radio"
        name={`move-target-${value}`}
        checked={checked}
        onChange={onChecked}
        className="size-3.5 accent-primary"
      />
      📁 {label}
    </label>
  )
}
