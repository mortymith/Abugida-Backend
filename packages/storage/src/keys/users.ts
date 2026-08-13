/**
 * User-related storage key generators.
 *
 * Key structure:
 * ```
 * users/{userId}/avatar.{ext}
 * users/{userId}/profile/{assetId}
 * ```
 */

/** Generate the base key for a user directory. */
export function user(userId: string): string {
  return `users/${userId}`
}

/** Generate the key for a user avatar. */
export function userAvatar(userId: string, ext = 'webp'): string {
  return `users/${userId}/avatar.${ext}`
}

/** Generate the key for a user profile asset. */
export function userProfile(userId: string, assetId: string): string {
  return `users/${userId}/profile/${assetId}`
}

/** List prefix for all profile assets of a user. */
export function userProfilePrefix(userId: string): string {
  return `users/${userId}/profile/`
}
