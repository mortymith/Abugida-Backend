# Section 3: Content Library

> **Abugida Academy — UX Design Specification** · Part 05 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Courses](04-Courses.md) · [Students →](06-Students.md)

## What changed in Part 05 (Revision 3)

- **Uploads are resumable.** [S-3.2](#scr-3-2) now specifies per-file progress starting within 1 s of the drop, **cancel**, **retry**, and **resume from the last byte** after a network drop or a tab reload, plus an **offline queue** and a clear-on-close warning. The generic _"Upload failed. Check file format and size."_ is gone; every failure names a file and a reason.
- **The 500 MB cap is stated up front**, in the drop zone, before a file is chosen — not discovered after a 45-minute upload.
- **Metadata is per file.** One name / tags / description form applied to _N_ files is replaced by one editable row per file, defaulting to the filename with its extension stripped, with duplicate-name resolution, a folder target, and tag autocomplete with reuse.
- **"Replace existing asset with same name" creates a new version**, not an overwrite: it is offered only on a name collision and writes a row in `asset_versions`, which [S-3.3](#scr-3-3) already has a history for.
- **Delete shows its usage impact before it asks.** _"Used in 14 items across 2 courses — 1 item is in a published course. Deleting will show a broken image to 234 students."_ The primary action is **Archive** (hides it, breaks nothing); **Delete permanently** is the separated destructive secondary, and **Detach from all items** is offered alongside.
- **Folders are keyboard-reachable.** Nesting caps at 2 levels, rename collisions are defined, and the right-click-only move is replaced by a `⋯` menu with **Move to folder…** plus a drag-keyboard mode. Drag is never the only route ([Part 11](11-Global-Standards.md#accessibility-specification)).
- **The preview modal has a full accessibility contract** — `role="dialog"`, `aria-modal`, focus trap, focus moving to the player on open and **returning to the triggering control** on close, `Esc`, `aria-labelledby` — plus **captions in the video player**, a **preview failed** state, and an Esc-only-when-focused rule.
- **All six screens ship `Resilience`, `Keyboard & Focus`, and `Instrumentation & acceptance`**, and every table, pill, money value, and drop zone follows [S-7.12](09-Shared-Components.md#scr-7-12) and [Localization & Formatting](11-Global-Standards.md#localization--formatting).

## What changed in Part 05 (Revision 2)

The library itself is unchanged. It became more central to the authoring flow, so three things were added:

- **Picker mode** ([S-3.1](05-Content-Library.md#scr-3-1)) is now a first-class mode with a **return-to** target, because media is attached from inside the curriculum item pane and must return the author to the item they left.
- **Asset Detail** ([S-3.3](05-Content-Library.md#scr-3-3)) gains _Attach to curriculum item…_, and its _Used in_ list deep-links into the workspace Curriculum tab with the item selected, instead of the retired flat lesson screen.
- **Transcription** ([S-3.6](05-Content-Library.md#scr-3-6)) resolves its return path to the workspace item pane, and captions on video items are now a publish blocker (`RC-5`).

<a id="scr-3-1"></a>

##### Screen Name: S-3.1 Asset Repository 🔄 CHANGED

- **Purpose:** Central repository for all media assets (videos, PDFs, images) used across courses. Supports upload, organization, tagging, and search. In Revision 2 it also serves as the media picker invoked from inside the curriculum item pane.
- **User Role(s):** Admin, Editor, Viewer
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Content Library"                        [+ Upload]    │
  │         [Search] [Filter: All] [Sort: Newest ▾]                │
  │         [Density: Comfortable ▾]   (bulk: Archive / Tag / Move)│
  ├──────────────────────────────────────────────────────────────────┤
  │ Stats Row:                                                      │
  │ +----------+ +----------+ +----------+ +----------+          │
  │ | 156      | | 89       | | 45       | | 22       |          │
  │ | Total    | | Videos   | | PDFs     | | Images   |          │
  │ | Assets   | | 12GB used| | 3GB used | | 1.2GB    |          │
  │ +----------+ +----------+ +----------+ +----------+          │
  ├──────────────────────────────────────────────────────────────────┤
  │ Grid View (3 columns):                                         │
  │ +──────────────────+ +──────────────────+ +──────────────────+ │
  │ | [Thumbnail]      | | [Thumbnail]      | | [Thumbnail]      │ │
  │ | PDF              | | Video            | | Image            │ │
  │ | TOEFL_Syllabus   | | Reading_Overview | | Course_Banner    │ │
  │ | 2.3 MB           | | 45 MB            | | 1.2 MB           │ │
  │ | 23 uses →        | | 12 uses →        | | 8 uses →         │ │
  │ | Tags: TOEFL, PDF | | Tags: Reading    | | Tags: Banner     │ │
  │ | Uploaded: 3 days | | Uploaded: 1 week | | Uploaded: 2 days │ │
  │ | [Edit] [⋯ menu]  | | [Edit] [⋯ menu]  | | [Edit] [⋯ menu]  │ │
  │ +──────────────────+ +──────────────────+ +──────────────────+ │
  │                                                               │
  │ Pagination: 1–24 of 156                                       │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Upload new assets.
  2. Search and filter assets.
  3. Preview and edit asset metadata.
  4. Delete or replace assets.
  5. View usage count (which courses use this asset).
  6. Switch **density** (Comfortable / Compact) and **sort** — Newest, Name, Size, Usage. Both persist per user, not per browser.
  7. **Multi-select outside Picker mode** to bulk **archive**, **tag**, or **move to folder**. Selection is independent of Picker mode: in Picker mode a selection means _attach these_, everywhere else it means _operate on these_.
- **Data Displayed/Modified:** Reads from asset_library table with usage counts.
  - **"23 uses" means 23 distinct curriculum items that reference this asset — not 23 raw references.** An image in one lesson body and its lesson thumbnail is one use, shown once. The tooltip names them: _"Used in 23 items across 5 courses."_
- **Validation & Feedback:**
  - Bulk archive → toast with a timed **Undo**; bulk delete → [S-7.1](09-Shared-Components.md#scr-7-1) with the aggregate impact statement, never a per-item dialog.
  - Sorting by Size or Usage is server-side; the column is `tabular-nums` and right-aligned.
- **States:**
  - **Default:** Grid populated with all assets.
  - **Empty:** [S-7.3](09-Shared-Components.md#scr-7-3): "No assets uploaded. Upload your first asset to get started." — only when the library has **never** had an asset.
  - **Zero-result:** "No assets match your filters." + **Clear filters** — deliberately _not_ the creation CTA, per [Part 11](11-Global-Standards.md#global-validation-and-feedback-patterns). The two are never collapsed: an author who filtered to `Video` and found nothing should not be told to upload a video.
  - **Loading:** Skeleton grid (6 cards); the shell, filters, and sort stay mounted.
  - **Uploading:** Upload progress modal.
  - **Deleting:** The impact statement first, not a bare confirmation. [S-7.1](09-Shared-Components.md#scr-7-1): _"Used in 14 items across 2 courses — 1 item is in a published course. Deleting will show a broken image to 234 students."_ Primary action **Archive**; separated destructive secondary **Delete permanently**; third option **Detach from all items** (clears the references, keeps the file). Per [Part 11](11-Global-Standards.md#global-validation-and-feedback-patterns) the reversible option is always first.
  - **Error:** "We couldn't load your assets — nothing you did was lost." + Retry + a request ID. Never a bare _"Retry?"_.
  - **Picker Mode (new):** the header names the destination item and its full path; selection is multi-select with a running count; the primary CTA is **Attach selected**; a persistent _Return to {item}_ link is always present. Attaching never navigates away from the item — on success the picker closes and the item pane shows the new media.
  - **Return-To (new):** entering the library from an item records that item. Every way out — back, cancel, `Esc`, browser Back — returns to the same item with the pane still open and the scroll position preserved. Losing an author's place because they opened a file picker is a defect, not a detail.
  - **Already Attached (new):** assets attached to the calling item are shown checked and badged **Attached**, so the same asset is not attached twice by accident.
- **Resilience:**
  - **403:** _"You don't have access to {folder}."_ naming the resource, plus a request ID and **Ask an Admin for access**. This is the [S-7.12](09-Shared-Components.md#scr-7-12) Forbidden surface, not an empty grid.
  - **404:** _"This asset was deleted, or you followed an old link."_ + **Back to Content Library** + a request ID.
  - **Offline:** A persistent banner, not a toast. The library renders **read-only** from cache with _"You're offline — 3 uploads waiting to sync."_ Search, filter, and sort still work locally; upload and edit are disabled-with-a-reason, never silently dead.
  - **Reconnected:** The queue flushes in order; each completed upload reports _"Synced."_ and a file whose metadata was edited offline resolves through [Conflict](#scr-3-1) if its `rowVersion` went stale.
  - **Session expired:** The 2-minute warning modal names the surfaces with unsaved work — on this screen, an open upload modal or an in-flight tag edit. On return the user lands on the same filter, sort, and page.
  - **Conflict:** Two people editing one asset's metadata → _"Changed by {actor} {N} minutes ago."_ with **Review changes / Keep mine / Take theirs**. Reload is never the only option.
  - **Server error:** Retry + a request ID, in the product's voice.
- **Keyboard & Focus:**
  - The grid is a `role="list"` of cards; each card is one Tab stop and opens with `Enter`. `Space` toggles selection when a selection mode is active.
  - Density and sort are labelled `<select>` controls; changing either moves nothing, but changing sort announces the new order in a polite live region.
  - A deep link arriving with a filter in the URL moves focus to the **Search** field and announces the result count.
- **Instrumentation & acceptance:**
  - **Events:** `library_viewed` `{mode: picker|browse, filter, sort, density, resultCount}` · `asset_opened` `{assetId, from: grid|usage_link|item_pane}` · `library_bulk_action` `{action: archive|tag|move, selectedCount}` · `asset_delete_confirmed` `{useCount, courseCount, publishedUseCount, affectedStudentCount}`. IDs and counts only — no filenames, no tags.
  - **Acceptance:**
    1. The delete confirmation names the item count, the course count, the published-item count, and the affected student count before the primary action is enabled.
    2. **Archive** is the primary action in that dialog and **Delete permanently** is visually separated below it.
    3. A zero-result grid offers **Clear filters** and does **not** offer the upload CTA.
    4. Offline, the grid is read-only and shows the queued-upload count inline.
    5. "23 uses" expands to a list of distinct items; an asset referenced twice by one item is counted once.
  - **Budgets:** First paint < 1.5 s for 25 cards; filter + sort re-query < 400 ms; thumbnails lazy-load with fixed aspect boxes (no layout shift); sort-by-size and sort-by-usage are server-side past 100 assets.
- **Navigation:**
  - "Upload" → [S-3.2](#scr-3-2) Asset Upload Modal
  - Asset Click → S-3.3 Asset Detail View
  - "Edit" → S-3.3 Asset Detail View
  - **Attach selected** → [S-2.7](04-Courses.md#scr-2-7) item pane, selection unchanged
  - _Return to {item}_ → [S-2.17](04-Courses.md#scr-2-17) Curriculum tab with that item's pane open

---

<a id="scr-3-2"></a>

##### Screen Name: S-3.2 Asset Upload Modal 🔄 CHANGED

- **Purpose:** Modal for uploading new assets with drag-and-drop support and metadata tagging.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Modal: "Upload Asset"                         [X] Close        │
  ├──────────────────────────────────────────────────────────────────┤
  │ Drop Zone:                                                      │
  │ +────────────────────────────────────────────────────────────-+ │
  │ │ Drag & drop files here or click to browse                    │ │
  │ │                                                             │ │
  │ │ Supported: MP4, PDF, PNG, JPG, MP3                          │ │
  │ │ Max size 500 MB per file — stated here, before you choose.  │ │
  │ +────────────────────────────────────────────────────────────-+ │
  │ Target folder: [Content Library / root ▾]   (2 levels deep)   │
  │                                                              │
  │ Files (one editable row each):                                │
  │ +------------------------------------------------------------+ │
  │ | Reading_Overview.mp4            45 MB  ▓▓▓▓▓▓▓░░░ 62%      | │
  │ |   Name  [Reading_Overview      ]  ⨯                          | │
  │ |   Tags  [Reading] [autocomplete ▾]   Folder [Speaking ▾]   | │
  │ |   Description [______________________]                        | │
  │ |   [Cancel upload]                                            | │
  │ +------------------------------------------------------------+ │
  │ | TOEFL_Syllabus.pdf              2.3 MB  ✗ Failed             | │
  │ |   "Format not supported: .docx"    [Retry] [Remove]          | │
  │ +------------------------------------------------------------+ │
  │ | Course_Banner.png               1.2 MB  ⏸ Queued (offline)  | │
  │ |   "Waiting for connection — will upload automatically."      | │
  │ +------------------------------------------------------------+ │
  │                                                              │
  │ [ ] Replace existing asset with same name  (shown only when a  │
  │     name collides — creates a new version, never an overwrite) │
  │                                                              │
  │ [Upload 3 Assets]  [Cancel]   ● 3 uploads waiting to sync      │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Add files by drag-and-drop or the file browser. The same Drop Zone, progress contract, and limits as [S-7.12](09-Shared-Components.md#scr-7-12).
  2. Edit **each file's own** metadata — name, tags, description, target folder.
  3. Start, **cancel**, **retry**, or **resume** any individual upload.
  4. Remove a queued file.
- **Data Displayed/Modified:** Writes to asset_library; a replace-on-collision writes to asset_versions instead of overwriting bytes. Reads `asset_folders` for the folder target.
- **Validation & Feedback:**
  - **Per-file metadata, not one form for N files.** Each file gets its own row — name, tags, description, folder — defaulting to **the filename with its extension stripped** (`Reading_Overview.mp4` → `Reading_Overview`). Applying one name to a mixed batch is how libraries end up with 40 files called `document`.
  - **Duplicate-name resolution.** If a name already exists in the library, the row is flagged inline and offers three explicit outcomes, never a silent overwrite: **Create a new asset** (default, with a ` (2)` suffix offered), **Replace as a new version** of the existing asset, or **Rename**. The **`Replace existing asset with same name`** checkbox is therefore **only offered when a name actually collides**, and it maps to _Create a new version_ — the asset's bytes, its ID, its `asset_usage` rows, and its existing [S-3.3](#scr-3-3) version history are all preserved, and the upload lands as the next version. Overwriting an asset in place is not a behaviour this product has.
  - **Folder target** is chosen once for the batch and overridable per file, to a depth of 2 ([S-3.4](#scr-3-4)).
  - **Tag autocomplete reuses existing tags** from the workspace, ranked by use count, and accepts a new tag inline. Tags are case-normalized and Ge'ez tags match by the 2-syllable n-gram rule ([Part 11](11-Global-Standards.md#localization--formatting)).
  - **The 500 MB cap is stated up front** in the drop zone, before a file is chosen. An oversize file is rejected at drop, immediately, with its actual size — never after the upload.
  - **Closing with work in flight** raises [S-7.1](09-Shared-Components.md#scr-7-1): _"2 uploads are still in progress. Closing pauses them — you can resume from the library."_ The same prompt appears on `Esc` and on `beforeunload`.
- **States:**
  - **Default:** Empty drop zone, limits stated, folder target at root.
  - **File Selected:** One row per file, metadata fields expanded, nothing uploaded yet.
  - **Uploading:** **Per-file** progress bar, percentage, bytes transferred/total, elapsed, and speed. **Progress starts within 1 s of the drop**, per the [Part 11 upload budget](11-Global-Standards.md#success-criteria--instrumentation). Each row has **Cancel**.
  - **Interrupted / Resumable:** Uploads are chunked and the byte offset is checkpointed. A network drop, a tab reload, or a crash moves the row to **Paused — resumable** with **Resume** and **Retry from start**; resuming continues **from the last confirmed byte**, never from zero. A 45 MB video resumed at 38 MB sends 7 MB, not 45.
  - **Queued (offline):** Dropping a file while offline does not fail. It is **queued**, the row says _"Waiting for connection — will upload automatically."_, and the modal footer shows _"N uploads waiting to sync."_ On reconnect the queue flushes in order and each file reports its outcome.
  - **Failed — stays listed.** A failed file **remains in the list** with a reason specific enough to act on, and **Retry**. The generic _"Upload failed. Check file format and size."_ is removed.
    | Reason shown                                        | Cause                      | Action offered               |
    | --------------------------------------------------- | -------------------------- | ---------------------------- |
    | "Format not supported: .mov"                        | extension/type rejected    | Remove, or convert           |
    | "File is 620 MB — the limit is 500 MB"              | oversize, rejected at drop | Remove                       |
    | "Network lost at 42% — retry or resume"             | transport interrupted      | **Resume**, Retry from start |
    | "Upload rejected: the file failed our malware scan" | server-side content scan   | Remove                       |
    | "Storage full — 2 GB free, file is 45 MB"           | quota                      | Remove, or free space        |
  - **Partial success:** mixed results are reported per file — _"2 uploaded · 1 failed — Retry"_ — never one blanket toast.
  - **Success:** Toast: "3 assets uploaded." + a link to the new assets, then close.
  - **Server error:** Retry + a request ID; bytes already sent are kept, so the retry resumes rather than restarts.
- **Resilience:**
  - **403:** Uploading into a folder you cannot write to → _"You don't have access to {folder}."_ with a request ID and **Ask an Admin for access**. The drop zone is disabled-with-a-reason; it is not removed, because the action is permitted and the destination is not.
  - **404:** The modal is opened from a deleted asset's page → _"This asset was deleted, or you followed an old link."_ + **Back to Content Library** + a request ID. **In-flight uploads are never discarded by a 404**; they continue in the background and the modal offers **View in library**.
  - **Offline:** See **Queued (offline)**. Metadata edits made offline are queued too, and the modal renders read-only for anything requiring a write.
  - **Reconnected:** The queue flushes in order. A queued file whose name collided while offline resolves to the duplicate-name prompt rather than creating a duplicate.
  - **Session expired:** The 2-minute warning modal names the in-flight uploads; on return the same modal is restored **with every upload still resumable from its checkpoint** — a session expiry must never cost a 45-minute upload.
  - **Conflict:** Two people uploading a file with the same name, or editing one asset's tags during an upload → _"Changed by {actor} {N} minutes ago."_ with **Review changes / Keep mine / Take theirs**.
  - **Partial failure:** Per the table above — the rest of the batch is uploaded and the failures are individually retryable.
- **Keyboard & Focus:**
  - The Drop Zone is a real `<button>`: `Enter`/`Space` opens the file browser, and a dropped file is also attachable via **Add files…** so drag is never the only route.
  - Focus moves to the first file row's **Name** field when the first file is added, and `Tab` walks file-row by file-row (name → tags → folder → description → row actions), not field by field across the batch.
  - `Esc` inside a text field does not close the modal; `Esc` from the modal chrome triggers the close confirmation.
  - Announcements: each upload's start, completion, and failure go to a polite live region; a failure is `assertive`.
- **Instrumentation & acceptance:**
  - **Events:** `upload_modal_opened` `{source}` · `upload_files_added` `{count, totalBytes, oversizeCount, unsupportedCount}` · `upload_started` `{assetDraftId, sizeBucket}` · `upload_progress` `{assetDraftId, percent, resumedFromByte}` (throttled) · `upload_completed` `{sizeBucket, durationMs}` · `upload_failed` `{reason, sizeBucket}` · `upload_resumed` `{fromByte}` · `upload_cancelled` `{atPercent}` · `upload_queued_offline` `{count}`. IDs, counts, and reason codes — no filenames, no PII.
  - **Acceptance:**
    1. Per-file progress begins within 1 s of the drop and each row has an independent **Cancel**.
    2. A failed file **stays listed** with a reason naming the actual cause and at least one action; no row shows only "Upload failed".
    3. After a network drop, **Resume** continues from the last confirmed byte and the transferred total does not reset to 0.
    4. Files dropped while offline are **queued**, not rejected, and upload automatically on reconnect.
    5. Each file has its own name, tags, description, and folder; the default name is the filename minus its extension.
    6. **Replace existing asset with same name** appears only on a collision, and completing it creates a new row in `asset_versions` — the original file, its ID, and its `asset_usage` rows are unchanged.
    7. Closing with uploads in flight shows the pause-and-resume confirmation; closing does not discard bytes already sent.
  - **Budgets:** progress starts < 1 s after drop; chunk checkpoint every 8 MB or 10 s, whichever is first; resume handshake < 1 s; cancel takes effect < 500 ms; no layout shift as each row's progress bar renders.
- **Navigation:**
  - "Upload" → Start upload → [S-3.1](#scr-3-1) Asset Repository (or back to the calling item pane in Picker mode)
  - "X" Close → confirmation if any upload is in flight, queued, or paused
  - A completed asset → [S-3.3](#scr-3-3) Asset Detail View

---

<a id="scr-3-3"></a>

##### Screen Name: S-3.3 Asset Detail View 🔄 CHANGED

- **Purpose:** Detail and management screen for a single content-library asset: preview, metadata, usage, and version history.
- **User Role(s):** Admin, Editor, Viewer
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "TOEFL_Syllabus.pdf"                    [Download] [X]  │
  ├──────────────────────────────────────────────────────────────────┤
  │ +────────────────────────+  Metadata:                           │
  │ │                        │  Type: PDF · Size: 2.3 MB             │
  │ │   [Inline Preview]     │  Uploaded: 2026-08-02 by Jane Smith   │
  │ │                        │  Tags: [TOEFL] [Syllabus] [+ Add]     │
  │ +────────────────────────+  Description: [Textarea]              │
  │                                                                  │
  │ Used In — 14 items across 2 courses (1 in a published course):    │
  │  • TOEFL Complete Course → Module 1 → "What is TOEFL?"  ✔ Live  │
  │  • TOEFL Speaking Intensive → Module 2               ▣ Archived  │
  │                                                                  │
  │ Version History: v3 (current) · v2 · v1  [Upload New Version]   │
  │ [⋯ menu: Archive · Move to folder… · Detach from all items]      │
  │                                                [Delete permanently]│
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Preview the file inline (uses [S-3.5](#scr-3-5) File Preview Modal for non-inline types).
  2. Edit tags and description.
  3. Upload a new version or replace the file.
  4. View everywhere the asset is used.
  5. **Archive** the asset — the reversible default, offered before delete everywhere ([Part 11](11-Global-Standards.md#global-validation-and-feedback-patterns)).
  6. **Attach to a curriculum item** — pick a course, a section, and an item, then attach without leaving the asset view.
- **Data Displayed/Modified:** Reads/writes `asset_library`, `asset_versions`, `asset_usage`; attachment writes the target item's media reference.
- **Validation & Feedback:**
  - **Usage impact before any destructive action.** The dialog states the blast radius in items, courses, and affected students: _"Used in 14 items across 2 courses — 1 item is in a published course. Deleting will show a broken image to 234 students."_ The Revision 1 line, _"This asset is used in 3 lessons. Are you sure?"_, named neither the courses, the published status, nor the students, so it let a library manager break a live course while thinking they were tidying a folder.
  - **The `⋯` menu is ordered reversible-first:** Archive · Move to folder… · Detach from all items · — separator — · **Delete permanently**. [S-7.1](09-Shared-Components.md#scr-7-1) is required for delete and for detach.
  - **Archive** hides the asset from the library and from the picker without breaking a single reference. It is reversible, and the asset is reachable from the library's **Archived** filter.
  - **Detach from all items** clears the `asset_usage` rows and the items' media references, keeping the file. Confirmation names what is affected: _"This will remove the image from 14 items. Items will show a missing-media placeholder until you re-attach something."_ Students already enrolled are named in the count.
  - **Delete permanently** states that references are _not_ cleaned up silently — it first requires either an Archive or a Detach, or an explicit acknowledgement that the 14 items will break.
  - **Version history:** uploading a new version is a resumable upload ([S-3.2](#scr-3-2)) and never replaces the current version until the bytes are complete. Each version is restorable as the current version, and restoring is itself versioned.
- **States:**
  - **Loading:** the preview pane shows a skeleton while the file streams; the metadata column resolves independently so tags stay editable before the preview loads.
  - **Default:** Preview + metadata populated.
  - **Loading:** Skeleton for the preview pane and the metadata block; the header and the `⋯` menu stay mounted.
  - **In Use Delete Attempt:** The impact statement above, with **Archive** as the primary action, **Delete permanently** as the separated destructive secondary, and **Detach from all items** as a third option.
  - **Archived:** The screen renders read-only with an **Archived** pill (tint background, text token, fill-token icon) and a single **Restore** action. Editing is disabled with the reason _"This asset is archived. Restore it to make changes."_ in a tooltip and in `aria-describedby`.
  - **Uploading New Version:** Per-file progress bar; previous version retained and still served until the new bytes are complete.
  - **Success:** Toast: "Asset updated." Metadata edits autosave on a 60 s idle timer with the [S-7.8](09-Shared-Components.md#scr-7-8) indicator; structural changes (move, attach, detach, archive) commit immediately with optimistic UI.
  - **Used In Entries (new):** each entry shows course, section, item, and the item's kind, and links into the workspace Curriculum tab with that item selected. Entries in archived items are dimmed and badged **Archived** so a library manager can tell live usage from historical usage.
  - **Attach Picker (new):** a scoped course/section/item selector limited to courses the user can edit; after attaching, the asset's usage list updates and a toast offers _Open item_.
- **Resilience:**
  - **403:** _"You don't have access to {folder}."_ naming the folder the asset lives in, with a request ID and **Ask an Admin for access**. A Viewer and a Support user (via `assets.read`) see the detail view read-only: case-1 controls are absent, not disabled.
  - **404:** _"This asset was deleted, or you followed an old link."_ + **Back to Content Library** + a request ID. If the asset is merely **archived**, it is a 200 with an **Archived** pill, never a 404.
  - **Offline:** Persistent banner; the view renders read-only from cache, and _"1 edit waiting to sync"_ counts queued metadata changes. Uploading a new version while offline is **queued**, not rejected.
  - **Reconnected:** Queued writes flush in order; a metadata edit whose `rowVersion` went stale resolves to Conflict.
  - **Session expired:** The 2-minute warning names the unsaved metadata edits and any in-flight version upload; on return the screen is restored with the buffer intact and the upload still resumable.
  - **Conflict:** Two people editing the same asset's metadata — the most common case being a tag added from two courses at once → _"Changed by {actor} {N} minutes ago."_ with **Review changes / Keep mine / Take theirs**, plus a field-level diff of the changed fields. Never Reload-only.
  - **Partial failure:** _"Saved 3 of 4 fields. The tag 'TOEFL 2026' was rejected — it already exists with different casing."_ The other three fields are kept.
  - **Server error:** _"We couldn't load this asset — nothing you did was lost."_ + Retry + a request ID.
- **Keyboard & Focus:**
  - Focus moves to the asset **Name** heading on load and the heading is the `aria-labelledby` target for the page region.
  - The `⋯` menu is one Tab stop; `↑`/`↓` move between items, `Enter` activates, `Esc` closes and returns focus to the trigger. The destructive item is separated by a non-focusable divider and is announced as destructive.
  - `Ctrl/⌘+S` flushes the metadata buffer; with a clean buffer the control is **Flush now**, disabled with `aria-describedby` "No unsaved changes".
  - Deep-linking to a specific **Used In** entry focuses that row and announces the destination in a polite live region.
- **Instrumentation & acceptance:**
  - **Events:** `asset_detail_viewed` `{assetId, versionCount, useCount}` · `asset_metadata_saved` `{fieldCount, failedFieldCount}` · `asset_version_uploaded` `{versionNumber, durationMs}` · `asset_version_restored` `{fromVersion}` · `asset_archived` `{useCount}` · `asset_detached_all` `{useCount, affectedStudentCount}` · `asset_delete_permanently_confirmed` `{useCount, courseCount, publishedUseCount, affectedStudentCount}`. IDs and counts only.
  - **Acceptance:**
    1. The delete confirmation names item count, course count, published-item count, and affected student count before the destructive action is enabled.
    2. **Archive** is the primary action; **Delete permanently** is separated below it in both the `⋯` menu and the dialog.
    3. **Archive** leaves every `asset_usage` row and every item reference intact and is reversible from the Archived filter.
    4. **Detach from all items** removes the references and keeps the file, and its confirmation names the affected student count.
    5. A new version does not become current until its bytes are complete; the previous version is still served during the upload.
    6. A concurrent metadata edit offers **Review changes / Keep mine / Take theirs**; no path offers Reload alone.
  - **Budgets:** Preview first paint < 1.5 s; the usage list renders in ≤ 2 queries and paginates past 50 entries; a video preview streams progressively and does not block metadata paint; version upload obeys the [S-3.2](#scr-3-2) upload budget.
- **Navigation:**
  - "Used In" row → [S-2.17](04-Courses.md#scr-2-17) Curriculum tab with that item's pane open
  - "Attach to curriculum item…" → the item pane of the chosen target
  - "Archive" → [S-3.1](#scr-3-1) Asset Repository, Archived filter, with a timed Undo toast
  - "Delete Asset" → [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation → [S-3.1](#scr-3-1) Asset Repository
  - Non-inline preview → [S-3.5](#scr-3-5) File Preview Modal

---

<a id="scr-3-4"></a>

##### Screen Name: S-3.4 Folders & Collections 🔄 CHANGED

- **Purpose:** Organize the Content Library into folders/collections so large asset sets stay navigable. In Revision 3 it is also a **search scope** and a **keyboard-reachable** move target.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Content Library  ▸  Videos  ▸  TOEFL Speaking          [+ New   │
  │                                                          Folder] │
  │ [Search this folder]                                            │
  ├──────────────────────────────────────────────────────────────────┤
  │ Templates (4)  Course Banners (7)  TOEFL Speaking (12)          │
  │ ▸ Reading ▸ (3)   ← depth 2, the maximum                       │
  ├──────────────────────────────────────────────────────────────────┤
  │ Assets in this folder:                                           │
  │  Intro.mp4   [⋯]   Part1.mp4   [⋯]   Part2.mp4   [⋯]           │
  │  (drop here, or use each row's ⋯ → Move to folder…)             │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Create, rename, and delete folders.
  2. Move assets between folders by drag-and-drop **or** by keyboard.
  3. **Move or copy an asset via the per-row `⋯` menu → Move to folder…** — a full folder picker, not a context menu.
  4. **Search within a folder**, or across the folder and its descendants.
- **Data Displayed/Modified:** Writes to `asset_folders`, updates `asset_library.folder_id`.
- **Validation & Feedback:**
  - **Nesting is capped at 2 levels.** A folder may contain folders, but not folders inside folders. Attempting a third level offers to create the folder as a **sibling** of the current one instead: _"Folders nest 2 levels deep. Create {name} alongside {current} instead?"_ — the option is offered, not imposed.
  - **Rename with a collision.** Renaming a folder to a name already used **in the same parent** is rejected inline with the fix named: _"A folder called 'Reading' already exists here. Choose another name, or merge into it."_ Merge is offered only while both folders are empty, and states exactly what happens: _"12 assets will move into Reading. The old folder will be removed."_ Renaming to a name used in a _different_ parent is allowed — sibling scopes may repeat.
  - **Move to folder…** opens a picker scoped to folders the user can write to, showing the full path of each option and the asset's current location. A move to a folder that is a descendant of the source is rejected (it would be a no-op that appears to work).
  - **Drag is never the only route** ([Part 11](11-Global-Standards.md#accessibility-specification)). Revision 1's right-click menu is removed: a context menu is unavailable on touch and hostile to a keyboard. The equivalent route is the row's `⋯` menu, and drag has a keyboard mode — `Space` picks up, arrows move, `Space` drops, `Esc` cancels, with every position change announced in a live region.
- **States:**
  - **Empty Folder:** [S-7.3](09-Shared-Components.md#scr-7-3) Empty State: "This folder is empty. Drag assets here, or use a file's ⋯ menu." — the non-drag route is named in the empty state itself.
  - **Zero-result (folder search):** "No assets in this folder match '{query}'." + **Clear search**. Search covers the folder **and its descendants**, and uses the Ge'ez 2-syllable n-gram tokenizer ([Part 11](11-Global-Standards.md#localization--formatting)), so እንግሊዝ matches እንግሊዝኛ. Matches are highlighted in filenames.
  - **Depth limit reached:** The **New Folder** action is disabled-with-a-reason — _"Folders nest 2 levels deep. Create it alongside TOEFL Speaking instead."_ — in a tooltip and in `aria-describedby`, with a working alternative rather than a dead control.
  - **Deleting Non-Empty Folder:** [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation: "Move 12 assets to Uncategorized?" The **reversible option is Archive folder**, which keeps the tree intact and is offered first.
  - **Moving:** Optimistic; the row relocates immediately and rolls back with an error toast on failure. The server's ordering is authoritative.
  - **Drag in progress:** The drop target is a full-width highlighted region with a visible label, not a thin outline, and is skipped entirely by Tab.
  - **Error:** _"We couldn't load these folders — nothing you did was lost."_ + Retry + a request ID.
- **Resilience:**
  - **403:** _"You don't have access to {folder}."_ naming the folder, with a request ID and **Ask an Admin for access** — the [S-7.12](09-Shared-Components.md#scr-7-12) Forbidden surface, not an empty list.
  - **404:** _"This folder was deleted, or you followed an old link."_ + **Back to Content Library** + a request ID. A breadcrumb segment for a deleted folder renders as **Unknown folder** with a working **Back to Content Library** link, so the crumb itself is never a dead end.
  - **Offline:** Persistent banner; the tree and grid render read-only from cache, with _"1 move waiting to sync."_ Drag-and-drop is disabled-with-a-reason (_"Reconnect to move files."_), and **Move to folder…** queues instead — the keyboard route is not penalised for being the accessible one.
  - **Reconnected:** Queued moves flush in order; a move into a folder deleted while offline resolves to a field error on that move, not a silent success.
  - **Session expired:** The 2-minute warning names any in-flight drag or a rename in progress; on return the breadcrumb and folder contents are restored.
  - **Conflict:** Two people renaming the same folder, or moving the same asset to different folders → _"Changed by {actor} {N} minutes ago."_ with **Review changes / Keep mine / Take theirs**. The two-card destination picker is the Review-changes surface.
  - **Partial failure:** A multi-select move reports per-folder results — _"9 moved · 2 failed — Retry failures"_ — naming which folders rejected them and why (permissions, quota, folder deleted).
  - **Server error:** Retry + a request ID in the product's voice.
- **Keyboard & Focus:**
  - The folder list is a `role="tree"` with `aria-level`, `aria-expanded`, and `aria-selected`: `↑`/`↓` between visible rows, `→`/`←` expand and collapse, `Home`/`End` to the ends, type-ahead to jump by name. It is a single Tab stop.
  - Selecting a folder moves focus to the asset grid and announces the destination; **Back** from the grid returns focus to the folder row with `aria-selected` restored.
  - Each asset row's `⋯` menu is reachable by `Tab` and operable by `Enter`; within it `↑`/`↓` move and `Esc` returns focus to the row.
  - Keyboard drag: `Space` picks up (announced), arrows move, `Space` drops, `Esc` cancels and restores the original position. The equivalent `Move to folder…` path exists for every gesture.
- **Instrumentation & acceptance:**
  - **Events:** `folder_opened` `{folderId, depth, resultCount}` · `folder_created` `{parentId, depth}` · `folder_renamed` `{folderId, collisionBlocked}` · `folder_deleted` `{folderId, assetCount, mode: archive|delete}` · `asset_moved` `{assetId, fromFolderId, toFolderId, method: drag|keyboard|menu}` · `folder_search` `{queryLength, resultCount, scope: subtree|folder}`. IDs, counts, and method only.
  - **Acceptance:**
    1. Creating or moving a folder past depth 2 offers a sibling instead, and never silently nests deeper.
    2. Renaming into a sibling name collision is blocked with the fix named; renaming into a name used in another parent succeeds.
    3. Every drag gesture has a `⋯` → **Move to folder…** equivalent, and the drag is completable with `Space`/arrows/`Space` alone.
    4. Folder search covers descendants and matches Ge'ez inflected forms via the 2-syllable n-gram rule.
    5. A depth-blocked **New Folder** is disabled with a reason in a tooltip and in `aria-describedby`, and the suggested alternative works.
    6. Deleting a non-empty folder offers **Archive folder** first.
  - **Budgets:** Folder tree interactive < 500 ms; a move applies in < 200 ms; folder search returns < 400 ms; keyboard move applies in < 200 ms.
- **Navigation:**
  - Folder click → drills into that folder (same screen, breadcrumb updates)
  - Asset click → [S-3.3](#scr-3-3) Asset Detail View
  - Breadcrumb segment → its parent folder, same screen
  - "Move to folder…" → the same screen, scrolled to the destination folder

---

<a id="scr-3-5"></a>

##### Screen Name: S-3.5 File Preview Modal 🔄 CHANGED

- **Purpose:** Lightweight, reusable overlay for previewing video, PDF, or image files without leaving the current screen. Invoked from [S-3.1](#scr-3-1), [S-3.3](#scr-3-3), and [S-2.7](04-Courses.md#scr-2-7).
- **User Role(s):** Admin, Editor, Viewer, Support
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │  Reading_Overview.mp4                          [Download] [X]   │
  │  +----------------------------------------------------------+   │
  │  |             [Video Player / PDF Viewer]                   |   │
  │  |             CC [On ▾]   Transcript   [Speed 1.0x ▾]        |   │
  │  +----------------------------------------------------------+   │
  │  ◀ Prev in folder                              Next in folder ▶ │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Play/scrub video, page through PDFs, zoom images.
  2. Navigate to the previous/next asset in the same folder without closing the modal.
  3. Turn captions on, read the transcript, change playback speed.
  4. Download the file.
- **Data Displayed/Modified:** Read-only. Reads the published transcript track from `transcripts` when one exists.
- **Validation & Feedback:**
  - **Dialog contract.** `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing at the file-name title, so the dialog is announced as _"Reading_Overview.mp4, dialog."_
  - **Focus moves into the dialog** on open — to the player or viewer surface itself, not to the close button — and is **trapped** while open. On close, focus **returns to the control that opened it** (the grid card, the [S-3.3](#scr-3-3) preview button, or the item-pane media block), including when the asset was changed with _Next_.
  - **`Esc` closes the modal** from anywhere in the chrome, **except while focus is inside a text input or an open dropdown**, where `Esc` closes only that. It never closes the whole modal from inside a control the user is still using.
  - **Focus ring is never removed.** Player surface, caption toggle, transcript panel, zoom, Prev/Next, Download, and Close are all keyboard operable with a visible focus ring.
  - **Video is never the sole channel for information** ([Part 11](11-Global-Standards.md#accessibility-specification)). A `CC` control is present whenever a caption track exists, and a **Transcript** toggle opens a scroll-synced, selectable text track where `⏎` seeks the player to that timestamp. A video with neither captions nor transcript states **"No captions available for this video"** and, for Editor/Admin, links to [S-3.6](#scr-3-6) — the absence is stated, never silent.
  - **Print:** `Ctrl/⌘+P` prints the asset metadata and, for an image or PDF, the current page. The print stylesheet drops the overlay positioning so the output is the content, not a floating box.
- **States:**
  - **Loading:** A skeleton in the media area, not a bare spinner, with the file name and size already visible. Title and Close are interactive from the first frame — a user is never trapped in a loading modal.
  - **Unsupported Format:** "Preview not available. Download to view." with **Download** as the primary action, and the reason named where known: _".docx files can't be previewed here."_ This is a decision made **before** trying.
  - **Preview Failed:** _"This file couldn't be previewed. Download it instead."_ + **Download** + **Retry**, with a request ID. Distinct from Unsupported: this is a failure that actually happened, and it always carries a request ID.
  - **No Captions:** "No captions available for this video." + (Editor/Admin) **Add captions** → [S-3.6](#scr-3-6).
  - **Streaming:** Video and large PDFs stream progressively; a buffering indicator overlays the media without blocking the controls, and seeking ahead reads _"Buffering…"_ rather than freezing silently.
  - **At a Folder Boundary:** _Next_ on the last asset is **disabled with a reason** (_"Last asset in TOEFL Speaking."_), not hidden and not a silent no-op.
  - **Error:** _"We couldn't load this preview — nothing you did was lost."_ + Retry + a request ID.
- **Resilience:**
  - **403:** The modal is readable by anyone with `assets.read`; a **403 on the media bytes** (expired signed URL, restricted asset) is reported _inside_ the modal — _"You don't have access to this file."_ + request ID + **Ask an Admin for access** — never as an empty black player. An expired signed URL is re-requested once silently before any 403 is shown.
  - **404:** _"This file was deleted, or you followed an old link."_ + **Back to Content Library** + a request ID, rendered inside the modal.
  - **Offline:** The modal opens and shows the metadata it has; the media area reads _"You're offline — this file needs a connection to stream."_ It never presents a broken player as though it were the file.
  - **Reconnected:** Streaming resumes from the last buffered position; the player does not restart from 0:00.
  - **Session expired:** The 2-minute warning names an open preview; on return the modal is restored on the same asset at the same position.
  - **Conflict:** This screen is read-only, so no metadata conflict arises here. If the **underlying asset** changed while the modal was open (renamed, new version), the header shows _"Updated by {actor} {N} minutes ago"_ + **Refresh**; the media is never swapped under the user.
  - **Partial failure:** In a Next/Prev sequence, one file failing to load does not close the modal — it renders **Preview Failed** in place, with Prev still working.
  - **Server error:** Retry + a request ID, in the product's voice.
- **Keyboard & Focus:**
  - `role="dialog"` + `aria-modal="true"` + focus trap + focus return to the trigger, per the contract above.
  - Video: `Space`/`K` play-pause, `←`/`→` seek 5 s, `↑`/`↓` volume, `M` mute, `F` fullscreen, `C` captions. PDF: `←`/`→`/`PageUp`/`PageDown`, `Ctrl/⌘+`/`Ctrl/⌘-` zoom. Image: `+`/`-` zoom, `0` reset. Every shortcut has a visible, labelled control equivalent — none is the only route.
  - `←`/`→` while focus is on the modal chrome (not inside the media) moves to the **previous/next asset in folder**, matching the on-screen arrows.
  - `Esc` closes from the chrome; from inside the transcript panel, `Esc` closes the panel first, then the modal.
  - The transcript panel is focusable and scroll-linked; follow-playhead is a labelled toggle, not an implicit behaviour.
- **Instrumentation & acceptance:**
  - **Events:** `preview_opened` `{assetId, source, mediaKind}` · `preview_closed` `{durationMs, method: esc|close_button|next|prev|download}` · `preview_failed` `{reason, mediaKind}` · `captions_toggled` `{on}` · `transcript_opened` `{hasTranscript}` · `preview_nav` `{direction}`. IDs and reason codes only — no filenames, no transcript text.
  - **Acceptance:**
    1. Focus is inside the media surface on open; after close it is on the exact control that opened the modal, including when the asset was changed with _Next_.
    2. `Tab` never escapes the modal, and the dialog is announced with the file name via `aria-labelledby`.
    3. `Esc` closes the modal from the chrome and does **not** close it from inside a text input.
    4. A video with a caption track has a working `CC` control and a scroll-synced Transcript panel.
    5. A video with no captions and no transcript reads **"No captions available"** rather than showing a silent video.
    6. **Preview Failed** offers **Download** and **Retry** and carries a request ID, and is distinct from **Unsupported Format**.
    7. _Next_ on the last asset in a folder is disabled with a reason, not hidden.
  - **Budgets:** Modal shell and metadata paint < 300 ms; first video frame < 1.5 s warm; PDF first page < 1 s; focus moves into the dialog within 100 ms of open; no layout shift as the media loads.
- **Navigation:**
  - "X" / `Esc` → returns to the screen that opened it, with focus restored to the triggering control
  - Prev / Next in folder → the adjacent asset in the same folder, same modal
  - "Add captions" → [S-3.6](#scr-3-6) Transcription & Subtitle Editor
  - "Download" → a file download of the current version

---

<a id="scr-3-6"></a>

##### Screen Name: S-3.6 Transcription & Subtitle Editor 🔄 CHANGED

- **Purpose:** Auto-generate, edit, and publish transcriptions and subtitles for video lessons: speech-to-text with timestamps, a segment editor, caption styling, translation options, and export to .srt/.vtt. Improves accessibility, searchability, and completion for video-heavy courses.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Transcription — Lesson 2: Skimming Basics"  [Export ▾]  │
  ├──────────────────────────────────────────────────────────────────┤
  │ +----------------------------+ +------------------------------+  │
  │ | [Video Player 16:9]        | | Transcript language:          |  │
  │ |  ▶ 00:00 / 12:34           | |  (● Amharic (am) ○ English    |  │
  │ |  [CC On]  [Speed 1.0x ▾]   | |   ○ Other… [type to search])  |  │
  │ |  Waveform + caption strip  | | Detected in audio: Amharic    |  │
  │ |                            | | Segments (auto-synced):      │  │
  │ |                            | | [00:04] እንደምን ደህና መጡ!        │  │
  │ |                            | │         ዛሬ የስክሚንግ ስለ እንውበር │  │
  │ |                            | │ [00:11] Skimming is reading  │  │
  │ |                            | │ [✎ Edit] [↻ Regenerate range] │  │
  │ |                            | │ [+ Add segment]              │  │
  │ +----------------------------+ +------------------------------+  │
  ├──────────────────────────────────────────────────────────────────┤
  │ [✨ Auto-Transcribe]  [Import .srt/.vtt]  [Translate ▾]          │
  │ Caption style: Font [Inter / Noto Sans Ethiopic ▾]  Size [16px]  │
  │               BG [Semi-transparent]  ☑ Show captions by default  │
  │ [Save & Apply to Lesson]                                          │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Auto-transcribe a video lesson (speech-to-text with timestamps and speaker detection when available).
  2. Edit any segment's text or timing; re-generate a time range without redoing the whole track.
  3. Import existing .srt/.vtt files, or translate the transcript to another language.
  4. Style captions, apply them to the lesson, and export .srt/.vtt.
  5. **Set the transcript's language** — Amharic, English, or another language from a searchable list.
- **Data Displayed/Modified:** Writes `transcripts`, `transcript_segments` (text, start/end, speaker, `lang`); lesson reads the published track for captions and the searchable transcript.
- **Validation & Feedback:**
  - **Transcript language selector.** The transcript is not assumed to be English. The selector is **Amharic (am)** / **English (en)** / **Other…** (a searchable BCP-47 list), and **Auto-Transcribe pre-selects from the audio's detected language**, saying so: _"Detected in audio: Amharic."_ The selected `lang` is stored on the transcript, written to each segment, and exported in the `.vtt` (`lang=` header) and `.srt` metadata, so a player's caption menu is correct rather than guessed.
  - A Ge'ez transcript applies the full [Part 11 typography](11-Global-Standards.md#localization--formatting): the `Noto Sans Ethiopic` stack, `line-height: 1.6`, `letter-spacing: normal`, and **no fixed-px line clamp** — the segments list grows, it does not clip. The caption font picker offers the Ethiopic face, and a Ge'ez caption at 16px must be legible against the semi-transparent background at 320px width.
  - **Read time is script-aware.** A Ge'ez transcript reports read time at `ceil(words / 180)`, an English one at `/ 220` ([Part 11](11-Global-Standards.md#localization--formatting)) — Ge'ez is denser per "word" and the 220 constant understates a long Amharic track.
  - **Transcript search is Ge'ez-aware.** Transcript text is indexed with the **2-syllable n-gram** tokenizer, so searching `እንግሊዝ` matches `እንግሊዝኛ` inside a transcript, and matches are highlighted in the segment list and in [S-1.3](03-Dashboard.md#scr-1-3) Global Search results.
  - Segment times must be monotonic (no overlaps); overlapping edits snap to the nearest free gap and say so: _"Overlaps the next segment — snapped to 0:00–0:06."_
  - Import validates .srt/.vtt syntax and reports malformed blocks with line numbers.
- **States:**
  - **Loading:** skeleton segments while the existing track resolves; the video player and caption controls stay interactive, because a slow transcript read must not block playback.
  - **No Captions Yet:** Player shows a "No captions" chip with the ✨ Auto-Transcribe CTA.
  - **Generating:** Progress with a time estimate; the editor stays navigable but is locked from edits with the reason _"Transcribing 3:20 / 12:34 — editing unlocks when it finishes."_ in a tooltip and in `aria-describedby`. Segments stream in as they are recognised.
  - **Editing:** Autosave per segment on a 30 s idle timer with the [S-7.8](09-Shared-Components.md#scr-7-8) indicator; `Ctrl/⌘+S` flushes. Playback follows the selected segment (click-to-seek).
  - **Long-Line Warning:** Segments exceeding 42 characters per line / 2 lines get a styling hint (readability best practice). **The 42-character rule is Latin-only** — it is advisory for `am`/`ti`/`gez` and never blocks a save, because a Ge'ez syllable is wider than a Latin character and the limit would mis-flag every Amharic segment.
  - **Applied:** Toast: "Captions applied to lesson." — the item shows a transcript tab for students, and readiness check `RC-5` stops blocking for captions on that item.
  - **Failed:** "Transcription failed for 0:00–0:30 (unclear audio)." with per-range retry and a request ID.
  - **Error:** _"We couldn't load this transcript — nothing you did was lost."_ + Retry + a request ID.
- **Resilience:**
  - **This screen inherits Part 05's resilience contract in full** ([Part 11](11-Global-Standards.md#resilience-states)) — 403, 404, offline, reconnected, session expiry, conflict, partial failure, and server error. Specifically:
  - **403:** _"You don't have access to {item}."_ naming the curriculum item, with a request ID and **Ask an Admin for access**. A Reviewer or Viewer never reaches the editing affordances at all — absent, not disabled.
  - **404:** _"This video was deleted, or you followed an old link."_ + **Back to Content Library** + a request ID. A retired transcript track that has been superseded reads as a version, not a 404.
  - **Offline:** Persistent banner; the player and segment list render read-only from cache, and segment edits queue — _"4 segment edits waiting to sync."_ Auto-transcribe is disabled-with-a-reason (_"Transcription needs a connection."_).
  - **Reconnected:** Queued segment edits flush in order; an edit whose segment `rowVersion` went stale resolves to Conflict rather than overwriting a colleague's correction.
  - **Session expired:** The 2-minute warning names this surface explicitly — a half-edited transcript is minutes of work. On return the editor is restored with the buffer and the generation job's progress intact.
  - **Conflict — per file and per segment.** Two people correcting the same transcript is ordinary. Resolution is **per segment**, not per track: _"Changed by {actor} {N} minutes ago"_ with **Review changes / Keep mine / Take theirs** on the specific segment, and a batch action **Keep all of mine / Keep all of theirs** for the rest. Taking _theirs_ for the whole track is available only as an explicit, confirmed bulk action, because transcription corrections are exactly where a silent overwrite destroys work. An AI **Regenerate** that lands on a segment someone has just hand-edited raises the same conflict rather than replacing the text.
  - **Partial failure:** _"Saved 41 of 43 segments. Segments 12–14 were rejected — the timings overlap. See below."_ The other 41 are kept, and the rejected range is focused.
- **Keyboard & Focus:**
  - The segment list is a `role="listbox"`: `↑`/`↓` move between segments, `Enter` seeks the player, `F2` or `Enter` on a focused segment opens it for editing, `Esc` leaves the editor keeping the text. The video player is a separate Tab stop before the list.
  - `Space` plays/pauses only when focus is on the player, never while a segment is being edited.
  - **Announcements:** generation progress and completion use a polite live region; a failure is `assertive`; every autosave state change is announced by the [S-7.8](09-Shared-Components.md#scr-7-8) indicator.
  - A deep link to a specific segment time focuses that segment and seeks the player there.
- **Instrumentation & acceptance:**
  - **Events:** `transcription_started` `{assetId, language, durationBucket}` · `transcription_segment_edited` `{mode: manual|regenerate|import}` · `transcription_applied` `{segmentCount, language}` · `transcription_conflict_resolved` `{scope: segment|track, resolution}` · `transcription_exported` `{format, language}`. IDs, counts, and language tags only — no transcript text, ever.
  - **Acceptance:**
    1. The language selector is present, defaults to the detected audio language, and the value is written to the `.vtt` `lang=` header on export.
    2. A Ge'ez transcript renders in Noto Sans Ethiopic at `line-height: 1.6` with no letter-spacing and no line clamp at 320px width.
    3. Searching `እንግሊዝ` matches `እንግሊዝኛ` inside a transcript.
    4. A concurrent segment edit offers **Review changes / Keep mine / Take theirs** for that segment; no path overwrites silently, and an AI regenerate on a hand-edited segment raises the same prompt.
    5. A 43-segment track with 2 rejected segments keeps the other 41 and reports the rejected range.
    6. No transcript text appears in any analytics event property.
  - **Budgets:** Segment list virtualised and interactive < 500 ms for a 2-hour track; seeking < 200 ms; autosave flush < 1 s; generating never blocks the player or the segment navigation.
- **Navigation:**
  - Opened from the [S-2.7](04-Courses.md#scr-2-7) item pane (video items → _Captions & transcript_) and from [S-3.3](#scr-3-3) Asset Detail (video assets)
  - "Export" → file download (.srt/.vtt)
  - **Save & Apply** → returns to the calling screen. When the call came from the workspace item pane, it returns to that **same item in the Curriculum tab with the pane still open and the editor scroll position restored**, and the item row in the tree shows a captions badge. This is a hard requirement: transcription is a long task, and returning to the course root loses the author's work context.
  - "Add captions" (from [S-3.5](#scr-3-5)) → this screen with the asset already loaded
