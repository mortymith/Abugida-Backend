import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Skeleton } from '#/components/ui/skeleton'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { useRole } from '#/features/auth'
import { Folder02Icon, FolderAddIcon, UploadIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  libraryListQueryOptions,
  libraryFoldersQueryOptions,
  libraryStatsQueryOptions,
  libraryTrailQueryOptions,
} from '#/features/library/hooks/library.queries'
import { LibraryStatCards } from '#/features/library/components/library.stat-cards'
import { LibraryFoldersBar } from '#/features/library/components/library.folders-bar'
import { LibraryAssetCard } from '#/features/library/components/library.asset-card'
import { LibraryPreviewModal } from '#/features/library/components/library.preview-modal'
import { LibraryUploadModal } from '#/features/library/components/library.upload-modal'
import {
  useDeleteAsset,
  useDuplicateAsset,
  useMoveAssets,
} from '#/features/library/hooks/library.mutations'
import type { LibraryAssetCard as AssetCardDTO } from '#/features/library/library.types'

const librarySearchSchema = z.object({
  q: z.string().optional(),
  folder: z.string().optional(),
  type: z.enum(['video', 'image', 'audio', 'document']).optional(),
  sort: z.enum(['newest', 'oldest', 'name', 'size', 'uses']).optional(),
  page: z.coerce.number().int().min(1).optional(),
})

export const Route = createFileRoute('/_app/content-library/')({
  validateSearch: librarySearchSchema,
  loaderDeps: ({ search }) => ({
    q: search.q,
    folder: search.folder,
    type: search.type,
    sort: search.sort,
    page: search.page,
  }),
  loader: ({ context, deps }) => {
    const query = {
      q: deps.q,
      category: deps.type,
      folder: deps.folder,
      sort: deps.sort,
      page: deps.page,
    }
    return Promise.allSettled([
      context.queryClient.ensureQueryData(libraryListQueryOptions(query)),
      context.queryClient.ensureQueryData(libraryStatsQueryOptions()),
      context.queryClient.ensureQueryData(libraryFoldersQueryOptions()),
      ...(deps.folder
        ? [context.queryClient.ensureQueryData(libraryTrailQueryOptions(deps.folder))]
        : []),
    ])
  },
  component: ContentLibraryPage,
})

type SearchShape = {
  q?: string
  folder?: string
  type?: 'video' | 'image' | 'audio' | 'document'
  sort?: 'newest' | 'oldest' | 'name' | 'size' | 'uses'
  page?: number
}

function ContentLibraryPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const role = useRole()
  const canEdit = role === 'admin' || role === 'editor'

  const query = {
    q: search.q,
    category: search.type,
    folder: search.folder,
    sort: search.sort,
    page: search.page,
  }

  const assets = useQuery(libraryListQueryOptions(query))
  const stats = useQuery(libraryStatsQueryOptions())
  const folders = useQuery(libraryFoldersQueryOptions())
  const trail = useQuery({
    ...libraryTrailQueryOptions(search.folder ?? '__none__'),
    enabled: Boolean(search.folder),
  })

  const [uploadOpen, setUploadOpen] = useState(false)
  const [previewAsset, setPreviewAsset] = useState<AssetCardDTO | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<AssetCardDTO | null>(null)
  const moveAssets = useMoveAssets()
  const duplicateAsset = useDuplicateAsset()
  const deleteAsset = useDeleteAsset()

  // dnd-kit: draggable asset cards → droppable folder chips (S-3.4).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [draggingAsset, setDraggingAsset] = useState<AssetCardDTO | null>(null)

  function patchSearch(patch: Partial<SearchShape>) {
    void navigate({
      to: '/content-library',
      search: (prev) => {
        const current = prev as Partial<SearchShape>
        return {
          q: patch.q !== undefined ? patch.q : current.q,
          folder: patch.folder !== undefined ? patch.folder : current.folder,
          type: patch.type !== undefined ? patch.type : current.type,
          sort: patch.sort !== undefined ? patch.sort : current.sort,
          page: patch.page !== undefined ? patch.page : current.page,
        }
      },
    })
  }

  function toggleSelected(assetPublicId: string, checked: boolean) {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (checked) next.add(assetPublicId)
      else next.delete(assetPublicId)
      return next
    })
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    if (!id.startsWith('asset:')) return
    const asset = assets.data?.rows.find((row) => row.publicId === id.slice('asset:'.length))
    setDraggingAsset(asset ?? null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingAsset(null)
    const overId = event.over?.id
    if (!overId) return
    const target = String(overId)
    if (!target.startsWith('folder:')) return
    const activeId = String(event.active.id)
    if (!activeId.startsWith('asset:')) return
    const assetPublicId = activeId.slice('asset:'.length)
    const folderId = target.slice('folder:'.length)
    moveAssets.mutate({
      assetPublicIds: [assetPublicId],
      folderId: folderId === 'root' ? null : folderId,
    })
  }

  // Reset selection when the visible list changes context.
  useEffect(() => {
    setSelectedIds(new Set())
  }, [search.folder, search.q, search.type, search.page])

  const rows = assets.data?.rows ?? []

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">Content Library</h1>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectMode((value) => !value)}
                aria-pressed={selectMode}
              >
                {selectMode ? 'Cancel selection' : 'Select'}
              </Button>
              <Button size="sm" onClick={() => setUploadOpen(true)}>
                <HugeiconsIcon icon={UploadIcon} className="size-4" aria-hidden="true" />
                Upload
              </Button>
            </>
          ) : (
            <span className="text-xs text-muted-foreground">Read-only access</span>
          )}
        </div>
      </header>

      {selectMode && canEdit ? (
        <div
          className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-2 text-sm"
          role="toolbar"
          aria-label="Bulk actions"
        >
          <span>{selectedIds.size} selected</span>
          <span className="flex-1" />
          <Button
            size="sm"
            variant="outline"
            disabled={selectedIds.size === 0 || moveAssets.isPending}
            onClick={() => {
              // Bulk move targets "Uncategorized" from the selection bar;
              // per-folder moves use drag or the card menu.
              moveAssets.mutate({ assetPublicIds: [...selectedIds], folderId: null })
              setSelectedIds(new Set())
            }}
          >
            Move to Uncategorized
          </Button>
        </div>
      ) : null}

      <LibraryStatCards stats={stats.data} />

      <LibraryFoldersBar
        folders={folders.data ?? []}
        trail={trail.data ?? []}
        activeFolder={search.folder ?? 'all'}
        canEdit={canEdit}
        onSelectFolder={(folder) =>
          patchSearch({ folder: folder === 'all' ? undefined : folder, page: undefined })
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          placeholder="Search assets, tags, descriptions…"
          value={search.q ?? ''}
          aria-label="Search assets"
          className="max-w-xs"
          onChange={(event) => patchSearch({ q: event.target.value || undefined, page: undefined })}
        />
        <nav aria-label="Type filter" className="flex flex-wrap gap-1">
          {(['all', 'video', 'document', 'image', 'audio'] as const).map((type) => (
            <Button
              key={type}
              variant={(search.type ?? 'all') === type ? 'default' : 'outline'}
              size="xs"
              aria-pressed={(search.type ?? 'all') === type}
              onClick={() =>
                patchSearch({ type: type === 'all' ? undefined : type, page: undefined })
              }
            >
              {type === 'all'
                ? 'All'
                : type === 'document'
                  ? 'PDFs'
                  : type[0].toUpperCase() + type.slice(1)}
            </Button>
          ))}
        </nav>
        <label className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
          Sort
          <select
            value={search.sort ?? 'newest'}
            aria-label="Sort assets"
            className="h-8 rounded-lg border bg-input/30 px-2 text-sm"
            onChange={(event) =>
              patchSearch({
                sort:
                  event.target.value === 'newest'
                    ? undefined
                    : (event.target.value as Exclude<SearchShape['sort'], undefined>),
                page: undefined,
              })
            }
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="name">Name</option>
            <option value="size">Size</option>
            <option value="uses">Uses</option>
          </select>
        </label>
      </div>

      {assets.isPending ? (
        <div
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
          aria-busy="true"
          aria-label="Loading assets"
        >
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : assets.isError ? (
        <RetryErrorState
          title="Unable to load assets. Retry?"
          onRetry={() => void assets.refetch()}
          isRetrying={assets.isRefetching}
        />
      ) : rows.length === 0 ? (
        search.q || search.type || search.folder ? (
          <EmptyState
            variant="compact"
            title="No matches — adjust filters"
            description="No assets match the current search and filters."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => void navigate({ to: '/content-library', search: {} })}
              >
                Clear filters
              </Button>
            }
          />
        ) : (
          <EmptyState
            icon={<HugeiconsIcon icon={Folder02Icon} aria-hidden="true" />}
            title="No assets uploaded. Upload your first asset to get started."
            action={
              canEdit ? (
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                  <HugeiconsIcon icon={FolderAddIcon} className="size-4" aria-hidden="true" />
                  Upload asset
                </Button>
              ) : undefined
            }
          />
        )
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((asset) => (
              <LibraryAssetCard
                key={asset.publicId}
                asset={asset}
                canEdit={canEdit}
                selectMode={selectMode}
                selected={selectedIds.has(asset.publicId)}
                onSelectToggle={(checked) => toggleSelected(asset.publicId, checked)}
                onPreview={() => setPreviewAsset(asset)}
                onEdit={() =>
                  void navigate({
                    to: '/content-library/$assetId',
                    params: { assetId: asset.publicId },
                  })
                }
                onDelete={() => setDeleteTarget(asset)}
                onMove={() =>
                  void navigate({
                    to: '/content-library/$assetId',
                    params: { assetId: asset.publicId },
                  })
                }
                onDuplicate={() =>
                  duplicateAsset.mutate({ assetPublicId: asset.publicId, folderId: null })
                }
              />
            ))}
          </div>
          <DragOverlay>
            {draggingAsset ? (
              <span className="rounded-lg border bg-card px-3 py-2 text-sm shadow-lg">
                {draggingAsset.name}
              </span>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {assets.data && assets.data.totalRows > 0 ? (
        <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
          <span className="text-muted-foreground">
            Page {assets.data.page} of{' '}
            {Math.max(1, Math.ceil(assets.data.totalRows / assets.data.pageSize))} ·{' '}
            {assets.data.totalRows} assets
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={assets.data.page <= 1}
              onClick={() => patchSearch({ page: assets.data.page - 1 })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!assets.data.hasNextPage}
              onClick={() => patchSearch({ page: assets.data.page + 1 })}
            >
              Next
            </Button>
          </div>
        </nav>
      ) : null}

      <LibraryPreviewModal
        asset={previewAsset}
        siblings={rows}
        open={previewAsset != null}
        onOpenChange={(open) => {
          if (!open) setPreviewAsset(null)
        }}
        onRequestAsset={(asset) => setPreviewAsset(asset)}
      />

      <LibraryUploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        folderId={search.folder ?? null}
        canEdit={canEdit}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={`Delete asset “${deleteTarget?.name ?? ''}”?`}
        body={
          deleteTarget && deleteTarget.usageCount > 0
            ? `This asset is used in ${deleteTarget.usageCount} lesson${deleteTarget.usageCount === 1 ? '' : 's'}. Are you sure you want to delete it? Linked lessons keep working, but the library entry will be gone.`
            : 'Are you sure you want to delete this asset? This cannot be undone.'
        }
        confirmLabel="Delete asset"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return
          await deleteAsset.mutateAsync({
            assetPublicId: deleteTarget.publicId,
            acknowledgedUsage: deleteTarget.usageCount > 0,
          })
          setDeleteTarget(null)
        }}
      />
    </div>
  )
}
