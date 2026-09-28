/**
 * Single source of truth for the Lesson Editor's Tiptap schema — spec 12 § 6.1
 * ("Course Editor — Markdown Lesson Authoring").
 *
 * Deliberately React-free and DOM-free so `courses.markdown.ts` can build a
 * server-side `MarkdownManager` from the *exact* list the browser editor uses.
 * A divergence between the two would let the editor render content the server
 * cannot serialize. Do not import `@tiptap/react` here.
 *
 * The set below is load-bearing. Removing any of image / table / task-list
 * silently re-enables the content loss catalogued in spec 12 § 3.3:
 * `![alt](url)` degrades to `alt`, GFM tables degrade to an empty document, and
 * `- [x] done` degrades to `- done`. `tests/courses.markdown.test.ts` pins every
 * one of those cases, so the failure will be loud rather than silent.
 */
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableCell } from '@tiptap/extension-table-cell'
import Placeholder from '@tiptap/extension-placeholder'
import { Markdown } from '@tiptap/markdown'

export const LESSON_EDITOR_PLACEHOLDER = 'Lesson content — rich text, media links…'

/**
 * Order matters:
 *  - StarterKit already bundles `link` and `underline` in v3. Registering
 *    `@tiptap/extension-link` again produces
 *    "[tiptap warn]: Duplicate extension names found: ['link']", so link
 *    options are configured on StarterKit instead (spec 12 § 3.5, D-5).
 *  - `Table` requires its row / header / cell siblings; omitting any of them
 *    throws "No node type or group 'tableRow' found" at schema build time.
 *  - `Markdown` overrides setContent / insertContent / insertContentAt and must
 *    therefore be registered **last** so it wins command resolution (D-6).
 *  - `allowBase64: false` keeps pasted data URIs out of `lessons.body`; images
 *    are served from the Content Library (S-3.1).
 */
export const LESSON_EDITOR_EXTENSIONS = [
  StarterKit.configure({
    link: {
      openOnClick: false,
      HTMLAttributes: { rel: 'noopener noreferrer' },
    },
  }),
  Image.configure({ allowBase64: false }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Table.configure({ resizable: false }),
  TableRow,
  TableHeader,
  TableCell,
  Placeholder.configure({ placeholder: LESSON_EDITOR_PLACEHOLDER }),
  Markdown,
]
