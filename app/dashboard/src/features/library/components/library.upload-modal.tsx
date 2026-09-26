import { useCallback, useMemo, useReducer, useRef, useState } from 'react'
import { Button } from '#/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '#/components/ui/dialog'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'
import { Textarea } from '#/components/ui/textarea'
import { Spinner } from '#/components/ui/spinner'
import { ConfirmDialog } from '#/components/common/confirm-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getAssetUploadUrl } from '../server/all'
import { useCompleteAssetUpload } from '../hooks/library.mutations'
import { libraryQueryKeys } from '../hooks/library.queries'
import {
  ASSET_MAX_SIZE_BYTES,
  ASSET_MIME_LIST,
  formatBytes,
  resolveAssetMime,
  isSupportedAssetMime,
} from '../library.asset-category'
import { summarizeUploadRun, uploadQueueReducer, validatePickedFile } from '../library.upload-queue'
import type { QueueItem } from '../library.upload-queue'

/**
 * S-3.2 Asset Upload Modal: drag-and-drop multi-file queue, per-file
 * progress (XHR), shared metadata, and optional "replace existing asset
 * with same name" → recorded as a new version of the matched asset.
 */
export function LibraryUploadModal({
  open,
  onOpenChange,
  folderId,
  canEdit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  folderId: string | null
  canEdit: boolean
}) {
  const queryClient = useQueryClient()
  const [queue, dispatch] = useReducer(uploadQueueReducer, [])
  const [tags, setTags] = useState('')
  const [description, setDescription] = useState('')
  const [replaceExisting, setReplaceExisting] = useState(false)
  const [confirmClose, setConfirmClose] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const idCounter = useRef(0)
  // The File objects can't live in the reducer (non-serializable) — a ref
  // keeps them beside their queue entries.
  const filesRef = useRef(new Map<string, File>())
  const completeUpload = useCompleteAssetUpload()

  const uploading = queue.some(
    (item) => item.status === 'uploading' || item.status === 'completing',
  )
  const doneCount = queue.filter((item) => item.status === 'done').length
  const queuedIds = useMemo(
    () =>
      queue
        .filter((item) => item.status === 'queued' || item.status === 'error')
        .map((item) => item.id),
    [queue],
  )

  const addFiles = useCallback((files: FileList | File[]) => {
    const items: QueueItem[] = []
    for (const file of Array.from(files)) {
      const issue = validatePickedFile(
        file.name,
        file.size,
        file.type || null,
        ASSET_MIME_LIST,
        ASSET_MAX_SIZE_BYTES,
      )
      if (issue) {
        toast.error(`${file.name}: ${issue.message}`)
        continue
      }
      idCounter.current += 1
      const id = `file-${idCounter.current}`
      filesRef.current.set(id, file)
      items.push({
        id,
        fileName: file.name,
        displayName: file.name,
        sizeBytes: file.size,
        contentType: file.type || null,
        status: 'queued',
        progress: 0,
      })
    }
    if (items.length > 0) dispatch({ type: 'add', items })
  }, [])

  async function uploadOne(item: QueueItem, file: File) {
    dispatch({ type: 'status', id: item.id, status: 'uploading' })
    // 1. Presign (server validates role + mime + size).
    const contentType = resolveAssetMime(item.fileName, item.contentType)
    if (contentType == null || !isSupportedAssetMime(contentType)) {
      dispatch({ type: 'error', id: item.id, message: 'Unsupported file format.' })
      return
    }
    const presigned = await getAssetUploadUrl({
      data: {
        fileName: item.fileName,
        contentType,
        fileSizeBytes: item.sizeBytes,
      },
    })
    // 2. PUT with progress (fetch cannot report upload progress).
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', presigned.uploadUrl)
      xhr.setRequestHeader('Content-Type', contentType)
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          dispatch({
            type: 'progress',
            id: item.id,
            progress: Math.round((event.loaded / event.total) * 100),
          })
        }
      })
      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve()
        else reject(new Error(`Upload failed (${xhr.status}). Check file format and size.`))
      })
      xhr.addEventListener('error', () =>
        reject(new Error('Upload failed. Check your connection.')),
      )
      xhr.send(file)
    })
    // 3. Persist metadata (server heads the object before writing).
    dispatch({ type: 'status', id: item.id, status: 'completing' })
    const result = await completeUpload.mutateAsync({
      objectKey: presigned.objectKey,
      name: item.displayName.trim() || item.fileName,
      description: description.trim() || null,
      tags: tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean)
        .slice(0, 20),
      folderId,
      durationSeconds: null,
      replaceExisting,
    })
    dispatch({ type: 'done', id: item.id, assetPublicId: result.assetPublicId })
  }

  async function startUpload() {
    const pending = queue.filter((item) => queuedIds.includes(item.id))
    // Per-file outcomes from *this* run. Re-reading `queue` after the loop would
    // return the pre-run snapshot (dispatch does not update the value captured
    // in this render), which reported success even when every file failed.
    const outcomes: boolean[] = []
    for (const item of pending) {
      const file = filesRef.current.get(item.id)
      if (!file) {
        dispatch({ type: 'error', id: item.id, message: 'File missing — re-select it.' })
        outcomes.push(false)
        continue
      }
      try {
        await uploadOne(item, file)
        outcomes.push(true)
      } catch (cause) {
        dispatch({
          type: 'error',
          id: item.id,
          message:
            cause instanceof Error ? cause.message.replace(/^[A-Z_]+:\s*/, '') : 'Upload failed.',
        })
        outcomes.push(false)
      }
    }
    const summary = summarizeUploadRun(outcomes)
    if (summary.attempted > 0) {
      if (summary.allSucceeded) {
        toast.success(
          `${summary.attempted} asset${summary.attempted === 1 ? '' : 's'} uploaded successfully.`,
        )
        onOpenChange(false)
      } else {
        toast.warning(
          `${summary.succeeded} uploaded, ${summary.failed} failed — retry from the list.`,
        )
      }
      void queryClient.invalidateQueries({ queryKey: libraryQueryKeys.stats() })
      void queryClient.invalidateQueries({ queryKey: libraryQueryKeys.folders() })
    }
  }

  const onInputChange = (list: FileList | null) => {
    if (!list) return
    addFiles(list)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && uploading) {
          setConfirmClose(true)
          return
        }
        onOpenChange(next)
        if (!next) {
          dispatch({ type: 'reset' })
          filesRef.current.clear()
          setTags('')
          setDescription('')
          setReplaceExisting(false)
        }
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload Asset</DialogTitle>
        </DialogHeader>

        {canEdit ? (
          <>
            <div
              role="button"
              tabIndex={0}
              aria-label="Add files to upload queue"
              className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed p-4 text-center text-sm transition-colors ${
                dragOver ? 'border-primary bg-primary/10' : 'border-muted-foreground/30'
              }`}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click()
              }}
              onDragOver={(event) => {
                event.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault()
                setDragOver(false)
                addFiles(event.dataTransfer.files)
              }}
            >
              <span aria-hidden="true">📤</span>
              <span className="font-medium">Drag &amp; drop files here or click to browse</span>
              <span className="text-xs text-muted-foreground">
                Supported: MP4, PDF, PNG, JPG, MP3 · Max size: 500MB
              </span>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".mp4,.pdf,.png,.jpg,.jpeg,.mp3,video/mp4,application/pdf,image/png,image/jpeg,audio/mpeg"
                className="sr-only"
                onChange={(event) => {
                  onInputChange(event.target.files)
                  event.target.value = ''
                }}
              />
            </div>

            {queue.length > 0 ? (
              <ul className="flex flex-col gap-2" aria-label="Files to upload">
                {queue.map((item) => (
                  <li key={item.id} className="rounded-lg border p-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Input
                        value={item.displayName}
                        aria-label={`Asset name for ${item.fileName}`}
                        onChange={(event) =>
                          dispatch({ type: 'rename', id: item.id, displayName: event.target.value })
                        }
                        disabled={
                          item.status === 'uploading' ||
                          item.status === 'completing' ||
                          item.status === 'done'
                        }
                        className="h-8 flex-1"
                      />
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatBytes(item.sizeBytes)}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Remove ${item.fileName} from queue`}
                        disabled={item.status === 'uploading' || item.status === 'completing'}
                        onClick={() => {
                          filesRef.current.delete(item.id)
                          dispatch({ type: 'remove', id: item.id })
                        }}
                      >
                        ✕
                      </Button>
                    </div>
                    {item.status === 'uploading' || item.status === 'completing' ? (
                      <div
                        className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted"
                        role="progressbar"
                        aria-valuenow={item.progress}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div
                          className="h-full bg-primary transition-all"
                          style={{
                            width: `${item.status === 'completing' ? 100 : item.progress}%`,
                          }}
                        />
                      </div>
                    ) : null}
                    {item.status === 'error' ? (
                      <p className="mt-1 text-xs text-destructive" role="alert">
                        {item.error}
                      </p>
                    ) : null}
                    {item.status === 'done' ? (
                      <p className="mt-1 text-xs text-green-600 dark:text-green-400">Uploaded ✓</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="grid gap-3">
              <div>
                <Label htmlFor="upload-tags">Tags (comma-separated)</Label>
                <Input
                  id="upload-tags"
                  value={tags}
                  onChange={(event) => setTags(event.target.value)}
                  placeholder="TOEFL, Syllabus, PDF"
                  maxLength={400}
                />
              </div>
              <div>
                <Label htmlFor="upload-description">Description</Label>
                <Textarea
                  id="upload-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="What is this asset for?"
                  rows={2}
                  maxLength={2_000}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(event) => setReplaceExisting(event.target.checked)}
                  className="size-4 accent-primary"
                />
                Replace existing asset with same name
              </label>
            </div>

            <div className="flex items-center justify-end gap-2">
              {doneCount > 0 ? (
                <span className="mr-auto text-xs text-muted-foreground">
                  {doneCount}/{queue.length} uploaded
                </span>
              ) : null}
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => void startUpload()}
                disabled={queue.length === 0 || uploading || queuedIds.length === 0}
              >
                {uploading ? <Spinner className="size-4" /> : null}
                {uploading
                  ? 'Uploading…'
                  : `Upload ${queuedIds.length} Asset${queuedIds.length === 1 ? '' : 's'}`}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            You do not have permission to upload assets.
          </p>
        )}

        <ConfirmDialog
          open={confirmClose}
          onOpenChange={setConfirmClose}
          title="Close while uploading?"
          body="An upload is still in progress. Closing now will not finish it."
          confirmLabel="Close anyway"
          destructive
          onConfirm={() => {
            setConfirmClose(false)
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
