import { keepPreviousData, queryOptions } from '@tanstack/react-query'
import {
  getAssetDetail,
  getAssetUsage,
  getAssetVersions,
  getFolderTrail,
  getLibraryAssets,
  getLibraryStats,
  getTranscript,
  listFolders,
} from '../server/all'
import type { MediaListQuery } from '../schemas/media.schema'

/** Query key registry for the media feature (['media', slice, ...id]). */
export const mediaQueryKeys = {
  list: (query: MediaListQuery) => ['media', 'list', query] as const,
  stats: () => ['media', 'stats'] as const,
  folders: () => ['media', 'folders'] as const,
  trail: (folderPublicId: string) => ['media', 'trail', folderPublicId] as const,
  detail: (assetPublicId: string) => ['media', 'detail', assetPublicId] as const,
  usage: (assetPublicId: string) => ['media', 'usage', assetPublicId] as const,
  versions: (assetPublicId: string) => ['media', 'versions', assetPublicId] as const,
  transcript: (assetPublicId: string, language: string) =>
    ['media', 'transcript', assetPublicId, language] as const,
}

const STALE = { list: 15_000, stats: 60_000, folders: 60_000, detail: 30_000, transcript: 0 }

export function mediaListQueryOptions(query: MediaListQuery) {
  return queryOptions({
    queryKey: mediaQueryKeys.list(query),
    queryFn: () => getLibraryAssets({ data: query }),
    staleTime: STALE.list,
    // Refining the search, changing a filter chip or paging changes the query
    // key. Without this the grid would fall back to `isPending` and flash the
    // skeleton grid on every change; keeping the previous page on screen while
    // the next one loads keeps the list stable.
    placeholderData: keepPreviousData,
  })
}

export function mediaStatsQueryOptions() {
  return queryOptions({
    queryKey: mediaQueryKeys.stats(),
    queryFn: () => getLibraryStats(),
    staleTime: STALE.stats,
  })
}

export function mediaFoldersQueryOptions() {
  return queryOptions({
    queryKey: mediaQueryKeys.folders(),
    queryFn: () => listFolders(),
    staleTime: STALE.folders,
  })
}

export function mediaTrailQueryOptions(folderPublicId: string) {
  return queryOptions({
    queryKey: mediaQueryKeys.trail(folderPublicId),
    queryFn: () => getFolderTrail({ data: { folderPublicId } }),
    staleTime: STALE.folders,
  })
}

export function assetDetailQueryOptions(assetPublicId: string) {
  return queryOptions({
    queryKey: mediaQueryKeys.detail(assetPublicId),
    queryFn: () => getAssetDetail({ data: { assetPublicId } }),
    staleTime: STALE.detail,
  })
}

export function assetUsageQueryOptions(assetPublicId: string) {
  return queryOptions({
    queryKey: mediaQueryKeys.usage(assetPublicId),
    queryFn: () => getAssetUsage({ data: { assetPublicId } }),
    staleTime: STALE.detail,
  })
}

export function assetVersionsQueryOptions(assetPublicId: string) {
  return queryOptions({
    queryKey: mediaQueryKeys.versions(assetPublicId),
    queryFn: () => getAssetVersions({ data: { assetPublicId } }),
    staleTime: STALE.detail,
  })
}

export function transcriptQueryOptions(assetPublicId: string, language: string) {
  return queryOptions({
    queryKey: mediaQueryKeys.transcript(assetPublicId, language),
    queryFn: () => getTranscript({ data: { assetPublicId, language } }),
    staleTime: STALE.transcript,
  })
}
