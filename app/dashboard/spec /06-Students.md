# Section 4: Student & Enrollment Management

> **Abugida Academy — UX Design Specification** · Part 06 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Content Library](05-Content-Library.md) · [Analytics →](07-Analytics.md)

## What changed in Part 06 (Revision 3)

- **Student identity is Telegram-capable, and this was the file's defining defect.** The directory keyed on `Email`, the profile showed an address as the primary contact, and Add Student collected name + email. Auth is Google + Telegram only, so a Telegram user may have **no address at all**. The `Email` column is replaced by **`Telegram`**, email becomes a secondary column rendering `—` when absent, and each contact channel carries a **verified** marker.
- **Names are never split and never truncated.** `Alemayehu K.` is gone. A one-word Ge'ez name, a single-token patronymic chain, and a 40-character name are all rendered in full, per [Part 11](11-Global-Standards.md#localization--formatting).
- **Add Student no longer collects a name or an email.** It issues a **claimable link** (`/enroll/:token`, single-use, 7-day expiry) **or an 8-character code**. The student's own name is captured after sign-in, from their identity — the inviter never types it. Success copy: _"Enrollment link copied — share it over Telegram or any channel."_
- **Every "email" line becomes the Part 11 delivery rule** — in-app always, Telegram by default, email optional and **disabled with the reason "No verified email on this account"** — plus a **Delivery failures** state on each outbound surface. A student with no address is never silently skipped.
- **S-4.2 Student Profile is no longer four tabs and one of them.** All four tabs are specified with per-tab skeletons, per-tab empty states, the full edit field list with validation, and a **conflict state** — two Admins editing the same student is the most contended surface in the product.
- **S-4.5 Messaging Center states its channel** (in-app message, Telegram as the delivery mechanism for a student who has not opened the app in 7 days), with read receipts, attachment validation, a broadcast **rate limit**, and a 24-month retention statement. It is **Admin + Support only**, matching `students.message`.
- **Enrollment Requests** require a **denial reason shown to the student**, gain waitlist **auto-promotion** with a stated policy, a **capacity-race** outcome, and a confirmation showing the final count.
- **Badges lose their emoji icons** for hugeicons, gain a defined **streak time window** and **scope**, and say plainly that the 1,842 matching students are awarded on the **next nightly evaluation**, not immediately. **Rule builder** gains **cycle detection** beyond self-enrollment, a **Last sweep** timestamp with **Run now**, and a review-lock state.
- **All eight screens ship `Resilience`**, `Keyboard & Focus` where interactive, and `Instrumentation & acceptance` on S-4.1, S-4.6, and S-4.8.

## What changed in Part 06 (Revision 2)

No screen was added, removed, or redesigned. One relationship was made explicit, because the Course Workspace added a course-scoped roster:

