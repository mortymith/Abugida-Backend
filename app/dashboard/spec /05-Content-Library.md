# Section 3: Content Library

> **Abugida Academy — UX Design Specification** · Part 05 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Courses](04-Courses.md) · [Students →](06-Students.md)

<a id="scr-3-1"></a>

##### Screen Name: S-3.1 Asset Repository

- **Purpose:** Central repository for all media assets (videos, PDFs, images) used across courses. Supports upload, organization, tagging, and search.
- **User Role(s):** Admin, Editor, Viewer
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Content Library"                        [+ Upload]    │
  │         [Search] [Filter: All] [Sort: Date]                    │
  ├──────────────────────────────────────────────────────────────────┤
  │ Stats Row:                                                      │
  │ +----------+ +----------+ +----------+ +----------+          │
  │ | 📁 156   | | 🎬 89   | | 📄 45   | | 🖼️ 22   |          │
  │ | Total    | | Videos   | | PDFs    | | Images  |          │
  │ | Assets   | | 12GB used| | 3GB used| | 1.2GB   |          │
  │ +----------+ +----------+ +----------+ +----------+          │
  ├──────────────────────────────────────────────────────────────────┤
  │ Grid View (3 columns):                                         │
  │ +──────────────────+ +──────────────────+ +──────────────────+ │
  │ | [Thumbnail]      | | [Thumbnail]      | | [Thumbnail]      │ │
  │ | 📄 PDF           | | 🎬 Video         | | 🖼️ Image         │ │
  │ | TOEFL_Syllabus   | | Reading_Overview | | Course_Banner     │ │
  │ | 2.3 MB · 23 uses | | 45 MB · 12 uses | | 1.2 MB · 8 uses  │ │
  │ | Tags: TOEFL, PDF | | Tags: Reading   | | Tags: Banner      │ │
  │ | Uploaded: 3 days | | Uploaded: 1 week | | Uploaded: 2 days │ │
  │ | [Edit] [Delete]  | | [Edit] [Delete]  | | [Edit] [Delete]  │ │
  │ +──────────────────+ +──────────────────+ +──────────────────+ │
  │                                                               │
  │ Pagination                                                    │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Upload new assets.
  2. Search and filter assets.
  3. Preview and edit asset metadata.
  4. Delete or replace assets.
  5. View usage count (which courses use this asset).
