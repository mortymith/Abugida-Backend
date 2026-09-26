import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, createFileRoute } from '@tanstack/react-router'
import { useHydrated } from '#/hooks/use-hydrated'
import { toast } from 'sonner'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { Button } from '#/components/ui/button'
import { Skeleton } from '#/components/ui/skeleton'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { EmptyState } from '#/components/common/empty-state'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { useRole } from '#/features/auth'
import { canEditLibrary } from '#/features/library/library.permissions'
import { Folder02Icon, FolderAddIcon, UploadIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  libraryListQueryOptions,
  libraryFoldersQueryOptions,
  libraryStatsQueryOptions,
  libraryTrailQueryOptions,
} from '#/features/library/hooks/library.queries'
import { parseLibrarySearch, trailFolderId } from '#/features/library/schemas/library.schema'
import { LibraryStatCards } from '#/features/library/components/library.stat-cards'
import { LibraryFoldersBar } from '#/features/library/components/library.folders-bar'
import { LibrarySearchInput } from '#/features/library/components/library.search-input'
import { LibraryAssetCard } from '#/features/library/components/library.asset-card'
import { LibraryPreviewModal } from '#/features/library/components/library.preview-modal'
import { LibraryUploadModal } from '#/features/library/components/library.upload-modal'
import { LibraryMoveDialog } from '#/features/library/components/library.move-dialog'
import {
  useDeleteAsset,
  useDuplicateAsset,
  useMoveAssets,
} from '#/features/library/hooks/library.mutations'
import type { LibrarySearch } from '#/features/library/schemas/library.schema'
import type { LibraryAssetCard as AssetCardDTO } from '#/features/library/library.types'

/** Filter chips for the type nav. `all` clears `type` rather than setting it. */
const TYPE_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'video', label: 'Video' },
  { value: 'document', label: 'PDFs' },
  { value: 'image', label: 'Image' },
  { value: 'audio', label: 'Audio' },
] as const

export const Route = createFileRoute('/_app/content-library/')({
  // Narrowing parser (see features/library/schemas/library.schema.ts): an
  // unrecognised ?type=/?sort=/?page= is dropped, never thrown, so a stale or
  // hand-edited URL can't take the page down.
  validateSearch: parseLibrarySearch,
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
    // `all` / `root` are view sentinels, not folder ids — no trail to load.
    const trailFolder = trailFolderId(deps.folder)
    return Promise.allSettled([
      context.queryClient.ensureQueryData(libraryListQueryOptions(query)),
      context.queryClient.ensureQueryData(libraryStatsQueryOptions()),
      context.queryClient.ensureQueryData(libraryFoldersQueryOptions()),
      ...(trailFolder
        ? [context.queryClient.ensureQueryData(libraryTrailQueryOptions(trailFolder))]
        : []),
    ])
  },
  component: ContentLibraryPage,
})

