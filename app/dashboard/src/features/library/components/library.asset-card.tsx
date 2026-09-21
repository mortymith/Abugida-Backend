import { useDraggable } from '@dnd-kit/core'
import { Link } from '@tanstack/react-router'
import { DocIcon, ImageIcon, PlayCircleIcon, MusicNoteIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '#/components/ui/button'
import { Card } from '#/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '#/components/ui/dropdown-menu'
import { formatBytes, ASSET_CATEGORY_LABELS } from '../library.asset-category'
import type { AssetCategory } from '@abugida/database/catalog'
import type { LibraryAssetCard as AssetCardDTO } from '../library.types'

/**
 * Asset grid card (S-3.1): thumbnail/icon, name, size · uses, tags, upload
 * recency, and per-card actions. Draggable onto folder chips (S-3.4).
 */
export function LibraryAssetCard({
  asset,
  canEdit,
  selectMode,
  selected,
  onSelectToggle,
  onPreview,
  onEdit,
  onDelete,
  onMove,
  onDuplicate,
}: {
  asset: AssetCardDTO
  canEdit: boolean
  selectMode: boolean
  selected: boolean
  onSelectToggle: (checked: boolean) => void
  onPreview: () => void
  onEdit: () => void
  onDelete: () => void
  onMove: () => void
  onDuplicate: () => void
}) {
  const draggable = useDraggable({
    id: `asset:${asset.publicId}`,
    disabled: !canEdit || selectMode,
  })

  return (
    <Card
      ref={draggable.setNodeRef}
      {...draggable.listeners}
      {...draggable.attributes}
      className={`group relative flex touch-none flex-col overflow-hidden pt-0 ${selected ? 'ring-2 ring-ring' : ''} ${draggable.isDragging ? 'opacity-50' : ''}`}
      aria-grabbed={draggable.isDragging}
    >
      {selectMode && canEdit ? (
        <label className="absolute top-2 left-2 z-10 flex cursor-pointer items-center gap-1 rounded bg-background/80 px-1 py-0.5 text-xs">
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => onSelectToggle(event.target.checked)}
            className="size-3.5 accent-primary"
            aria-label={`Select ${asset.name}`}
          />
        </label>
      ) : null}

      <button
        type="button"
        onClick={() => (selectMode && canEdit ? onSelectToggle(!selected) : onPreview())}
        className="flex h-28 w-full items-center justify-center border-b bg-muted/30 text-muted-foreground"
        aria-label={selectMode && canEdit ? `Select ${asset.name}` : `Preview ${asset.name}`}
      >
        <CategoryGlyph category={asset.category} size="large" />
      </button>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <div className="flex items-start justify-between gap-1">
          <Link
            to="/content-library/$assetId"
            params={{ assetId: asset.publicId }}
            className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
            title={asset.name}
          >
            {asset.name}
          </Link>
          {canEdit ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Actions for ${asset.name}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    ⋯
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={onEdit}>Edit metadata</DropdownMenuItem>
                <DropdownMenuItem onSelect={onPreview}>Preview</DropdownMenuItem>
                <DropdownMenuItem onSelect={onMove}>Move to folder…</DropdownMenuItem>
                <DropdownMenuItem onSelect={onDuplicate}>Duplicate</DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={onDelete}>
                  Delete asset
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          {ASSET_CATEGORY_LABELS[asset.category]} · {formatBytes(asset.fileSizeBytes)} ·{' '}
          {asset.usageCount} {asset.usageCount === 1 ? 'use' : 'uses'}
        </p>

        {asset.tags.length > 0 ? (
          <ul className="flex flex-wrap gap-1" aria-label={`Tags for ${asset.name}`}>
            {asset.tags.slice(0, 3).map((tag) => (
              <li
                key={tag}
                className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                {tag}
              </li>
            ))}
            {asset.tags.length > 3 ? (
              <li className="text-[10px] text-muted-foreground">+{asset.tags.length - 3}</li>
            ) : null}
          </ul>
        ) : (
          <span className="text-[10px] text-transparent">·</span>
        )}

        <p className="mt-auto text-[11px] text-muted-foreground">
          Uploaded {formatUploadedAt(asset.createdAt)}
        </p>
      </div>
    </Card>
  )
}

export function CategoryGlyph({
  category,
  size = 'small',
}: {
  category: AssetCategory
  size?: 'small' | 'large'
}) {
  const dimension = size === 'large' ? 'size-10' : 'size-4'
  const iconClass = `${dimension} shrink-0`
  switch (category) {
    case 'video':
      return <HugeiconsIcon icon={PlayCircleIcon} className={iconClass} aria-hidden="true" />
    case 'image':
      return <HugeiconsIcon icon={ImageIcon} className={iconClass} aria-hidden="true" />
    case 'audio':
      return <HugeiconsIcon icon={MusicNoteIcon} className={iconClass} aria-hidden="true" />
    default:
      return <HugeiconsIcon icon={DocIcon} className={iconClass} aria-hidden="true" />
  }
}

function formatUploadedAt(isoDate: string): string {
  const date = new Date(isoDate)
  const diffDays = Math.floor((Date.now() - date.getTime()) / 86_400_000)
  if (diffDays <= 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 30) return `${diffDays} days ago`
  return date.toISOString().slice(0, 10)
}
