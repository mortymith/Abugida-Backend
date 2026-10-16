/**
 * Upload metadata + duplicate-name resolution (spec 05 § S-3.2).
 *
 * Rev 3 replaces "one name/tags/description form applied to N files" with
 * **one editable row per file**. Each file defaults to its filename with
 * the extension stripped (`Reading_Overview.mp4` → `Reading_Overview`),
 * with duplicate-name resolution, a folder target, and tag autocomplete
 * with reuse.
 *
 * The duplicate-name resolution is the load-bearing part. The spec
 * mandates three explicit outcomes on a collision, never a silent
 * overwrite:
 * - **Create a new asset** (default, with a ` (2)` suffix offered)
 * - **Replace as a new version** of the existing asset (writes a row in
 *   `asset_versions`, preserves the original file + ID + usage)
 * - **Rename** (the author picks a new name)
 *
 * The `Replace existing asset with same name` checkbox is therefore
 * **only offered when a name actually collides** (decision D8), and it
 * maps to "Create a new version" — not an overwrite.
 *
 * This module is framework-free: it owns the default-name computation,
 * the collision detection, and the resolution options. The React
 * component renders the per-file rows.
 */

export interface PerFileMetadata {
  readonly fileId: string
  readonly fileName: string
  readonly displayName: string
  readonly tags: readonly string[]
  readonly description: string
  readonly folderId: string | null
  readonly duplicateNameResolution?: DuplicateNameResolution
}

export type DuplicateNameResolution =
  | { readonly kind: 'create_new'; readonly suffix: string }
  | { readonly kind: 'replace_as_version'; readonly existingAssetId: string }
  | { readonly kind: 'rename'; readonly newName: string }

export const DUPLICATE_NAME_LABELS: Record<DuplicateNameResolution['kind'], string> = {
  create_new: 'Create a new asset',
  replace_as_version: 'Replace as a new version',
  rename: 'Rename',
}

/**
 * Compute the default display name for a file: the filename with its
 * extension stripped. `Reading_Overview.mp4` → `Reading_Overview`.
 * Files with no extension keep their full name.
 */
export function defaultNameFromFile(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot <= 0) return filename // no extension, or leading dot (hidden file)
  return filename.slice(0, lastDot)
}

/**
 * Suffix to offer when creating a new asset on a name collision. The
 * spec: "Create a new asset (default, with a ` (2)` suffix offered)".
 * Increments until the suffixed name is unique.
 */
export function suggestCollisionSuffix(
  collidingName: string,
  existingNames: ReadonlySet<string>,
): string {
  let counter = 2
  while (existingNames.has(`${collidingName} (${counter})`)) {
    counter += 1
  }
  return ` (${counter})`
}

export type CollisionDetection =
  | { readonly kind: 'unique' }
  | {
      readonly kind: 'collision'
      readonly existingAssetId: string
      readonly existingAssetName: string
      readonly suggestedSuffix: string
    }

/**
 * Detect whether `displayName` collides with an existing asset name in
 * the workspace. Comparison is case-insensitive (the spec normalizes
 * case). Returns the collision details + the suggested suffix for the
 * "Create a new asset" option.
 */
export function detectNameCollision(
  displayName: string,
  existing: ReadonlyArray<{ id: string; name: string }>,
): CollisionDetection {
  const normalized = displayName.trim().toLowerCase()
  const collision = existing.find((asset) => asset.name.trim().toLowerCase() === normalized)
  if (!collision) return { kind: 'unique' }
  const existingNames = new Set(existing.map((a) => a.name))
  return {
    kind: 'collision',
    existingAssetId: collision.id,
    existingAssetName: collision.name,
    suggestedSuffix: suggestCollisionSuffix(displayName, existingNames),
  }
}

/**
 * Whether the `Replace existing asset with same name` checkbox should
 * render. The spec mandates it appears **only on collision** (decision
 * D8). When there is no collision, the checkbox is absent — not just
 * disabled.
 */
export function shouldShowReplaceCheckbox(collision: CollisionDetection): boolean {
  return collision.kind === 'collision'
}

/**
 * Validate per-file metadata. Returns field-level errors, or `null` when
 * valid. The spec's validation rules:
 * - `displayName` is 1–300 characters (matches `asset_library.name`).
 * - `tags` is 0–20 tags, each 1–50 characters (matches the insert schema).
 * - `description` is 0–5000 characters.
 * - `folderId` is null or a valid UUID (the component validates existence).
 */
export interface PerFileMetadataErrors {
  displayName?: string
  tags?: string
  description?: string
}

export function validatePerFileMetadata(metadata: PerFileMetadata): PerFileMetadataErrors | null {
  const errors: PerFileMetadataErrors = {}
  const name = metadata.displayName.trim()
  if (name.length < 1) {
    errors.displayName = 'A name is required'
  } else if (name.length > 300) {
    errors.displayName = 'A name can be at most 300 characters'
  }
  if (metadata.tags.length > 20) {
    errors.tags = 'At most 20 tags are allowed'
  } else {
    const badTag = metadata.tags.find((tag) => tag.trim().length < 1 || tag.length > 50)
    if (badTag !== undefined) {
      errors.tags = 'Each tag must be 1–50 characters'
    }
  }
  if (metadata.description.length > 5000) {
    errors.description = 'A description can be at most 5000 characters'
  }
  return Object.keys(errors).length === 0 ? null : errors
}

/**
 * Normalize tags for storage: trim, lowercase for case-normalization (per
 * spec: "Tags are case-normalized"), deduplicate, cap at 20.
 */
export function normalizeTags(tags: readonly string[]): string[] {
  const normalized = tags
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
    .map((tag) => tag.toLowerCase())
  return [...new Set(normalized)].slice(0, 20)
}

/**
 * Build the initial per-file metadata for a dropped file. The display
 * name defaults to the filename sans extension; tags and description
 * start empty; the folder defaults to the batch's target folder.
 */
export function buildInitialMetadata(
  fileId: string,
  fileName: string,
  folderId: string | null,
): PerFileMetadata {
  return {
    fileId,
    fileName,
    displayName: defaultNameFromFile(fileName),
    tags: [],
    description: '',
    folderId,
  }
}
