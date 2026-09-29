# Section 7: Shared Components

> **Abugida Academy — UX Design Specification** · Part 09 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Settings](08-Settings.md) · [Marketing & Growth →](10-Marketing-and-Growth.md)

## What changed in Part 09 (Revision 3)

- **The file gains a [Component Index](#component-index).** Revision 2 left the ownership of each component implicit, which is why the palette could be restated locally in [S-7.2](#scr-7-2) and why the form primitives in [S-7.12](#scr-7-12) were missing entirely. The index is an index, not a second source of truth.
- **[S-7.12 Form & Data Primitives 🆕](#scr-7-12)** — Input, Select, Combobox, MultiSelect, DateTimePicker, Tabs, DataTable, Pagination, Skeleton, CopyButton, StatusPill, Avatar, Money, and DropZone, plus the **Forbidden (403)** and **Offline** surfaces. Parts 05, 06, 08, and 10 all render tables and forms and previously had no specification for them.
- **[S-7.1](#scr-7-1) gains an API contract and fixes its own safe-action contradiction.** The wireframe showed `[Confirm] [Cancel]` while the prose and `DESIGN.md` §5.7 required focus on the reversible alternative; the wireframe now matches. It also gains the **Unsaved Changes** variant that [S-7.8](#scr-7-8) rule 6 referenced but nobody defined.
- **Palette hues are gone.** [S-7.2](#scr-7-2) no longer restates colour values ruled out as text by `DESIGN.md` §15 #2; types map to the Part 11 fill / text / tint triples, and error toasts never auto-dismiss.
- **[S-7.9](#scr-7-9) contradicts itself on selection and on width.** "Selection is single" is replaced by the three-mode model (single drives the pane, multi is bulk-only), and the fixed 320px sidebar becomes the Part 11 resizable 240–480px / collapsible-to-0 behaviour.
- **[S-7.3 vs `DESIGN.md` §5.7 is resolved here.** "One sentence, one CTA" is the default; the multi-action variant is permitted **only** where more than one credible starting path exists, and the variant is named. `DESIGN.md` §15 should record this as a resolved conflict.
- **The out-of-capability affordance is stated once.** [S-7.10](#scr-7-10) now quotes the Part 11 three-case policy and notes that absent, disabled-with-reason, and replaced-with-an-explanation are **not interchangeable**.
- **Every component gains `Keyboard & Focus`, `ARIA`, `Resilience`, and `Instrumentation & acceptance`** where relevant, and the file closes with a per-component **Responsive** table and the authoritative **[Keyboard Shortcuts](#keyboard-shortcuts)** appendix Part 11 points at.
- **Recent items stop leaking student names.** [S-7.5](#scr-7-5) Recent groups are filtered by `students.read` **server-side**; a role without it sees the student group omitted, not empty.

---

## Component Index

Every component the product renders, and where its behaviour is actually specified. This file owns the first block; the second is indexed here only so that "which file defines this?" has one answer.

### Owned here

| Component                                       | Screen ID           | Where specified                                                                  | Notes                                                         |
| ----------------------------------------------- | ------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Confirmation Dialog (+ Unsaved Changes variant) | [S-7.1](#scr-7-1)   | This section                                                                     | Hosts the destructive confirm and the dirty-buffer guard      |
| Toast Notifications                             | [S-7.2](#scr-7-2)   | This section                                                                     | Non-blocking feedback, timed Undo, `status` / `alert`         |
| Empty State Component                           | [S-7.3](#scr-7-3)   | This section                                                                     | True-empty only; a filter miss is a lighter zero-result state |
| Help & Support Panel                            | [S-7.4](#scr-7-4)   | This section                                                                     | Knowledge base + ticket form                                  |
| Command Palette                                 | [S-7.5](#scr-7-5)   | This section                                                                     | ⌘K / Ctrl+K, globally registered                              |
| Onboarding Tour                                 | [S-7.6](#scr-7-6)   | This section                                                                     | Authoring-loop walkthrough over a seeded practice course      |
| Duplicate Item Modal                            | [S-7.7](#scr-7-7)   | This section                                                                     | Items and sections, same-course or cross-course               |
| Save-State Indicator                            | [S-7.8](#scr-7-8)   | This section                                                                     | One state machine for every editing surface                   |
| Curriculum Tree                                 | [S-7.9](#scr-7-9)   | This section                                                                     | Also the preview outline and the review navigator             |
| Curriculum Item Actions Menu                    | [S-7.10](#scr-7-10) | This section                                                                     | The single `⋯` menu; archive before delete                    |
| Publish Readiness Checklist                     | [S-7.11](#scr-7-11) | This section                                                                     | Server-evaluated verdicts with Fix deep links                 |
| **Form & Data Primitives** 🆕                   | [S-7.12](#scr-7-12) | This section                                                                     | Cross-cutting controls; items 28 of the Part 11 index         |
| Forbidden (403) surface 🆕                      | [S-7.12](#scr-7-12) | This section                                                                     | A dedicated page, never a silent empty list                   |
| Offline banner + read-only surface 🆕           | [S-7.12](#scr-7-12) | This section                                                                     | Persistent, with a queued-write count                         |
| StatusPill 🆕                                   | [S-7.12](#scr-7-12) | This section · tokens in [Part 11](11-Global-Standards.md#status-colour-mapping) | Rendered as fill + text + tint, never coloured text alone     |

### Owned elsewhere

| Component                   | Screen ID                                | Where specified                                 | Notes                                                                                 |
| --------------------------- | ---------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| Sidebar Navigation          | [S-A.1](02-Global-Navigation.md#scr-a-1) | [Part 02](02-Global-Navigation.md#scr-a-1)      | Collapse, role-filtered nav, skip link                                                |
| Breadcrumb                  | [S-A.1](02-Global-Navigation.md#scr-a-1) | [Part 02](02-Global-Navigation.md#scr-a-1)      | Workspace-aware                                                                       |
| Notification Bell / drawer  | [S-1.4](03-Dashboard.md#scr-1-4)         | [Part 03](03-Dashboard.md#scr-1-4)              | In-app channel is mandatory ([Part 11](11-Global-Standards.md#notification-delivery)) |
| Course Card                 | [S-2.1](04-Courses.md#scr-2-1)           | [Part 04](04-Courses.md#scr-2-1)                | Status pill sourced from [S-7.12](#scr-7-12)                                          |
| Workspace Shell             | [S-2.6](04-Courses.md#scr-2-6)           | [Part 04](04-Courses.md#scr-2-6)                | Identity header + lifecycle stepper + `⋯`                                             |
| Lifecycle Stepper           | [S-2.22](04-Courses.md#scr-2-22)         | [Part 04](04-Courses.md#course-lifecycle)       | Clickable, labelled, never colour-only                                                |
| Approval Status Stepper     | [S-2.14](04-Courses.md#scr-2-14)         | [Part 04](04-Courses.md#scr-2-14)               | Draft → Published                                                                     |
| Rich-Text Authoring Surface | [S-2.7](04-Courses.md#scr-2-7)           | [Part 12](12-Course-Editor-Markdown-Lessons.md) | Idle-timer autosave; ⌘K must not be swallowed here                                    |
| File Preview Modal          | [S-3.5](05-Content-Library.md#scr-3-5)   | [Part 05](05-Content-Library.md#scr-3-5)        | Video / PDF / image                                                                   |
| Badge Card                  | [S-4.7](06-Students.md#scr-4-7)          | [Part 06](06-Students.md#scr-4-7)               | Badge + trigger + status pill                                                         |
| Rule Builder                | [S-4.8](06-Students.md#scr-4-8)          | [Part 06](06-Students.md#scr-4-8)               | Always paired with a dry-run preview                                                  |
| Permission Matrix Table     | [S-6.9](08-Settings.md#scr-6-9)          | [Part 08](08-Settings.md#scr-6-9)               | Module × capability toggles                                                           |
| AI Prompt Panel             | [S-2.11](04-Courses.md#scr-2-11)         | [Part 04](04-Courses.md#scr-2-11)               | Streaming draft, explicit accept/discard                                              |
| Preview Frame               | [S-2.21](04-Courses.md#scr-2-21)         | [Part 04](04-Courses.md#scr-2-21)               | Fixed device frame; a labelled region, not a resized page                             |
| Multi-Step Wizard           | [S-2.13](04-Courses.md#scr-2-13)         | [Part 04](04-Courses.md#scr-2-13)               | Retired from course creation; still used by Bulk Import                               |

> **This list is an index, not a second source of truth.** Where a component is defined in this file, that definition governs; where it is defined elsewhere, that file governs. Tokens and colour mappings are never redefined here — they come from [Part 11](11-Global-Standards.md#status-colour-mapping).

---

## What changed in Part 09 (Revision 2)

- **New:** [S-7.8](09-Shared-Components.md#scr-7-8) Save-State Indicator · [S-7.9](09-Shared-Components.md#scr-7-9) Curriculum Tree · [S-7.10](09-Shared-Components.md#scr-7-10) Curriculum Item Actions Menu · [S-7.11](09-Shared-Components.md#scr-7-11) Publish Readiness Checklist.
- **Changed:** [S-7.5](09-Shared-Components.md#scr-7-5) Command Palette and [S-7.6](09-Shared-Components.md#scr-7-6) Onboarding Tour are curriculum-aware; [S-7.7](09-Shared-Components.md#scr-7-7) is generalised from "Duplicate Lesson Modal" to **Duplicate Item Modal** and now covers sections and same-course duplication.
- **Also changed, contrary to the Revision 1 note that S-7.1–S-7.4 were "Unchanged":** [S-7.1](09-Shared-Components.md#scr-7-1) gained the **Reversible Alternative** and **Typed Confirmation** states; [S-7.2](09-Shared-Components.md#scr-7-2) gained **Undo toasts**; [S-7.3](09-Shared-Components.md#scr-7-3) gained the **curriculum variant**; [S-7.4](09-Shared-Components.md#scr-7-4) gained the curriculum-specific **Popular** replacement. All four are marked `(new)` inline.

The four new components exist because the Course Workspace ([Part 04](04-Courses.md#the-course-workspace-model)) introduced three things Revision 1 had no vocabulary for: a persistent tree that must be keyboard-complete, a save-state contract shared by many editing surfaces, and a publish gate with deep links into the screens that fix each failure.

---

<a id="scr-7-1"></a>

##### Screen Name: S-7.1 Confirmation Dialog 🔄 CHANGED

- **Purpose:** Reusable confirmation dialog for destructive or irreversible actions. Revision 3 adds the API contract every screen depends on, the **Unsaved Changes** variant, and a corrected safe-action wireframe.
- **User Role(s):** All roles
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Modal: Confirmation Dialog                                      │
  ├──────────────────────────────────────────────────────────────────┤
  │ ⚠ Delete "TOEFL Complete" permanently?                          │
  │                                                                  │
  │ Body: "This deletes the course and its 234 student enrollments.  │
  │        It cannot be undone."                                     │
  │                                                                  │
  │   [ Archive instead ]  [ Delete permanently ]  [ Cancel ]        │
  │   ▲ focus starts here       tone: danger          Esc also works│
  └──────────────────────────────────────────────────────────────────┘

  Variant: Unsaved Changes
  ┌──────────────────────────────────────────────────────────────────┐
  │ You have unsaved changes                                        │
  │                                                                  │
  │ Lesson body — 340 characters unsaved                             │
  │ Quiz: 2 questions                                               │
  │ Course description — unsaved                                    │
  │                                                                  │
  │   [ Retry ]  [ Discard ]  [ Stay ]                              │
  │                     ▲ focus starts here                          │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Safe action:** When a reversible alternative exists it is the primary button and receives initial focus. `Cancel` is never the default. Escape cancels. Wireframe focus order is `[Archive instead] [Delete permanently] [Cancel]`.
- **API Contract:**

  | Prop                     | Type                                 | Notes                                                                                                              |
  | ------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
  | `title`                  | `string`                             | Names the object: _"Delete "TOEFL Complete" permanently?"_                                                         |
  | `body`                   | `string`                             | States the consequence and the blast radius, never a bare "Are you sure?"                                          |
  | `consequenceCount?`      | `number`                             | e.g. `234` enrollments; rendered as a count, never a vague "several items"                                         |
  | `confirmLabel`           | `string`                             | Verb-first: "Delete permanently", not "Confirm"                                                                    |
  | `cancelLabel`            | `string`                             | "Cancel" by default; never the focused control                                                                     |
  | `tone`                   | `'danger' \| 'warning' \| 'neutral'` | Drives the icon and the button treatment; from the [Part 11](11-Global-Standards.md#status-colour-mapping) triples |
  | `requireTyped?`          | `string`                             | Exact string the user must type. High blast radius only                                                            |
  | `reversibleAlternative?` | `{ label, onSelect }`                | Present ⇒ becomes the primary button and the initial focus                                                         |
  | `onConfirm`              | `() => Promise<void>`                | Drives the loading state; a rejection renders inline, it does not close                                            |

- **Primary Actions:**
  1. Confirm or cancel destructive action.
- **Data Displayed/Modified:** Varies by context.
- **Validation & Feedback:**
  - `requireTyped` blocks confirm until the input matches exactly; mismatch states _"Type Delete permanently to confirm."_
  - `onConfirm` rejection keeps the dialog open with the reason inline and the button re-enabled — a closed dialog over a failed delete is a lie about the outcome.
- **States:**
  - **Default:** Title + body + buttons.
  - **Loading:** "Confirm" button spinner; `Cancel` is disabled while in flight so the dialog cannot be dismissed over a pending mutation.
  - **Success:** Action executed, toast notification.
  - **Error:** "Unable to complete action. Retry?" — inline, never a replacement dialog.
  - **Reversible Alternative (new):** Destructive curriculum actions offer the reversible path first — "Archive instead?" is presented as the primary button and "Delete permanently" as the secondary, per the [item action matrix](04-Courses.md#item-action-matrix). Archiving is the default answer, not a consolation prize.
  - **Typed Confirmation:** Reserved for irreversible, high-blast-radius actions only (course delete, unpublish-all-access). Never used for ordinary curriculum deletes.
  - **Unsaved Changes (new):** the variant below.
- **Unsaved Changes variant (new):**
  - **Title:** _"You have unsaved changes"_. The body **names each dirty surface and the size of the loss** — _"Lesson body — 340 characters unsaved"_, _"Quiz: 2 questions"_ — never "you have unsaved work".
  - **Buttons:** `[Retry] [Discard] [Stay]`, with **Stay** focused. `Discard` is the only tone: `danger`.
  - **Triggers:** tab close, route change, workspace-tab or section switch, and `beforeunload`.
  - **Two-save model:** surfaces with a visible **Save changes** button (the [S-6.x](08-Settings.md) settings surfaces) are `explicit-save` — the dialog names that button, and the loss measure is characters/fields changed. Surfaces with an idle-timer autosave ([S-2.7](04-Courses.md#scr-2-7)) are `autosave` — the dialog appears **only after a failed flush**, never because the buffer is merely dirty, because the user has nothing to lose that autosave has not already kept.
- **Keyboard & Focus:**
  - Focus moves into the dialog on open and is **trapped** until it closes.
  - Initial focus: the reversible alternative if present, otherwise `Cancel`; for Unsaved Changes, `Stay`.
  - `Tab` / `Shift+Tab` cycle only within the dialog; `Escape` cancels; `Enter` activates the focused control.
  - Focus **returns to the trigger** on close in every path — confirm, cancel, Escape, or error.
  - Background content is `inert`; no pointer event reaches it.
- **ARIA:**
  - `role="dialog"`, `aria-modal="true"`, `aria-labelledby` the title, `aria-describedby` the body.
  - The dialog is a `z-index: 200` layer and always sits **above** toasts, so a toast can never cover the confirm action.
  - The typed-confirmation input is referenced by the button's `aria-describedby` when confirm is still blocked.
- **Resilience:** `403` — the dialog closes and the underlying surface renders the Forbidden page; `offline` — confirm is disabled with the reason _"You're offline — this needs a connection"_, the typed value is preserved, and re-enables on reconnect; `session-expired` — the buffer is preserved and the dialog returns after re-authentication; `conflict` — a stale `rowVersion` resolves to the Part 11 conflict actions, not to a second dialog on top of this one; `server-error` — inline error with a request ID, dialog stays open.
- **Instrumentation & acceptance:** Events `confirm_dialog_opened` (`{tone, consequenceCount, requireTyped, has_reversible_alternative, variant}`) · `confirm_dialog_resolved` (`{outcome, ms_to_decision}`) · `unsaved_changes_blocked` (`{surface_ids[], save_model}`). Accept when: focus lands on the reversible alternative when one exists; Escape cancels with no side effect; `requireTyped` blocks until an exact match; focus returns to the trigger on all four exit paths; no toast overlaps the confirm button. Budget: open < 100 ms, no layout shift.
- **Navigation:**
  - Triggered by every destructive entry in [S-7.10](#scr-7-10), course delete, unpublish, bulk archive/delete, and by any navigation that would drop a failed-flush buffer.

---

<a id="scr-7-2"></a>

##### Screen Name: S-7.2 Toast Notifications 🔄 CHANGED

- **Purpose:** Non-blocking feedback for user actions.
- **User Role(s):** All roles
- **Primary Actions:** dismiss (auto, manual, or `Escape`); run the toasts's action — **Retry**, **Undo**, **View**, **Discard**; never a navigation in its own right.
- **Data Displayed/Modified:** None. A toast reads only what its caller passes: `type`, `message`, optional `action`, optional `requestId`, `durationMs`. It performs no write of its own.
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────┐
  │ [Toast Container - Top Right Corner]                        │
  │ +----------------------------------------------------------+┐ │
  │ │ ✔ Course published. 234 students keep access.   [View]  │ │
  │ │   (auto-dismisses after 5s)                             │ │
  │ +----------------------------------------------------------+─ │
  │ +----------------------------------------------------------+┐ │
  │ │ ● 1 item is missing a thumbnail.                        │ │
  │ │   (manual dismiss)                                      │ │
  │ +----------------------------------------------------------+─ │
  │ +----------------------------------------------------------+┐ │
  │ │ ✕ Couldn't save "Reading Skills". Your work is safe.     │ │
  │ │   [Retry] [Discard]                            [Dismiss] │ │
  │ │   (never auto-dismisses)                                │ │
  │ +----------------------------------------------------------+─ │
  └──────────────────────────────────────────────────────────────┘
  ```
- **Types:** each type maps to the [Part 11](11-Global-Standards.md#status-colour-mapping) fill / text / tint triple — success `success-text` on `success-tint`, info `info-text` on `info-tint`, warning `warning-text` on `warning-tint`, error `danger-text` on `danger-tint`. **The toast border and icon use the fill; all text uses the text token.** No raw hex value is chosen in this file.
- **Behavior:** Maximum **3** visible toasts; the rest queue and render in arrival order. Success and info auto-dismiss after 5s and pause on hover **and** focus. Warning requires manual dismiss. **Error never auto-dismisses** and always offers Retry, per [Part 11 § Resilience](11-Global-Standards.md#resilience-states).
- **Undo toasts (new):** Destructive-but-reversible operations (archive, delete, bulk move) raise a toast with a **10 s Undo** action. Undo is a 10 s button whose remaining time is shown visually only, not in a live region; the region announces _"Archived. Undo available for 10 seconds"_ once. **A toast containing an action never auto-dismisses while it holds focus.**
- **Keyboard & Focus:** toasts are reachable in DOM order after the main content, never inserted ahead of the focused element; `Tab` moves into a toast and suspends its dismiss timer; `Escape` dismisses the focused toast and returns focus to the element that raised it.
- **ARIA:** success / info / warning are `role="status"`; **error is `role="alert"`**. The timer is `aria-hidden`. Each action carries its own label ("Undo archive", not "Undo").
- **Resilience:** `offline` — a queued action's toast states _"Queued — we'll retry when you're back online"_ rather than claiming success; `session-expired` — a toast raised post-re-auth names the surface it belongs to; `partial-failure` — one toast per outcome, capped at 3, with the rest queued; `server-error` — error toast carries the request ID.
- **Instrumentation & acceptance:** Events `toast_shown` (`{type, action?, duration_ms, queued}`) · `toast_dismissed` (`{type, method: auto|manual|action}`) · `undo_invoked` (`{action, ms_since_action}`). Accept when: no more than 3 render at once; an error toast survives 30s untouched; a focused toast with an action survives focus indefinitely; Undo is reachable by keyboard and its timer pauses on focus. Budget: mount < 50 ms, no reflow of the page behind it.
- **States:**
  - **Loading:** a toast is the loading surface, not a subject of it — an action in flight is expressed as a pending action on the toast that raised it, never as a second toast. **Visible** (entering, animating in over 200 ms), **Hovered** (timer paused), **Focused** (timer paused), **Auto-dismissed** (after 5 s for success/info), **Manually dismissed**, **Action taken** (the action ran; the toast retitles to its outcome), and **Queued** (over the 3-toast cap). Warning requires manual dismissal. Error never auto-dismisses.
- **Navigation:** `z-index: 300`, always below modals (200 is higher; toasts never overlap a confirm action). A toast never navigates on its own — the **View** / **Retry** / **Undo** action owns the destination.

---

<a id="scr-7-3"></a>

##### Screen Name: S-7.3 Empty State Component 🔄 CHANGED

- **Purpose:** Standard empty state for list views with no data.
- **User Role(s):** All roles
- **Primary Actions:** the module's creation action — **Create Course** in the example. Secondary: browse the [Content Library](#navigation). The `multi-action` variant exposes 3–4 equal-weight starting paths instead. Rate the state with 👍 / 👎.
- **Data Displayed/Modified:** Read-only. It renders a count and a copy string supplied by the caller; the 👍 / 👎 form posts `{ screenId, componentId, variant, rating, comment? }` to a feedback endpoint and writes nothing else.
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
  │                                    👍  👎  (in-context feedback)   │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **CTA rule (resolves the `DESIGN.md` §5.7 conflict):** **one sentence, one CTA is the default.** The multi-action variant is permitted **only** where more than one credible starting path exists, and that variant is **named** in this file as the `multi-action` variant. A second CTA added for decoration rather than a real alternative path is a defect.
- **Variants:** Different icon + text + CTA per module (Courses, Students, Assets, Cohorts, **Curriculum tree**).
- **Curriculum variant (`multi-action`):** "No sections yet." with the three realistic starting points as equal-weight actions — **Create a section**, **Use a template**, **✨ Generate an outline** — plus **Import**. Four credible starting paths is precisely the condition the rule above permits.
- **Distinction:** A genuinely empty module gets this component; a filter with no matches gets the lighter "No matches — adjust filters" state with a **Clear filters** action ([Part 11](11-Global-Standards.md#global-validation-and-feedback-patterns)).
- **In-context feedback:** every empty state carries a 👍 / 👎 pair. Either opens a **one-field form** — a single optional textarea, no required fields — tagged with the screen ID and the component ID (`screen: S-2.17`, `component: S-7.3`, `variant: multi-action`). Submitting raises a confirmation toast; dismissal is silent. Feedback is never a route out of the empty state and never a second CTA.
- **Keyboard & Focus:** the primary CTA is the first tab stop inside the region; the 👍 / 👎 pair sits after it and is reachable by `Tab`; both carry `aria-label`s that name what is being rated.
- **ARIA:** the region is `role="status"` only while loading; the empty state itself is a plain `section` with `aria-labelledby` the sentence, so it is not announced as a live update on arrival. The rating control is a `group` labelled _"Was this empty state useful?"_.
- **Resilience:** `403` — an empty state is never used to render a forbidden module; the Forbidden page replaces it. `offline` — the CTA is disabled with the reason _"You're offline — create this when you're back"_ and the sentence explains why. `server-error` — a load failure is an error state, not an empty state.
- **Instrumentation & acceptance:** Events `empty_state_shown` (`{module, variant, screen_id}`) · `empty_state_cta_clicked` (`{module, cta}`) · `empty_state_feedback` (`{screen_id, component_id, rating}`). Accept when: a filtered-to-zero list never renders the empty state; the rating form submits with every field optional; 👍/👎 are reachable without a pointer; no PII or authored content appears in event properties. Budget: renders with no CLS.
- **States:**
  - **True empty:** no record has ever been created. Renders the illustration, the sentence, and a creation CTA. This is the only case that offers a CTA.
  - **Zero-result:** records exist but a filter or search excluded them. Renders the lighter _"No matches — adjust filters"_ with a **Clear filters** action, **never** a creation CTA.
  - **Loading:** a skeleton, not this component. An empty state that flashes during load is a defect.
  - **Not permitted:** a module the role cannot use renders the Forbidden page, never an empty state. See [Resilience](#resilience).
  - **Error:** a load failure renders the error state with Retry and a request ID. An empty state is never a fallback for a failed request.
- **Navigation:** CTA → the module's creation flow; **Content Library** link → [S-3.1](05-Content-Library.md#scr-3-1).

---

<a id="scr-7-4"></a>

##### Screen Name: S-7.4 Help & Support Panel 🔄 CHANGED

- **Purpose:** Slide-out panel for in-app help: searchable knowledge base, contextual tips, and a contact-support form.
- **User Role(s):** All roles
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Help & Support                                            [X]   │
  │ [🔍 Search help articles…]                                      │
  │ Popular: "How to create a course" · "Setting up payments"        │
  │ ─────────────────────────────────────────────────────────────── │
  │ ┌──────────────────────────────────────────────────────────────┐ │
  │ │ Reordering items                                           │ │
  │ │ Drag a row, or press Space and use the arrow keys.          │ │
  │ └──────────────────────────────────────────────────────────────┘ │
  │ ─────────────────────────────────────────────────────────────── │
  │ Still stuck? [Contact Support]  ·  [Watch Getting-Started Video] │
  │                                                          👍 👎  │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Search and read help articles inline.
  2. Submit a support ticket with the current screen auto-attached for context.
- **Data Displayed/Modified:** Read-only knowledge base; writes `support_tickets`.
- **States:**
  - **Default:** Popular articles for the current module surfaced first.
  - **In the Curriculum (new):** "Popular" is replaced by curriculum-specific articles — reordering items, keyboard moves, publish blockers — because those are the questions authors actually have at that moment.
  - **Empty search:** "Start typing to search 400+ articles." with the Popular list still visible — an empty panel with no cause is a dead end.
  - **No results:** "No articles match 'ክርስ'. Try a shorter term — Ge'ez search matches on 2-syllable n-grams." with **Clear search**.
  - **Loading:** Result skeletons sized to the article rows; the Popular list stays mounted above them.
  - **Ticket Submitted:** Toast: "We'll get back to you within one business day."
- **Keyboard & Focus:** focus moves to the **search input** on open, is trapped while the panel is open, and `Escape` closes the panel and restores focus to the `?` trigger. `Tab` cycles panel content only; the background is `inert`.
- **ARIA:** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` the panel title. The search input owns a `combobox` pattern with `aria-expanded` and `aria-activedescendant` against the results listbox; result count is announced in a polite live region ("3 articles"). The 👍 / 👎 pair opens the same one-field feedback form as [S-7.3](#scr-7-3), tagged with the article ID.
- **Resilience:** `403` — articles for a module the role cannot access are omitted from Popular and from search results, server-side. `offline` — previously opened articles are readable from cache and the panel says _"You're offline — showing saved articles."_ `server-error` — search failures keep the panel open with a retry; the ticket form still submits to the queue.
- **Instrumentation & acceptance:** Events `help_opened` (`{screen_id, entry}`) · `help_search` (`{query_length, lang, result_count}`) · `ticket_submitted` (`{screen_id, article_id?}`). Accept when: focus lands in the search input on open; Escape restores focus to `?`; the empty-search and no-results states are distinct; no query text is logged with PII. Budget: panel open < 200 ms.
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
  │  👨‍🎓 Alemayehu K.          (omitted entirely without            │
  │                            students.read)                      │
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
- **Permission filtering (Revision 3):** **Recent items are filtered by read permission server-side; a role without `students.read` sees the student group omitted entirely, not as an empty group.** An empty "Recent › Students" heading tells a Support user the system is broken; an absent group tells them nothing and leaks nothing. The same rule gates assets and course content.
- **Keyboard & Focus:** focus is in the input on open; `↑`/`↓` move the active option with `aria-activedescendant`; `Enter` runs it; `Escape` dismisses and restores focus to the prior screen. `⌘K` is registered at the document level and must not be swallowed by the lesson editor ([Part 12 § 7.3](12-Course-Editor-Markdown-Lessons.md#73-keyboard)).
- **ARIA:** `role="dialog"` with `aria-modal`, `role="combobox"` input with `aria-expanded`, `aria-controls`, `aria-activedescendant`, and a `role="listbox"` of `option`s. Groups are `role="group"` with `aria-labelledby`. The result count is announced politely.
- **Responsive:** below 640px the palette is full-width and is **opened by a visible "Search" button in the header** — Android has no ⌘K, so the shortcut must never be the only route. `⌘K`/`Ctrl+K` still work where they exist.
- **Resilience:** `403` — a result that resolves to a forbidden module is not rendered at all; selecting it cannot 403. `offline` — the local index of screens and the current course still works, cloud targets are marked _"unavailable offline"_. `session-expired` — the palette closes and the session-expiry modal takes over.
- **Instrumentation & acceptance:** Events `palette_opened` (`{entry: keyboard|button, screen_id}`) · `palette_run` (`{command, target_type, ms_to_resolve}`). Accept when: `⌘K` works from inside the item editor; a role without `students.read` sees no student Recent group; every listed action is runnable by the current role; Escape restores focus.
- **Navigation:**
  - Result select → target screen; `Esc` dismisses and returns focus to the prior screen
  - **Open item…** → [S-2.17](04-Courses.md#scr-2-17) Curriculum with that item's pane open
  - **Preview course as a student** → [S-2.21](04-Courses.md#scr-2-21)
  - **Publish checklist** → [S-2.22](04-Courses.md#scr-2-22)

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
  - **Missing Target:** if a spotlighted element is absent (a role that cannot see it, or a screen the tour skipped past) the step **reports "Step skipped — this isn't available for your role"** rather than being silently dropped; a tour that silently vanishes is indistinguishable from a broken one.
- **Keyboard & Focus:** `Escape` exits the tour at **any** step and returns focus to the tour trigger. `Tab` is trapped in the step card; `Next` advances, and focus then **moves to the spotlighted element** so the user is standing where the tutorial is pointing. The overlay respects `prefers-reduced-motion`: the spotlight and card appear without fade or travel.
- **ARIA:** the step card is `role="dialog"` with `aria-modal="false"` (the page stays reachable) and `aria-labelledby` the step title. The spotlighted element is **not** hidden from the tree — it receives `aria-describedby` pointing at the step text, so the explanation is read in place rather than in a detached region. The step counter is a polite live region.
- **Resilience:** `403` — the seeded practice course is visible to every role by construction, so no tour step can resolve to a Forbidden page. `offline` — a resumed tour re-attaches to whatever is rendered on arrival; if the target is absent it reports the skip message above. `session-expired` — the tour pauses and resumes after re-authentication rather than restarting at step 1.
- **Instrumentation & acceptance:** Events `tour_started` (`{role, entry}`) · `tour_step` (`{index, step_id, outcome: seen|skipped}`) · `tour_exited` (`{at_step, method}`). Accept when: Escape exits from every step and restores focus; advancing moves focus to the spotlighted target; a role-inapplicable step reports its skip instead of vanishing; no overlay animation runs under `prefers-reduced-motion`.
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
  │   ☐ Publish immediately                                           │
  │ Unlock rules are not copied. Re-configure them in the            │
  │ target course.                                                    │
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
  4. Choose what to include: content & media, attached quiz, immediate publish.
  5. Jump straight to the new copy.
- **Data Displayed/Modified:** Reads the source item/section and its `quizzes`; writes a new `lessons` (or a whole `modules` subtree) row set, plus a **copy** of the quiz — the copy is independently editable and its analytics are never merged with the source's.
- **States:**
  - **Loading:** the modal disables its confirm action and shows progress on it while the duplicate is written; the tree behind it is unchanged until the server returns the new item, then it is selected.
  - **Empty:** not applicable — the modal is opened against an existing item and has nothing to be empty about.
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
  - **Unlock rules are not copied. Re-configure them in the target course.** (static text — there is nothing to check, and a control the user can never change is a lie about the dialog's affordances)
  - Duplicating into a **published** course still creates the copy as unpublished; "Publish immediately" is the only way around it, and it is off by default and requires the course's publish permission.
- **Keyboard & Focus:** focus moves to the first radio group on open and returns to the triggering `⋯` on close; radio groups and the checkbox row are single tab stops with arrow-key movement inside; `Escape` closes.
- **ARIA:** `role="dialog"`, `aria-modal`, `aria-labelledby` the title. Each radio group is a `radiogroup` with `aria-labelledby`; the static unlock-rules sentence is plain text inside the fieldset's `aria-describedby`, not a control.
- **Resilience:** `403` — a target course the user cannot edit is not listed. `offline` — Duplicate is disabled with the reason _"You're offline — duplicating needs a connection"_, and the dialog stays open with its state. `conflict` — a source deleted mid-flight resolves to a stated failure, not a dangling copy. `server-error` — progress stops with a retry that resumes rather than restarting the copy.
- **Instrumentation & acceptance:** Events `duplicate_opened` (`{source_type, target_type}`) · `duplicate_completed` (`{item_count, media_reused, quiz_copied}`). Accept when: "This course" is preselected; a section duplicate states its item count before confirming; unlock rules are described as not copied and offer no checkbox; the copy's analytics are independent. Budget: preview < 200 ms.
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
  3. **Switching context flushes first** — changing item, tab, section, or route. If the flush fails, navigation is blocked with Retry / Discard / Stay ([S-7.1](#scr-7-1)).
  4. **`saving` has a minimum visible duration** so fast saves do not strobe.
  5. **State is announced, not implied:** the full variant is an `aria-live="polite"` region; the compact variant is `aria-live="assertive"` for `error` and `conflict` only.
  6. **Tab close / unload with a failed-flush buffer** triggers the [S-7.1](09-Shared-Components.md#scr-7-1) unsaved-changes dialog.
  7. **The word "Saved" appears only after the server confirms** — never on an optimistic write.
- **Placement Rules:**
  - **Full variant:** persistent surfaces with a footer (item pane, quiz builder, settings sections).
  - **Compact variant:** headers, toolbars, and the settings section header, where the label would crowd the title.
  - The two variants are never shown simultaneously for the same buffer.
- **Keyboard & Focus:** the indicator itself is not a tab stop in the compact form; its Retry / Reload / Save now actions are. `⌘/Ctrl+S` is registered per-surface and flushes the buffer bound to the focused region.
- **ARIA:** see contract rule 5. `error` and `conflict` announcements are `assertive` because they require action; `saving`/`saved` are `polite`.
- **Resilience:** this component **is** the reporting surface for most Part 11 resilience states — `offline` → `offline` with the queued count; `reconnected` → flushes in order, then `saved`; `conflict` → `conflict` naming the other actor; `session-expired` → `error` with the buffer preserved and the [S-7.1](#scr-7-1) unsaved-changes dialog holding the surfaces.
- **Instrumentation & acceptance:** Events `save_state_shown` (`{state, surface_id, ms_in_state}`) · `save_retry_clicked` (`{surface_id, outcome}`) · `save_conflict_resolved` (`{resolution}`). Accept when: "Saved" never precedes a server response; an error holds until retried successfully or discarded; the compact and full variants are never both mounted; every state change is announced once.
- **Navigation:**
  - **Retry / Reload / Save now** → the owning surface's mutation
  - **Offline → Reconnect** → retries the queue and reports the result
  - Used by [S-2.7](04-Courses.md#scr-2-7), [S-2.8](04-Courses.md#scr-2-8), [S-2.17](04-Courses.md#scr-2-17), [S-2.20](04-Courses.md#scr-2-20), [S-2.23](04-Courses.md#scr-2-23)
  - Governed by [Part 11 § Auto-save](11-Global-Standards.md#global-validation-and-feedback-patterns) and [Part 12 § 8](12-Course-Editor-Markdown-Lessons.md#8-persistence--state)

---

<a id="scr-7-9"></a>

##### Screen Name: S-7.9 Curriculum Tree 🔄 CHANGED

- **Purpose:** The persistent curriculum sidebar of [S-2.17](04-Courses.md#scr-2-17): sections and their items, with add, rename, reorder, move, duplicate, archive, and delete. It is specified here as a shared component because the same tree renders in three contexts — the Curriculum tab, the [S-2.21](04-Courses.md#scr-2-21) preview's outline, and the [S-2.14](04-Courses.md#scr-2-14) review panel — and they must behave identically.
- **User Role(s):** Admin, Editor (Reviewer/Viewer: read-only rendering)
- **Wireframe Layout (Text-Based):**
  ```
  ┌─── CURRICULUM TREE (320px default, 240–480px resizable) ──────────┐
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
  │ 3 items selected   [Select all in section] [Clear selection]       │
  │                        [Archive selected] [Move selected ▸]         │
  │ ⠿ = drag handle   ✓ approved  ◐ in review  ⚠ no content             │
  │ 🔒 = has unlock rules (S-2.15)                                       │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Width:** 320px is the **default only**. Per [Part 11](11-Global-Standards.md#spacing--layout) the sidebar is resizable **240–480px** and **collapsible to 0** so the item pane can take the full width. Width is a user preference persisted per user, not a constant in this component.
- **Semantics:** `role="tree"` with `role="treeitem"` rows and `aria-expanded` / `aria-level` / `aria-selected` / `aria-setsize` / `aria-posinset`. Sections are level 1, items level 2. The tree is a `tabindex=0` composite widget: one Tab stop, arrow keys inside. **Selection has three modes and they are not interchangeable:**

  | Mode              | How it is entered                         | What it does                                                                                  |
  | ----------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------- |
  | **Single (pane)** | Click, or `↑`/`↓`/`Home`/`End`/type-ahead | Selects one row and drives the item pane. `aria-selected="true"` on that row only.            |
  | **Multi (bulk)**  | Modifier-click or `Shift`-click           | Builds a set used **only** by bulk archive / bulk move / bulk reorder. Never drives the pane. |
  | **No selection**  | `Escape` on a multi-selection             | Collapses the multi-selection back to the active row.                                         |
  - The tree is `aria-multiselectable="true"` because bulk selection exists, even though the pane is single-selection.
  - A multi-selection is announced in a polite live region: _"3 items selected"_, and cleared by **[Clear selection]** or `Escape`.
  - **[Select all in section]** extends the multi-selection to every visible row in the focused section.
  - **Bulk archive is capped at 50 items.** Above the cap the action becomes _"Select all 128 items matching the filter"_ — an explicit, counted, deliberate act rather than a keystroke. The result banner is _"47 archived · 3 failed — Retry failures"_, and the 3 failures stay listed with a specific reason.
  - `aria-setsize` / `aria-posinset` are set on **every** `treeitem`, so a filtered or collapsed section still reports correct position to a screen reader.

- **Primary Actions:**
  1. Navigate (`↑`/`↓` between visible rows, `→` expand, `←` collapse, `Home`/`End`, type-ahead to jump by title).
  2. Select a row to open the corresponding pane.
  3. Reorder by drag-and-drop: sections among sections, items within a section, items across sections.
  4. Move without dragging — `Move up`, `Move down`, `Move to section ▸` from the [S-7.10](09-Shared-Components.md#scr-7-10) menu.
  5. Add a section or an item inline; rename inline with `F2`.
  6. Collapse/expand (persisted per user), filter, search, and open the archived view.
  7. Build a multi-selection with `Shift`-click / `Ctrl`-click for multi-archive, multi-move, and bulk reordering.
- **Data Displayed/Modified:** Sections and items from `getCurriculum`; writes through the curriculum server functions listed in [S-2.17](04-Courses.md#scr-2-17).
- **States:**
  - **Empty:** The [S-7.3](#scr-7-3) curriculum `multi-action` variant with four equal starting actions.
  - **Collapsed Section:** Header only, showing the item count and total duration; a collapsed section with ⚠ items shows the count of items needing content so problems are never hidden by collapsing.
  - **Drag Active:** The dragged row lifts; valid drop positions show a 2px insertion line; invalid targets are dimmed and non-droppable. Hovering a collapsed section for 600ms expands it so cross-section drops are always reachable.
  - **Drag Keyboard Mode:** `Space` picks up a row, arrows move it, `Space` drops, `Esc` cancels — the standard accessible drag pattern, with every move announced in a live region ("Essay draft, position 2 of 3 in S2 Reading Skills").
  - **Multi-Selection Active:** A bulk-action bar replaces the add-item row's secondary actions; the tree stays fully navigable; `Escape` returns to single selection.
  - **Partial Bulk Failure:** Rows that succeeded render archived; failures keep their row and carry a per-row reason plus the aggregate banner.
  - **Optimistic Reorder:** The tree reorders instantly; the server returns the authoritative tree and the client adopts it, so a server-side renormalisation can never leave the UI lying.
  - **Conflict:** A concurrent structural change reverts the optimistic move and raises a toast with Reload.
  - **Inline Creation:** A focused title input appears in place with a kind selector; `Enter` commits, `Esc` cancels. The row shows a `saving` dot until the server confirms.
  - **Inline Rename:** Single-line input; `Enter` commits, `Esc` reverts. Duplicate titles within a section are allowed and warned, not blocked.
  - **Archived View:** Archived rows render greyed with a restore action; they are excluded from every count in the active tree and from publish readiness.
  - **Search / Filter:** Non-matching sections collapse to "⋯ n hidden" rather than disappearing, so structure is never lost.
  - **Read-only (Reviewer/Viewer):** No drag handles, no inline editing, no add buttons. `aria-disabled` rather than a broken interaction.
  - **Loading:** Section-block skeletons; a previously selected item stays highlighted so the pane does not appear to reset.
- **Validation & Feedback:**
  - Titles: 3–300 characters, both levels. **Titles wrap to at most two lines at `line-height: 1.6` with no fixed-px clamp; the full title is on hover and is the row's accessible name; the 300-character maximum is measured in grapheme clusters.**
  - Every mutation is optimistic-with-rollback and shows [S-7.8](09-Shared-Components.md#scr-7-8) state at the row level for creation, and a global state for reordering.
  - Drag is never the only way to reorder — this is a WCAG requirement, not a graceful degradation.
  - **A row shows at most one metric. Precedence: ⚠ no content > 🔒 locked > ✓ approved > nothing.** Reach and student counts appear on hover and in the row's `aria-description`, never competing with a warning in the row body.
- **Keyboard & Focus:** one Tab stop for the whole tree. Arrows navigate, `→`/`←` expand/collapse, `Home`/`End` jump to the ends, type-ahead jumps by title, `F2` renames, `Space` enters and leaves drag mode, `Esc` cancels a drag or collapses a multi-selection. Selecting a row moves focus to the item pane; returning to the tree restores the previously selected row.
- **ARIA:** `role="tree"` with `aria-multiselectable="true"`, `aria-label="Curriculum"`. Every `treeitem` carries `aria-level`, `aria-expanded` (sections only), `aria-selected`, `aria-setsize`, and `aria-posinset`. Drag-mode announcements use a polite live region; bulk-selection count uses its own polite region so the two do not overwrite each other.
- **Responsive:** below 640px the tree is **not** narrowed further — it becomes an overlay drawer opened by a **Curriculum** button in the workspace header, and the item `⋯` menu becomes a bottom sheet with ≥40px targets. See [Responsive Behaviour](#responsive-behaviour).
- **Resilience:** `403` — a read-only role sees the tree with no editing affordances, not a Forbidden page; a course the role cannot open renders the Forbidden page. `offline` — the tree is read-only with a persistent banner and the queued-count line; add, rename, reorder, and bulk actions are disabled with that reason. `conflict` — a stale `rowVersion` reverts the optimistic change and offers **Review changes / Keep mine / Take theirs**. `partial-failure` — the bulk result banner above. `server-error` — skeletons are replaced by an error state; the previous tree is never silently shown as current.
- **Instrumentation & acceptance:** Events `tree_row_selected` (`{item_type, source: click|keyboard|typeahead}`) · `tree_reordered` (`{item_type, to_section, mode: drag|keyboard|menu, ms_to_apply}`) · `tree_bulk_action` (`{action, count, succeeded, failed, capped}`) · `tree_filter` (`{query_length, lang, visible, hidden}`). Accept when: 200 items are interactive in < 500 ms and a keyboard move applies in < 200 ms; a multi-selection never changes which pane is open; `aria-setsize`/`aria-posinset` stay correct under a filter and under collapse; bulk archive above 50 requires the explicit counted selection; a partial failure names each failing row.
- **Navigation:**
  - Row selection → the item pane ([S-2.7](04-Courses.md#scr-2-7) / [S-2.8](04-Courses.md#scr-2-8) / [S-2.23](04-Courses.md#scr-2-23)) in the same screen
  - `⋯` on a row → [S-7.10](09-Shared-Components.md#scr-7-10) item actions
  - `⋯` on a section → Rename · Duplicate · Complete in order ([S-2.15](04-Courses.md#scr-2-15)) · Settings · Archive · Delete
  - **＋ Add item ▾** → creates a Lesson / Quiz / Assignment and opens its pane
  - **Archived (3)** → archived view with Restore / Delete
  - Reused by [S-2.21](04-Courses.md#scr-2-21) (as a read-only outline) and [S-2.14](04-Courses.md#scr-2-14) (as the review navigator)

---

<a id="scr-7-10"></a>

##### Screen Name: S-7.10 Curriculum Item Actions Menu 🔄 CHANGED

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
  │ ─────────────────────────── │  (role="separator")
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
- **Out-of-capability policy (one rule, quoted from [Part 11](11-Global-Standards.md#global-validation-and-feedback-patterns)):** the three cases below are **not interchangeable**, and the menu may not choose between them per-row. A control's affordance is determined by _which_ case it is, not by what is convenient to render.

  | Case                                              | What the menu renders                                                                                                        |
  | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
  | **Out of capability** for the role                | The entry is **absent entirely**.                                                                                            |
  | **Capable but blocked by current state**          | The entry is **present and disabled with a reason**, exposed in a tooltip _and_ in `aria-describedby`. Never a silent no-op. |
  | **Whole surface locked** (review, archived, etc.) | The menu is **replaced with an explanation** of what locked it and how to unlock it.                                         |

- **Primary Actions:** the menu entries shown above, filtered by item kind and role.
- **Data Displayed/Modified:** Dispatches the curriculum server functions; every entry produces an audit entry.
- **States:**
  - **Loading:** not applicable in the menu itself; a long-running action taken from it reports through [S-7.8](09-Shared-Components.md#scr-7-8) on the row and the pane, never as a menu state.
  - **Kind Filtering:** **Quiz** items show **Questions** and **AI draft quiz**; **Assignment** items show **Grading**; all items show the shared core.
  - **First Item / Last Item:** _Move up_ / _Move down_ are disabled **with a reason in the tooltip** ("Already first in this section") and the same reason in `aria-describedby` — the state-blocked case, not the absent case.
  - **Single-Section Course:** _Move to section_ is **absent**, because there is nowhere to move to — a capability the role has but no target exists. It is not disabled.
  - **Locked by Review:** the whole menu is **replaced with an explanation** — "Editing is locked while this course is in review" — plus a **View review** entry, so the menu never shows eight things that all fail.
  - **Archived Item:** the menu becomes **Restore** · **Duplicate** · **Delete permanently**.
  - **Read-only Role:** the menu is **not rendered**; the row exposes only a labelled **Open in new tab** link.
  - **Danger Zone:** _Archive_ is a normal row; _Delete_ is separated by a divider, is red, and is never the default focus target. Focus lands on **Rename**, not on Delete.
- **Validation & Feedback:**
  - **Archive before Delete** — the order in the menu encodes the safe default.
  - _Duplicate…_ opens [S-7.7](09-Shared-Components.md#scr-7-7); _Move_ and _Archive_ are immediate with optimistic rollback; _Delete_ always confirms via [S-7.1](09-Shared-Components.md#scr-7-1).
  - **Undo:** archive and delete raise a 10s Undo toast ([S-7.2](#scr-7-2)).
  - **The menu closes and returns focus to the `⋯` trigger** after any action, so keyboard users are never stranded.
- **Keyboard & Focus:** roving `tabindex` across entries; `↑`/`↓` move, `Home`/`End` jump, type-ahead by first letter, `Esc` closes and returns focus to the trigger, `Tab` closes the menu and moves on. A disabled entry is skipped by arrow navigation but is still reachable by screen-reader browse mode via `aria-describedby`.
- **ARIA:** the `⋯` trigger is a `button` with `aria-haspopup="menu"` and `aria-expanded`. The popup is `role="menu"`; entries are `role="menuitem"`, or `role="menuitemradio"` where they are mutually exclusive (view modes, position defaults). The dividers are `role="separator"`. Each entry's accessible name includes the object where ambiguity is possible ("Delete 'Skimming Basics'"). When the menu is not rendered for a read-only role, the row exposes only a labelled **Open in new tab** link.
- **Resilience:** `403` — a role that lost capability mid-session gets the menu collapsed to the explanation, not a series of failing calls. `offline` — mutating entries are disabled with the reason _"You're offline"_; read-only entries (Preview, Open in new tab) remain available. `conflict` — a stale `rowVersion` on Move or Archive resolves to Review changes / Keep mine / Take theirs. `server-error` — the menu closes and a persistent error toast names the failed entry and its request ID.
- **Instrumentation & acceptance:** Events `item_menu_opened` (`{item_type, role, entry_count}`) · `item_menu_action` (`{action, item_type, mode: keyboard|pointer, ms_to_resolve}`). Accept when: every listed action is enabled or explained; _Move to section_ is absent in a single-section course; _Move up_ at position 1 is disabled with a reachable reason; focus lands on Rename, never on Delete; `Escape` always returns focus to `⋯`.
- **Navigation:**
  - Triggered from the [S-7.9](#scr-7-9) row, the [S-2.7](04-Courses.md#scr-2-7) item pane header, and the Curriculum toolbar
  - **Rename / Move / Archive / Delete** → [S-2.17](04-Courses.md#scr-2-17) actions
  - **Duplicate…** → [S-7.7](09-Shared-Components.md#scr-7-7)
  - **Unlock rules** → [S-2.15](04-Courses.md#scr-2-15)
  - **Preview as student** → [S-2.21](04-Courses.md#scr-2-21)
  - **View analytics** → [S-2.19](04-Courses.md#scr-2-19) filtered to the item
  - **Open in new tab** → the alias route, which opens the workspace with this item selected

---

<a id="scr-7-11"></a>

##### Screen Name: S-7.11 Publish Readiness Checklist 🔄 CHANGED

- **Purpose:** The reusable rendering of the [S-2.22](04-Courses.md#scr-2-22) readiness checks. Every check is a row with a verdict, an explanation, and a **Fix** action that deep-links into the screen and field that resolves it. A gate the author cannot act on is a report, not a gate.
- **User Role(s):** All roles (Admin, Editor, Reviewer, Viewer — read-only for the last two)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ PUBLISH READINESS            4 of 8 checks pass                 │
  │                                                                   │
  │ Blocking                                                          │
  │ ❌ RC-3  At least one section with one item                       │
  │         No sections yet.                          [Add a section →]│
  │ ❌ RC-4  Every published item has content                         │
  │         3 items have no content: Test format, Essay draft, …     │
  │                                              [Open the first one →] │
  │ ⛔ RC-8  Review                                                   │
  │         2 items await approval                    [Open queue →]   │
  │ Advisory                                                          │
  │ ✅ RC-1  Title, exam, instructor, thumbnail                       │
  │ ✅ RC-2  Description (180 characters)                             │
  │ ⚠ RC-5  Captions on every video                                  │
  │         2 videos have no captions.       [Add captions →]        │
  │ ⚠ RC-6  Alt text on every image                                   │
  │         1 image has empty alt text.             [Fix alt text →]  │
  │ ⚠ RC-7  Completion rule                                          │
  │         Using the default: 100% of published items   [Change →]  │
  │                                                                   │
  │ Re-checked 2 minutes ago            [Re-check]                    │
  │                                             👍  👎  (feedback)     │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Check coverage:** all eight `RC-1`–`RC-8` checks from [S-2.22](04-Courses.md#readiness-checks) are renderable by this component. `RC-5` (captions on every video) and `RC-6` (alt text on every image) are shown above as advisory; a check that does not apply to the course renders as **`— not applicable`**, never as a failure and never silently absent.
- **States:** `pass` (✅) · `fail-blocking` (❌) · `pass-with-warning` (⚠, does not block) · `not-applicable` (— not applicable) · `pending-review` (⏳, blocking only when `requiresApproval` is on).
- **Primary Actions:**
  1. Read which checks block publishing and why.
  2. **Fix** — deep-link to the exact screen, tab, and field; the field is focused on arrival.
  3. **Re-check** after an out-of-band change; checks are otherwise re-evaluated on load and before every publish attempt.
  4. Collapse blocking vs advisory sections when the list is long — **blocking entries are never collapsed by default**.
- **Data Displayed/Modified:** Reads `getPublishReadiness`; writes nothing. The server is the single source of truth for verdicts.
- **Behaviour:**
  - **All Pass:** The summary states what publishing will do ("18 items, 3 quizzes, 234 students keep access") and the lifecycle CTA becomes available.
  - **Failures:** grouped as _Blocking_ and _Advisory_.
  - **Warning vs Failure:** a warning is a real recommendation that does not block (e.g. no certificate configured for a course with no completion rule). The distinction is stated in the copy, never implied by colour.
  - **In Review:** read-only with a banner explaining that a course cannot be edited into an inconsistent state while a decision is pending — items edited during review are flagged instead.
  - **Stale:** if the last evaluation is older than 5 minutes or the course has changed, a **Re-check** affordance appears next to the timestamp.
  - **Archived Course:** all checks are evaluated against the archived state and the checklist is read-only.
  - **Loading / Error:** skeleton rows; a failed evaluation never renders a green checklist — it renders an error, because a false "ready" is the most damaging possible output of this component.
  - **Partial evaluation:** if some checks cannot be evaluated, the rows that can be render normally and the others read _"Not evaluated — server error"_. A missing verdict is never rendered as a pass.
- **Validation & Feedback:**
  - Each row's copy names the **specific offending objects** ("3 items have no content: …"), not a category.
  - The checklist is a mirror of server evaluation; the client never computes a verdict locally.
  - The full check table (`RC-1`…`RC-8`) is defined in [S-2.22](04-Courses.md#readiness-checks) and is the single source for both this component and the server query.
- **Keyboard & Focus:** each row is one tab stop; `↑`/`↓` move between rows; `Enter` activates the row's Fix link; the summary is focusable on the first `Tab`. Every blocking Fix link is reachable without passing the advisory section.
- **ARIA:** the checklist is `role="list"` with `aria-label="Publish readiness"`. Each row pairs an **`aria-hidden` icon** with a **text verdict**, so the verdict is never colour-only. The "4 of 8 checks pass" summary is an `aria-live="polite"` region, updated after **Re-check**. Each **Fix** link carries `aria-describedby` naming the check it resolves ("Add captions — resolves RC-5").
- **In-context feedback:** the 👍 / 👎 pair sits in the checklist footer and opens the same **one-field** form as [S-7.3](#scr-7-3), tagged `screen: S-2.22`, `component: S-7.11`, plus the failing check IDs at the time of feedback. No required fields.
- **Responsive:** blocking entries **stay expanded** below 640px; advisory entries collapse by default; the summary line and Re-check remain visible without scrolling.
- **Resilience:** `403` — a read-only role gets the verdict list without Fix links, replaced by an explanation, not a disabled Fix button. `offline` — the last evaluated verdict is shown marked _"Not re-evaluated — offline"_ with the timestamp; Re-check is disabled with that reason. `conflict` — a course changed since evaluation marks the list stale rather than publishing from it. `server-error` — an error state with a request ID, never a green checklist. `session-expired` — evaluation re-runs after re-authentication before any publish is permitted.
- **Instrumentation & acceptance:** Events `readiness_viewed` (`{course_id, pass, blocking, advisory, ms_since_eval}`) · `readiness_fix_clicked` (`{check_id}`) · `readiness_rechecked` (`{outcome, ms_to_evaluate}`) · `readiness_feedback` (`{check_ids[], rating}`). Accept when: server evaluation completes in < 1 s; `RC-5` and `RC-6` are renderable and non-applicable checks render as `— not applicable`; a Fix link focuses the offending field on arrival; the pass count updates once, politely, after Re-check; a failed evaluation never shows green.
- **Navigation:**
  - **Fix →** → the owning screen and field: [S-2.20](04-Courses.md#scr-2-20) Details/Pricing/Completion, [S-2.17](04-Courses.md#scr-2-17) Curriculum, an item pane, or the [S-2.14](04-Courses.md#scr-2-14) queue
  - **Re-check** → re-runs `getPublishReadiness`
  - Rendered in [S-2.22](04-Courses.md#scr-2-22), in the [S-2.6](04-Courses.md#scr-2-6) Overview banner, and in the [S-2.14](04-Courses.md#scr-2-14) course review panel

---

<a id="scr-7-12"></a>

##### Screen Name: S-7.12 Form & Data Primitives 🆕 NEW

- **Purpose:** The cross-cutting controls every module depends on. Parts 05, 06, 08, and 10 all render tables and forms; until this revision none of those controls had a specification, so each screen invented its own and none of them were keyboard-complete, Ge'ez-safe, or AA-compliant by construction.
- **User Role(s):** All roles (capability-filtered server-side)
- **Wireframe Layout (Text-Based):**
  ```
  ┌── Input ───────────────────────────────────────────────────────────┐
  │ Course title (label, always visible above the field)               │
  │ ┌──────────────────────────────────────────────┐                  │
  │ │ TOEFL Complete ኤንግሊዝ ኮርስ                       │                  │
  │ └──────────────────────────────────────────────┘                  │
  │ 60 characters · Enter or Tab to submit, Shift+Enter for a newline  │
  │   └─ help text, referenced by aria-describedby                    │
  └───────────────────────────────────────────────────────────────────┘

  ┌── Combobox ────────────────────────────────────────────────────────┐
  │ [🔍 Type to search sections…                          ▾]          │
  │ ┌──────────────────────────────────────────────┐                  │
  │ │ S1 Foundations · 3 items          (selected)  │                  │
  │ │ S2 Reading Skills · 2 items                   │                  │
  │ │ › S2.1 Skimming Basics                        │                  │
  │ └──────────────────────────────────────────────┘                  │
  │ 6 matching sections · ↑↓ move · Enter select · Esc close          │
  └───────────────────────────────────────────────────────────────────┘

  ┌── Tabs ────────────────────────────────────────────────────────────┐
  │ ?tab=curriculum                                                    │
  │ [ Overview ][ Curriculum ][ Students ][ Analytics ][ Settings ]    │
  │ ── selected ──                                                   │
  └───────────────────────────────────────────────────────────────────┘

  ┌── DataTable ───────────────────────────────────────────────────────┐
  │ Students   [⌕ Filter…] [Status: Enrolled ▾] [✕ Enrolled] [+Tag]    │
  │ ────────────────────────────────────────────────────────────────── │
  │ ☐ │ Name ▲        │ Status      │ Progress │ Enrolled  │   ⋯     │
  │ ── sticky header ──────────────────────────────────────────────── │
  │ ☐ │ Alemayehu K.  │ Enrolled    │ 42%      │ 12 Mar     │  ⋯      │
  │ ☐ │ Marta G.      │ Completed   │ 100%     │ 02 Feb     │  ⋯      │
  │ ☐ │ Dawit T.      │ ⚠ At risk   │ 8%       │ 28 Aug     │  ⋯      │
  │ ────────────────────────────────────────────────────────────────── │
  │ Showing 1–25 of 412        [◀ 1 2 3 … 17 ▶]      [Rows: 25 ▾]     │
  │ ☑ 2 selected   [Message] [Change status] [Export] [Clear]         │
  └───────────────────────────────────────────────────────────────────┘

  ┌── DropZone ────────────────────────────────────────────────────────┐
  │ Drop video, audio, PDF, or subtitle files here, or [Browse files] │
  │ Up to 500 MB per file. Large files resume if your connection drops.│
  │ ────────────────────────────────────────────────────────────────── │
  │ ▸ test-format.mp4   148 MB   ████████████░░ 78%  [Cancel]         │
  │ ▸ intro-v2.mp4       82 MB   ██████████████ 100%  ✓ Uploaded      │
  │ ✗ captions.srt        0 KB   — Failed: unsupported format.        │
  │                        Supported: .srt, .vtt        [Retry]        │
  └───────────────────────────────────────────────────────────────────┘
  ```
- **Component contract (binding on every module):**

  | Component                | Contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
  | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | **Input**                | **40px minimum height.** Label **persistent and above** the field (never a placeholder-only label). Validate **on blur**, re-validate live after the first error. `aria-describedby` points at both the help text and the error text. Sized for **40% expansion headroom** — a Ge'ez value must never need the control to resize, because a control that resizes moves everything below it.                                                                                                                                                                                                                                                                                                                                                                                             |
  | **Select**               | Native `<select>` where the option count is small (≤ 12); otherwise a Combobox. Label persistent, same `aria-describedby` contract as Input. Never disabled without a reason (Part 11 three-case rule).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
  | **Combobox**             | `role="combobox"` + `aria-expanded` + `aria-controls` + `aria-activedescendant` against a `role="listbox"`. Type-ahead on the input, not on a separate key handler. **No-result state:** "No matches for '{query}'." with a **Create "{query}"** option where creation is permitted. **Ge'ez n-gram matching** — the query is tokenized as 2-syllable n-grams, so `እንግሊዝ` matches `እንግሊዝኛ` ([Part 11](11-Global-Standards.md#localization--formatting)); matches are highlighted in every option label.                                                                                                                                                                                                                                                                                 |
  | **MultiSelect**          | A **checkbox group**, not a listbox, so "3 of 8 selected" is legible. Includes a **[Select all]** toggle carrying `aria-checked="mixed"` when the selection is partial, and a live count. Options are not collapsed to a summary without a way to see what is selected.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
  | **DateTimePicker**       | Always shows the **workspace timezone** next to the field ("Africa/Addis_Ababa · EAT+03:00"). Calendar display follows the **per-user Gregorian / Ethiopian toggle**, and every Ethiopian display carries an **unambiguous Gregorian fallback** — either inline (`12 መስከረም 2018 (29 Sep 2026)`) or on hover and focus. Times are **24-hour with a 12-hour suffix**: `6:00 PM EAT`, never a bare `09:00`. Audit log and exports always use ISO-8601 with offset.                                                                                                                                                                                                                                                                                                                         |
  | **Tabs**                 | `role="tablist"` with **roving `tabindex`** (the whole strip is one tab stop), arrow keys to move, `Home`/`End` to jump, `aria-selected` on the active tab, `aria-controls`/`tabpanel` wired. **Deep-linkable via `?tab=`**, so a tab is a shareable URL and a reload lands where the user was. **Unsaved-changes guard on switch** — switching away from a dirty tab flushes first; on failure the [S-7.1](#scr-7-1) unsaved-changes dialog blocks the switch.                                                                                                                                                                                                                                                                                                                         |
  | **DataTable**            | Sortable headers carry **`aria-sort`** (`ascending` / `descending` / `none`), and the header button's accessible name names both the column and the direction. **Sticky header** under the workspace chrome. **Filter chips** above the table are individually removable and are not the only way to filter. **25 rows per page by default**; **server-side sort past 100 rows**, with the row count stated ("412 students"). **Bulk-action bar** appears on selection and always offers **Clear selection**. **Density toggle** (`comfortable` / `compact`), persisted per user. **True-empty vs zero-result:** no records ever → [S-7.3](#scr-7-3) Empty State with creation actions; records excluded by a filter → "No matches — adjust filters" with **Clear filters** and no CTA. |
  | **Pagination**           | Page numbers plus **per-page** selection. Names the visible range and the total ("Showing 1–25 of 412"). Page state is in the URL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
  | **Skeleton**             | Matches the shape of the content it replaces, so nothing shifts when data lands. **Static under `prefers-reduced-motion`** — no shimmer, no pulse. Skeletons replace **only the loading region**; the workspace shell, the tree selection, and the surrounding navigation stay mounted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
  | **CopyButton**           | Copies to the clipboard and confirms in a **live region**: "Copied." Feedback is `role="status"` with a 3s revert to the idle label. **Fallback when the Clipboard API is blocked** (insecure context, permission denied): selects the text, shows "Press ⌘/Ctrl+C to copy", and focuses it — never a silent no-op.                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
  | **StatusPill**           | Rendered as the Part 11 **fill / text / tint triple** — tint background, `*-text` token for the label, fill token for the icon, 1px hairline. **Never coloured text.** Status is never colour-only: the pill always carries an icon _and_ a label, so it survives grayscale and colour-vision differences.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
  | **Avatar / AvatarGroup** | Image with an **initials fallback for a one-word Ge'ez name** — one syllable, not two, and never a required first/last split. `AvatarGroup` collapses overflow to **`+n`**, and the group carries `aria-label="Alemayehu K., Marta G., and 3 others"`; the `+n` chip is itself focusable and lists the remainder.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
  | **Money**                | **Right-aligned**, `font-variant-numeric: tabular-nums`, rendered with `Intl.NumberFormat` in the workspace locale. **The currency code is always visible** — `ETB 1,240.00` — including where a symbol is available. Revenue is **redacted server-side** for the Support role (`finance.view_revenue`); the component receives no figure and never renders a masked-looking number.                                                                                                                                                                                                                                                                                                                                                                                                    |
  | **DropZone**             | **Per-file progress** with its own bar, filename, and size — never one aggregate bar for many files. **Cancel** per file. **Retry** per failed file. **Resume from the last byte** on reconnect, continuing the same file rather than restarting. **The 500 MB cap is stated up front**, in the drop area, before the user picks a file — a limit discovered at 99% is a limit discovered too late. **Failed files stay listed with a specific reason** ("unsupported format", "file too large — 620 MB", "network error"), never a generic "upload failed". **Closing the panel with files in flight warns first** and states exactly what is lost.                                                                                                                                    |

- **States (across every primitive above):**

  | State                    | Behaviour                                                                                                                                                                                       |
  | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | **Default**              | Resting state; every control has a visible, persistent label.                                                                                                                                   |
  | **Loading**              | Skeleton for lists and tables; a spinner inside buttons and inside the control being loaded. The label never disappears — `Loading…` replaces it.                                               |
  | **Error**                | Field-level message naming what is wrong **and** how to fix it, linked by `aria-describedby`, announced politely. A list-level error keeps the last good data visible and marks it stale.       |
  | **Disabled with reason** | `disabled`/`aria-disabled` **plus** the reason, in a tooltip on hover/focus and in `aria-describedby`. Never a silent no-op.                                                                    |
  | **Offline**              | The whole surface renders **read-only** behind a persistent banner with the queued-change count — "3 changes waiting to sync." Mutations are disabled _with that reason_; reads stay available. |

- **Primary Actions:**
  1. Enter and correct data in any form field without a mouse.
  2. Filter, sort, page, and bulk-act on any tabular data set.
  3. Upload files with progress, cancel, retry, and resume.
  4. Copy a value and know it was copied.
- **Data Displayed/Modified:** Reads and writes whatever the host module defines; the primitives hold no data of their own beyond transient UI state (open, hovered, page, filter). Every mutating control is guarded by `rowVersion` and reports through [S-7.8](#scr-7-8) when it belongs to an editing surface.
- **Validation & Feedback:**
  - All strings externalized; English and Amharic at launch. No per-screen format exceptions.
  - Validation is **on blur**, not on every keystroke; once a field has errored it validates live until it is valid again.
  - Ge'ez content uses the Noto Sans Ethiopic stack at `line-height: 1.6`, `letter-spacing: normal`, and **no fixed-px line clamps** anywhere in a field, chip, or cell.
- **Keyboard & Focus:**
  - Every control is reachable by `Tab` and operable by `Enter`/`Space`; the focus ring is never removed.
  - Comboboxes and tabs use roving focus; tables are a grid of row tab stops with `↑`/`↓` between rows and `→` into row actions.
  - `Escape` closes a listbox or popup and returns focus to its trigger; no control traps focus.
  - Drag-and-drop always has a keyboard and a button equivalent — a file can be selected with the Browse button, and a row can be moved from a menu.
- **ARIA:** every control has a programmatically associated label. Errors use `aria-describedby` and a polite live region, never colour alone. Popups use `role="listbox"`/`role="menu"` with `aria-expanded` and `aria-activedescendant`. Tables use `aria-sort`, `aria-rowcount`, and row/cell associations. Progress uses `aria-valuenow` on a `progressbar`; it is never a bare animated bar.
- **Responsive:** below 640px the DataTable converts to stacked cards per [Part 11](11-Global-Standards.md#responsive-breakpoints), with the row's primary value as the card heading and its actions in a bottom sheet at ≥40px targets. Filter chips wrap; the Pagination control collapses to **Prev / "1–25 of 412" / Next**. See [Responsive Behaviour](#responsive-behaviour).
- **Resilience:** `403` — a role without the capability gets the Forbidden surface below, not a disabled form. `404` — a combobox result whose object was deleted since the index built renders "This item no longer exists" in the no-result state. `offline` — as in the states table above. `session-expired` — form values are preserved in memory and restored after re-authentication; an in-flight DropZone upload pauses and resumes. `conflict` — a stale `rowVersion` on any field resolves to Review changes / Keep mine / Take theirs, per field. `partial-failure` — "Saved 8 of 9 fields. Discount limit was rejected — see below", with only the rejected field marked. `server-error` — a load failure renders an error with a request ID and the stated-voice message, never a blank table.
- **Instrumentation & acceptance:** Events `field_validated` (`{field_id, result, ms, lang}`) · `combobox_search` (`{query_length, lang, result_count}`) · `table_interaction` (`{action: sort|filter|page|density, column?, ms_to_rows}`) · `bulk_action` (`{action, selected, succeeded, failed}`) · `upload` (`{size_bucket, outcome, resumed, duration_ms, bytes_from_resume}`) · `copy_attempt` (`{api: clipboard|fallback, outcome}`). Accept when: every field has a persistent label and an `aria-describedby` that reaches both help and error text; the DataTable is fully operable at 320px with 400% zoom; bulk archive past 50 items requires the counted selection; an upload resumes from the last byte rather than restarting; the currency code is visible on every Money value; a Support session receives no revenue figure in any payload. Budgets: DataTable first paint < 1.5 s at 25 rows; upload progress starts within 1 s of drop; combobox first results < 100 ms.

---

<a id="scr-7-12-forbidden"></a>

##### Forbidden (403) Surface 🆕 (within S-7.12)

- **Purpose:** The dedicated page rendered when the authenticated user lacks the capability for a resource. **No screen in this spec defined it before Revision 3**, which is why "Forbidden" has been rendered as an empty list in at least one place.
- **User Role(s):** All roles
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │                                                                  │
  │              🔒 [Lock Icon]                                      │
  │                                                                  │
  │        You don't have access to "TOEFL Complete".               │
  │                                                                  │
  │        You were signed in as Support. Support can view a         │
  │        student's enrollment record but not course content.       │
  │                                                                  │
  │        Request ID: req_8f2a1c                                     │
  │                                                                  │
  │        [ Ask an Admin for access ]   [ Back to Courses ]         │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **States:**
  - **Default:** as above. The message **names the resource** and the role the user actually holds.
  - **Course removed mid-session:** collapses to the 404 variant ("This course was deleted, or you followed an old link.").
  - **Escalation pending:** after **Ask an Admin for access**, the page reads "Request sent — {Admin name} has been notified" and the button becomes disabled with that reason. It does not silently do nothing.
  - **Deep link:** arriving with a stale URL to a forbidden resource keeps the URL, never a redirect loop.
- **Keyboard & Focus:** focus moves to the page heading on arrival so the title is read first; both actions are normal tab stops; focus never lands on an inert region.
- **ARIA:** `role="alert"` is **not** used — this is a destination, not an interruption. The page is a `main` region with an `h1`; the lock icon is `aria-hidden`; the resource name is inside the `h1` so it is the accessible name of the page.
- **Navigation:** **Back to {module}** and **Ask an Admin for access** (a POST that writes `access_requests` and notifies via [Part 11 Notification Delivery](11-Global-Standards.md#notification-delivery)). Always offers **Back** — an error a user can resolve must state the way out.

---

<a id="scr-7-12-offline"></a>

##### Offline Surface 🆕 (within S-7.12)

- **Purpose:** The persistent banner and the read-only posture rendered when connectivity drops. Per [Part 11](11-Global-Standards.md#resilience-states) this is a **banner, never a toast** — a toast disappears, and a user who does not know they are offline will believe their edits were lost.
- **User Role(s):** All roles
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ ⬤ You're offline. 3 changes waiting to sync.      [Try again]   │
  ├──────────────────────────────────────────────────────────────────┤
  │  All editing is paused. Reads use your last synced copy.         │
  │                                                                  │
  │  ── Every control on this screen is disabled, with this ──        │
  │  ── reason. The screen never pretends to have saved.  ──          │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **States:**
  - **Just offline:** "You're offline. Reads use your last synced copy." No queue yet.
  - **Queued writes:** "3 changes waiting to sync." The count is live and never estimated.
  - **Reconnected:** "Back online. Syncing 3 changes…" then "All changes synced 14:06." The banner persists until the queue is empty — a banner that vanishes on reconnect while writes are still flushing is worse than no banner.
  - **Queued write rejected as stale after reconnect:** resolves to **Conflict**, never a silent overwrite.
  - **Long outage:** past 5 minutes the banner adds "Your work is safe on this device until you close the tab."
- **Keyboard & Focus:** the banner is a `region` with `aria-label="Connection status"` placed before `main` in DOM order so it is the first thing read; **Try again** is a normal tab stop; focus is never moved to the banner automatically, which would interrupt typing.
- **ARIA:** the banner is `role="status"` with `aria-live="polite"` so transitions to and from offline are announced without stealing focus. The queued count is inside that region. Every disabled control on the surface references the banner by `aria-describedby`.
- **Navigation:** **Try again** retries the queue in order. Closing a tab with queued writes raises the [S-7.1](#scr-7-1) unsaved-changes dialog naming the queued surfaces.

---

## Responsive Behaviour

One rule per component. Below 640px is the binding case: a dense desktop layout squeezed into a phone is not a responsive design, it is a smaller broken one.

| Component                      | Desktop (≥1024px)                                   | Tablet (640–1024px)               | Mobile (<640px)                                                                                                                                                                                                     |
| ------------------------------ | --------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S-7.9 Curriculum Tree**      | 320px default, resizable 240–480px, beside the pane | Collapses to an overlay drawer    | **Overlay drawer opened by a "Curriculum" button** in the workspace header. The tree is never squeezed below a usable width. Drawer traps focus, `Esc` closes it, and the selected row is kept across close/reopen. |
| **S-7.10 Item Actions Menu**   | Anchored `role="menu"` popup beside `⋯`             | Anchored popup, 40px hit areas    | **Bottom sheet** with ≥40px targets, full-width rows, `Esc` to close and a visible Close button                                                                                                                     |
| **S-7.1 Confirmation Dialog**  | Centred modal, 12px radius                          | Centred modal, 90vw max           | **Full-height sheet** with the **confirm action pinned to the bottom** above the safe area inset; the body scrolls; focus lands on the pinned confirm                                                               |
| **S-7.2 Toast**                | Top-right stack, max 3                              | Top-right stack, max 3            | Bottom-anchored above the safe area, max 3, full-width minus 16px; a toast with an action stays until acted on                                                                                                      |
| **S-7.5 Command Palette**      | Centred overlay, 640px wide                         | Centred overlay                   | Full-width sheet **and a visible trigger button** in the header — Android has no ⌘K, so the shortcut is never the only route                                                                                        |
| **S-7.4 Help & Support**       | Right slide-over, 420px                             | Right slide-over, 60vw            | Full-screen sheet; search input focused on open; `Esc` closes and restores focus to `?`                                                                                                                             |
| **S-7.11 Readiness Checklist** | Two-column Fix layout                               | Stacked rows                      | **Blocking entries stay expanded**; advisory entries collapse by default; summary line and Re-check remain visible without scrolling                                                                                |
| **S-7.12 DataTable**           | Full table, sticky header                           | Reduced columns, hidden secondary | Stacked cards per row; primary value as the card heading; actions in a bottom sheet. `aria-sort` state survives the switch.                                                                                         |
| **S-7.12 Pagination**          | Page numbers + per-page                             | Page numbers                      | `◀` · "1–25 of 412" · `▶`, with per-page in the density menu                                                                                                                                                        |
| **S-7.12 DropZone**            | Full area, multi-file list                          | Full area                         | Full area; a 500 MB file is reachable over a phone connection, so the resume path and the **Cancel** button are both above the fold                                                                                 |
| **S-7.6 Onboarding Tour**      | Spotlight overlay                                   | Spotlight overlay                 | Spotlight scrolls the target into view; the step card pins to the bottom; overlay transitions are disabled under `prefers-reduced-motion`                                                                           |
| **S-7.8 Save-State Indicator** | Full variant in the footer                          | Full variant                      | Full variant in a fixed footer strip above the safe area; never compressed to the compact icon-only form, because the state text is the point                                                                       |
| **S-7.3 Empty State**          | Centred, illustration + CTA                         | Centred                           | Left-aligned, full-width CTA ≥44px, secondary link below                                                                                                                                                            |
| **S-7.7 Duplicate Modal**      | Centred modal                                       | Centred modal                     | Full-height sheet with a pinned **Duplicate**                                                                                                                                                                       |

---

<a id="keyboard-shortcuts"></a>

## Keyboard Shortcuts

**This is the authoritative table.** [Part 11](11-Global-Standards.md#global-validation-and-feedback-patterns) links here rather than restating the list.

| Action                           | macOS                     | Windows / Linux           | Visible equivalent                                                     |
| -------------------------------- | ------------------------- | ------------------------- | ---------------------------------------------------------------------- |
| Save / flush the dirty buffer    | `⌘S`                      | `Ctrl+S`                  | **Save now** in the [S-7.8](#scr-7-8) footer strip                     |
| Undo                             | `⌘Z`                      | `Ctrl+Z`                  | **Undo** in the editor toolbar / Undo toast action ([S-7.2](#scr-7-2)) |
| Redo                             | `⇧⌘Z`                     | `Ctrl+Y`                  | **Redo** in the editor toolbar                                         |
| Command palette                  | `⌘K`                      | `Ctrl+K`                  | **Search** button in the header (mandatory on Android)                 |
| Find in the current view         | `⌘F`                      | `Ctrl+F`                  | 🔍 search field in the table header / palette                          |
| Tree: move between rows          | `↑` `↓`                   | `↑` `↓`                   | Clicking a row; arrow keys also drive the tree's roving focus          |
| Tree: expand / collapse          | `→` `←`                   | `→` `←`                   | The section disclosure triangle                                        |
| Tree: first / last row           | `Home` `End`              | `Home` `End`              | Scrolling; both ends are reachable without a keyboard                  |
| Tree: jump by title              | type a title fragment     | type a title fragment     | The tree's filter field                                                |
| Tree: pick up / drop             | `Space`                   | `Space`                   | Drag handle — **drag is never the only way to reorder**                |
| Tree: cancel drag                | `Esc`                     | `Esc`                     | **Cancel** in the same toolbar                                         |
| Tree: rename the focused row     | `F2`                      | `F2`                      | **Rename…** in the [S-7.10](#scr-7-10) menu                            |
| Tree: collapse a multi-selection | `Esc`                     | `Esc`                     | **Clear selection** in the bulk-action bar                             |
| Skip to main content             | first `Tab`, then `Enter` | first `Tab`, then `Enter` | A visible **Skip to content** link, first in the DOM                   |
| Move focus                       | `Tab` / `⇧Tab`            | `Tab` / `Shift+Tab`       | Every control is pointer-reachable; the focus ring is never removed    |
| Close a dialog or popup          | `Esc`                     | `Esc`                     | A visible **Close** button on every dialog and sheet                   |
| Activate the focused control     | `Return`                  | `Enter`                   | Every control is clickable                                             |
| Toolbar: move between groups     | `←` `→`                   | `←` `→`                   | Each toolbar group is also reachable by `Tab`                          |
| Toolbar: move within a group     | `↑` `↓`                   | `↑` `↓`                   | Toolbar buttons are individually tab-reachable in sequence             |
| Table: move between rows         | `↑` `↓`                   | `↑` `↓`                   | Row click / the pagination control                                     |
| Table: enter row actions         | `→`                       | `→`                       | The row's `⋯` button                                                   |
| Select the next tab              | `⇧Ctrl+Tab`               | `Ctrl+Tab`                | Clicking a tab                                                         |
| Shortcut help                    | `⌘/`                      | `Ctrl+/`                  | **Keyboard shortcuts** link in [S-7.4](#scr-7-4) Help & Support        |

> **Every shortcut has a visible, labelled control equivalent.** A shortcut is never the only route to an action. `⌘K` must reach the command palette from inside the item editor ([Part 12 § 7.3](12-Course-Editor-Markdown-Lessons.md#73-keyboard)), and the palette must also have a visible trigger for platforms without a shortcut key.
