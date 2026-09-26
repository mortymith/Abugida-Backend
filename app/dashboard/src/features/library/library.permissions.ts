/**
 * Content Library permission matrix (spec 05 screens + spec 11 Roles &
 * Permissions), as pure data so the route guard, the UI gates and the tests
 * all read from one source.
 *
 * - S-3.1 Asset Repository — Admin, Editor, Viewer
 * - S-3.2 Asset Upload Modal — Admin, Editor
 * - S-3.3 Asset Detail View — Admin, Editor, Viewer (read) / Admin, Editor (write)
 * - S-3.4 Folders & Collections — Admin, Editor
 * - S-3.5 File Preview Modal — Admin, Editor, Viewer, Support
 * - S-3.6 Transcription & Subtitle Editor — Admin, Editor
 *
 * Every write is *also* enforced server-side (`requireLibraryWriteRole`); these
 * helpers only decide what to render, so a read-only user is never shown a
 * button whose only possible outcome is a FORBIDDEN toast.
 */
import { COURSE_AUTHORING_ROLES } from '#/features/auth/auth.roles'
import type { PlatformRole } from '#/features/auth/auth.roles'

/** Roles that may open the library section at all (S-3.1 – S-3.6). */
export const LIBRARY_VIEW_ROLES: readonly PlatformRole[] = ['admin', 'editor', 'reviewer', 'viewer']

/** Roles that may author library content (S-3.2, S-3.4, S-3.6 + S-3.3 writes). */
export const LIBRARY_WRITE_ROLES: readonly PlatformRole[] = COURSE_AUTHORING_ROLES

export function canViewLibrary(role: PlatformRole): boolean {
  return LIBRARY_VIEW_ROLES.includes(role)
}

/** Admin/Editor only: upload, edit metadata, delete, folders, versions, captions. */
export function canEditLibrary(role: PlatformRole): boolean {
  return LIBRARY_WRITE_ROLES.includes(role)
}
