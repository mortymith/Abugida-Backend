/**
 * Upload queue state machine for S-3.2 (pure logic — unit-tested). The
 * modal drives it with reducer actions; each file flows
 * queued → uploading → completing → done | error, with per-file progress.
 */

export type QueueItemStatus = 'queued' | 'uploading' | 'completing' | 'done' | 'error'

export interface QueueItem {
  /** Client-side unique key (file can be renamed). */
  id: string
  fileName: string
  displayName: string
  sizeBytes: number
  contentType: string | null
  status: QueueItemStatus
  /** 0–100 upload progress. */
  progress: number
  error?: string
  resultAssetPublicId?: string
}

export type QueueAction =
  | { type: 'add'; items: QueueItem[] }
  | { type: 'remove'; id: string }
  | { type: 'rename'; id: string; displayName: string }
  | { type: 'status'; id: string; status: QueueItemStatus }
  | { type: 'progress'; id: string; progress: number }
  | { type: 'error'; id: string; message: string }
  | { type: 'done'; id: string; assetPublicId: string }
  | { type: 'reset' }

export function uploadQueueReducer(state: QueueItem[], action: QueueAction): QueueItem[] {
  switch (action.type) {
    case 'add':
      return [...state, ...action.items]
    case 'remove':
      // Only files that are not in flight can be pulled from the queue.
      return state.filter(
        (item) =>
          !(item.id === action.id && item.status !== 'uploading' && item.status !== 'completing'),
      )
    case 'rename':
      return state.map((item) =>
        item.id === action.id && item.status !== 'uploading' && item.status !== 'completing'
          ? { ...item, displayName: action.displayName }
          : item,
      )
    case 'status':
      return state.map((item) =>
        item.id === action.id ? { ...item, status: action.status } : item,
      )
    case 'progress':
      return state.map((item) =>
        item.id === action.id
          ? { ...item, progress: Math.min(100, Math.max(0, action.progress)) }
          : item,
      )
    case 'error':
      return state.map((item) =>
        item.id === action.id ? { ...item, status: 'error', error: action.message } : item,
      )
    case 'done':
      return state.map((item) =>
        item.id === action.id
          ? { ...item, status: 'done', progress: 100, resultAssetPublicId: action.assetPublicId }
          : item,
      )
    case 'reset':
      return []
    default:
      return state
  }
}

/**
 * "Replace existing asset with same name" matcher (spec S-3.2 checkbox):
 * case-insensitive on the trimmed display name.
 */
export function findExistingByName(
  existingNames: { publicId: string; name: string }[],
  displayName: string,
): { publicId: string; name: string } | null {
  const needle = displayName.trim().toLowerCase()
  if (needle === '') return null
  return existingNames.find((candidate) => candidate.name.trim().toLowerCase() === needle) ?? null
}

export interface FileValidationIssue {
  code: 'unsupported_type' | 'too_large' | 'empty'
  message: string
}

/** Client-side pre-validation mirroring the server gate (UX only). */
export function validatePickedFile(
  fileName: string,
  sizeBytes: number,
  contentType: string | null,
  supportedMimes: readonly string[],
  maxSizeBytes: number,
): FileValidationIssue | null {
  if (sizeBytes <= 0) return { code: 'empty', message: 'File is empty.' }
  if (sizeBytes > maxSizeBytes)
    return { code: 'too_large', message: 'File exceeds the size limit.' }
  const supported =
    (contentType != null && supportedMimes.includes(contentType)) ||
    /\.(mp4|pdf|png|jpe?g|mp3)$/i.test(fileName)
  if (!supported) return { code: 'unsupported_type', message: 'Unsupported file format.' }
  return null
}