- **[S-4.1](06-Students.md#scr-4-1) Student Directory is the canonical implementation** behind both the global directory and the workspace's **Students** tab ([S-2.18](04-Courses.md#scr-2-18)). The workspace tab is the same data table, the same selection model, and the same bulk-action bar with the course filter **pinned** and course-specific actions added — it is not a second table. Any change to the roster is made once, here.
- The course-scoped variant adds exactly three things: the pinned course context chip, enrolment actions scoped to one course, and an empty state for the case where a course is not yet published. Everything else is inherited.

<a id="scr-4-1"></a>

##### Screen Name: S-4.1 Student Directory 🔄 CHANGED

- **Purpose:** Complete directory of all students with search, filtering, and bulk actions. The canonical table implementation behind both this screen and the Course Workspace's **Students** tab ([S-2.18](04-Courses.md#scr-2-18)).
- **User Role(s):** Admin, Editor, Support, Viewer
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Students"                                              │
  │   [🔍 Search] [Course: All ▾] [Status ▾] [Enrolled ▾] [Export ▾] │
  │   [+ Add Student] [+ Create Cohort]   1–25 of 1,234  ‹ 1 2 3 ›  │
  ├──────────────────────────────────────────────────────────────────┤
  │ Stats: 1,234 Total · 456 Active this week · 78 Inactive this    │
  │        week · 12 Courses avg/user · 19 No linked contact        │
  ├──────────────────────────────────────────────────────────────────┤
  │ ☑ | Name                 | Telegram      | Email    | Courses    │
  │ ──┼──────────────────────┼───────────────┼──────────┼────────────│
  │ ☐ | አለመዱ ካሳሁን          | @alemayehu ✔   | —        │ 3  68%     │
  │ ☐ | Tigist M.            | @tigist ✔     | tigist@… │ 2  45%     │
  │ ☐ | Daniel W.            | —             | daniel@… │ 4  82%     │
  │ ☐ | Sara B.              | @sara ✔       | —        │ 1  23%     │
  │                              ✔ = verified                            │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Search and filter students.
  2. Bulk actions: Add to cohort, Enroll in course, Archive, **Message** ([S-4.5](#scr-4-5)).
  3. View student profile.
  4. **Add a student** — issue a claimable link or an 8-character code. No name, no email, no password is collected here.
- **Data Displayed/Modified:** Reads from `users` with `enrollments` aggregated; writes `users`, `enrollment_invites`, `cohort_enrollments`.
- **Table contract:** [S-7.12 DataTable](09-Shared-Components.md#scr-7-12) — **25-row pages**, server-side sort and filter, sortable columns with `aria-sort`, column filters in a popover, selection with a header checkbox that offers **Select all 1,234** (a distinct state from "all 25 on this page"), and a bulk-action bar that is one Tab stop. **Sort and filter move server-side past 100 rows**; below 100 they still round-trip through the URL so a link reproduces the view ([Part 00 § Cross-Screen Contract](00-Overview-and-Sitemap.md#cross-screen-contract)).
- **Validation & Feedback:**
  - **The `Telegram` column replaces `Email`.** Email authentication is not a thing this product has, and a Telegram user frequently has no address, so keying the directory on email hid a third of the roster behind a truncated string. **Email remains a column, but it is secondary and renders `—` when absent** — never an empty cell, which reads as a rendering bug.
  - **Each contact channel carries a verified marker** (✔ next to the handle or address), because a self-entered string is not a reachable channel. An unverified value is shown with a warning pill and a **Verify** action, and is excluded from campaign audiences in [S-8.1](10-Marketing-and-Growth.md#scr-8-1).
  - **Names are rendered in full and never split.** No `First Last` fields, no initial truncation, no `Alemayehu K.`. A one-word Ge'ez name, a long patronymic chain, and a 40-character name are all valid ([Part 11](11-Global-Standards.md#localization--formatting)). The cell wraps; the row grows; **no fixed-px line clamp**.
  - **A row with no reachable channel at all** is badged **No linked contact** and offers **Send enrollment link** — the one action that can fix it.
  - **CSV export is permission-gated and audited.** It requires `students.read` **and** an explicit confirm, writes one row to the [S-6.8](08-Settings.md#scr-6-8) audit log `{actorId, rowCount, filterHash, timestamp}`, and **excludes** `finance`-scoped columns and any contact field a Support user is not entitled to re-export. A Support user's export contains **no** revenue, and the export dialog says so: _"Exported 25 students · 3 columns (contact details only — no revenue)."_ Exports are also gated in [S-1.3](03-Dashboard.md#scr-1-3) Global Search recents and the command palette by the same capability.
- **States:**
  - **Default:** Table populated.
  - **Empty:** [S-7.3](09-Shared-Components.md#scr-7-3) — "No students yet. Add a student with an enrollment link, or wait for someone to sign up." Only when the workspace has **never** had a student.
  - **Zero-result:** "No students match your filters." + **Clear filters** — deliberately _not_ the Add-Student CTA. A workspace with 1,200 students filtered to one cohort is not empty.
  - **Loading:** Skeleton table rows (25), with the filter bar, sort headers, and column headers mounted so nothing jumps on arrival.
  - **Add Student:** see below. The dialog collects **no identity data**.
  - **No Linked Contact:** `—` in both channel columns, a warning pill, and a **Send enrollment link** row action.
  - **Export in progress:** Exports are **asynchronous** ([S-5.4](07-Analytics.md#scr-5-4)) — the button becomes _"Preparing export…"_ and the file is retrievable in-app, with an email copy as a convenience only.
  - **Error:** "We couldn't load your students — nothing you did was lost." + Retry + a request ID. Never a bare _"Retry?"_.
  - **Course-Scoped Instance (new):** the same table renders inside the Course Workspace with the course filter pinned, a context chip, and a _View all students_ escape hatch back to the unscoped directory. Filtering, sorting, selection, and export behave identically in both hosts, so an author who learns the table once is never surprised. See [S-2.18](04-Courses.md#scr-2-18).
- **Resilience:**
  - **403:** _"You don't have access to this student directory."_ — or, for a course-scoped instance the user cannot read, _"You don't have access to {course}."_ Both with a request ID and **Ask an Admin for access**. Never a silent empty table.
  - **404:** A filtered URL naming a deleted course or cohort → _"This course was deleted, or you followed an old link."_ + **Back to Students** + a request ID, with the rest of the filter preserved so one dead value does not lose the user's query.
  - **Offline:** Persistent banner, not a toast. The table renders **read-only** from cache with _"You're offline — showing the last loaded directory."_ Search, filter, and sort still work locally. Bulk actions are disabled-with-a-reason (_"Reconnect to enroll students."_); **Add Student is disabled-with-a-reason too**, because an invite link that cannot be delivered is worse than none — the reason names the fix: _"Enrollment links need a connection. Reconnect to issue one."_
  - **Reconnected:** Queued writes flush in order; a bulk enroll whose `rowVersion` went stale resolves to a per-row failure, never a silent overwrite.
  - **Session expired:** The 2-minute warning names an open Add-Student dialog with an un-copied link and any in-flight export; on return the filters, sort, page, and selection are restored and the un-copied link is still there.
  - **Conflict:** Two Admins editing the same student → routed to [S-4.2](#scr-4-2), which owns the conflict contract. Bulk enroll over a changed capacity reports per row: _"3 enrolled · 2 failed — the cohort filled up."_
  - **Partial failure:** _"Enrolled 18 of 20. Sara B. and Daniel W. are already enrolled."_ Every skipped row names its reason and links to the row.
  - **Server error:** Retry + a request ID, in the product's voice.
- **Keyboard & Focus:**
  - The table is a `role="grid"` with one Tab stop for the grid; `↑`/`↓` move rows, `←`/`→` move cells, `Enter` opens the student, `Space` toggles selection, `Shift+Space` selects a range, and `Ctrl/⌘+A` selects the whole filtered set (announced: _"All 1,234 students selected"_).
  - Sort headers are buttons with `aria-sort`; every column has a keyboard-reachable sort toggle inside the header popover as well as the click affordance.
  - The bulk-action bar appears after the first selection and **takes focus**, so keyboard users are not left tabbing through 25 rows to reach it. `Esc` clears the selection.
  - A deep link arriving with a filter in the URL focuses the **Search** field and announces the result count in a polite live region.
- **Instrumentation & acceptance:**
  - **Events:** `student_directory_viewed` `{scope, filterHash, sort, page, resultCount}` · `student_filter_changed` `{filterKey, resultCount}` · `student_bulk_action` `{action, selectedCount, succeededCount, failedCount}` · `student_invite_issued` `{method: link|code, courseId?}` · `student_export_requested` `{rowCount, columnsRequested[]}` · `student_export_completed` `{rowCount, durationMs}`. IDs and counts only — no names, no handles, no addresses.
  - **Acceptance:**
    1. A student with no email renders `—` in the Email column, not an empty cell, and the row is not hidden.
    2. `Alemayehu K.` does not appear in any rendering; a 40-character Ge'ez name and a one-word name both render in full at 320px width and 200% zoom.
    3. The zero-result state offers **Clear filters** and does **not** offer **Add Student**.
    4. **Add Student** collects no name and no email, and produces either a single-use 7-day `/enroll/:token` link or an 8-character code.
    5. A Support user's CSV export contains no revenue column, and every export writes exactly one audit-log row.
    6. Offline, the table is read-only and **Add Student** is disabled with a reason that names the fix.
  - **Budgets:** 25-row pages; first paint < 1.5 s; server-side sort and filter past 100 rows with a response < 400 ms; selection does not re-query; no layout shift when 25 rows replace 25 skeletons.
- **Navigation:**
  - Student Row → [S-4.2](#scr-4-2) Student Profile
  - "+ Add Student" → the Add Student dialog below
  - "+ Create Cohort" → [S-4.4](#scr-4-4) Cohort Management
  - Course chip (in the workspace instance) → [S-2.18](04-Courses.md#scr-2-18) Workspace · Students
  - Bulk **Message** → [S-4.5](#scr-4-5) Messaging Center, audience pre-filtered to the selection
  - **Export** → [S-5.4](07-Analytics.md#scr-5-4) Export Reports (asynchronous, in-app behind re-auth)

---

### Add Student (dialog on S-4.1)

- **Purpose:** Put one student in front of the product without the admin knowing anything about them.
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────┐
  │ Add Student                                             [X] │
  │ The student gives us their own name after they sign in.     │
  │                                                              │
  │ Course: [IELTS Advanced ▾]     Cohort: [None ▾]             │
  │                                                              │
  │ Claimable link   /enroll/a7f3k2m9   [Copy]   expires in 7d  │
  │      single use · works over any channel you like           │
  │                                                              │
  │ ─── or ───                                                  │
  │                                                              │
  │ 8-character code:  A7F3-K2M9   [Copy]                       │
  │      student enters it at /enroll after signing in          │
  └──────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Choose the course and cohort the student will land in.
  2. **Copy the claimable link.**
  3. **Copy the 8-character code.**
  4. Close — the invite is issued and the student appears in the directory as **Invited, not yet signed in**.
- **Data Displayed/Modified:** Writes `enrollment_invites` (token or code, course, cohort, `expiresAt = now + 7d`, `singleUse`, `createdBy`).
- **Validation & Feedback:**
  - **The dialog collects nothing about the student.** No name, no email, no phone. A wrong name typed by an admin is a record that is wrong in a system of record, and Part 11 forbids splitting a name anyway.
  - Both channels are issued at once and are equivalent; neither is a fallback for the other, because the inviver may have no way to send a link (a printed handout) and no way to read a handle aloud.
  - **Success copy:** _"Enrollment link copied — share it over Telegram or any channel."_ The code path says _"Code copied — the student enters it at /enroll after signing in."_
  - Both are **single-use** and **expire in 7 days**; the countdown is visible, and an expired invite shows **Expired — issue a new one** rather than failing at redemption.
  - Redemption is Telegram-safe: the student signs in with Google **or** Telegram, the token is consumed, and **their own name is captured from their identity** — if their provider exposes none, the app asks them for it once, in their own script, as a single un-split field.
  - **Re-issue** is available from the row and from the student profile; the previous token is invalidated, and this is stated: _"Issuing a new link invalidates the previous one."_
- **States:**
  - **Default:** Link and code issued, both copyable, course and cohort chosen.
  - **Copied:** The copy button confirms inline with **Copied** for 2 s and the value stays selectable.
  - **Issued, not signed in:** The directory row shows a **Invited** pill (tint background, text token, fill-token icon) with the issue date. It is not a student yet and is excluded from progress metrics.
  - **Redeemed:** The row becomes a real student row; the invite row moves to history with the redemption timestamp and the provider used.
  - **Expired:** _"This invite expired on {date}."_ + **Issue a new one**.
  - **Partial failure:** The invite is issued but the copy-to-clipboard is blocked by the browser → the value is shown selected, with a manual-copy note. The invite is never lost because a clipboard permission was denied.
  - **Error:** "We couldn't issue this invite — nothing you did was lost." + Retry + a request ID.
- **Resilience:** Same contract as the host screen. Offline, **Copy** still works (the value is already issued) but **Issue** is disabled-with-a-reason (_"Reconnect to issue a new invite."_); an invite issued moments before the connection dropped is not invalidated, and the dialog says so. A 409 — the token already consumed — is reported as _"This link was already used on {date} by {provider}. Issue a new one."_, not as a generic error.
- **Keyboard & Focus:** Focus moves to the **Copy link** button on open and focus is trapped in the dialog. `Esc` closes. Each copy button announces **Copied** in a polite live region. An expiring invite announces in a polite region at 24 h and 1 h remaining.
- **Instrumentation & acceptance:** Events `student_invite_issued` `{method, courseId?, hasCohort}` · `student_invite_copied` `{method}` · `student_invite_redeemed` `{method, provider, hoursToRedeem}`. Acceptance: the dialog collects zero identity fields; the link is single-use with a 7-day expiry; redemption succeeds for a student with no email address; a re-issue invalidates the prior token and says so.

<a id="scr-4-2"></a>

##### Screen Name: S-4.2 Student Profile 🔄 CHANGED

- **Purpose:** Detailed view of an individual student's identity, enrollment history, progress, activity, and communication log. In Revision 3 all four tabs are specified, and the screen owns the product's most contended conflict surface.
- **User Role(s):** Admin, Editor, Support, Viewer
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: Students / Alemayehu K.                  [Message] [⋯]  │
  ├──────────────────────────────────────────────────────────────────┤
  │ ┌─ Identity card ──────────────────────────────────────────────┐ │
  │ │ [Avatar]  Alemayehu K.                                      │ │
  │ │ Telegram  @alemayehu ✔ verified                              │ │
  │ │ Email     —  (no address on file)                            │ │
  │ │ Joined Jan 15, 2026 · Last active 2 days ago · Active ✔     │ │
  │ │ Cohort: TOEFL Jan 2026 · 3 courses · 68% avg progress        │ │
  │ └──────────────────────────────────────────────────────────────┘ │
  │ Tabs: [Courses 3] [Progress] [Activity Log] [Messages 2]        │
  │ ┌─ Activity Log tab ───────────────────────────────────────────┐ │
  │ │ Sep 12, 6:00 PM EAT  Completed "Reading 2" · TOEFL Complete  │ │
  │ │ Sep 11, 4:12 PM EAT  Scored 88% on "Module 2 quiz"           │ │
  │ │ Sep 10, 9:02 AM EAT  Signed in via Telegram                  │ │
  │ └──────────────────────────────────────────────────────────────┘ │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. View student details and status.
  2. Edit student information.
  3. Send a message ([S-4.5](#scr-4-5)).
  4. Enroll in a new course.
  5. View full progress ([S-4.3](#scr-4-3)).
- **Data Displayed/Modified:** Reads/writes `users`, `enrollments`, `activity_log`, `messages`. The Activity Log is append-only and written by the platform, never by this screen.
- **Identity display:**
  | Channel      | Renders                                                                     |
  | ------------ | --------------------------------------------------------------------------- |
  | **Telegram** | `@handle` with a **verified ✔** marker; `—` when unlinked                   |
  | **Email**    | the address with a **verified ✔**; **`—` when absent**, never an empty cell |
  | **Phone**    | shown when the student supplied one; optional, never required               |
  - A value entered by an admin is **unverified** until the student proves it, and renders with a warning pill and a **Verify** action. An unverified channel is not a delivery channel: outbound messages say so rather than bouncing silently.
  - **No verified contact at all** → a state on the identity card: _"No verified contact — send them an enrollment link."_ + **Send enrollment link** (the claimable link from [S-4.1](#scr-4-1)). This is a first-class state, not an absence: 19 students in the sample directory are in it, and each is one message away from being reachable.
- **Validation & Feedback:** — the complete edit field list:
  | Field                | Required       | Validation                                                                                                                                                                                     |
  | -------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | **Display name**     | ✔              | **One field, never split into first/last.** Accepts a single Ge'ez word, a multi-word Latin name, and a long patronymic chain. Min 1, max 120 characters, no fixed-px truncation at any width. |
  | **Telegram handle**  | —              | `@` + 5–32 of `A-Za-z0-9_`. Marked **unverified** until the student confirms it in-app.                                                                                                        |
  | **Email**            | —              | RFC-shaped validation. Marked **unverified** until confirmed. **A verified email is the only thing that enables the email channel.**                                                           |
  | **Phone**            | —              | E.164-normalized, shown in the student's own local format.                                                                                                                                     |
  | **Cohort**           | —              | One cohort per term; a student in 3 cohorts across 3 terms is normal.                                                                                                                          |
  | **Notes (internal)** | —              | Staff-only, never shown to the student, never included in an export.                                                                                                                           |
  | **Consent**          | read-only here | Edited in [S-6.10](08-Settings.md#scr-6-10); shown as a read-only summary with a link.                                                                                                         |
  - **A verified email or Telegram handle is required before that channel can be used for delivery.** This is the whole delivery contract: no verified channel, no message.
  - **Changing a student's identity does not rename their history.** Certificates, issued records, and progress history are bound to the **student ID**, not the name or the handle. Renaming Alemayehu K. to a full patronymic, or unlinking and re-linking a Telegram account, leaves every certificate, every `issued_certificates` row, and every completion record exactly as it was. Where a name change invalidates a certificate's _printed_ name, the certificate is **reissued as a new document** and the original is retained — it is never rewritten in place.
- **States:** — per tab, every tab has a skeleton and an empty state:
  | Tab              | Loading                | Empty                                                                                                               |
  | ---------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
  | **Courses**      | 3 skeleton rows        | "Not enrolled in any course yet." + **Enroll in a course**                                                          |
  | **Progress**     | 2 skeleton chart cards | "No activity recorded since enrollment." + a link to the course roster; charts need data before they can render one |
  | **Activity Log** | 5 skeleton rows        | "No recorded activity yet." — the student's first sign-in will appear here                                          |
  | **Messages**     | 3 skeleton bubbles     | "No messages with this student yet." + **Send a message** (never the bare "no data")                                |
  - **Default:** Profile populated.
  - **Edit Mode:** Inline edit for the fields above. Structural changes (cohort change) commit **immediately** with optimistic UI; text fields autosave on a 60 s idle timer with the [S-7.8](09-Shared-Components.md#scr-7-8) indicator and flush on `Ctrl/⌘+S`.
  - **Saving:** The [S-7.8](09-Shared-Components.md#scr-7-8) indicator, never a bespoke "Save" spinner.
  - **Error:** "We couldn't save these changes — nothing you did was lost." + Retry + a request ID.
  - **Partial failure:** _"Saved 3 of 4 fields. The Telegram handle was already linked to another account."_ The other three are kept and the failing field is focused.
  - **Conflict:** see below.
  - **No verified contact:** as above.
  - **Archived student:** The screen renders read-only with an **Archived** pill and a **Restore** action; editing is disabled with the reason _"This student is archived. Restore them to make changes."_
  - **Support role:** Support holds `students.read`, `students.message`, and `audit.read_own_actions`. They see the full record, **internal notes included and marked as read-only**, and the Message action — but **every identity field is disabled with a reason**: _"Editing student identity requires the Admin role."_ Editing is a case-2 block, not an absent capability, because the surface itself is reachable for them.
- **Resilience:**
  - **403:** _"You don't have access to this student's record."_ with a request ID and **Ask an Admin for access**. Support is never blocked here; a user outside `students.read` is.
  - **404:** _"This student was deleted, or you followed an old link."_ + **Back to Students** + a request ID. A **merged** student resolves to the surviving record with an explanation, not a 404.
  - **Offline:** Persistent banner; the profile renders read-only from cache with _"2 changes waiting to sync."_ Tabs switch locally; Message is disabled-with-a-reason (_"Reconnect to send messages."_).
  - **Reconnected:** Queued edits flush in order; a stale `rowVersion` resolves to Conflict, never a silent overwrite of a colleague's correction.
  - **Session expired:** The 2-minute warning names **this** screen and the open tab, and lists which tab had unsaved edits. On return the student, the tab, and the buffer are all restored.
  - **Conflict — the most contended surface in the product.** Two Admins editing one student is routine, not an edge case: a display name is edited from a course roster, a cohort from the cohort screen, a handle from a support ticket.
    - A stale `rowVersion` on save produces _"Changed by {actor} {N} minutes ago."_ with **Review changes / Keep mine / Take theirs**. **Reload is never the only option.**
    - **Review changes** shows a **field-level diff**, not a whole-record replace: which fields they touched, old value → new value, per field. Two Admins editing _different_ fields of the same student is the common case and must not require choosing a side.
    - Non-overlapping edits **merge silently** and report it: _"Merged — Alemayehu changed the cohort, you changed the display name."_ Forcing a choice when there is no conflict is the failure mode this replaces.
    - `Ctrl/⌘+S` on a stale buffer opens the conflict dialog rather than overwriting.
  - **Partial failure:** per field, as above.
  - **Server error:** Retry + a request ID, in the product's voice.
- **Keyboard & Focus:**
  - Tabs are a proper `role="tablist"` with `aria-selected` and roving tabindex: `←`/`→` switch tabs, `Home`/`End` jump to the first/last. The selected tab is in the URL (`?tab=activity`), so the tab is linkable.
  - Switching tabs flushes the dirty buffer first ([Part 11](11-Global-Standards.md#global-validation-and-feedback-patterns)); if that save fails, navigation is blocked with **Retry / Discard / Stay**.
  - Deep-linking to a tab or an activity-log entry moves focus to its target control and announces the destination in a polite live region.
  - The conflict dialog is a `role="alertdialog"`; focus moves to **Review changes** and is trapped; the diff is navigable row by row and each changed field is announced with its old and new value.
  - `Esc` in the identity card's inline editor does not discard the buffer — it prompts.
- **Instrumentation & acceptance:**
  - **Events:** `student_profile_viewed` `{studentId, tab}` · `student_profile_tab_changed` `{tab}` · `student_field_edited` `{fieldGroup, fieldCount}` · `student_edit_conflict` `{fields, resolution: merged|reviewed|kept_mine|took_theirs}` · `student_enrolled_from_profile` `{courseId}`. **No names, handles, addresses, or note text in any event property.**
  - **Acceptance:**
    1. Two Admins editing **different** fields of one student merge without a prompt.
    2. Two Admins editing the **same** field get **Review changes / Keep mine / Take theirs**, and no path offers Reload alone.
    3. A student with no email shows `—` and remains fully usable.
    4. Renaming a student leaves every issued certificate, `issued_certificates` row, and progress record unchanged.
    5. Every tab has a distinct loading skeleton and a distinct empty state with an action.
  - **Budgets:** Profile shell paints < 1 s; each tab's data < 400 ms; a tab switch flushes and re-renders < 300 ms; a 2,000-row activity log paginates past 100; the conflict diff renders < 200 ms.
- **Navigation:**
  - "Enroll in a course" → [S-2.1](04-Courses.md#scr-2-1) Course Catalog (selection mode)
  - "Message" → [S-4.5](#scr-4-5) Messaging Center, this student open
  - "Send enrollment link" → [S-4.1](#scr-4-1) Add Student dialog
  - Certificates → [S-2.10](04-Courses.md#scr-2-10) Certificates & Completion Rules
  - Progress tab → [S-4.3](#scr-4-3) Student Progress Dashboard
  - Badges in the Activity Log → [S-4.7](#scr-4-7) Badges & Achievements
  - Consent summary → [S-6.10](08-Settings.md#scr-6-10) Privacy & Data Retention

---

<a id="scr-4-3"></a>

##### Screen Name: S-4.3 Student Progress Dashboard

- **Purpose:** Focused, chart-driven view of a single student's learning progress across all enrolled courses — a deeper counterpart to the "Progress" tab summarized in [S-4.2](#scr-4-2).
- **User Role(s):** Admin, Editor, Support, Viewer
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Progress — Alemayehu K."                                │
  ├──────────────────────────────────────────────────────────────────┤
  │ Overall Completion: 68%  ▓▓▓▓▓▓▓░░░                              │
  │ Streak: 🔥 12 days     Time Invested: 34.5 hrs                  │
  ├──────────────────────────────────────────────────────────────────┤
  │ Per-Course Breakdown:                                            │
  │ +─────────────────────+ +─────────────────────+                 │
  │ │ TOEFL Complete      │ │ IELTS Advanced      │                 │
  │ │ 📈 Progress over time│ │ 📈 Progress over time│                 │
  │ │ Last quiz: 88%      │ │ Last quiz: 71%      │                 │
  │ +─────────────────────+ +─────────────────────+                 │
  ├──────────────────────────────────────────────────────────────────┤
  │ Earned Certificates: 🏅 Grammar Basics (2026-07-01)              │
  │ Badges: 🥇 First Steps · 🔥 7-Day Streak · 💯 Perfect Score        │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Review completion, quiz scores, and time-on-task per course.
  2. View earned certificates ([S-2.10](04-Courses.md#scr-2-10)).
  3. Export an individual progress report.
  4. Review earned badges and streaks ([S-4.7](#scr-4-7)).
- **Data Displayed/Modified:** Reads `enrollments`, `lesson_progress`, `quiz_attempts`, `issued_certificates`, `awarded_badges`.
- **Validation & Feedback:**
  - The date range and course filters are reflected in the URL, so a shared link reproduces the view; a range with no data says so rather than rendering an empty chart.
  - **Suppression before display:** any comparison with `n < 5` renders as _"Too few students to compare"_. A 12% completion rate across two students is not a metric.
  - **Export** is asynchronous and gated: it opens [S-5.4](07-Analytics.md#scr-5-4) with the student pre-filtered, and the resulting file is retrievable in-app behind re-auth ([S-6.10](08-Settings.md#scr-6-10)) with an emailed copy as a convenience only.
- **States:**
  - **Default:** Charts populated per enrolled course.
  - **Loading:** 2 skeleton chart cards with fixed heights, so the layout does not shift when the real charts paint.
  - **Zero-result:** "No activity in this range." + **Widen range** — distinct from the true-empty state below.
  - **No Activity Yet:** "No activity recorded since enrollment."
  - **At Risk Flag:** a warning pill (tint background, text token, fill-token icon) when a student has been inactive 14+ days, stating the threshold: _"No activity for 18 days."_ A streak is shown as a number with an icon, never as emoji alone.
  - **Suppressed small samples:** any cohort or badge comparison with `n < 5` renders as _"Too few students to compare"_ rather than a misleading percentage, per the `n < 5` suppression rule in the [S-2.19](04-Courses.md#scr-2-19) metric definitions.
- **Resilience:**
  - **403:** _"You don't have access to this student's progress."_ with a request ID and **Ask an Admin for access**. Support reaches it via `students.read`.
  - **404:** _"This student was deleted, or you followed an old link."_ + **Back to Students** + a request ID.
  - **Offline:** Persistent banner; charts render read-only from cache with the last known values labelled as such — _"You're offline — showing data from 2 hours ago."_ Export is disabled-with-a-reason (_"Reconnect to export."_).
  - **Reconnected:** The view refetches and the "as of" timestamp updates; a stale `rowVersion` on a filter or range change resolves to Conflict.
  - **Session expired:** The 2-minute warning names the open date range and course filter; on return the same range, filter, and scroll position are restored.
  - **Conflict:** Read-only, so no field conflict arises. If the **student record** changed while open (name, archive, deletion), the header shows _"Updated by {actor} {N} minutes ago"_ + **Refresh**.
  - **Partial failure:** In a multi-course view, one course's chart failing to load renders a **skeleton with Retry** in its own card; the other courses render normally. Never one error for the whole screen.
  - **Server error:** _"We couldn't load this progress — nothing you did was lost."_ + Retry + a request ID.
- **Keyboard & Focus:**
  - Every chart has a **data-table alternative** rendered on demand, not on load, and is reachable by `Tab`; the toggle is a labelled button and the table is announced as a region.
  - Date range and course filter are labelled controls; changing either moves focus nowhere but announces the new result count politely.
  - Deep-linking to a course card focuses that card and announces the destination.
- **Navigation:**
  - Course card → [S-2.19](04-Courses.md#scr-2-19) workspace Analytics (student filtered)
  - "Export" → [S-5.4](07-Analytics.md#scr-5-4) Export Reports (pre-filtered to this student)
  - Back → [S-4.2](#scr-4-2) Student Profile
  - Back to course → [S-2.18](04-Courses.md#scr-2-18) Workspace · Students for the course this view was opened from
  - Badge in the list → [S-4.7](#scr-4-7) Badges & Achievements
- **Instrumentation & acceptance:**
  - **Events:** `student_progress_viewed` `{studentId, courseCount, range}` · `student_progress_range_changed` `{range}` · `student_progress_exported` `{format}`. IDs, counts, and ranges only — no names.
  - **Acceptance:**
    1. A comparison with `n < 5` renders **"Too few students to compare"**, not a percentage.
    2. A student with no activity in the selected range shows the **zero-result** state with **Widen range**, distinct from the true-empty "no activity since enrollment" state.
    3. Every chart exposes a data-table alternative that renders on demand, not on load.
    4. Export opens [S-5.4](07-Analytics.md#scr-5-4) pre-filtered and the file is retrievable in-app behind re-auth.
  - **Budgets:** LCP < 2.5 s; each course chart renders < 600 ms; a chart's data table renders on demand in < 200 ms; the date-range control applies without a full refetch of unmounted tabs.

---

<a id="scr-4-4"></a>

##### Screen Name: S-4.4 Cohort Management 🔄 CHANGED

- **Purpose:** Manage student cohorts/groups for batch enrollment, communication, and progress tracking.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Cohorts"                              [+ Create Cohort]│
  │                                                                  │
  ├──────────────────────────────────────────────────────────────────┤
  │ Cohort List (Cards):                                           │
  │ +──────────────────+ +──────────────────+ +──────────────────+ │
  │ | 📚 TOEFL Jan 2026| | 📚 IELTS Feb 2026| | 📚 GRE Mar 2026 | │
  │ | ──────────────── | | ──────────────── | | ──────────────── | │
  │ | 24 students      | | 18 students      | | 12 students      | │
  │ | 68% Avg Progress | | 52% Avg Progress | | 35% Avg Progress | │
  │ | Started: 01-15   | | Started: 02-01   | | Started: 03-01   | │
  │ | [Manage] [✉ Send] | | [Manage] [✉ Send] | | [Manage] [✉ Send] | │
  │                  channels: 24 in-app · 21 Telegram · 9 email    │
  │ +──────────────────+ +──────────────────+ +──────────────────+ │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Create new cohort.
  2. Manage cohort (add/remove students).
  3. **Send a message to the cohort** — in-app always, Telegram by default, email only where verified. Not an email batch.
  4. View cohort progress.
- **Data Displayed/Modified:** Reads/Writes to cohorts and cohort_enrollments.
- **Validation & Feedback:**
  - **The card's Send action states its channels before it is used:** _"24 in-app · 21 Telegram · 9 email (3 have no verified email)."_ A user pressing Send learns the split, not after.
  - Cohort sends follow [Part 11 Notification Delivery](11-Global-Standards.md#notification-delivery) in full. There is no "email this cohort" action, because a cohort of Telegram-authenticated students may have no addresses at all.
- **States:**
  - **Default:** Cohort cards populated.
  - **Empty:** [S-7.3](09-Shared-Components.md#scr-7-3) — "No cohorts created yet. Create your first cohort."
  - **Loading:** Skeleton cards.
  - **Delivery failures:** surfaced per recipient, not as a single success toast — _"{name} has no email on file — sent in-app and via Telegram."_ See [S-4.5](#scr-4-5).
  - **No reachable student:** a cohort where every member has no verified channel shows **"None of these 24 students has a verified contact — sends will queue, not deliver."** and a **Send enrollment links** action, which is the only thing that actually helps.
  - **Error:** "We couldn't load your cohorts — nothing you did was lost." + Retry + a request ID.
- **Resilience:**
  - **403:** _"You don't have access to {cohort}."_ with a request ID and **Ask an Admin for access**. Support reaches cohorts read-only via `students.read`; the Send action is **absent** for them, not disabled.
  - **404:** _"This cohort was deleted, or you followed an old link."_ + **Back to Cohorts** + a request ID. Removing a student from a cohort never 404s the cohort.
  - **Offline:** Persistent banner; cards render read-only from cache, and Send is disabled-with-a-reason (_"Reconnect to send messages."_) rather than queueing silently into a void.
  - **Reconnected:** A queued send flushes in order; a member removed from the cohort while offline is skipped with a reason, not messaged.
  - **Session expired:** The 2-minute warning names an open Send dialog with an un-sent draft; on return the draft is intact.
  - **Conflict:** Two Admins adding the same student to a cohort → _"Daniel W. is already in TOEFL Jan 2026."_ on that row, with the rest of the batch succeeding.
  - **Partial failure:** _"Added 18 of 20. Tigist M. and Sara B. are already in this cohort."_
  - **Server error:** Retry + a request ID.
- **Keyboard & Focus:**
  - Cards are a `role="list"`; each card is one Tab stop and its Manage/Send actions are reachable within the card without leaving it.
  - Removing a student from a cohort is a two-step confirm ([S-7.1](09-Shared-Components.md#scr-7-1)) and focus returns to the removed row's position afterwards.
- **Navigation:**
  - "Create Cohort" → Cohort Creation Modal
  - "Manage" → [S-4.2](#scr-4-2) Student Profile (cohort view)
  - "Send" → [S-4.5](#scr-4-5) Messaging Center, audience pre-filtered to this cohort
- **Instrumentation & acceptance:**
  - **Events:** `cohort_viewed` `{cohortId, studentCount}` · `cohort_created` `{name, plannedSize}` · `cohort_student_added` `{cohortId, bulk}` · `cohort_student_removed` `{cohortId, bulk, succeededCount}` · `cohort_send_started` `{cohortId, channelCounts{}, excludedCount}`. IDs and counts only — no student names.
  - **Acceptance:**
    1. A cohort card shows its per-channel reach before Send is used, and the count includes "(N have no verified email)".
    2. A cohort where no student has a verified contact badges **None of these N students has a verified contact** and offers **Send enrollment links**.
    3. Support sees cohorts read-only and the Send action is **absent**, not disabled.
    4. Removing a student twice reports _"already in this cohort"_ per row rather than failing the batch.

---

<a id="scr-4-5"></a>

##### Screen Name: S-4.5 Messaging Center 🔄 CHANGED

- **Purpose:** Threaded, one-to-one **messages** and **broadcasts** to students, supporting the Message action in [S-4.2](#scr-4-2) and cohort sends in [S-4.4](#scr-4-4).
- **User Role(s):** Admin, Support
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Threads                       │ Alemayehu K.   @alemayehu ✔     │
  │ ─────────────                 │ ──────────────────────────────────│
  │ ● Alemayehu K.   2m          │ Channels: in-app ✔  Telegram ✔   │
  │   Tigist M.      1d          │          email — not verified     │
  │   TOEFL Jan (broadcast, 24)  │                                     │
  │                                │ [Sep 5, 4:12 PM EAT]              │
  │                                │ You: Hi, having trouble with      │
  │                                │   Module 2 quiz…      Delivered ✓  │
  │                                │      Read 6:00 PM EAT              │
  │                                │ Them: That fixed it, thank you.   │
  │                                │                                     │
  │                                │ [Attach 📎]  [type a message…]    │
  │                                │                    (Enter to send) │
  │                                │ [Send]                            │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Channel decision (the point of this revision):**
  - A message here is an **in-app message**. It is written to the student's in-app feed first, always, and it is the system of record — a toast is never the only place an outcome is reported.
  - **Telegram is the delivery mechanism**, not a separate kind of message: when the student has a **verified linked handle** **and** has not opened the app in **7 days**, the same message is relayed over Telegram with a deep link back into the thread. A student who opened the app yesterday gets in-app only; a student who has not opened it in three weeks gets the Telegram nudge.
  - **Email is only used when a verified address exists**, and only for the same 7-day dormancy rule. Where no verified address exists the email leg is **disabled with the reason "No verified email on this account"** and the header says so — never hidden, never silently skipped.
  - The channel state is shown **before** sending, per thread: _"Channels: in-app ✔ · Telegram ✔ · email — not verified."_
  - This screen is **not** the campaign surface. A **message** is 1:1, in a thread, and is a conversation the student can reply to. A **broadcast** is many recipients, one delivery, and **no reply thread** — it is an announcement, it is rate-limited, and it is confirmed with the final per-channel count. A broadcast is never used to start a conversation.
- **Primary Actions:**
  1. Read and reply to individual student threads.
  2. Compose a **broadcast** to a cohort or filtered student list — with the per-channel breakdown and a rate limit.
  3. Attach files or lesson links to a message.
  4. Re-issue a failed delivery.
- **Data Displayed/Modified:** Reads/writes `messages`, `message_threads`, `message_deliveries` (per-recipient channel, state, timestamps). A delivery is a row, not a boolean on the message.
- **Validation & Feedback:**
  - **Attachments:** max **5 files** and **10 MB each** per message; accepted types `.pdf .png .jpg .mp3 .mp4`; validated **client-side on pick** and **again server-side**. A rejected file states the reason and the limit: _"'Design.zip isn't a supported attachment type. Accepted: PDF, PNG, JPG, MP3, MP4."_ and _"'Recording.m4a is 24 MB — the limit is 10 MB per file."_ Lesson links are validated to exist before send and render as a titled card.
  - **Read receipts** are per message and per channel, shown as **Delivered ✓** → **Read**, with the read time in the [Part 11 time format](11-Global-Standards.md#localization--formatting) (`6:00 PM EAT`). A message that was delivered over Telegram and read in-app reads **Read** once, with the channel noted — not two receipts. Receipts are never shown as a percentage or a count of viewers.
  - **Broadcast rate limit:** **3 broadcasts per cohort (or per audience) per day**, and **20 messages per day** to a single student. Exceeding it is disabled-with-a-reason, not failed after the fact: _"You've sent 3 broadcasts to this cohort today. Try again tomorrow."_ The limit is per **audience**, not per Admin, so two staff members cannot collectively bypass it.
  - **Retention:** messages are retained **24 months**, then purged. The countdown is visible on the thread (_"This thread is deleted in 3 months."_) and the statement is repeated in the student's privacy screen ([S-6.10](08-Settings.md#scr-6-10)). Purge is logged to [S-6.8](08-Settings.md#scr-6-8).
  - **Support role:** this screen is **Admin and Support only**, and that follows the [Part 11 grant](11-Global-Standards.md#roles--permissions-matrix) — Support holds `students.message`. Editor, Reviewer, and Viewer have **no** access: the navigation item is absent, and a direct link renders the 403. Support can read every thread but sees only their **own** actions in the audit log (`audit.read_own_actions`).
- **States:**
  - **Unread:** Bold thread with a dot indicator; the count is in the header badge with an accessible name, not a colour alone.
  - **Sending:** Optimistic send with a visible pending state; on failure the bubble becomes **Failed** with **Retry** — it never vanishes.
  - **Delivered / Read:** the two receipt states above, with the read time.
  - **Delivery failure:** _"@{name} has no email on file — sent in-app and via Telegram."_ If **no** channel is reachable, the message is **not sent** and the thread shows _"Not delivered — no verified contact. [Send an enrollment link]"_ linking to [S-4.1](#scr-4-1). A message that cannot reach its recipient is never reported as sent.
  - **Broadcast Confirmation:** [S-7.1](09-Shared-Components.md#scr-7-1) showing the **final per-channel count** after exclusions: _"Send to 24 students in TOEFL Jan 2026? 24 in-app · 21 Telegram · 9 email (3 have no verified email)."_ Sends above 100 recipients get a **10-second countdown with Cancel** ([S-8.1](10-Marketing-and-Growth.md#scr-8-1) owns the delay contract).
  - **Rate limited:** the Send control is disabled with the reason in a tooltip and in `aria-describedby`, and the reset time is stated: _"You've sent 3 broadcasts to this cohort today. Try again tomorrow."_
  - **Attachment rejected:** per-file, with the reason and the limit, and the rest of the message is unaffected.
  - **Thread purged:** _"This thread was deleted after 24 months."_ + a link to the student's activity log, which is retained longer.
  - **Error:** "We couldn't load this thread — nothing you did was lost." + Retry + a request ID.
- **Resilience:**
  - **403:** _"You don't have access to these conversations."_ with a request ID and **Ask an Admin for access**. Editor, Reviewer, and Viewer never see the screen, so a 403 here means the role changed mid-session.
  - **404:** _"This conversation was deleted, or you followed an old link."_ + **Back to Messages** + a request ID. A purged thread renders this with the retention explanation, not a blank pane.
  - **Offline:** Persistent banner; the thread list and the open thread render read-only from cache, and the composer is disabled-with-a-reason (_"Reconnect to send messages."_). A half-typed message is **preserved** in the composer and restored on reconnect — it is never discarded by a connection drop.
  - **Reconnected:** The preserved draft is still there; queued sends flush in order; a send whose recipient lost every channel resolves to **Delivery failure**, not a success.
  - **Session expired:** The 2-minute warning names this screen and the **un-sent draft**; on return the thread and the draft are restored intact. Losing a typed message to a session timeout is not acceptable on a support surface.
  - **Conflict:** Two staff replying in the same thread → the newer message merges and both render, with the thread scrolled and announced. There is no overwrite: a message is append-only, so this is a merge, not a three-way choice. If a **broadcast** is edited while queued, the queue reports _"Message edited — 6 recipients already received the previous version."_ rather than pretending all saw one version.
  - **Partial failure:** A broadcast reports per-reason counts — _"Delivered 21 · 2 not delivered (no verified contact) · 1 failed"_ — with a **Retry failed only** action and a per-recipient list.
  - **Server error:** Retry + a request ID, in the product's voice.
- **Keyboard & Focus:**
  - The thread list is a `role="listbox"` and the conversation pane is the complementary panel; `↑`/`↓` move threads, `Enter` opens one and moves focus to the composer, and the selected thread is restored on return.
  - The composer is a `textarea`; `Enter` sends and `Shift+Enter` inserts a newline. Attach is reachable by `Tab` and the picker is a dialog with a focus trap.
  - Unread threads announce their new-message count politely, not assertively.
  - A deep link to a thread (`/messages/:threadId`) focuses the composer and announces the student and the thread's last activity.
- **Instrumentation & acceptance:**
  - **Events:** `message_sent` `{channel, hasAttachment, isBroadcast, recipientCount}` · `message_delivery_failed` `{reason, channel}` · `message_read` `{channel, minutesToRead}` · `broadcast_blocked` `{reason: rate_limit|no_reachable_channel|empty_audience}` · `message_purged` `{threadId, ageMonths}`. **No message text, no student names, no handles in any event property.**
  - **Acceptance:**
    1. A thread shows its channel state before send, including _"email — not verified."_
    2. A student with **no** reachable channel is reported as **Not delivered** with a link to send an enrollment link, and is never counted as sent.
    3. The broadcast confirmation shows the final per-channel count after exclusions.
    4. The 4th broadcast to one cohort in one day is blocked with the reason in a tooltip, in `aria-describedby`, and in text.
    5. An attachment over 10 MB or of an unsupported type is rejected per file with the reason, and the rest of the message still sends.
    6. Retention is stated on the thread and in the privacy screen, and a thread older than 24 months renders the purged state.
    7. An Editor following a direct link to this screen gets the 403, not the thread list.
- **Navigation:**
  - Thread click → conversation pane (same screen)
  - Student name → [S-4.2](#scr-4-2) Student Profile
  - "Send an enrollment link" → [S-4.1](#scr-4-1) Add Student dialog
  - Cohort "Send" → this screen, audience pre-filtered
  - Broadcast above 100 recipients → [S-8.1](10-Marketing-and-Growth.md#scr-8-1) (same delay, countdown, and partial-failure contract)

<a id="scr-4-6"></a>

##### Screen Name: S-4.6 Enrollment Requests / Waitlist 🔄 CHANGED

- **Purpose:** Review and approve pending enrollment requests for capacity-limited cohorts, and manage waitlists.
- **User Role(s):** Admin, Editor, Support (Support: view only)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Enrollment Requests"     [Approve selected (2)] [Filter]│
  ├──────────────────────────────────────────────────────────────────┤
  │ | Student     | Telegram   | Course         | Requested | Action   │
  │ | Sara B.     | @sara ✔    | IELTS Advanced | Sep 5     |          │
  │ |                                [Approve] [Deny…]           │
  │ | Daniel W.   | —          | TOEFL Complete | Sep 6     |          │
  │ |                                [Approve] [Deny…]           │
  ├──────────────────────────────────────────────────────────────────┤
  │ Waitlist — IELTS Advanced (Full, 24/24): 3 waiting              │
  │  #1 Tigist M. @tigist ✔ · 6:00 PM EAT   [Promote]               │
  │  #2 አለመዱ ካሳሁን @alemayehu ✔                                │
  │  #3 Sara B. @sara ✔                                             │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Approve or deny individual requests.
  2. Bulk-approve with a confirmation showing the final count.
  3. Promote a waitlisted student when a seat opens — automatically, or by hand.
- **Data Displayed/Modified:** Writes to `enrollment_requests`, `enrollments`, `waitlists`, `enrollment_rule_runs` (for auto-promotions).
- **Validation & Feedback:**
  - **A denial requires a reason, and the student sees it.** Deny opens a required, bounded-select-plus-optional-note dialog (reasons: _course full_, _prerequisites not met_, _duplicate request_, _not eligible for this cohort_, _other — add a note_). A denial with no reason is not submittable: the confirm button is disabled with `aria-describedby` "Choose a reason — the student sees this." The reason is delivered with the outcome, not filed silently. This is the single largest trust failure the Revision 1 flow had: a student denied for no stated reason had no way to act.
  - **Bulk-approve confirms the final count after every exclusion.** Exclusions are computed before the dialog opens — already enrolled, course unpublished, cohort archived, consent withdrawn — and the dialog names each: _"Approve 2 requests? 2 will be enrolled. 1 skipped: Daniel W. is already enrolled in TOEFL Complete."_ The count in the dialog is the count that will actually happen, not the number of ticked rows.
  - **Auto-promotion from the waitlist is first-come, first-served, on seat release.** When an enrollment is cancelled, refunded, or expired, the waitlist head is promoted automatically within **60 seconds** and both the student and the staff member who owns the waitlist are notified. A seat is never held open for a manual decision unless the workspace has turned auto-promotion **off** for that cohort, in which case the waitlist is badged **Manual** and names the owner. The policy is stated in the UI — _"When a seat opens, the first student on the waitlist is admitted automatically"_ — because a silent policy is indistinguishable from a broken one.
  - **Bulk actions above 25 students** require [S-7.1](09-Shared-Components.md#scr-7-1) with the final count; above 100 the 10-second countdown with Cancel applies ([S-8.1](10-Marketing-and-Growth.md#scr-8-1)).
- **States:**
  - **Empty:** [S-7.3](09-Shared-Components.md#scr-7-3) — "No pending requests." Only when there genuinely are none; a filtered empty is the zero-result state below.
  - **Zero-result:** "No requests match your filters." + **Clear filters**.
  - **Loading:** Skeleton rows; the header, filters, and bulk bar stay mounted.
  - **Approving:** The row transitions optimistically and removes from the list on success, with a timed **Undo** on a reversible action.
  - **Denying:** the required-reason dialog above.
  - **Auto-Notify:** outcomes follow [Part 11 Notification Delivery](11-Global-Standards.md#notification-delivery) — **in-app always**, **Telegram by default** where a verified handle is linked, **email only where a verified address exists**. The delivery line is per student and states what happened: _"{name} has no email on file — sent in-app and via Telegram."_ Where **no** channel is reachable, the outcome is still recorded and the row reads _"Approved · not delivered — no verified contact"_, linking to **Send an enrollment link**. An undelivered approval is never reported as a failed approval.
  - **Capacity race:** the honest outcome when a seat is contested — _"3 students were approved for the last seat. 1 was admitted, 2 moved to the waitlist."_ The dialog names each student and their new position, and the 2 moved students are notified with their **position**, not just a rejection. The race is resolved **server-side** in one transaction; the client never decides who won.
  - **Course full:** Approve is **disabled with a reason** — _"IELTS Advanced is full (24/24). Approve anyway to add to the waitlist?"_ — which is the case-2 rule: the control is present, the state is explained, and the alternative is offered.
  - **Error:** "We couldn't load the requests — nothing you did was lost." + Retry + a request ID.
- **Resilience:**
  - **403:** _"You don't have access to these enrollment requests."_ with a request ID and **Ask an Admin for access**. Support sees the queue read-only via `students.read`; the Approve/Deny controls are **absent** for them, not disabled.
  - **404:** _"This course was deleted, or you followed an old link."_ + **Back to Enrollment Requests** + a request ID. A request for an unpublished course renders **withheld**, not 404 — the request still exists.
  - **Offline:** Persistent banner; the queue renders read-only from cache. Approve and Deny are disabled-with-a-reason (_"Reconnect to change enrollments."_) — an enrollment is not something to queue optimistically.
  - **Reconnected:** A seat that opened while offline is reconciled on reconnect and any resulting auto-promotion is reported, not applied silently.
  - **Session expired:** The 2-minute warning names this screen and any open deny dialog with an unsent reason; on return the dialog is restored with the reason intact.
  - **Conflict:** Two staff approving the same request → the second gets _"This request was already approved by {actor} {N} minutes ago."_ with a link to the student, never a duplicate enrollment. Two staff denying it → _"Already denied by {actor}"_. A seat freed and refilled mid-dialog resolves to the **capacity-race** state.
  - **Partial failure:** _"Approved 3 of 5. Sara B. is already enrolled; Daniel W.'s course is full."_ Each failed row names its reason and links onward. Never one blanket toast.
  - **Server error:** Retry + a request ID, in the product's voice.
- **Keyboard & Focus:**
  - The queue is a [S-7.12 DataTable](09-Shared-Components.md#scr-7-12) with `role="grid"`, 25-row pages, and `aria-sort` on Requested. `↑`/`↓` move rows, `Enter` opens the request, `Space` selects, and the bulk bar takes focus on first selection.
  - The **deny reason** is a `role="radiogroup"` plus a textarea; `←`/`→` move between reasons, `Tab` reaches the note, and the confirm button is disabled with the reason in `aria-describedby` until a reason is chosen.
  - An auto-promotion arriving while the screen is open is announced politely with the position: _"Tigist M. was admitted to IELTS Advanced from the waitlist."_
- **Instrumentation & acceptance:**
  - **Events:** `enrollment_request_approved` `{requestId, courseId, outcome: enrolled|waitlisted, deliveredChannels[]}` · `enrollment_request_denied` `{requestId, reasonCode}` · `enrollment_bulk_approve` `{selectedCount, enrolledCount, excludedCount, capacityRaceCount}` · `waitlist_auto_promoted` `{courseId, position, secondsToPromotion}` · `enrollment_delivery_failed` `{reason}`. **No student names, handles, or addresses.**
  - **Acceptance:**
    1. Deny cannot be submitted without a reason, and that reason is delivered to the student with the outcome.
    2. The bulk-approve confirmation states the count that will actually happen and names each excluded student with their reason.
    3. A seat opening promotes the waitlist head automatically within 60 seconds and notifies both the student and the owner.
    4. A contested last seat produces the **capacity-race** message naming how many were admitted and how many moved, with the moved students' positions.
    5. A student with no verified channel is recorded as approved and reported **not delivered**, with a link to send an enrollment link.
    6. Two staff acting on one request produce a named "already approved by {actor}" message, never a duplicate enrollment.
- **Navigation:**
  - "Approve" → the student appears in [S-4.1](#scr-4-1) Student Directory
  - Student name → [S-4.2](#scr-4-2) Student Profile
  - "Deny…" → required-reason dialog → delivery to the student
  - Waitlist "Promote" → the student appears in [S-4.1](#scr-4-1) with the cohort filter applied
  - "Send an enrollment link" → [S-4.1](#scr-4-1) Add Student dialog

<a id="scr-4-7"></a>

##### Screen Name: S-4.7 Badges & Achievements 🔄 CHANGED

- **Purpose:** Create and manage gamification badges that reward student milestones — first lesson completed, 7-day streak, perfect quiz score — with automatic triggers, manual awards, and in-app/Telegram notifications. Badge awards surface on the student's [S-4.3](#scr-4-3) Progress Dashboard.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Badges & Achievements"        [Create Badge]  Last eval │
  │                                            Sep 29, 6:00 PM EAT    │
  ├──────────────────────────────────────────────────────────────────┤
  │ Badge Grid:                                                      │
  │ +------------+ +------------+ +------------+ +----------------+  │
  │ │ First Steps| │ 7-Day      | | Perfect    | | Course         |  │
  │ │            | | Streak     | | Score      | | Complete       |  │
  │ │ Trigger:   | | Trigger:   | | Trigger:   | | Trigger:       |  │
  │ │ 1st lesson | │ 7 consec.  | | 100% quiz  | | any course     |  │
  │ │ done       | │ days, any  | | score      | | completed      |  │
  │ │            | │ activity   | |            | |                |  │
  │ │ Scope: All | │ Scope: All | │ Scope: All | | Scope: All     |  │
  │ │ Active ✔   | │ Active ✔   | │ Active ✔   | │ Paused ‖       │  │
  │ +------------+ +------------+ +------------+ +----------------+  │
  ├──────────────────────────────────────────────────────────────────┤
  │ Badge Editor (modal):                                            │
  │ Name: [First Steps]                                             │
  │ Icon: [hugeicons picker ▾ — one outline family, no emoji]       │
  │ Description: [Completed your first lesson — the journey begins!]│
  │ Trigger: (● First lesson completed  ○ Streak ≥ [7] days          │
  │           ○ Quiz score = 100%  ○ Course completed                │
  │           ○ Manual award)                                        │
  │ Streak window: "7 consecutive days with any lesson activity,      │
  │                 measured in the student's own timezone"           │
  │ Scope: (● All courses  ○ Course [▾])                             │
  │ Notify student: ☑ in-app ☑ Telegram  ☐ email                    │
  │      (email disabled with reason: "No verified email on file")   │
  │ [Dry run] → "1,842 students match — awarded on the next          │
  │               evaluation, nightly at 6:00 PM EAT"                │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Create a badge with icon, name, description, and an automatic trigger (first lesson completed, streak ≥ N days, quiz score = 100%, course completed) or manual awarding.
  2. Edit, **pause**, **revoke**, or archive badges.
  3. Manually award a badge to one student or a filtered selection (e.g., a whole cohort).
  4. Inspect the award history: who earned what, when, and via which trigger.
- **Icons:** badge glyphs come from the **hugeicons** set on the 20px grid, 1.5px stroke — the same single family as the rest of the product. **Emoji are not UI icons** ([Part 11](11-Global-Standards.md#localization--formatting)); the medal/trophy/percent glyphs in Revision 1 were decorative raster glyphs at inconsistent weights and were unreadable at 16px. A badge may carry **one** glyph; the name always carries the meaning, and the pill carries a label and an icon, never colour alone.
- **Trigger definitions:**
  | Trigger                | Fires when                                                                                                                                                                                                                                                                                                                                                               |
  | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | First lesson completed | `lesson_progress.status = 'completed'` for any item, once per student.                                                                                                                                                                                                                                                                                                   |
  | **Streak ≥ N days**    | **N consecutive calendar days with any lesson activity, measured in the student's own timezone**, not the workspace's. A day counts on any activity ≥ 1 minute; a day with no activity breaks the streak, it does not pause it. Midnight is the student's midnight, so a student in Addis and one in Los Angeles are not penalised differently for the same UTC instant. |
  | Quiz score = 100%      | Any `quiz_attempts` submission scoring full marks, once per quiz.                                                                                                                                                                                                                                                                                                        |
  | Course completed       | All published items in a course reach `completed` and the completion rule is satisfied.                                                                                                                                                                                                                                                                                  |
  | Manual award           | A staff member awards it.                                                                                                                                                                                                                                                                                                                                                |
  - **Scope** is required on every badge: **Global** (any course) or **Per-course** (one chosen course). A streak or completion badge scoped to a course only fires for that course, and the scope is shown on the card. Without a scope, a "First Steps" badge awarded for a course the student later left is ambiguous.
- **Data Displayed/Modified:** Writes `badges`, `awarded_badges`, `badge_evaluation_runs`; triggers evaluate on progress events (`lesson_progress`, `quiz_attempts`, streaks) and on a **nightly sweep**.
- **Validation & Feedback:**
  - Badge names unique per workspace; **one trigger per badge** (combine behaviours by awarding multiple badges) — stated as helper text on the trigger picker.
  - The streak definition is fixed by platform policy and shown verbatim under the field, because "7-day streak" configured wrongly is a badge that never fires.
- **States:**
  - **Empty:** "No badges yet. Create one to reward a milestone." with **Create badge** as the single CTA. **Zero-result:** a filter or search excluded badges → "No matches — adjust filters" with **Clear filters**, never a creation CTA.
  - **Default:** Badge grid sorted by total awards; `Active ✔ / Paused ‖ / Archived 🗄` pills, each a [fill/text/tint triple](11-Global-Standards.md#status-colour-mapping) with a label and an icon.
  - **Creating / Editing:** the **dry run** is the feedback, and it says _when_, not only _who_: _"1,842 students currently match this trigger — they will be awarded on the next evaluation."_ Evaluation runs **nightly at 6:00 PM EAT** (the workspace timezone, stated with the time format), so the match count is a forecast, not a schedule of immediate awards. A **Run now** action exists for staff who cannot wait, and it is labelled as a full evaluation, not a shortcut.
  - **Evaluating:** a sweep in progress shows a progress state; awards appear in the history as they are granted, and each student is notified.
  - **Paused:** pausing **stops new awards without revoking existing ones**. A paused badge's card states the count already awarded: _"Paused · 1,204 already awarded. Those awards stay."_ (Retained from Revision 1.)
  - **Revoked:** distinct from **Archived**. **Archived** means the badge is no longer configured but its history is retained and existing awards remain visible on student profiles. **Revoked** means the badge was **wrongly awarded or was granted in error** and the award is withdrawn: the student's award is removed from [S-4.3](#scr-4-3), the student is **notified**, and the revocation is written to [S-6.8](08-Settings.md#scr-6-8) with the actor and reason. Revocation is a destructive action and is [S-7.1](09-Shared-Components.md#scr-7-1)-confirmed with the affected count: _"Revoke First Steps? This will remove the badge from 1,842 students and notify each of them."_ There is no "revoke the badge definition" action — that is Archive.
  - **Manual Award:** Student picker with search ([S-4.1](#scr-4-1) filters reusable) + optional note; batch award requires [S-7.1](09-Shared-Components.md#scr-7-1) confirmation above 25 students, showing the final count after exclusions.
  - **Awarded:** Toast on manual award; automatic awards fire a student notification in-app and via Telegram per [Part 11 Notification Delivery](11-Global-Standards.md#notification-delivery), and appear in [S-1.4](03-Dashboard.md#scr-1-4) for staff only when manually granted.
  - **Delivery failures:** surfaced per student — _"{name} has no email on file — sent in-app and via Telegram."_ The email checkbox is **disabled with the reason "No verified email on this account"** for a student with no verified address, never hidden.
  - **Error:** "We couldn't load your badges — nothing you did was lost." + Retry + a request ID.
- **Resilience:**
  - **403:** _"You don't have access to these badges."_ with a request ID and **Ask an Admin for access**. Reviewer and Viewer have **no** access — the navigation item is absent, and a direct link is a 403. Support has view-only via `students.read`; Create/Edit/Award/Revoke are **absent** for them.
  - **404:** _"This badge was deleted, or you followed an old link."_ + **Back to Badges** + a request ID. An **archived** badge is a 200 with an `Archived 🗄` pill, never a 404.
  - **Offline:** Persistent banner; the grid renders read-only from cache. Create, pause, award, and revoke are disabled-with-a-reason (_"Reconnect to manage badges."_) — a badge award is not something to fire optimistically and hope for.
  - **Reconnected:** A queued dry run refreshes; a stale `badge.updated_at` on save resolves to Conflict.
  - **Session expired:** The 2-minute warning names an open badge editor with unsaved trigger configuration; on return the editor is restored with its dry-run count re-fetched, not a stale forecast.
  - **Conflict:** Two staff editing the same badge — common when a designer and an academic lead both adjust a trigger → _"Changed by {actor} {N} minutes ago."_ with **Review changes / Keep mine / Take theirs** on the changed fields. A **manual award to a student who was just awarded the same badge by the nightly sweep** reports _"Tigist M. already has First Steps (awarded by the nightly evaluation at 6:00 PM EAT)"_ rather than double-awarding.
  - **Partial failure:** A batch award reports per-student: _"Awarded to 22 of 24. Sara B. and Daniel W. were archived during the run."_ Retry failures only.
  - **Server error:** Retry + a request ID, in the product's voice.
- **Keyboard & Focus:**
  - The grid is a `role="list"`; each badge card is one Tab stop, opening the editor with `Enter`, with the pause/revoke/archive controls reachable inside the card.
  - The icon picker is a searchable `role="listbox"` with type-ahead over icon names; the selected icon's name is announced and every badge also has a typed `aria-label` (_"Badge: First Steps"_), so the glyph is never the only label.
  - The trigger `radiogroup` uses arrow keys; **the streak window helper text is associated via `aria-describedby`**, so a screen-reader user hears the timezone rule before choosing a number.
  - The dry-run result is a polite live region; the evaluation progress indicator is polite, and a failure is assertive.
  - Revoke is a `role="alertdialog"` with the affected count read on open and focus on the confirm control.
- **Navigation:**
  - Opened from [S-A.1](02-Global-Navigation.md#scr-a-1) Students group
  - Student name in Award History → [S-4.2](#scr-4-2) Student Profile
  - Badge icons also render on [S-4.3](#scr-4-3) Student Progress Dashboard
  - "Run now" → the evaluation progress state, then refreshed award history
- **Instrumentation & acceptance:**
  - **Events:** `badge_created` `{triggerType, scope}` · `badge_dry_run` `{matchCount}` · `badge_evaluation_run` `{durationMs, awardedCount, triggerType}` · `badge_awarded` `{source: manual|trigger, scope}` · `badge_paused` / `badge_archived` / `badge_revoked` `{awardedCount}` · `badge_delivery_failed` `{reason}`. **No student names, no note text.**
  - **Acceptance:**
    1. No badge glyph in the grid or the picker is an emoji; all come from the single hugeicons family on the 20px grid.
    2. The dry run states **when** the 1,842 matching students are awarded (the next nightly evaluation, with its time), not only how many match.
    3. **Paused** stops new awards and retains existing ones, and the card states how many were already awarded.
    4. **Revoked** removes the award from the student, notifies the student, and writes one audit-log row; it is distinct from **Archived**, which retains history.
    5. The email notification control is disabled with the reason "No verified email on this account" for a student with no verified address, and is not hidden.
    6. The streak rule states the student's-own-timezone basis in text, and the helper text is reachable by keyboard and by screen reader.
    7. A student already auto-awarded the badge during the nightly sweep is not double-awarded by a manual award; the row says who awarded it and when.

<a id="scr-4-8"></a>

##### Screen Name: S-4.8 Automated Enrollment Rules 🔄 CHANGED

- **Purpose:** Rule engine that auto-enrolls students in courses based on criteria — prerequisite course completion, tags, or cohort assignment — replacing repetitive manual enrollment with auditable, previewable automation.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Automated Enrollment Rules"   [+ New Rule] [Run now ⚙️]  │
  │ Last sweep: Sep 29, 6:00 PM EAT (Africa/Addis_Ababa) · 34 enrolled│
  ├──────────────────────────────────────────────────────────────────┤
  │ | Rule name        | Trigger            | Enrolls into | State     │
  │ | TOEFL→IELTS path | TOEFL Complete     | IELTS Adv.   | On ✔      │
  │ | Corporate cohort | Tag = "acme-2026"  | Workplace ES | On ✔      │
  │ | Alumni refresher | Course completed + | Grammar Adv. | Paused ‖  │
  │ |                  | 90 days idle       |              |           │
  ├──────────────────────────────────────────────────────────────────┤
  │ Rule Builder (WHEN / AND / THEN):                                │
  │ WHEN  (● student completes [TOEFL Complete ▾]                   │
  │        ○ tag added [▾]   ○ assigned to cohort [▾]               │
  │        ○ account created)                                        │
  │ AND   [condition ▾]  [+ Add condition]                           │
  │ THEN  enroll in [IELTS Advanced ▾]                               │
  │       ☑ Send welcome message (template: Welcome — [S-8.2])      │
  │                                                                  │
  │ Cycle check:  A → B → A   ✖ Cannot save                          │
  │   [diagram] A[TOEFL Complete] → B[IELTS Advanced] → A[TOEFL…]   │
  │   "This rule would re-enrol students forever. Remove the loop."  │
  │                                                                  │
  │ [Dry Run: "Would enroll 34 students → Preview list"]             │
  │ [Save & Activate]   Last run: 34 enrolled · 2 already in        │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Build a rule: pick a WHEN trigger (course completed, tag added, cohort assigned, account created), optional AND conditions, and a THEN target course.
  2. Dry-run the rule to preview exactly which students would be enrolled before activating.
  3. Pause, edit, duplicate, or delete rules; inspect each run's result log.
  4. Optionally attach a **welcome message** from the campaign templates ([S-8.2](10-Marketing-and-Growth.md#scr-8-2)), delivered per [Part 11 Notification Delivery](11-Global-Standards.md#notification-delivery) — in-app always, Telegram by default, email only where verified.
  5. **Run now** — trigger the sweep immediately instead of waiting for the schedule.
- **Data Displayed/Modified:** Writes `enrollment_rules`, `enrollment_rule_runs`; creates rows in `enrollments` exactly as manual enrollment does (fully auditable in [S-6.8](08-Settings.md#scr-6-8)).
- **Validation & Feedback:**
  - **Cycle detection, not just self-enrollment.** Revision 1 blocked only a rule targeting its own trigger course. A rule must not create a **loop** through any chain of rules, and the graph is checked at **save time**, not only at activation. `A → B → A` (and any longer cycle: A→B→C→A) is **rejected with the cycle drawn** — the offending path is rendered as a small graph with the loop highlighted, and the message names the rule that closes it: _"This rule would re-enroll students forever. Remove the loop, or exclude students already enrolled in TOEFL Complete."_ **Save is blocked** while a cycle exists; a rule that forms a cycle when another rule is later added is flagged on **both** rules and is not activated until resolved, with the other rule's author notified.
  - **The nightly sweep runs in a stated timezone and says so in the UI:** `Africa/Addis_Ababa` (the workspace timezone, configurable), nightly, with the offset visible. A **Last sweep** timestamp is displayed at all times — _"Last sweep: Sep 29, 6:00 PM EAT (Africa/Addis_Ababa) · 34 enrolled"_ — because "the rules didn't run" and "the rules ran and found nobody" must be distinguishable at a glance. **Run now** sits beside it, states that it runs every rule, and requires [S-7.1](09-Shared-Components.md#scr-7-1) confirmation with the projected count from the last dry run.
  - A rule cannot target its own trigger course (retained; this is the degenerate 1-cycle case).
  - Capacity limits are respected: rules stop enrolling into a full cohort and log _"capacity reached"_ instead of overfilling — and the affected students are **moved to the waitlist** with the auto-promotion policy in [S-4.6](#scr-4-6), not dropped.
  - Rule edits apply **prospectively**; past enrollments are never reversed by editing a rule.
- **States:**
  - **Loading:** skeleton rows; the rule count resolves before the table paints.
  - **Empty:** "No rules yet. A rule can enroll students automatically when they finish a course." with **New rule** as the single CTA. **Zero-result:** "No rules match this filter — clear it to see all {total}."
  - **Draft:** Rule saved but not evaluating; activation is explicit.
  - **Dry Run Preview:** List of matched students with an "Enroll 34" confirmation; students already enrolled are listed as _"will skip (already enrolled)"_.
  - **On / Paused / Error** pills, each a [fill/text/tint triple](11-Global-Standards.md#status-colour-mapping) with a label and an icon.
  - **Running:** Fires in real time on trigger events; the nightly sweep catches misses (e.g., retroactive tag imports). Progress is visible and the run is cancellable before it commits.
  - **Review lock:** a rule whose trigger fires **during a course's review lock** does not silently mutate a course under review. The run **holds** the matched students, marks them **Deferred — course in review**, and queues them for the next sweep once the lock clears. A manual override is available to an Admin with [S-7.1](09-Shared-Components.md#scr-7-1) confirmation: _"TOEFL Complete is in review. Enrolling 12 students now publishes them into a course that is not approved. Enqueue instead?"_ The lock is a case-2 state: the control is present and explained, not removed.
  - **Conflict:** granting paid access requires [S-7.1](09-Shared-Components.md#scr-7-1): _"This will grant paid access at no charge."_
  - **Run Log:** Per run: matched, enrolled, skipped, deferred, failed — with reasons, and exportable via [S-5.4](07-Analytics.md#scr-5-4). The log is the only place a rule's behaviour is explained, so a failed enrollment is always attributable to a rule and a run.
  - **Cycle detected:** Save is blocked, the cycle is drawn, and the responsible rule is named (above).
  - **Error:** "We couldn't run your rules — nothing you did was lost." + Retry + a request ID, and the Last sweep timestamp is **not** advanced on a failed run, so a stale sweep is visible.
- **Resilience:**
  - **403:** _"You don't have access to these rules."_ with a request ID and **Ask an Admin for access**. Reviewer, Viewer, and Support have no authoring access: the nav item is absent and a direct link is a 403. Support may view rules read-only via `audit.read_own_actions` for the runs it triggered.
  - **404:** _"This rule was deleted, or you followed an old link."_ + **Back to Enrollment Rules** + a request ID. A rule that has never run is not a 404 — it is Draft.
  - **Offline:** Persistent banner; the rule list renders read-only from cache. **Save, activate, and Run now** are disabled-with-a-reason (_"Reconnect to run enrollment rules."_) — a rule sweep enrolls real students, and firing it from a queued offline action would enrol against stale data.
  - **Reconnected:** a queued **dry run** refreshes; the Last sweep timestamp and the queued-run state reconcile, and a run that was in flight is reported as completed or failed, never assumed.
  - **Session expired:** The 2-minute warning names an open rule builder and, importantly, an **in-flight sweep**; on return the rule is restored and any completed run is reported.
  - **Conflict:** Two staff editing one rule → _"Changed by {actor} {N} minutes ago."_ with **Review changes / Keep mine / Take theirs** on the changed clauses. A rule edited **while a sweep is running** is resolved by finishing the run against the version it started with and reporting _"This run used the version saved at 5:58 PM EAT."_ — an in-flight sweep is never silently switched mid-flight.
  - **Partial failure:** _"Enrolled 31 of 34. 2 deferred — TOEFL Complete is in review. 1 failed — capacity reached."_ Every category is enumerated, and **deferred** is visibly distinct from **failed** because deferred students are still going to be enrolled.
  - **Server error:** Retry + a request ID, in the product's voice.
- **Keyboard & Focus:**
  - The rule list is a [S-7.12 DataTable](09-Shared-Components.md#scr-7-12) with `role="grid"` and `aria-sort` on Rule name and Last run; `↑`/`↓` move rows and `Enter` opens the builder.
  - The builder is a **WHEN / AND / THEN** form, not a canvas: each clause is a labelled group with `role="radiogroup"` triggers and a reachable condition list, operable entirely by keyboard and readable in order. A drag-and-drop clause builder would be unusable here, so clause **order** is set with **Move up / Move down** controls.
  - The cycle diagram is a labelled `role="img"` with a text alternative listing the loop in reading order (_"TOEFL Complete → IELTS Advanced → TOEFL Complete"_), and the blocking message is a polite live region on save attempt.
  - The dry-run result is a polite live region; a failed run is assertive. The `Last sweep` timestamp is inside a polite region so a background refresh announces itself.
- **Navigation:**
  - Opened from [S-A.1](02-Global-Navigation.md#scr-a-1) Students group
  - "Enrolls into" course → [S-2.18](04-Courses.md#scr-2-18) Course Workspace · Students
  - Cohort trigger → [S-4.4](#scr-4-4) Cohort Management
  - Welcome-message template → [S-8.2](10-Marketing-and-Growth.md#scr-8-2) Template Editor
  - Run log export → [S-5.4](07-Analytics.md#scr-5-4) Export Reports
  - Rule runs → [S-6.8](08-Settings.md#scr-6-8) Security & Audit Log
- **Instrumentation & acceptance:**
  - **Events:** `rule_created` `{triggerType, conditionCount}` · `rule_dry_run` `{matchCount, wouldEnroll, wouldSkip, wouldDefer}` · `rule_saved` `{hasCycle}` · `rule_cycle_rejected` `{cycleLength, offendingRuleId}` · `rule_sweep_run` `{trigger: nightly|manual, enrolled, skipped, deferred, failed, durationMs}` · `rule_deferred` `{reason: review_lock|capacity}`. **No student names, no tag values from a student record.**
  - **Acceptance:**
    1. A rule forming a cycle `A → B → A` cannot be saved, and the cycle is drawn with the closing rule named.
    2. A rule that would create a cycle only because a **second** rule was added is flagged on both rules and is not activated.
    3. The **Last sweep** timestamp is displayed with its timezone and the [Part 11 time format](11-Global-Standards.md#localization--formatting), and is **not** advanced on a failed run.
    4. A trigger firing during a course's review lock **defers** the students, labels them **Deferred — course in review**, and enqueues them for the next sweep; deferred is reported separately from failed.
    5. A run reports matched, enrolled, skipped, deferred, and failed with reasons for every non-enrolled student.
    6. A rule edited mid-sweep is not silently applied to the in-flight run; the run states which version it used.
    7. The builder is completable by keyboard alone, with no drag gesture required.
