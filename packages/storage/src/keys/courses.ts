/**
 * Course-related storage key generators.
 *
 * Key structure:
 * ```
 * courses/{courseId}/thumbnails/{assetId}.webp
 * courses/{courseId}/videos/{assetId}.mp4
 * courses/{courseId}/documents/{assetId}.pdf
 * courses/{courseId}/audio/{assetId}.mp3
 * courses/{courseId}/subtitles/{assetId}.vtt
 * ```
 */

/** Generate the base key for a course directory. */
export function course(courseId: string): string {
  return `courses/${courseId}`
}

/** Generate the key for a course thumbnail. */
export function courseThumbnail(courseId: string, assetId: string): string {
  return `courses/${courseId}/thumbnails/${assetId}.webp`
}

/** Generate the key for a course video. */
export function courseVideo(courseId: string, assetId: string): string {
  return `courses/${courseId}/videos/${assetId}.mp4`
}

/** Generate the key for a course document. */
export function courseDocument(courseId: string, assetId: string): string {
  return `courses/${courseId}/documents/${assetId}.pdf`
}

/** Generate the key for a course audio file. */
export function courseAudio(courseId: string, assetId: string): string {
  return `courses/${courseId}/audio/${assetId}.mp3`
}

/** Generate the key for a course subtitle file. */
export function courseSubtitle(courseId: string, assetId: string): string {
  return `courses/${courseId}/subtitles/${assetId}.vtt`
}

/** List prefix for all thumbnails in a course. */
export function courseThumbnailsPrefix(courseId: string): string {
  return `courses/${courseId}/thumbnails/`
}

/** List prefix for all videos in a course. */
export function courseVideosPrefix(courseId: string): string {
  return `courses/${courseId}/videos/`
}

/** List prefix for all documents in a course. */
export function courseDocumentsPrefix(courseId: string): string {
  return `courses/${courseId}/documents/`
}

/** List prefix for all audio in a course. */
export function courseAudioPrefix(courseId: string): string {
  return `courses/${courseId}/audio/`
}

/** List prefix for all subtitles in a course. */
export function courseSubtitlesPrefix(courseId: string): string {
  return `courses/${courseId}/subtitles/`
}
