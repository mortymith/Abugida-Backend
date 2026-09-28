# Section 7: Shared Components

> **Abugida Academy — UX Design Specification** · Part 09 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Settings](08-Settings.md) · [Marketing & Growth →](10-Marketing-and-Growth.md)

## What changed in Part 09 (Revision 2)

- **New:** [S-7.8](09-Shared-Components.md#scr-7-8) Save-State Indicator · [S-7.9](09-Shared-Components.md#scr-7-9) Curriculum Tree · [S-7.10](09-Shared-Components.md#scr-7-10) Curriculum Item Actions Menu · [S-7.11](09-Shared-Components.md#scr-7-11) Publish Readiness Checklist.
- **Changed:** [S-7.5](09-Shared-Components.md#scr-7-5) Command Palette and [S-7.6](09-Shared-Components.md#scr-7-6) Onboarding Tour are curriculum-aware; [S-7.7](09-Shared-Components.md#scr-7-7) is generalised from "Duplicate Lesson Modal" to **Duplicate Item Modal** and now covers sections and same-course duplication.
- **Unchanged:** [S-7.1](09-Shared-Components.md#scr-7-1)–[S-7.4](09-Shared-Components.md#scr-7-4).

The four new components exist because the Course Workspace ([Part 04](04-Courses.md#the-course-workspace-model)) introduced three things Revision 1 had no vocabulary for: a persistent tree that must be keyboard-complete, a save-state contract shared by many editing surfaces, and a publish gate with deep links into the screens that fix each failure.

---

<a id="scr-7-1"></a>

##### Screen Name: S-7.1 Confirmation Dialog

- **Purpose:** Reusable confirmation dialog for destructive or irreversible actions.
- **User Role(s):** All roles
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Modal: Confirmation Dialog                                      │
  ├──────────────────────────────────────────────────────────────────┤
  │ ⚠️ [Warning Icon]                                               │
  │                                                                  │
  │ Title: "Delete Course?"                                         │
  │                                                                  │
  │ Body: "Are you sure you want to delete 'TOEFL Complete'? This   │
  │        action cannot be undone. All 234 student enrollments     │
  │        will also be affected."                                  │
  │                                                                  │
  │ [Confirm] [Cancel]                                              │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Confirm or cancel destructive action.
- **Data Displayed/Modified:** Varies by context.
- **States:**
  - **Default:** Title + body + buttons.
  - **Loading:** "Confirm" button spinner.
  - **Success:** Action executed, toast notification.
  - **Error:** "Unable to complete action. Retry?"
  - **Reversible Alternative (new):** Destructive curriculum actions offer the reversible path first — "Archive instead?" is presented as the primary button and "Delete permanently" as the secondary, per the [item action matrix](04-Courses.md#item-action-matrix). Archiving is the default answer, not a consolation prize.
  - **Typed Confirmation:** Reserved for irreversible, high-blast-radius actions only (course delete, unpublish-all-access). Never used for ordinary curriculum deletes.

---

<a id="scr-7-2"></a>

##### Screen Name: S-7.2 Toast Notifications

- **Purpose:** Non-blocking feedback for user actions.
- **User Role(s):** All roles
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────┐
  │ [Toast Container - Top Right Corner]                        │
  │ +────────────────────────────────────────────────────────--+┐ │
  │ │ ✅ Success: Course published successfully!               │ │
  │ │    (Auto-dismisses after 5 seconds)                      │ │
  │ +----------------------------------------------------------+─ │
  │                                                              │ │
  │ +----------------------------------------------------------+┐ │
  │ │ ⚠️ Warning: Some student data is incomplete.            │ │
  │ │    (Manual dismiss required)                             │ │
  │ +----------------------------------------------------------+─ │
  │                                                              │ │
  │ +----------------------------------------------------------+┐ │
  │ │ ❌ Error: Unable to save changes. Retry?                │ │
  │ │    [Retry] [Dismiss]                                     │ │
  │ +----------------------------------------------------------+─ │
  └──────────────────────────────────────────────────────────────┘
  ```
- **Types:** Success (green), Info (blue), Warning (orange), Error (red).
- **Behavior:** Success auto-dismisses after 5s. Errors require manual dismiss or action.
- **Undo toasts (new):** Destructive-but-reversible operations (archive, delete, bulk move) raise a toast with a **10s Undo** action. The countdown is announced once and pauses on hover/focus so it can never be missed by a keyboard or screen-reader user.

---

<a id="scr-7-3"></a>

##### Screen Name: S-7.3 Empty State Component

- **Purpose:** Standard empty state for list views with no data.
- **User Role(s):** All roles
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │                                                                  │
  │                        📚 [Empty Icon]                          │
  │                                                                  │
  │              "No courses yet. Create your first course!"        │
  │                                                                  │
  │              ┌───────────────────────────────┐                  │
  │              │        Create Course          │                  │
  │              └───────────────────────────────┘                  │
  │                                                                  │
  │              Or browse the [Content Library]                    │
  │              to get started.                                    │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Variants:** Different icon + text + CTA per module (Courses, Students, Assets, Cohorts, **Curriculum tree**).
- **Curriculum variant (new):** "No sections yet." with the three realistic starting points as equal-weight actions — **Create a section**, **Use a template**, **✨ Generate an outline** — plus **Import**. Offering a single CTA when there are four credible starting paths is a design failure; the variant is a short row of equal actions.
- **Distinction:** A genuinely empty module gets this component; a filter with no matches gets the lighter "No matches — adjust filters" state ([Part 11](11-Global-Standards.md#global-validation-and-feedback-patterns)).

---

<a id="scr-7-4"></a>

##### Screen Name: S-7.4 Help & Support Panel

- **Purpose:** Slide-out panel for in-app help: searchable knowledge base, contextual tips, and a contact-support form.
- **User Role(s):** All roles
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Help & Support                                            [X]   │
  │ [🔍 Search help articles…]                                      │
  │ Popular: "How to create a course" · "Setting up payments"        │
  │ ─────────────────────────────────────────────────────────────── │
  │ Still stuck? [Contact Support]  ·  [Watch Getting-Started Video] │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Search and read help articles inline.
  2. Submit a support ticket with the current screen auto-attached for context.
- **Data Displayed/Modified:** Read-only knowledge base; writes `support_tickets`.
- **States:**
  - **Default:** Popular articles for the current module surfaced first.
  - **In the Curriculum (new):** "Popular" is replaced by curriculum-specific articles — reordering items, keyboard moves, publish blockers — because those are the questions authors actually have at that moment.
  - **Ticket Submitted:** Toast: "We'll get back to you within one business day."
- **Navigation:**
  - Opened from a "?" icon available on every screen in [S-A.1](02-Global-Navigation.md#scr-a-1)

---

<a id="scr-7-5"></a>

##### Screen Name: S-7.5 Command Palette 🔄 CHANGED

- **Purpose:** Keyboard-driven quick-actions launcher (⌘K / Ctrl+K) for jumping to any screen, course, or **curriculum item**, and for triggering common actions without the mouse. Revision 2 adds curriculum-aware targets and course-contextual actions.
- **User Role(s):** All roles
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ [Type a command or search…]                                     │
  │ ── In this course ────────────────────────────────────────────── │
  │  ✎  Open item…                      (searches this course)     │
  │  ➕  Add item →                      Lesson · Quiz · Assignment  │
  │  ↕  Move current item up / down                                │
  │  👁  Preview course as a student                                │
  │  ✅ Publish checklist                                           │
  │ ── Navigate ──────────────────────────────────────────────────── │
  │  → Go to course workspace…                                      │
  │  → Create Course                                                 │
  │  → Go to Student Directory                                      │
  │ ── Recent ────────────────────────────────────────────────────── │
  │  📚 TOEFL Complete Course  ·  ✎ Skimming Basics                │
  │  👨‍🎓 Alemayehu K.                                                │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Fuzzy-search screens, courses, **curriculum items**, students, and assets.
  2. Trigger quick actions, now including the authoring actions of the course you are currently in.
  3. Run an action on the current selection without a mouse.
- **Data Displayed/Modified:** Read-only; the same index as [S-1.3](03-Dashboard.md#scr-1-3), extended with curriculum items and the active course context.
- **States:**
  - **Empty Query:** Recent items plus suggested actions for the current course.
  - **In a Course:** A **"In this course"** group appears first with item-scoped actions; the group is absent outside a workspace.
  - **Item Query:** Typing inside a course shows that course's items ranked first, with the section path as a secondary label ("S2 Reading Skills › Skimming Basics").
  - **No Match:** "No matches. Try a different term."
  - **Loading:** Result skeletons for the index lookup.
  - **Permission-Aware:** Actions the current role cannot perform are omitted, not disabled.
- **Navigation:**
  - Result select → target screen; `Esc` dismisses and returns focus to the prior screen
  - **Open item…** → [S-2.17](04-Courses.md#scr-2-17) Curriculum with that item's pane open
  - **Preview course as a student** → [S-2.21](04-Courses.md#scr-2-21)
  - **Publish checklist** → [S-2.22](04-Courses.md#scr-2-22)
  - `⌘K` **must not be swallowed by the lesson editor** — it is registered at the document level with a guard and covered by a test ([Part 12 § 7.3](12-Course-Editor-Markdown-Lessons.md#73-keyboard))

---

<a id="scr-7-6"></a>

##### Screen Name: S-7.6 Onboarding Tour 🔄 CHANGED

- **Purpose:** Contextual, dismissible product tour spotlighting key UI elements for first-time users, auto-launched after [S-0.2](01-Authentication-and-Onboarding.md#scr-0-2) sign-up. Revision 2 replaces the flat screen walk with a walkthrough of the **authoring workflow**.
- **User Role(s):** All roles (first login only, replayable from Help)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │            ┌─────────────────────────────┐                      │
  │            │ 3 of 6                        │                      │
  │            │ This tree is your course.     │                      │
  │            │ Click any item to edit it —   │                      │
  │            │ the tree stays right here.     │                      │
  │            │            [Skip] [Next →]     │                      │
  │            └─────────────┬───────────────┘                       │
  │                          ▼ (points at the curriculum sidebar)    │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Step through spotlighted UI elements.
  2. Skip or replay the tour at any time from [S-7.4](09-Shared-Components.md#scr-7-4) Help & Support.
  3. **Jump straight into a practice course**: a seeded sample course with content is created for the tour, so every step has something real to point at. The sample is clearly labelled and can be deleted in one action.
- **Data Displayed/Modified:** Writes `onboarding_progress.tour_completed`.
- **States:**
  - **In Progress:** Step counter and progress dots.
  - **Skipped/Completed:** Does not auto-launch again.
  - **Missing Target:** If a spotlighted element is absent (a role that cannot see it, or a screen the tour skipped past), the step is skipped silently rather than spotlighting empty space.
- **Navigation:**
  - "Next" advances through: [S-1.1](03-Dashboard.md#scr-1-1) Dashboard → [S-2.1](04-Courses.md#scr-2-1) Catalog → [S-2.6](04-Courses.md#scr-2-6) workspace Overview → [S-2.17](04-Courses.md#scr-2-17) curriculum sidebar → item pane → [S-2.22](04-Courses.md#scr-2-22) publish checklist → [S-4.1](06-Students.md#scr-4-1) Students → [S-6.1](08-Settings.md#scr-6-1) Settings
  - The tour always demonstrates the **core authoring loop**: pick an item → edit it → check publish readiness.

---

<a id="scr-7-7"></a>

##### Screen Name: S-7.7 Duplicate Item Modal 🔄 CHANGED

- **Purpose:** Clone a curriculum **item or section**, either in place within the same course (the common case) or into another course. Preserves content, media, and attached quizzes. Revision 2 makes same-course duplication the default and adds section duplication.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Modal: "Duplicate"                                  [X] Close   │
  ├──────────────────────────────────────────────────────────────────┤
  │ Source: "Skimming Basics"  (item · lesson)                      │
  │         TOEFL Complete ▸ S2 Reading Skills                       │
  │ ────────────────────────────────────────────────────────────────│
  │ Target: (● This course   ○ Another course)                        │
  │   Section: [S2 Reading Skills ▾]  or  [+ New section]            │
  │   Position: (○ End of section  ● After "Skimming Basics")        │
  │ ────────────────────────────────────────────────────────────────│
  │ Include:                                                          │
  │   ☑ Content & media   ☑ Attached quiz (copied, unlinked)         │
  │   ☐ Unlock rules (not transferable)   ☐ Publish immediately      │
  │                                                                  │
  │ ⚠️ "Skimming Basics" already exists in this section → saved as   │
  │    "Skimming Basics (copy)"                                      │
  │                                                                  │
  │ [Duplicate]                                                       │
  │  → Progress → ✅ "Duplicated."  [Open the copy]                   │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Duplicate into **this course** (default) — pick the target section and position, or create a section inline.
  2. Duplicate **into another course** — pick the course and section.
  3. Duplicate a **section** with all of its items, in one action; the same dialog, scoped to the section, showing an item count.
  4. Choose what to include: content & media, attached quiz, unlock rules, immediate publish.
  5. Jump straight to the new copy.
- **Data Displayed/Modified:** Reads the source item/section and its `quizzes`; writes a new `lessons` (or a whole `modules` subtree) row set, plus a **copy** of the quiz — the copy is independently editable and its analytics are never merged with the source's.
- **States:**
  - **Default:** Source pre-filled from the triggering row; **This course** preselected; the target section defaults to the source's section and the position to _after the source_.
  - **Duplicating a Section:** A progress summary states the exact counts: "Copying 2 sections and 14 items…". Section duplication is never silent about scope.
  - **Name Conflict:** An existing item with the same title in the target section → automatic " (copy)" suffix, shown before confirming.
  - **Duplicating:** Progress indicator; media is referenced, not re-uploaded, when the asset lives in the [Content Library](05-Content-Library.md#scr-3-1).
  - **Success:** Toast: "Duplicated." with an **Open the copy** deep link that selects the new item in the tree.
  - **Review-Gated Target:** If the target course requires approval ([S-2.14](04-Courses.md#scr-2-14)), the copy is created in Draft and cannot bypass the workflow.
  - **Archived Source:** Allowed; the copy is created live. The dialog states that the source is archived.
- **Validation & Feedback:**
  - Target course selector lists only courses where the user has edit rights.
  - Quiz copies are detached from the original's analytics; the note in the modal says so explicitly.
  - Unlock rules are never copied blindly (cross-course references would be invalid); re-configure them in the target via [S-2.15](04-Courses.md#scr-2-15).
  - Duplicating into a **published** course still creates the copy as unpublished; "Publish immediately" is the only way around it, and it is off by default and requires the course's publish permission.
- **Navigation:**
  - Triggered from the sidebar row `⋯ → Duplicate…` and the item pane `⋯` menu in [S-2.17](04-Courses.md#scr-2-17)/[S-2.7](04-Courses.md#scr-2-7), the Quiz Builder, and the section `⋯` menu
  - **Open the copy** → [S-2.17](04-Courses.md#scr-2-17) Curriculum with the copy selected
  - **X** Close → returns to the triggering screen with the tree selection intact

---

<a id="scr-7-8"></a>

##### Screen Name: S-7.8 Save-State Indicator 🆕 NEW

- **Purpose:** One shared vocabulary for "is my work saved?" across every editing surface in the product — the item pane, the quiz builder, the assignment builder, course settings, the approval toggle, and the readiness checklist. Revision 2 introduced many concurrent editing surfaces; without one component they would each invent their own wording, and a user could not tell a saving state from a failed one.
- **User Role(s):** All roles
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Variants                                                          │
  │                                                                  │
  │  ● All changes saved                            (idle, 2s)     │
  │  ◌ Unsaved changes · ⌘S                        (dirty)        │
  │  ◐ Saving…                                      (saving)      │
  │  ● All changes saved at 14:02                   (saved)        │
  │  ✕ Save failed — [Retry]                        (error)        │
  │  ⚠ Edited elsewhere — [Reload]                  (conflict)     │
  │  ⏸ Autosave paused (in review)                  (suspended)    │
  │                                                                  │
  │  Compact (icon-only, toolbar):  ●  ◌  ◐  ✕  ⚠                  │
  │  Full (footer strip, wide surfaces):                             │
  │  ┌────────────────────────────────────────────────────────────┐ │
  │  │ ● All changes saved 14:02            [Save now ⌘S]        │ │
  │  └────────────────────────────────────────────────────────────┘ │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **States:** `idle` · `dirty` · `saving` · `saved` · `error` · `conflict` · `suspended` (review lock) · `offline` (queue and retry on reconnect).

  | State       | Label                         | Visual                                             | Duration                             |
  | ----------- | ----------------------------- | -------------------------------------------------- | ------------------------------------ |
  | `idle`      | "All changes saved"           | neutral dot                                        | until dirty                          |
  | `dirty`     | "Unsaved changes · ⌘S"        | amber dot                                          | until saving                         |
  | `saving`    | "Saving…"                     | spinner, **never** replaces text with colour alone | ≥ 300ms floor so it does not flicker |
  | `saved`     | "All changes saved at HH:MM"  | green check + timestamp                            | 4s, then `idle`                      |
  | `error`     | "Save failed — Retry"         | red + action                                       | until resolved                       |
  | `conflict`  | "Edited elsewhere — Reload"   | amber + action                                     | until resolved                       |
  | `suspended` | "Autosave paused (in review)" | lock icon + explanation                            | persistent                           |
  | `offline`   | "Offline — changes queued"    | cloud-off + queued count                           | until reconnect                      |

- **Primary Actions:**
  1. Read the state at a glance without reading text (icon + colour), with the full text available to assistive tech.
  2. **Retry** from `error`, **Reload** from `conflict`, **Save now** (`⌘/Ctrl+S`) to flush immediately.
  3. Abandon deliberately via the [S-7.1](09-Shared-Components.md#scr-7-1) dialog, never by closing a tab.
- **Data Displayed/Modified:** Consumes a save contract; writes nothing itself. Persistence is owned by the surface and guarded by `rowVersion`.
- **Behaviour Contract (binding on every editing surface):**
  1. **Never discard a buffer silently.** On failure the unsaved content stays in the editor; only an explicit Discard removes it.
  2. **Failure raises a toast _and_ holds the indicator in `error`.** A toast that auto-dismisses while the indicator forgets the failure is a data-loss bug.
  3. **Switching context flushes first** — changing item, tab, section, or route. If the flush fails, navigation is blocked with Retry / Discard / Stay.
  4. **`saving` has a minimum visible duration** so fast saves do not strobe.
  5. **State is announced, not implied:** the full variant is an `aria-live="polite"` region; the compact variant is `aria-live="assertive"` for `error` and `conflict` only.
  6. **Tab close / unload with a dirty buffer** triggers the [S-7.1](09-Shared-Components.md#scr-7-1) unsaved-changes dialog.
  7. **The word "Saved" appears only after the server confirms** — never on an optimistic write.
- **Placement Rules:**
  - **Full variant:** persistent surfaces with a footer (item pane, quiz builder, settings sections).
  - **Compact variant:** headers, toolbars, and the settings section header, where the label would crowd the title.
  - The two variants are never shown simultaneously for the same buffer.
- **Navigation:**
  - **Retry / Reload / Save now** → the owning surface's mutation
  - **Offline → Reconnect** → retries the queue and reports the result
  - Used by [S-2.7](04-Courses.md#scr-2-7), [S-2.8](04-Courses.md#scr-2-8), [S-2.17](04-Courses.md#scr-2-17), [S-2.20](04-Courses.md#scr-2-20), [S-2.23](04-Courses.md#scr-2-23)
  - Governed by [Part 11 § Auto-save](11-Global-Standards.md#global-validation-and-feedback-patterns) and [Part 12 § 8](12-Course-Editor-Markdown-Lessons.md#8-persistence--state)

---

<a id="scr-7-9"></a>

##### Screen Name: S-7.9 Curriculum Tree 🆕 NEW

- **Purpose:** The persistent curriculum sidebar of [S-2.17](04-Courses.md#scr-2-17): sections and their items, with add, rename, reorder, move, duplicate, archive, and delete. It is specified here as a shared component because the same tree renders in three contexts — the Curriculum tab, the [S-2.21](04-Courses.md#scr-2-21) preview's outline, and the [S-2.14](04-Courses.md#scr-2-14) review panel — and they must behave identically.
- **User Role(s):** Admin, Editor (Reviewer/Viewer: read-only rendering)
- **Wireframe Layout (Text-Based):**
  ```
  ┌─── CURRICULUM TREE (320px) ─────────────────────────────────────────┐
  │ [＋ Section ▾]   ⌕ Filter items…   [Archived (3)]  [⌘K here]       │
  │ ─────────────────────────────────────────────────────────────────── │
  │ ▾ ⠿ S1 Foundations            3 items · 41m        [⋯]              │
  │   ├ 📄 What is TOEFL?       ✓ approved   231 students              │
  │   ├ 🎥 Test format          ◐ in review   228 students              │
  │   └ ✎ Reading assignment    ⚠ no content    0 students              │
  │ ▾ ⠿ S2 Reading Skills       2 items · 25m        [⋯]              │
  │   ├ 📄 Overview              ✓ approved    198 students              │
  │   └ ✎ Essay draft           🔒 locked       0 students              │
  │ ▸ ⠿ S3 Listening            1 item · 18m         [⋯]              │
  │ ▸ ⠿ S4 Practice             5 items · 1h 10m     [⋯]              │
  │ ─────────────────────────────────────────────────────────────────── │
  │ ＋ Add item ▾  Lesson · Quiz · Assignment                          │
  │ ⠿ = drag handle   ✓ approved  ◐ in review  ⚠ no content             │
  │ 🔒 = has unlock rules (S-2.15)                                       │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Semantics:** `role="tree"` with `role="treeitem"` rows and `aria-expanded` / `aria-level` / `aria-selected`. Sections are level 1, items level 2. Selection is single and follows the pane. The tree is a `tabindex=0` composite widget: one Tab stop, arrow keys inside.
- **Primary Actions:**
  1. Navigate (`↑`/`↓` between visible rows, `→` expand, `←` collapse, `Home`/`End`, type-ahead to jump by title).
  2. Select a row to open the corresponding pane.
  3. Reorder by drag-and-drop: sections among sections, items within a section, items across sections.
  4. Move without dragging — `Move up`, `Move down`, `Move to section ▸` from the [S-7.10](09-Shared-Components.md#scr-7-10) menu.
  5. Add a section or an item inline; rename inline with `F2`.
  6. Collapse/expand (persisted per user), filter, search, and open the archived view.
  7. Bulk-select with `Shift`-click / `Ctrl`-click for multi-archive, multi-move, and bulk reordering.
- **Data Displayed/Modified:** Sections and items from `getCurriculum`; writes through the curriculum server functions listed in [S-2.17](04-Courses.md#scr-2-17).
- **States:**
  - **Empty:** The [S-7.3](09-Shared-Components.md#scr-7-3) curriculum variant with four equal starting actions.
  - **Collapsed Section:** Header only, showing the item count and total duration; a collapsed section with ⚠ items shows the count of items needing content so problems are never hidden by collapsing.
  - **Drag Active:** The dragged row lifts; valid drop positions show a 2px insertion line; invalid targets are dimmed and non-droppable. Hovering a collapsed section for 600ms expands it so cross-section drops are always reachable.
  - **Drag Keyboard Mode:** `Space` picks up a row, arrows move it, `Space` drops, `Esc` cancels — the standard accessible drag pattern, with every move announced in a live region ("Essay draft, position 2 of 3 in S2 Reading Skills").
  - **Optimistic Reorder:** The tree reorders instantly; the server returns the authoritative tree and the client adopts it, so a server-side renormalisation can never leave the UI lying.
  - **Conflict:** A concurrent structural change reverts the optimistic move and raises a toast with Reload.
  - **Inline Creation:** A focused title input appears in place with a kind selector; `Enter` commits, `Esc` cancels. The row shows a `saving` dot until the server confirms.
  - **Inline Rename:** Single-line input; `Enter` commits, `Esc` reverts. Duplicate titles within a section are allowed and warned, not blocked.
  - **Archived View:** Archived rows render greyed with a restore action; they are excluded from every count in the active tree and from publish readiness.
  - **Search / Filter:** Non-matching sections collapse to "⋯ n hidden" rather than disappearing, so structure is never lost.
  - **Read-only (Reviewer/Viewer):** No drag handles, no inline editing, no add buttons. `aria-disabled` rather than a broken interaction.
  - **Loading:** Section-block skeletons; a previously selected item stays highlighted so the pane does not appear to reset.
- **Validation & Feedback:**
  - Titles: 3–300 characters, both levels.
  - Every mutation is optimistic-with-rollback and shows [S-7.8](09-Shared-Components.md#scr-7-8) state at the row level for creation, and a global state for reordering.
  - Drag is never the only way to reorder — this is a WCAG requirement, not a graceful degradation.
  - Row metrics are fixed per kind so the sidebar stays scannable: reach for published items, ⚠ for items without content, nothing for untouched drafts.
- **Navigation:**
  - Row selection → the item pane ([S-2.7](04-Courses.md#scr-2-7) / [S-2.8](04-Courses.md#scr-2-8) / [S-2.23](04-Courses.md#scr-2-23)) in the same screen
  - `⋯` on a row → [S-7.10](09-Shared-Components.md#scr-7-10) item actions
  - `⋯` on a section → Rename · Duplicate · Complete in order ([S-2.15](04-Courses.md#scr-2-15)) · Settings · Archive · Delete
  - **＋ Add item ▾** → creates a Lesson / Quiz / Assignment and opens its pane
  - **Archived (3)** → archived view with Restore / Delete
  - Reused by [S-2.21](04-Courses.md#scr-2-21) (as a read-only outline) and [S-2.14](04-Courses.md#scr-2-14) (as the review navigator)

---

<a id="scr-7-10"></a>

##### Screen Name: S-7.10 Curriculum Item Actions Menu 🆕 NEW

- **Purpose:** The `⋯` overflow menu on every curriculum row and in the item pane header. Revision 1 had ad-hoc per-row buttons; a course can now be re-organised, duplicated, archived, and deleted from dozens of places, and they must offer the same set of actions with the same rules everywhere.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌─────────────────────────────┐
  │ ✎ Rename…                    │
  │ ⧉ Duplicate…                 │
  │ ⇅ Move to section ▸  S1 ▏S2▕ │
  │ ⇅ Move up        ⌥↑         │
  │ ⇅ Move down      ⌥↓         │
  │ ─────────────────────────── │
  │ 🔒 Unlock rules              │
  │ 👁 Preview as student        │
  │ 📊 View analytics            │
  │ ─────────────────────────── │
  │ 📤 Copy Markdown             │
  │ ↗ Open in new tab            │
  │ ─────────────────────────── │
  │ 🗄 Archive…     (default)    │
  │ 🗑 Delete…      (destructive)│
  └─────────────────────────────┘
  ```
- **Primary Actions:** the menu entries shown above, filtered by item kind and role.
- **Data Displayed/Modified:** Dispatches the curriculum server functions; every entry produces an audit entry.
- **States:**
  - **Kind Filtering:** **Quiz** items show **Questions** and **AI draft quiz**; **Assignment** items show **Grading**; all items show the shared core.
  - **First Item / Last Item:** _Move up_ / _Move down_ are disabled **with a reason in the tooltip** ("Already first in this section") — never a silent no-op.
  - **Single-Section Course:** _Move to section_ is hidden, not disabled, because there is nowhere to move to.
  - **Locked by Review:** Mutating entries are replaced by a single **View review** entry plus an explanation, so the menu never shows eight things that all fail.
  - **Archived Item:** The menu becomes **Restore** · **Duplicate** · **Delete permanently**.
  - **Read-only Role:** The menu is not rendered; the row exposes only _Open in new tab_.
  - **Danger Zone:** _Archive_ is a normal row; _Delete_ is separated by a divider, is red, and is never the default focus target. Focus lands on **Rename**, not on Delete.
- **Validation & Feedback:**
  - **Archive before Delete** — the order in the menu encodes the safe default.
  - _Duplicate…_ opens [S-7.7](09-Shared-Components.md#scr-7-7); _Move_ and _Archive_ are immediate with optimistic rollback; _Delete_ always confirms via [S-7.1](09-Shared-Components.md#scr-7-1).
  - **Undo:** archive and delete raise a 10s Undo toast ([S-7.2](09-Shared-Components.md#scr-7-2)).
  - **The menu closes and returns focus to the `⋯` trigger** after any action, so keyboard users are never stranded.
- **Navigation:**
  - Triggered from the [S-7.9](09-Shared-Components.md#scr-7-9) row, the [S-2.7](04-Courses.md#scr-2-7) item pane header, and the Curriculum toolbar
  - **Rename / Move / Archive / Delete** → [S-2.17](04-Courses.md#scr-2-17) actions
  - **Duplicate…** → [S-7.7](09-Shared-Components.md#scr-7-7)
  - **Unlock rules** → [S-2.15](04-Courses.md#scr-2-15)
  - **Preview as student** → [S-2.21](04-Courses.md#scr-2-21)
  - **View analytics** → [S-2.19](04-Courses.md#scr-2-19) filtered to the item
  - **Open in new tab** → the alias route, which opens the workspace with this item selected

---

<a id="scr-7-11"></a>

##### Screen Name: S-7.11 Publish Readiness Checklist 🆕 NEW

- **Purpose:** The reusable rendering of the [S-2.22](04-Courses.md#scr-2-22) readiness checks. Every check is a row with a verdict, an explanation, and a **Fix** action that deep-links into the screen and field that resolves it. A gate the author cannot act on is a report, not a gate.
- **User Role(s):** All roles (Admin, Editor, Reviewer, Viewer — read-only for the last two)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ PUBLISH READINESS            4 of 8 checks pass                 │
  │                                                                   │
  │ ✅ RC-1  Title, exam, instructor, thumbnail                       │
  │ ✅ RC-2  Description (180 characters)                             │
  │ ❌ RC-3  At least one section with one item                       │
  │         No sections yet.                          [Add a section →]│
  │ ❌ RC-4  Every published item has content                         │
  │         3 items have no content: Test format, Essay draft, …     │
  │                                              [Open the first one →] │
  │ ⚠ RC-7  Completion rule                                          │
  │         Using the default: 100% of published items   [Change →]  │
  │ ⛔ RC-8  Review                                                   │
  │         2 items await approval                    [Open queue →]   │
  │                                                                   │
  │ Re-checked 2 minutes ago            [Re-check]                    │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **States:** `pass` (✅) · `fail-blocking` (❌) · `pass-with-warning` (⚠, does not block) · `not-applicable` (—, hidden rather than shown as a failure) · `pending-review` (⏳, blocking only when `requiresApproval` is on).
- **Primary Actions:**
  1. Read which checks block publishing and why.
  2. **Fix** — deep-link to the exact screen, tab, and field; the field is focused on arrival.
  3. **Re-check** after an out-of-band change; checks are otherwise re-evaluated on load and before every publish attempt.
  4. Collapse blocking vs advisory sections when the list is long.
- **Data Displayed/Modified:** Reads `getPublishReadiness`; writes nothing. The server is the single source of truth for verdicts.
- **States and Behaviour:**
  - **All Pass:** The summary states what publishing will do ("18 items, 3 quizzes, 234 students keep access") and the lifecycle CTA becomes available.
  - **Failures:** Grouped as _Blocking_ and _Advisory_; blocking entries are never collapsed by default.
  - **Warning vs Failure:** A warning is a real recommendation that does not block (e.g. no certificate configured for a course with no completion rule). The distinction is stated in the copy, never implied by colour.
  - **In Review:** Read-only with a banner explaining that a course cannot be edited into an inconsistent state while a decision is pending — items edited during review are flagged instead.
  - **Stale:** If the last evaluation is older than 5 minutes or the course has changed, a **Re-check** affordance appears next to the timestamp.
  - **Archived Course:** All checks are evaluated against the archived state and the checklist is read-only.
  - **Loading / Error:** Skeleton rows; a failed evaluation never renders a green checklist — it renders an error, because a false "ready" is the most damaging possible output of this component.
- **Validation & Feedback:**
  - Each row's copy names the **specific offending objects** ("3 items have no content: …"), not a category.
  - The checklist is a mirror of server evaluation; the client never computes a verdict locally.
  - The full check table (`RC-1`…`RC-8`) is defined in [S-2.22](04-Courses.md#readiness-checks) and is the single source for both this component and the server query.
- **Navigation:**
  - **Fix →** → the owning screen and field: [S-2.20](04-Courses.md#scr-2-20) Details/Pricing/Completion, [S-2.17](04-Courses.md#scr-2-17) Curriculum, an item pane, or the [S-2.14](04-Courses.md#scr-2-14) queue
  - **Re-check** → re-runs `getPublishReadiness`
  - Rendered in [S-2.22](04-Courses.md#scr-2-22), in the [S-2.6](04-Courses.md#scr-2-6) Overview banner, and in the [S-2.14](04-Courses.md#scr-2-14) course review panel