function ContentLibraryPage() {
  const search = Route.useSearch()
  const navigate = useNavigate()
  const role = useRole()
  const canEdit = canEditLibrary(role)

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
  const trailFolder = trailFolderId(search.folder)
  const trail = useQuery({
    ...libraryTrailQueryOptions(trailFolder ?? 'root'),
    enabled: trailFolder != null,
  })

  const [uploadOpen, setUploadOpen] = useState(false)
  const [previewAsset, setPreviewAsset] = useState<AssetCardDTO | null>(null)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleteTarget, setDeleteTarget] = useState<AssetCardDTO | null>(null)
  const [moveOpen, setMoveOpen] = useState(false)
  const [moveAssetsIds, setMoveAssetsIds] = useState<string[]>([])
  const moveAssets = useMoveAssets()
  const duplicateAsset = useDuplicateAsset()
  const deleteAsset = useDeleteAsset()

  // dnd-kit: draggable asset cards → droppable folder chips (S-3.4).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const [draggingAsset, setDraggingAsset] = useState<AssetCardDTO | null>(null)

  // `isFetching` flips to `true` during the first client render when the SSR
  // data is already stale by then (hydration can take longer than the list's
  // `staleTime`), which the server could never have rendered. Gating on
  // hydration keeps the grid's first render identical on both sides.
  const hydrated = useHydrated()
  const gridBusy = hydrated && assets.isFetching

  /**
   * Merges `patch` into the current search.
   *
   * A key present in `patch` with an `undefined` value *clears* that param —
   * which is how the "All" chips opt out of a filter. Spreading `patch` over
   * the current search is what makes that work: the earlier
   * `patch.x !== undefined ? patch.x : current.x` treated `undefined` as
   * "leave unchanged", so "All", "All folders" and "Newest" could never reset
   * their filter. Any filter change also drops `page`, otherwise the user
   * lands on a page that no longer exists for the new filter.
   *
   * `replace` keeps refining in place: chips, sort and typing are exploration,
   * not navigation, so Back should return to the previous *view*, not to the
   * previous keystroke. Paging opts out (`{ replace: false }`) because moving
   * between result pages is a step a user may legitimately want to undo.
   */
  function patchSearch(patch: LibrarySearch, options?: { replace?: boolean }) {
    // Key *presence* (not value) signals a filter change: clearing a filter
    // passes `undefined`, which is exactly the case that must reset paging.
    const filters = ['q', 'folder', 'type', 'sort'] as const
    const resetsPage = filters.some((key) => key in patch)
    void navigate({
      to: '/content-library',
      replace: options?.replace ?? true,
      search: (prev) => {
        // At runtime `prev` is this route's already-validated search object.
        // The router types it loosely because `validateSearch` is a plain
        // function rather than a schema, so narrow it back here.
        const current = prev as LibrarySearch
        const next: LibrarySearch = { ...current, ...patch }
        if (resetsPage) next.page = undefined
        return next
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
            disabled={selectedIds.size === 0}
            onClick={() => {
              setMoveAssetsIds([...selectedIds])
              setMoveOpen(true)
            }}
          >
            Move to folder…
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
        <LibrarySearchInput value={search.q} onCommit={(q) => patchSearch({ q })} />
        <nav aria-label="Type filter" className="flex flex-wrap gap-1">
          {TYPE_FILTERS.map((filter) => {
            const active = (search.type ?? 'all') === filter.value
            return (
              <Button
                key={filter.value}
                variant={active ? 'default' : 'outline'}
                size="xs"
                aria-pressed={active}
                onClick={() =>
                  patchSearch({
                    type: filter.value === 'all' ? undefined : filter.value,
                    page: undefined,
                  })
                }
              >
                {filter.label}
              </Button>
            )
          })}
        </nav>
        <label className="ml-auto flex items-center gap-1 text-sm text-muted-foreground">
          Sort
          <select
            value={search.sort ?? 'newest'}
            aria-label="Sort assets"
            className="h-8 rounded-lg border bg-input/30 px-2 text-sm"
            onChange={(event) => {
              const next = event.target.value
              patchSearch({
                sort: next === 'newest' ? undefined : (next as LibrarySearch['sort']),
                page: undefined,
              })
            }}
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
        search.q || search.type ? (
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
        ) : search.folder && search.folder !== 'root' ? (
          <EmptyState
            icon={<HugeiconsIcon icon={Folder02Icon} aria-hidden="true" />}
            title="This folder is empty. Drag assets here."
            description={
              canEdit ? 'Drop assets onto the folder above, or use Move to folder…' : undefined
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
        // `id` keeps dnd-kit's `aria-describedby` target stable. Without it
        // dnd-kit falls back to a module-level counter that keeps growing on the
        // long-lived SSR process, so the server and the client disagree on the id
        // and hydration mismatches.
        <DndContext
          id="content-library-assets"
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          {/* `keepPreviousData` keeps the last page on screen while a new search
              runs; `isPlaceholderData` marks those rows as not yet matching the
              current query so the grid can read as "updating", not "final". */}
          <div
            className="grid grid-cols-1 gap-3 transition-opacity sm:grid-cols-2 lg:grid-cols-3 aria-busy:opacity-60"
            aria-busy={gridBusy}
            aria-label="Assets"
          >
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
                onMove={() => {
                  setMoveAssetsIds([asset.publicId])
                  setMoveOpen(true)
                }}
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
              onClick={() => patchSearch({ page: assets.data.page - 1 }, { replace: false })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!assets.data.hasNextPage}
              onClick={() => patchSearch({ page: assets.data.page + 1 }, { replace: false })}
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

      <LibraryMoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        folders={folders.data ?? []}
        assetCount={moveAssetsIds.length}
        currentFolderId={search.folder ?? 'root'}
        pending={moveAssets.isPending}
        onMove={(folderId) => {
          moveAssets.mutate(
            { assetPublicIds: moveAssetsIds, folderId },
            {
              onSuccess: () => {
                setMoveOpen(false)
                setSelectedIds(new Set())
              },
            },
          )
        }}
      />

      <ConfirmDialog
        open={deleteTarget != null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        title={`Delete asset “${deleteTarget?.name ?? ''}”?`}
        body={
          deleteTarget && deleteTarget.usageCount > 0
            ? `This asset is used in ${deleteTarget.usageCount} place${deleteTarget.usageCount === 1 ? '' : 's'} (lessons and course banners). Are you sure you want to delete it? Linked lessons keep working, but the library entry will be gone.`
            : 'Are you sure you want to delete this asset? This cannot be undone.'
        }
        confirmLabel="Delete asset"
        destructive
        onConfirm={async () => {
          if (!deleteTarget) return
          try {
            await deleteAsset.mutateAsync({
              assetPublicId: deleteTarget.publicId,
              acknowledgedUsage: deleteTarget.usageCount > 0,
            })
            setDeleteTarget(null)
          } catch (cause) {
            // The server rejects an in-use delete that was not acknowledged
            // (e.g. usage changed since the card rendered). Surface it and
            // leave the dialog open instead of hanging on an unhandled reject.
            toast.error(
              cause instanceof Error
                ? cause.message.replace(/^[A-Z_]+:\s*/, '')
                : 'Unable to delete this asset.',
            )
          }
        }}
      />
    </div>
  )
}
