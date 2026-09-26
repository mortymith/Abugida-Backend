import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft01Icon, DownloadIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Spinner } from '#/components/ui/spinner'
import { Textarea } from '#/components/ui/textarea'
import { Card } from '#/components/ui/card'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { RetryErrorState } from '#/components/common/retry-error-state'
import { useRole } from '#/features/auth'
import { canEditLibrary } from '#/features/library/library.permissions'
import { toast } from 'sonner'
import {
  formatBytes,
  isSupportedAssetMime,
  isTranscribableCategory,
  resolveAssetMime,
} from '#/features/library/library.asset-category'
import {
  assetDetailQueryOptions,
  assetUsageQueryOptions,
  assetVersionsQueryOptions,
} from '#/features/library/hooks/library.queries'
import { LibraryPreviewModal } from '#/features/library/components/library.preview-modal'
import {
  useCompleteAssetVersion,
  useUpdateAssetMetadata,
} from '#/features/library/hooks/library.mutations'
import { getAssetReadUrl } from '#/features/library/server/all'
import type { AssetCategory } from '@abugida/database/catalog'

export const Route = createFileRoute('/_app/content-library/$assetId/')({
  loader: ({ context, params }) =>
    Promise.allSettled([
      context.queryClient.ensureQueryData(assetDetailQueryOptions(params.assetId)),
      context.queryClient.ensureQueryData(assetUsageQueryOptions(params.assetId)),
      context.queryClient.ensureQueryData(assetVersionsQueryOptions(params.assetId)),
    ]),
  component: AssetDetailPage,
})

