import { useEffect, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Spinner } from '#/components/ui/spinner'
import { formatBytes } from '../library.asset-category'
import { getAssetReadUrl } from '../server/all'
import type { LibraryAssetCard } from '../library.types'

/**
 * S-3.5 File Preview Modal: lightweight reusable overlay for previewing
 * video, PDF, image or audio assets without leaving the current screen.
 * Prev/next walks the caller's asset list (e.g. the current folder view).
 */
export function LibraryPreviewModal({
  asset,
  siblings,
  open,
  onOpenChange,
  onRequestAsset,
}: {
  asset: LibraryAssetCard | null
  siblings: LibraryAssetCard[]
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called when prev/next selects a different asset. */
  onRequestAsset?: (asset: LibraryAssetCard) => void
}) {
  const [readUrl, setReadUrl] = useState<string | null>(null)
  const [urlState, setUrlState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [zoomed, setZoomed] = useState(false)

  useEffect(() => {
    if (!open || !asset) return
    let active = true
    setReadUrl(null)
    setUrlState('loading')
    setZoomed(false)
    getAssetReadUrl({ data: { assetPublicId: asset.publicId, disposition: 'inline' } })
      .then((result) => {
        if (!active) return
        setReadUrl(result.url)
        setUrlState(result.url ? 'ready' : 'error')
      })
      .catch(() => {
        if (active) setUrlState('error')
      })
    return () => {
      active = false
    }
  }, [asset, open])

  if (!asset) return null

  const index = siblings.findIndex((candidate) => candidate.publicId === asset.publicId)
  const hasPrev = index > 0
  const hasNext = index >= 0 && index < siblings.length - 1

  function step(delta: -1 | 1) {
    if (index < 0) return
    const nextIndex = index + delta
    if (nextIndex < 0 || nextIndex >= siblings.length) return
    onRequestAsset?.(siblings[nextIndex])
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{asset.name}</DialogTitle>
        </DialogHeader>

        <div
          className="flex min-h-64 items-center justify-center overflow-hidden rounded-lg bg-muted/40"
          aria-live="polite"
        >
          {urlState === 'loading' ? <Spinner className="size-8" /> : null}
          {urlState === 'error' ? (
            <div className="p-8 text-center">
              <p className="text-sm font-medium">Preview not available.</p>
              <p className="mt-1 text-sm text-muted-foreground">Download to view.</p>
            </div>
          ) : null}
          {urlState === 'ready' && readUrl && asset.mimeType?.startsWith('video/') ? (
            <video src={readUrl} controls autoPlay className="max-h-[70vh] w-full">
              <track kind="captions" />
            </video>
          ) : null}
          {urlState === 'ready' && readUrl && asset.mimeType?.startsWith('image/') ? (
            <button
              type="button"
              onClick={() => setZoomed((value) => !value)}
              className="flex cursor-zoom-in items-center justify-center p-2"
              aria-label={zoomed ? 'Reset zoom' : 'Zoom image'}
            >
              <img
                src={readUrl}
                alt={asset.name}
                className={
                  zoomed ? 'max-h-none max-w-none' : 'max-h-[70vh] max-w-full object-contain'
                }
              />
            </button>
          ) : null}
          {urlState === 'ready' && readUrl && asset.mimeType === 'application/pdf' ? (
            <iframe src={readUrl} title={asset.name} className="h-[70vh] w-full rounded-lg" />
          ) : null}
          {urlState === 'ready' && readUrl && asset.mimeType?.startsWith('audio/') ? (
            <audio src={readUrl} controls autoPlay className="w-full p-6">
              <track kind="captions" />
            </audio>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPrev}
            onClick={() => step(-1)}
            aria-label="Previous asset in folder"
          >
            ◀ Prev
          </Button>
          <p className="text-xs text-muted-foreground">
            {formatBytes(asset.fileSizeBytes)}
            {asset.mimeType ? ` · ${asset.mimeType}` : ''}
          </p>
          <div className="flex items-center gap-2">
            <DownloadButton asset={asset} />
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              onClick={() => step(1)}
              aria-label="Next asset in folder"
            >
              Next ▶
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DownloadButton({ asset }: { asset: LibraryAssetCard }) {
  const [busy, setBusy] = useState(false)
  return (
    <Button
      variant="secondary"
      size="sm"
      disabled={busy}
      onClick={() => {
        setBusy(true)
        getAssetReadUrl({
          data: {
            assetPublicId: asset.publicId,
            disposition: 'attachment',
            downloadName: asset.name,
          },
        })
          .then((result) => {
            if (result.url) window.location.href = result.url
          })
          .finally(() => setBusy(false))
      }}
    >
      Download
    </Button>
  )
}
