import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  completeAssetUpload,
  completeAssetVersion,
  createFolder,
  deleteAsset,
  deleteFolder,
  deleteTranscript,
  duplicateAsset,
  moveAssets,
  renameFolder,
  updateAssetMetadata,
} from '../server/all'
import type { QueryKey } from '@tanstack/react-query'
import type {
  AssetDeleteInput,
  AssetDuplicateInput,
  AssetMetadataUpdateInput,
  AssetUploadCompleteInput,
  AssetVersionCompleteInput,
  AssetsMoveInput,
  FolderCreateInput,
  TranscriptDeleteInput,
  folderDeleteSchema,
} from '../schemas/library.schema'
import type { z } from 'zod'

/**
 * Library mutation hooks. Every mutation funnels through a shared wrapper
 * that invalidates the given keys, toasts success, and strips server error
 * codes (`CODE: message`) for display — matching the courses/notifications
 * conventions. Callers pass explicit keys so cache scoping stays obvious.
 */

type FolderDeleteInput = z.infer<typeof folderDeleteSchema>

function stripErrorCode(message: string): string {
  return message.replace(/^[A-Z_]+:\s*/, '')
}

export function useLibraryMutation<TInput, TOutput>(options: {
  mutationFn: (input: TInput) => Promise<TOutput>
  invalidate: QueryKey[]
  successToast?: string
  onSuccess?: (output: TOutput, input: TInput) => void
}) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: (output, input) => {
      options.invalidate.forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key })
      })
      if (options.successToast) toast.success(options.successToast)
      options.onSuccess?.(output, input)
    },
    onError: (cause) => {
      toast.error(
        cause instanceof Error ? stripErrorCode(cause.message) : 'Something went wrong. Retry?',
      )
    },
  })
}

export function useUpdateAssetMetadata() {
  return useLibraryMutation<AssetMetadataUpdateInput, { ok: true }>({
    mutationFn: (input) => updateAssetMetadata({ data: input }),
    invalidate: [['library', 'detail'], ['library', 'list'], ['search']],
    successToast: 'Asset updated.',
  })
}

export function useDeleteAsset() {
  return useLibraryMutation<AssetDeleteInput, { ok: true }>({
    mutationFn: (input) => deleteAsset({ data: input }),
    invalidate: [['library', 'list'], ['library', 'stats'], ['library', 'folders'], ['courses']],
    successToast: 'Asset deleted.',
  })
}

export function useDuplicateAsset() {
  return useLibraryMutation<AssetDuplicateInput, { assetPublicId: string }>({
    mutationFn: (input) => duplicateAsset({ data: input }),
    invalidate: [
      ['library', 'list'],
      ['library', 'stats'],
      ['library', 'folders'],
    ],
    successToast: 'Asset duplicated.',
  })
}

export function useMoveAssets() {
  return useLibraryMutation<AssetsMoveInput, { moved: number }>({
    mutationFn: (input) => moveAssets({ data: input }),
    invalidate: [
      ['library', 'list'],
      ['library', 'folders'],
      ['library', 'detail'],
    ],
    successToast: 'Assets moved.',
  })
}

export function useCreateFolder() {
  return useLibraryMutation<FolderCreateInput, { folderPublicId: string }>({
    mutationFn: (input) => createFolder({ data: input }),
    invalidate: [['library', 'folders']],
    successToast: 'Folder created.',
  })
}

export function useRenameFolder() {
  return useLibraryMutation<{ folderPublicId: string; name: string }, { ok: true }>({
    mutationFn: (input) => renameFolder({ data: input }),
    invalidate: [
      ['library', 'folders'],
      ['library', 'list'],
      ['library', 'detail'],
      // The breadcrumb trail is fetched per folder and caches the names it
      // read, so without this a rename left the breadcrumb showing the old
      // name until the entry went stale.
      ['library', 'trail'],
    ],
    successToast: 'Folder renamed.',
  })
}

export function useDeleteFolder() {
  return useLibraryMutation<
    FolderDeleteInput,
    { ok: true; movedAssets: number; reparentedFolders: number }
  >({
    mutationFn: (input) => deleteFolder({ data: input }),
    invalidate: [
      ['library', 'folders'],
      ['library', 'list'],
      ['library', 'trail'],
    ],
    successToast: 'Folder deleted.',
  })
}

export function useCompleteAssetVersion() {
  return useLibraryMutation<AssetVersionCompleteInput, { versionNumber: number }>({
    mutationFn: (input) => completeAssetVersion({ data: input }),
    invalidate: [
      ['library', 'detail'],
      ['library', 'versions'],
      ['library', 'list'],
      ['courses', 'lesson-edit'],
    ],
    successToast: 'New version uploaded.',
  })
}

export function useDeleteTranscript() {
  return useLibraryMutation<TranscriptDeleteInput, { ok: true }>({
    mutationFn: (input) => deleteTranscript({ data: input }),
    invalidate: [['library', 'transcript']],
    successToast: 'Transcript deleted.',
  })
}

/** Upload completion returns the new asset id — invalidation is broad. */
export function useCompleteAssetUpload() {
  return useLibraryMutation<AssetUploadCompleteInput, { assetPublicId: string; replaced: boolean }>(
    {
      mutationFn: (input) => completeAssetUpload({ data: input }),
      invalidate: [
        ['library', 'list'],
        ['library', 'stats'],
        ['library', 'folders'],
      ],
    },
  )
}
