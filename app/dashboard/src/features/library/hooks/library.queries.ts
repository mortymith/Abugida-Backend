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
import type { LibraryListQuery } from '../schemas/library.schema'

/** Query key registry for the library feature (['library', slice, ...id]). */
export const libraryQueryKeys = {
  list: (query: LibraryListQuery) => ['library', 'list', query] as const,
  stats: () => ['library', 'stats'] as const,
  folders: () => ['library', 'folders'] as const,
  trail: (folderPublicId: string) => ['library', 'trail', folderPublicId] as const,
  detail: (assetPublicId: string) => ['library', 'detail', assetPublicId] as const,
  usage: (assetPublicId: string) => ['library', 'usage', assetPublicId] as const,
  versions: (assetPublicId: string) => ['library', 'versions', assetPublicId] as const,
  transcript: (assetPublicId: string, language: string) =>
    ['library', 'transcript', assetPublicId, language] as const,
}

const STALE = { list: 15_000, stats: 60_000, folders: 60_000, detail: 30_000, transcript: 0 }

export function libraryListQueryOptions(query: LibraryListQuery) {
  return queryOptions({
    queryKey: libraryQueryKeys.list(query),
    queryFn: () => getLibraryAssets({ data: query }),
    staleTime: STALE.list,
    // Refining the search, changing a filter chip or paging changes the query
    // key. Without this the grid would fall back to `isPending` and flash the
    // skeleton grid on every change; keeping the previous page on screen while
    // the next one loads keeps the list stable.
    placeholderData: keepPreviousData,
  })
}

export function libraryStatsQueryOptions() {
  return queryOptions({
    queryKey: libraryQueryKeys.stats(),
    queryFn: () => getLibraryStats(),
    staleTime: STALE.stats,
  })
}

export function libraryFoldersQueryOptions() {
  return queryOptions({
    queryKey: libraryQueryKeys.folders(),
    queryFn: () => listFolders(),
    staleTime: STALE.folders,
  })
}

export function libraryTrailQueryOptions(folderPublicId: string) {
  return queryOptions({
    queryKey: libraryQueryKeys.trail(folderPublicId),
    queryFn: () => getFolderTrail({ data: { folderPublicId } }),
    staleTime: STALE.folders,
  })
}

export function assetDetailQueryOptions(assetPublicId: string) {
  return queryOptions({
    queryKey: libraryQueryKeys.detail(assetPublicId),
    queryFn: () => getAssetDetail({ data: { assetPublicId } }),
    staleTime: STALE.detail,
  })
}

export function assetUsageQueryOptions(assetPublicId: string) {
  return queryOptions({
    queryKey: libraryQueryKeys.usage(assetPublicId),
    queryFn: () => getAssetUsage({ data: { assetPublicId } }),
    staleTime: STALE.detail,
  })
}

export function assetVersionsQueryOptions(assetPublicId: string) {
  return queryOptions({
    queryKey: libraryQueryKeys.versions(assetPublicId),
    queryFn: () => getAssetVersions({ data: { assetPublicId } }),
    staleTime: STALE.detail,
  })
}

export function transcriptQueryOptions(assetPublicId: string, language: string) {
  return queryOptions({
    queryKey: libraryQueryKeys.transcript(assetPublicId, language),
    queryFn: () => getTranscript({ data: { assetPublicId, language } }),
    staleTime: STALE.transcript,
  })
}
