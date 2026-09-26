import { z } from 'zod'

/**
 * Input validation for Content Library server functions (spec 05). Shared
 * between the client-safe wrappers (types) and the impl modules (parsing).
 */

export const LIBRARY_PAGE_SIZE = 12 // 3-column grid × 4 rows

export const assetCategoryFilterSchema = z.enum(['all', 'video', 'image', 'audio', 'document'])

export const librarySortSchema = z.enum(['newest', 'oldest', 'name', 'size', 'uses'])

export const libraryListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: assetCategoryFilterSchema.optional(),
  /** 'all' = everything, 'root' = uncategorized, else a folder public id. */
  folder: z.union([z.literal('all'), z.literal('root'), z.string().uuid()]).optional(),
  sort: librarySortSchema.optional(),
  page: z.coerce.number().int().min(1).optional(),
})
export type LibraryListQuery = z.infer<typeof libraryListQuerySchema>

// ---------------------------------------------------------------------------
// URL search params
// ---------------------------------------------------------------------------

/** Category values that actually narrow a query — i.e. `all` excluded. */
export type LibraryCategoryFilter = Exclude<z.infer<typeof assetCategoryFilterSchema>, 'all'>
export type LibrarySort = z.infer<typeof librarySortSchema>

/**
 * Search params for `/content-library`.
 *
 * Deliberately **narrowing, not validating**: every field drops any value it
 * does not recognise instead of throwing. A URL is user-editable and survives
 * bookmarks, shared links and deploys, so `?type=all`, `?type=undefined`,
 * `?type=` (empty) or a repeated `?q=a&q=b` must all degrade to "no filter"
 * rather than blow up the route with a raw Zod payload. This mirrors the
 * narrowing style already used by the sibling `/courses` route.
 *
 * `all` is accepted for `type` because it is the sentinel the filter chips
 * use; it is normalised to `undefined` here so the rest of the app only ever
 * sees a real narrowing value, and so the unfiltered view keeps a single
 * React Query cache entry.
 */
export interface LibrarySearch {
  q?: string | undefined
  folder?: string | undefined
  type?: LibraryCategoryFilter | undefined
  sort?: LibrarySort | undefined
  page?: number | undefined
}

const uuidSchema = z.string().uuid()

/** The parsed value when `schema` accepts it, else `undefined`. */
function pick<T extends z.ZodType>(schema: T, value: unknown): z.output<T> | undefined {
  const parsed = schema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

/** Positive integer, or `undefined` for anything else (NaN, 0, 1.5, "abc", …). */
function positiveInt(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isInteger(value) && value >= 1 ? value : undefined
  if (typeof value !== 'string' || value.trim() === '') return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : undefined
}

function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

/** Folder selector: `all`, `root` or a folder public id (uuid). */
function folderSelector(value: unknown): string | undefined {
  const raw = nonEmptyString(value)
  if (raw === 'all' || raw === 'root') return raw
  return uuidSchema.safeParse(raw).success ? raw : undefined
}

/**
 * The folder public id the breadcrumb trail should be loaded for, or
 * `undefined` when there is nothing to load.
 *
 * `all` and `root` are view sentinels, not folder ids — `getFolderTrail`
 * validates its input as a uuid, so requesting a trail for them produced a
 * guaranteed Zod failure (and React Query's default retries) on every
 * "All folders" / "Uncategorized" view.
 */
export function trailFolderId(folder: string | undefined): string | undefined {
  return folder && uuidSchema.safeParse(folder).success ? folder : undefined
}

export function parseLibrarySearch(search: Record<string, unknown>): LibrarySearch {
  const category = pick(assetCategoryFilterSchema, search.type)
  return {
    q: nonEmptyString(search.q)?.slice(0, 100),
    folder: folderSelector(search.folder),
    // `all` is the "All" chip's sentinel for "no filter"; normalising it away
    // here keeps the unfiltered view on a single React Query cache entry.
    type: category === 'all' ? undefined : category,
    sort: pick(librarySortSchema, search.sort),
    page: positiveInt(search.page),
  }
}

/** MIME whitelist mirrors the wireframe: MP4, PDF, PNG, JPG, MP3. */
export const ASSET_UPLOAD_MIME_SCHEMA = z.enum([
  'video/mp4',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'audio/mpeg',
])

export const assetUploadInitSchema = z.object({
  fileName: z.string().trim().min(1).max(300),
  contentType: ASSET_UPLOAD_MIME_SCHEMA,
  /** Client-reported size; re-verified against storage head after upload. */
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(500 * 1024 * 1024),
})
export type AssetUploadInitInput = z.infer<typeof assetUploadInitSchema>

export const tagsSchema = z.array(z.string().trim().min(1).max(50)).max(20)

export const assetUploadCompleteSchema = z.object({
  objectKey: z.string().trim().min(1).max(500),
  name: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2_000).nullable(),
  tags: tagsSchema.default([]),
  folderId: z.string().uuid().nullable(),
  durationSeconds: z.number().int().min(0).max(86_400).nullable(),
  /** Replace an existing asset with the same name → upload a new version. */
  replaceExisting: z.boolean().default(false),
})
export type AssetUploadCompleteInput = z.infer<typeof assetUploadCompleteSchema>