- **Data Displayed/Modified:** Reads from asset_library table with usage counts.
- **States:**
  - **Default:** Grid populated with all assets.
  - **Empty:** [S-7.3](09-Shared-Components.md#scr-7-3): "No assets uploaded. Upload your first asset to get started."
  - **Loading:** Skeleton grid (6 cards).
  - **Uploading:** Upload progress modal.
  - **Deleting:** [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation: "This asset is used in 3 courses. Are you sure you want to delete it?"
  - **Error:** "Unable to load assets. Retry?"
- **Navigation:**
  - "Upload" → [S-3.2](#scr-3-2) Asset Upload Modal
  - Asset Click → S-3.3 Asset Detail View
  - "Edit" → S-3.3 Asset Detail View

---

<a id="scr-3-2"></a>

##### Screen Name: S-3.2 Asset Upload Modal

- **Purpose:** Modal for uploading new assets with drag-and-drop support and metadata tagging.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Modal: "Upload Asset"                         [X] Close        │
  ├──────────────────────────────────────────────────────────────────┤
  │ Drop Zone:                                                      │
  │ +─────────────────────────────────────────────────────────────+ │
  │ │ 📤 Drag & drop files here or click to browse               │ │
  │ │                                                              │ │
  │ │ Supported: MP4, PDF, PNG, JPG, MP3                         │ │
  │ │ Max size: 500MB                                            │ │
  │ +─────────────────────────────────────────────────────────────+ │
  │                                                              │
  │ File List (if multiple selected):                             │
  │ +─────────────────────────────────────────────────────────────+ │
  │ │ 📄 TOEFL_Syllabus.pdf     2.3 MB  [✗]                      │ │
  │ │ 🎬 Reading_Overview.mp4   45 MB   [✗]                      │ │
  │ │ 🖼️ Course_Banner.png      1.2 MB  [✗]                      │ │
  │ +─────────────────────────────────────────────────────────────+ │
  │                                                              │
  │ Asset Metadata:                                               │
  │ [Asset Name: TOEFL_Syllabus.pdf]                             │
  │ [Tags: TOEFL, Syllabus, PDF]                                 │
  │ [Description: Full syllabus for TOEFL course]               │
  │                                                              │
  │ [ ] Replace existing asset with same name                    │
  │                                                              │
  │ [Upload 3 Assets] [Cancel]                                   │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Drag-and-drop files.
  2. Add metadata (name, tags, description).
  3. Upload assets.
  4. Remove files from queue.
- **Data Displayed/Modified:** Writes to asset_library table.
- **States:**
  - **Default:** Empty drop zone.
  - **File Selected:** File list with metadata fields.
  - **Uploading:** Progress bar per file.
  - **Success:** Toast: "3 assets uploaded successfully." → Close modal.
  - **Error:** "Upload failed. Check file format and size."
- **Navigation:**
  - "Upload" → Start upload → Close modal
  - "X" Close → Confirmation if upload in progress

---

<a id="scr-3-3"></a>

##### Screen Name: S-3.3 Asset Detail View

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
  │ Used In (3):                                                     │
  │  • TOEFL Complete Course → Module 1 → "What is TOEFL?"          │
  │  • TOEFL Speaking Intensive → Module 2                           │
  │                                                                  │
  │ Version History: v3 (current) · v2 · v1  [Upload New Version]   │
  │ [Replace File] [Delete Asset]                                   │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Preview the file inline (uses [S-3.5](#scr-3-5) File Preview Modal for non-inline types).
  2. Edit tags and description.
  3. Upload a new version or replace the file.
  4. View everywhere the asset is used.
  5. Delete the asset.
- **Data Displayed/Modified:** Reads/writes `asset_library`, `asset_versions`, `asset_usage`.
- **States:**
  - **Default:** Preview + metadata populated.
  - **In Use Delete Attempt:** Warns "This asset is used in 3 lessons" before allowing deletion via [S-7.1](09-Shared-Components.md#scr-7-1).
  - **Uploading New Version:** Progress bar; previous version retained.
  - **Success:** Toast: "Asset updated."
- **Navigation:**
  - "Used In" row → [S-2.7](04-Courses.md#scr-2-7) Lesson Editor
  - "Delete Asset" → [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation → [S-3.1](#scr-3-1) Asset Repository
  - Non-inline preview → [S-3.5](#scr-3-5) File Preview Modal

---

<a id="scr-3-4"></a>

##### Screen Name: S-3.4 Folders & Collections

- **Purpose:** Organize the Content Library into folders/collections so large asset sets stay navigable.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Content Library  ▸  Videos  ▸  TOEFL Speaking          [+ New   │
  │                                                          Folder] │
  ├──────────────────────────────────────────────────────────────────┤
  │ 📁 Templates    📁 Course Banners    📁 TOEFL Speaking (12)      │
  ├──────────────────────────────────────────────────────────────────┤
  │ Assets in this folder: [drag files here to move them in]        │
  │  🎬 Intro.mp4   🎬 Part1.mp4   🎬 Part2.mp4                     │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Create, rename, and delete folders.
  2. Drag-and-drop assets between folders.
  3. Move or copy assets via right-click / context menu.
- **Data Displayed/Modified:** Writes to `asset_folders`, updates `asset_library.folder_id`.
- **States:**
  - **Empty Folder:** [S-7.3](09-Shared-Components.md#scr-7-3) Empty State: "This folder is empty. Drag assets here."
  - **Deleting Non-Empty Folder:** [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation: "Move 12 assets to Uncategorized?"
- **Navigation:**
  - Folder click → drills into that folder (same screen, breadcrumb updates)
  - Asset click → [S-3.3](#scr-3-3) Asset Detail View

---

<a id="scr-3-5"></a>

##### Screen Name: S-3.5 File Preview Modal

- **Purpose:** Lightweight, reusable overlay for previewing video, PDF, or image files without leaving the current screen. Invoked from [S-3.1](#scr-3-1), [S-3.3](#scr-3-3), and [S-2.7](04-Courses.md#scr-2-7).
- **User Role(s):** Admin, Editor, Viewer, Support
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │  Reading_Overview.mp4                                    [X]    │
  │  +──────────────────────────────────────────────────────────+   │
  │  │                 [Video Player / PDF Viewer]                │   │
  │  +──────────────────────────────────────────────────────────+   │
  │  ◀ Prev in folder                              Next in folder ▶ │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Play/scrub video, page through PDFs, zoom images.
  2. Navigate to the previous/next asset in the same folder without closing the modal.
- **Data Displayed/Modified:** Read-only.
- **States:**
  - **Loading:** Spinner while the file streams.
  - **Unsupported Format:** "Preview not available. Download to view."
- **Navigation:**
  - "X" / Esc → returns to the screen that opened it

---

<a id="scr-3-6"></a>

##### Screen Name: S-3.6 Transcription & Subtitle Editor

- **Purpose:** Auto-generate, edit, and publish transcriptions and subtitles for video lessons: speech-to-text with timestamps, a segment editor, caption styling, translation options, and export to .srt/.vtt. Improves accessibility, searchability, and completion for video-heavy courses.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Transcription — Lesson 2: Skimming Basics"  [Export ▾]  │
  ├──────────────────────────────────────────────────────────────────┤
  │ +────────────────────────────+ +──────────────────────────────+  │
  │ │ [Video Player 16:9]        │ │ Segments (auto-synced):      │  │
  │ │  ▶ 00:00 / 12:34           │ │ [00:04] Welcome back. Today  │  │
  │ │  [CC On]  [Language: EN ▾] │ │         we're looking at…    │  │
  │ │  Waveform + caption strip  │ │ [00:11] Skimming is reading  │  │
  │ │                            │ │         quickly for the gist │  │
  │ │                            │ │ [00:19] …                    │  │
  │ │                            │ │ [✏️ Edit] [↻ Regenerate      │  │
  │ │                            │ │  0:00–0:30] [+ Add segment]  │  │
  │ +────────────────────────────+ +──────────────────────────────+  │
  ├──────────────────────────────────────────────────────────────────┤
  │ [✨ Auto-Transcribe]  [Import .srt/.vtt]  [Translate ▾]          │
  │ Caption style: Font [Inter ▾]  Size [16px]  BG [Semi-transparent]│
  │ [Save & Apply to Lesson]     ☑ Show captions by default          │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Auto-transcribe a video lesson (speech-to-text with timestamps and speaker detection when available).
  2. Edit any segment's text or timing; re-generate a time range without redoing the whole track.
  3. Import existing .srt/.vtt files, or translate the transcript to another language.
  4. Style captions, apply them to the lesson, and export .srt/.vtt.
- **Data Displayed/Modified:** Writes `transcripts`, `transcript_segments` (text, start/end, speaker); lesson reads the published track for captions and the searchable transcript.
- **States:**
  - **No Captions Yet:** Player shows "No captions" chip with the ✨ Auto-Transcribe CTA.
  - **Generating:** Progress with time estimate; the editor stays navigable but locked from edits; streaming segments appear as they are recognized.
  - **Editing:** Autosave every 30 seconds per segment; playback follows the selected segment (click-to-seek).
  - **Long-Line Warning:** Segments exceeding 42 characters per line / 2 lines get a ⚠️ styling hint (readability best practice).
  - **Applied:** Toast: "Captions applied to lesson." — lesson shows a transcript tab for students.
  - **Failed:** "Transcription failed for 0:00–0:30 (unclear audio)." with per-range retry.
- **Validation & Feedback:**
  - Segment times must be monotonic (no overlaps); overlapping edits snap to the nearest free gap.
  - Import validates .srt/.vtt syntax and reports malformed blocks with line numbers.
  - Transcript text is indexed for [S-1.3](03-Dashboard.md#scr-1-3) Global Search once applied.
- **Navigation:**
  - Opened from [S-2.7](04-Courses.md#scr-2-7) Lesson Editor (video lessons → "Captions & transcript") and [S-3.3](#scr-3-3) Asset Detail (video assets)
  - "Export" → file download (.srt/.vtt)
  - "Save & Apply" → returns to the calling screen ([S-2.7](04-Courses.md#scr-2-7) or [S-3.3](#scr-3-3))
