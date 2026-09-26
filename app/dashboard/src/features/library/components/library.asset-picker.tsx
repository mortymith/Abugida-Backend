import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { CategoryGlyph } from './library.asset-card'
import { libraryListQueryOptions } from '../hooks/library.queries'
import { formatBytes, pickerCategoryFilter } from '../library.asset-category'
import type { AssetCategory } from '@abugida/database/catalog'
import type { LibraryListQuery } from '../schemas/library.schema'

/**
 * Content Library selection mode (spec 04 S-2.7 "Add Media" → S-3.1):
 * a reusable dialog for picking an existing asset (video/pdf/image) as a
 * lesson's media. Selection is returned to the caller; linking happens in
 * the lesson save flow.
 */
export function LibraryAssetPicker({
  open,
  onOpenChange,
  categories,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Which asset categories are acceptable for the target slot. */
  categories: AssetCategory[]
  onSelect: (asset: { publicId: string; name: string; category: AssetCategory }) => void
}) {
  const [textQuery, setTextQuery] = useState('')
  const { category, filterLocally } = pickerCategoryFilter(categories)
  const query: LibraryListQuery = { q: textQuery || undefined, category }
  const assets = useQuery({
    ...libraryListQueryOptions(query),
    enabled: open,
  })

  const rows = filterLocally
    ? (assets.data?.rows ?? []).filter((row) => categories.includes(row.category))
    : (assets.data?.rows ?? [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Choose from Content Library</DialogTitle>
        </DialogHeader>
        <Input
          type="search"
          placeholder="Search assets…"
          aria-label="Search assets"
          value={textQuery}
          onChange={(event) => setTextQuery(event.target.value)}
        />
        {assets.isPending ? (
          <p className="py-8 text-center text-sm text-muted-foreground" aria-busy="true">
            Loading…
          </p>
        ) : assets.isError ? (
          <RetryErrorState onRetry={() => void assets.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            variant="compact"
            title="No matching assets"
            description="Upload the file in the Content Library first, then pick it here."
          />
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" aria-label="Library assets">
            {rows.map((asset) => (
              <li key={asset.publicId}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-lg border p-2 text-left hover:bg-accent"
                  onClick={() => {
                    onSelect({
                      publicId: asset.publicId,
                      name: asset.name,
                      category: asset.category,
                    })
                    onOpenChange(false)
                  }}
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
                    <CategoryGlyph category={asset.category} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{asset.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatBytes(asset.fileSizeBytes)} · {asset.usageCount}{' '}
                      {asset.usageCount === 1 ? 'use' : 'uses'}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