export const assetMetadataUpdateSchema = z.object({
  assetPublicId: z.string().uuid(),
  name: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2_000).nullable(),
  tags: tagsSchema,
})
export type AssetMetadataUpdateInput = z.infer<typeof assetMetadataUpdateSchema>

export const assetPublicIdSchema = z.object({ assetPublicId: z.string().uuid() })

export const assetDeleteSchema = z.object({
  assetPublicId: z.string().uuid(),
  /** Server re-verifies usage; flag only records the user acknowledged it. */
  acknowledgedUsage: z.boolean().default(false),
})
export type AssetDeleteInput = z.infer<typeof assetDeleteSchema>

export const assetDuplicateSchema = z.object({
  assetPublicId: z.string().uuid(),
  folderId: z.string().uuid().nullable(),
})
export type AssetDuplicateInput = z.infer<typeof assetDuplicateSchema>

export const assetsMoveSchema = z.object({
  assetPublicIds: z.array(z.string().uuid()).min(1).max(100),
  folderId: z.string().uuid().nullable(),
})
export type AssetsMoveInput = z.infer<typeof assetsMoveSchema>

export const folderCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  parentId: z.string().uuid().nullable(),
})
export type FolderCreateInput = z.infer<typeof folderCreateSchema>

export const folderRenameSchema = z.object({
  folderPublicId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
})

export const folderDeleteSchema = z.object({ folderPublicId: z.string().uuid() })

export const assetVersionInitSchema = z.object({
  assetPublicId: z.string().uuid(),
  fileName: z.string().trim().min(1).max(300),
  contentType: ASSET_UPLOAD_MIME_SCHEMA,
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(500 * 1024 * 1024),
})
export type AssetVersionInitInput = z.infer<typeof assetVersionInitSchema>

export const assetVersionCompleteSchema = z.object({
  assetPublicId: z.string().uuid(),
  objectKey: z.string().trim().min(1).max(500),
  durationSeconds: z.number().int().min(0).max(86_400).nullable(),
})
export type AssetVersionCompleteInput = z.infer<typeof assetVersionCompleteSchema>

export const transcriptSegmentInputSchema = z.object({
  segmentIndex: z.number().int().min(0),
  startMs: z.number().int().min(0).max(86_400_000),
  endMs: z.number().int().min(0).max(86_400_000),
  speaker: z.string().trim().max(80).nullable(),
  text: z.string().trim().min(1).max(2_000),
})

export const captionStyleInputSchema = z.object({
  font: z.enum(['inter', 'system', 'serif', 'mono']),
  fontSizePx: z.union([z.literal(14), z.literal(16), z.literal(18), z.literal(20)]),
  background: z.enum(['none', 'semi', 'opaque']),
})

export const transcriptSaveSchema = z.object({
  assetPublicId: z.string().uuid(),
  language: z.string().trim().min(2).max(10),
  segments: z.array(transcriptSegmentInputSchema).max(2_000),
  captionStyle: captionStyleInputSchema.nullable(),
  showByDefault: z.boolean().default(true),
  /** 'draft' keeps captions private; 'published' applies them to lessons. */
  status: z.enum(['draft', 'published']),
  source: z.enum(['manual', 'imported', 'stt', 'translated']).default('manual'),
})
export type TranscriptSaveInput = z.infer<typeof transcriptSaveSchema>

export const transcriptGetSchema = z.object({
  assetPublicId: z.string().uuid(),
  language: z.string().trim().min(2).max(10).optional(),
})

export const transcriptImportSchema = z.object({
  assetPublicId: z.string().uuid(),
  language: z.string().trim().min(2).max(10),
  content: z.string().max(2_000_000),
  fileName: z.string().trim().min(1).max(300),
})
export type TranscriptImportInput = z.infer<typeof transcriptImportSchema>

export const transcriptGenerateSchema = z.object({
  assetPublicId: z.string().uuid(),
  language: z.string().trim().min(2).max(10),
  /** Optional regenerate window (ms); omit for a full transcription. */
  rangeStartMs: z.number().int().min(0).optional(),
  rangeEndMs: z.number().int().min(0).optional(),
})
export type TranscriptGenerateInput = z.infer<typeof transcriptGenerateSchema>

export const transcriptTranslateSchema = z.object({
  assetPublicId: z.string().uuid(),
  fromLanguage: z.string().trim().min(2).max(10),
  toLanguage: z.string().trim().min(2).max(10),
})
export type TranscriptTranslateInput = z.infer<typeof transcriptTranslateSchema>

export const transcriptDeleteSchema = z.object({
  assetPublicId: z.string().uuid(),
  language: z.string().trim().min(2).max(10),
})
export type TranscriptDeleteInput = z.infer<typeof transcriptDeleteSchema>

export const readUrlSchema = z.object({
  assetPublicId: z.string().uuid(),
  /** 'inline' for previews, 'attachment' for downloads. */
  disposition: z.enum(['inline', 'attachment']).default('inline'),
  downloadName: z.string().trim().max(300).optional(),
  versionNumber: z.number().int().positive().optional(),
})