function AssetDetailPage() {
  const { assetId } = Route.useParams()
  const navigate = useNavigate()
  const role = useRole()
  // S-3.3 is a read screen (Admin/Editor/Viewer) but every write control on it
  // is Admin/Editor only. Without this the buttons rendered for Reviewer/
  // Viewer too and the server answered each one with FORBIDDEN.
  const canEdit = canEditLibrary(role)

  const detail = useQuery(assetDetailQueryOptions(assetId))
  const usage = useQuery(assetUsageQueryOptions(assetId))
  const versions = useQuery(assetVersionsQueryOptions(assetId))

  const [readUrl, setReadUrl] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tagsDraft, setTagsDraft] = useState('')
  const [hydrated, setHydrated] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const updateMetadata = useUpdateAssetMetadata()

  useEffect(() => {
    if (hydrated || !detail.data) return
    setName(detail.data.name)
    setDescription(detail.data.description ?? '')
    setTagsDraft(detail.data.tags.join(', '))
    setHydrated(true)
  }, [detail.data, hydrated])

  useEffect(() => {
    let active = true
    getAssetReadUrl({ data: { assetPublicId: assetId, disposition: 'inline' } })
      .then((result) => {
        if (active) setReadUrl(result.url)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [assetId, detail.data?.updatedAt])

  if (detail.isPending) return <Spinner className="mx-auto my-12" />
  if (detail.isError) {
    return (
      <RetryErrorState
        title="Unable to load this asset. Retry?"
        onRetry={() => void detail.refetch()}
        isRetrying={detail.isRefetching}
      />
    )
  }

  const asset = detail.data
  const dirty =
    name.trim() !== asset.name ||
    description !== (asset.description ?? '') ||
    tagsDraft !== asset.tags.join(', ')

  function saveMetadata() {
    if (!canEdit) return
    updateMetadata.mutate({
      assetPublicId: assetId,
      name: name.trim(),
      description: description.trim() || null,
      tags: tagsDraft
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 20),
    })
  }

  const previewByCategory: Record<AssetCategory, boolean> = {
    image: true,
    video: true,
    audio: true,
    document: true,
    other: false,
  }

  // `usageCount` already covers live lesson links *and* course banners, so it
  // matches what the server re-derives before rejecting an unacknowledged delete.
  const acknowledged = asset.usageCount > 0
  const thumbnailUses = usage.data?.thumbnailCourses.length ?? 0

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Back to Content Library"
            onClick={() => void navigate({ to: '/content-library' })}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden="true" />
          </Button>
          <h1 className="truncate font-display text-xl font-bold">{asset.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              getAssetReadUrl({
                data: {
                  assetPublicId: assetId,
                  disposition: 'attachment',
                  downloadName: asset.name,
                },
              })
                .then((result) => {
                  if (result.url) window.location.href = result.url
                })
                .catch(() => undefined)
            }}
          >
            <HugeiconsIcon icon={DownloadIcon} className="size-4" aria-hidden="true" />
            Download
          </Button>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <section className="flex flex-col gap-3" aria-label="Asset preview and usage">
          <Card className="flex min-h-72 items-center justify-center overflow-hidden bg-muted/20 p-0">
            {previewByCategory[asset.category] && readUrl ? (
              asset.category === 'image' ? (
                <img src={readUrl} alt={asset.name} className="max-h-96 w-auto object-contain" />
              ) : asset.category === 'video' ? (
                <video src={readUrl} controls className="max-h-96 w-full">
                  <track kind="captions" />
                </video>
              ) : asset.category === 'audio' ? (
                <audio src={readUrl} controls className="w-full p-6">
                  <track kind="captions" />
                </audio>
              ) : (
                <iframe src={readUrl} title={asset.name} className="h-96 w-full" />
              )
            ) : (
              <p className="p-8 text-sm text-muted-foreground">
                Preview not available. Download to view.
              </p>
            )}
          </Card>
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setPreviewOpen(true)}
          >
            Open in preview modal
          </Button>

          <Card className="flex flex-col gap-2 p-4">
            <h2 className="text-sm font-semibold">
              Used In (
              {(usage.data?.lessonUses.length ?? 0) + (usage.data?.thumbnailCourses.length ?? 0)})
            </h2>
            {usage.isPending ? (
              <Spinner className="size-4" />
            ) : (usage.data?.lessonUses.length ?? 0) === 0 &&
              (usage.data?.thumbnailCourses.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">
                Not used yet. Link this asset from a lesson&rsquo;s media picker.
              </p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {(usage.data?.lessonUses ?? []).map((row) => (
                  <li key={row.lessonPublicId} className="text-muted-foreground">
                    <Link
                      to="/courses/$courseId"
                      params={{ courseId: row.coursePublicId }}
                      className="text-foreground hover:underline"
                    >
                      {row.courseTitle}
                    </Link>{' '}
                    →{' '}
                    <Link
                      to="/courses/$courseId/lessons/$lessonId"
                      params={{ courseId: row.coursePublicId, lessonId: row.lessonPublicId }}
                      className="text-foreground hover:underline"
                    >
                      {row.moduleTitle} → &ldquo;{row.lessonTitle}&rdquo;
                    </Link>
                  </li>
                ))}
                {(usage.data?.thumbnailCourses ?? []).map((row) => (
                  <li key={row.coursePublicId} className="text-muted-foreground">
                    <Link
                      to="/courses/$courseId"
                      params={{ courseId: row.coursePublicId }}
                      className="text-foreground hover:underline"
                    >
                      {row.courseTitle}
                    </Link>{' '}
                    → course banner
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>

        <aside className="flex flex-col gap-3" aria-label="Asset metadata">
          <Card className="flex flex-col gap-3 p-4">
            <p className="text-sm text-muted-foreground">
              Type: {asset.mimeType ?? 'unknown'} · Size: {formatBytes(asset.fileSizeBytes)}
              {asset.durationSeconds ? ` · ${Math.round(asset.durationSeconds / 60)} min` : ''}
            </p>
            <p className="text-sm text-muted-foreground">
              Uploaded {asset.createdAt.slice(0, 10)}
              {asset.uploadedByName ? ` by ${asset.uploadedByName}` : ''}
            </p>
            <p className="text-sm text-muted-foreground">
              Folder: {asset.folderName ?? 'Uncategorized'} · v{asset.currentVersion}
            </p>
            {/* S-3.6 Navigation: the transcription editor is opened from
                S-3.3 Asset Detail for video/audio assets. */}
            {isTranscribableCategory(asset.category) ? (
              <Button
                variant="outline"
                size="sm"
                className="self-start"
                title={
                  canEdit
                    ? 'Open the transcription & subtitle editor'
                    : 'Transcription authoring requires the Editor or Admin role'
                }
                disabled={!canEdit}
                onClick={() =>
                  void navigate({
                    to: '/content-library/$assetId/transcript',
                    params: { assetId: asset.publicId },
                    search: { returnTo: window.location.pathname + window.location.search },
                  })
                }
              >
                Captions &amp; transcript
              </Button>
            ) : null}
          </Card>

          <Card className="flex flex-col gap-3 p-4">
            <div>
              <Label htmlFor="asset-name">Asset name</Label>
              <Input
                id="asset-name"
                value={name}
                maxLength={300}
                readOnly={!canEdit}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="asset-tags">Tags (comma-separated)</Label>
              <Input
                id="asset-tags"
                value={tagsDraft}
                maxLength={400}
                readOnly={!canEdit}
                placeholder="TOEFL, Syllabus"
                onChange={(event) => setTagsDraft(event.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="asset-description">Description</Label>
              <Textarea
                id="asset-description"
                value={description}
                rows={3}
                maxLength={2_000}
                readOnly={!canEdit}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            {canEdit ? (
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!dirty}
                  onClick={() => setHydrated(false)}
                >
                  Revert
                </Button>
                <Button
                  size="sm"
                  disabled={!dirty || updateMetadata.isPending}
                  onClick={saveMetadata}
                >
                  {updateMetadata.isPending ? <Spinner className="size-4" /> : null}
                  Save changes
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Read-only access</p>
            )}
          </Card>

          <Card className="flex flex-col gap-2 p-4">
            <h2 className="text-sm font-semibold">
              Version History (v{asset.currentVersion} current)
            </h2>
            {versions.isPending ? (
              <Spinner className="size-4" />
            ) : (
              <ul className="flex flex-col gap-1 text-sm" aria-label="Version history">
                {(versions.data ?? []).map((version) => (
                  <li
                    key={version.versionNumber}
                    className="flex items-center justify-between gap-2"
                  >
                    <span>
                      v{version.versionNumber}
                      {version.isCurrent ? (
                        <span className="ml-1 rounded bg-muted px-1 text-xs text-muted-foreground">
                          current
                        </span>
                      ) : null}
                      {version.uploadedByName ? ` · ${version.uploadedByName}` : ''}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(version.fileSizeBytes)} · {version.createdAt.slice(0, 10)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <UploadNewVersionButton
              assetId={assetId}
              nextVersion={asset.currentVersion + 1}
              canEdit={canEdit}
            />
          </Card>

          {canEdit ? (
            <Button variant="destructive" onClick={() => setConfirmDelete(true)}>
              Delete Asset
            </Button>
          ) : null}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete asset “${asset.name}”?`}
        body={
          acknowledged
            ? `This asset is used in ${asset.usageCount} place${asset.usageCount === 1 ? '' : 's'}: ${asset.usageCount - thumbnailUses} lesson${asset.usageCount - thumbnailUses === 1 ? '' : 's'}${thumbnailUses > 0 ? ` and ${thumbnailUses} course banner${thumbnailUses === 1 ? '' : 's'}` : ''}. Are you sure you want to delete it? Linked lessons keep working, but the library entry will be gone.`
            : 'Are you sure you want to delete this asset? This cannot be undone.'
        }
        confirmLabel="Delete asset"
        destructive
        onConfirm={async () => {
          try {
            const { deleteAsset: deleteAssetFn } = await import('#/features/library/server/all')
            await deleteAssetFn({
              data: { assetPublicId: assetId, acknowledgedUsage: acknowledged },
            })
            setConfirmDelete(false)
            void navigate({ to: '/content-library' })
          } catch (cause) {
            // Keep the dialog open so the warning can be acknowledged and
            // retried; a silent rejection left the modal stuck on "Delete".
            toast.error(
              cause instanceof Error
                ? cause.message.replace(/^[A-Z_]+:\s*/, '')
                : 'Unable to delete this asset.',
            )
          }
        }}
      />

      <LibraryPreviewModal
        asset={
          previewOpen
            ? {
                publicId: asset.publicId,
                name: asset.name,
                category: asset.category,
                mimeType: asset.mimeType,
                fileSizeBytes: asset.fileSizeBytes,
                durationSeconds: asset.durationSeconds,
                folderId: asset.folderId,
                folderName: asset.folderName,
                tags: asset.tags,
                currentVersion: asset.currentVersion,
                createdAt: asset.createdAt,
                usageCount: asset.usageCount,
                previewUrl: null,
              }
            : null
        }
        siblings={[]}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </div>
  )
}

function UploadNewVersionButton({
  assetId,
  nextVersion,
  canEdit,
}: {
  assetId: string
  nextVersion: number
  canEdit: boolean
}) {
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const completeVersion = useCompleteAssetVersion()

  async function uploadVersion(file: File) {
    setBusy(true)
    setProgress(0)
    setError(null)
    try {
      const { uploadAssetVersion } = await import('#/features/library/server/all')
      const contentType = resolveAssetMime(file.name, file.type)
      if (contentType == null || !isSupportedAssetMime(contentType)) {
        setError('Unsupported file format. MP4, PDF, PNG, JPG or MP3 only.')
        return
      }
      const presigned = await uploadAssetVersion({
        data: {
          assetPublicId: assetId,
          fileName: file.name,
          contentType,
          fileSizeBytes: file.size,
        },
      })
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', presigned.uploadUrl)
        xhr.setRequestHeader('Content-Type', contentType)
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100))
          }
        })
        xhr.addEventListener('load', () =>
          xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)),
        )
        xhr.addEventListener('error', () => reject(new Error('Upload failed')))
        xhr.send(file)
      })
      await completeVersion.mutateAsync({
        assetPublicId: assetId,
        objectKey: presigned.objectKey,
        durationSeconds: null,
      })
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message.replace(/^[A-Z_]+:\s*/, '') : 'Upload failed.',
      )
    } finally {
      setBusy(false)
      setProgress(0)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      {canEdit ? (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy ? `Uploading ${progress}%` : `Upload New Version (v${nextVersion})`}
        </Button>
      ) : null}
      {error ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {canEdit ? (
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          aria-label="Select file for new version"
          accept=".mp4,.pdf,.png,.jpg,.jpeg,.mp3"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            if (file) void uploadVersion(file)
          }}
        />
      ) : null}
    </div>
  )
}
