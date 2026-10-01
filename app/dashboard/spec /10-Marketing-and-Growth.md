# Section 8: Marketing & Growth

> **Abugida Academy — UX Design Specification** · Part 10 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Shared Components](09-Shared-Components.md) · [Global Standards →](11-Global-Standards.md)

Screens for attracting, converting, and retaining students: campaigns with per-channel delivery metrics, reusable message templates, discount and coupon codes, the affiliate program, and student testimonials for course landing pages. Revenue-sensitive surfaces (coupons, affiliate payouts) are restricted per the [Roles & Permissions Matrix](11-Global-Standards.md#roles--permissions-matrix), and bulk messaging always routes through [S-7.1](09-Shared-Components.md#scr-7-1)-grade confirmations and consent-aware audiences.

> **Naming.** Screen IDs are stable and never reused, so **S-8.1 Email Campaigns** and **S-8.2 Email Template Editor** keep their IDs while their behaviour stops assuming an address. They are referred to as **Campaigns** and **Template Editor** below. This is a clarification, not a rename: the sitemap's screen IDs are unchanged.

## What changed in Part 10 (Revision 3)

- **The module stops assuming an email address exists.** Sign-in is Google or Telegram only, so a Telegram-authenticated Editor may have **no address at all** — and `{{first_name}}` is unsafe for a single-name Ge'ez user. A campaign now targets a **segment**, and each recipient is reached on **the channels they have**: in-app always, Telegram when linked, email when verified. The composer shows the split: _"1,204 recipients — 1,204 in-app · 1,180 Telegram · 610 email (594 have no email)."_
- **`{{first_name}}` is deprecated in favour of `{{display_name}}`.** Existing templates keep rendering — a first name is used when the student has one — but the composer warns, and a template that renders an empty greeting is flagged at save. **`3 students in this segment have no first name — the greeting will use their display name.`**
- **Send Test reports which channels it actually reached:** _"Test sent — in-app ✓, Telegram ✓ (@yourhandle), email not available on your account."_ The Revision 1 toast, _"Test email sent to jane@abugida.com"_, assumed an address on the sender and had no alternative.
- **There is now a send-failure path**, the highest-consequence gap in the file: `Sending` with live progress and a **Cancel** that stops new sends and lets in-flight ones finish, a **Partial failure** with a per-reason breakdown and **Retry failed only**, and a `Failed` state with a request ID. **A send is not resumable after a full failure** and requires a new send with an explicit confirm.
- **Bulk-send safety is layered:** a **10-second send delay with a visible countdown and Cancel** above 100 recipients, a **per-recipient preview** of the final resolved message, and a confirmation showing the **exact final count after all exclusions**.
- **Coupons gain a `Currency` field** (ETB and USD, code always visible), **stacking rules with stated consequences** for both the on and off cases, **revoke distinguished from deactivate**, and a **per-code redemption list** so a leaked code is actionable. A 100% code on a paid course still confirms, and now names its audit entry.
- **Affiliate payouts** gain **Telebirr** alongside USD and bank transfer, a stated **payout currency**, and **reconciliation**, **partial payout**, and **Payout failed / returned** states. A refund issued _after_ a payout has run cannot claw back cash already sent — the policy is now stated.
- **Testimonials** gain an **opt-out** the student can see, a **rate limit** of one automatic request per student per 90 days, a **Ge'ez-language** moderation path with re-review in the student's own language, and a concrete definition of a **typo fix** — a heavier edit re-confirms with the student and holds the testimonial in Pending until they answer.
- **All five screens ship `Resilience`, `Keyboard & Focus` where interactive, and `Instrumentation & acceptance`**, per [Part 11](11-Global-Standards.md#resilience-states).

<a id="scr-8-1"></a>

##### Screen Name: S-8.1 Email Campaigns 🔄 CHANGED

- **Purpose:** Plan, send, and measure announcement, reminder, and promotion campaigns to student segments, with delivery, open, and click metrics per channel. A campaign targets a **segment**; each recipient is reached on the channels they actually have.
- **User Role(s):** Admin, Editor (Support: view only, no send)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Campaigns"                      [+ New Campaign] [Filter]│
  ├──────────────────────────────────────────────────────────────────┤
  │ | Campaign         | Audience     | Status   | Sent | Open |Click │
  │ | Sept. TOEFL push | All students | Sent ✔   |1,204 | 54% | 12%  │
  │ | Reminder: M2 due | TOEFL Jan    | Sent ✔   |   24 | 71% | 33%  │
  │ | Black Friday     | Newsletter   | Sched 📅 |   —  |  —  |  —   │
  ├──────────────────────────────────────────────────────────────────┤
  │ Campaign detail:                                                 │
  │ Delivered 1,180 → Opened 650 (54%) → Clicked 145 (12%) → Enrol 18│
  │ Link clicks: [View syllabus · 88]  [Enroll now · 57]            │
  │                                                                  │
  │ Compose:  Template [Announcement ▾]   Audience [Segment ▾]       │
  │ 1,204 recipients — 1,204 in-app · 1,180 Telegram · 610 email    │
  │                (594 have no email)                               │
  │ 3 students in this segment have no first name — the greeting     │
  │ will use their display name.                                     │
  │ [Send Test]  [Schedule ▾]  [Send Now]                            │
  ├──────────────────────────────────────────────────────────────────┤
  │ Sending — 742 of 1,180 delivered   [Cancel] (stops new sends)    │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Channel model (the point of this revision):**
  | Channel      | Rule                                                                                                                                                                                      |
  | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | **In-app**   | **Always.** Every campaign is written to each recipient's in-app feed first. It cannot be switched off and is not an alternative channel.                                                 |
  | **Telegram** | When the recipient has a **verified linked handle**. The default secondary leg.                                                                                                           |
  | **Email**    | When the recipient has a **verified** address. Where none exists the leg is simply absent and the count says so — _"610 email (594 have no email)"_ — rather than being silently dropped. |
- **Primary Actions:**
  1. Create a campaign: pick a template ([S-8.2](#scr-8-2)), build the audience segment (cohort, course, tags, activity filters), and send or schedule.
  2. Read the per-campaign funnel: delivered → opened → clicked → enrolled, per channel, plus link-level clicks.
  3. Duplicate a past campaign; cancel a scheduled send before it fires; **cancel an in-flight send**.
  4. **Send Test** to your own verified channels and see which ones were reached.
  5. **Retry failed only** after a partial failure.
- **Data Displayed/Modified:** Writes `campaigns`, `campaign_sends`; reads delivery aggregates (delivered, opened, clicked, attributed enrollments) from the in-app feed, the Telegram relay, and the email service ([S-6.3](08-Settings.md#scr-6-3)).
- **Validation & Feedback:**
  - **The composer states the per-channel breakdown, not a single number.** _"1,204 recipients — 1,204 in-app · 1,180 Telegram · 610 email (594 have no email)."_ This is the [Part 11 bulk-send](11-Global-Standards.md#notification-delivery) rule, applied at composition time, so the reach is known **before** the send rather than discovered in the bounce report.
  - **Audience rule.** A campaign reaches only students with a **consented, reachable channel**. Excluded students and their reasons are shown before send and are counted, not hidden: _"1,204 matched · 43 excluded — 38 unsubscribed, 3 archived, 2 no consented channel."_ Marketing consent is the one exclusion that is legally required to be visible; the consent log itself lives in [S-6.10](08-Settings.md#scr-6-10) and this screen links to it. In-app delivery of a **transactional** message is separate and does not require marketing consent.
  - **Merge tags.** `{{display_name}}` is the default tag and the only one guaranteed to render: it is a single un-split name, valid in any script. **`{{first_name}}` is deprecated** — it is unsafe for a one-word Ge'ez name, a single-token patronymic, and a name with no given/family split at all. It still renders where a first name exists, so existing templates do not break, but the composer flags it and a save with a first-name tag prompts: _"{{first_name}} is deprecated and will be empty for some students. Use {{display_name}}?"_ A **missing-value** state is explicit: _"3 students in this segment have no first name — the greeting will use their display name."_ The composer never renders an empty greeting silently.
  - **Per-recipient preview.** Before sending, the resolved final message can be previewed **against a real student**: a picker of named test recipients from the segment, rendering the message exactly as that student will receive it — their name, their locale, their language, and the channels it will go to. This is a **consent-safe** preview: it uses a real record in-app for the sender only, sends nothing, and the data does not leave the workspace. Combined with **Preview against a real student** it replaces the Revision 1 static sample-data preview, which could only show a fabricated English student.
  - **Send delay.** Any send above **100** recipients gets a **10-second countdown with a visible timer and a Cancel** action: _"Sending in 10s — Cancel."_ The countdown is a real, labelled, keyboard-reachable control, not a toast. Sends of 100 or fewer send immediately after confirmation.
  - **The confirmation shows the exact final count after all exclusions**, not the number of matched students.
- **States:**
  - **Loading:** skeleton rows while campaigns resolve; the **New campaign** action stays available throughout, because an author waiting on a list is an author who stops working.
  - **Draft / Scheduled / Sending / Sent / Cancelled / Failed** pills, each a [fill/text/tint triple](11-Global-Standards.md#status-colour-mapping) with a label and an icon.
  - **Scheduled** rows show a countdown and the **timezone**, in the [Part 11 time format](11-Global-Standards.md#localization--formatting) (`6:00 PM EAT`) with the offset in a tooltip. A scheduled campaign is cancellable until it fires.
  - **Segment Empty:** _"This audience matches 0 recipients — adjust filters."_ and send is **blocked** — a disabled control with the reason in a tooltip and in `aria-describedby`, not a click that does nothing.
  - **Send delay:** the countdown state above.
  - **Sending — with live progress and Cancel.** Progress is per-delivered recipient (`742 of 1,180 delivered`) with a rate. **Cancel stops _new_ sends and lets in-flight sends finish**; it is not a kill. The state reads _"Cancelling — 12 sends still in flight"_ until it settles, and then resolves into Sent (partial) or Cancelled. A send is never left ambiguous: it always lands in one of the terminal states below.
  - **Partial failure (the Revision 1 gap).** A 1,200-recipient campaign that fails 40% through lands here, with a **per-reason breakdown** and a **Retry failed only** action: _"Delivered 1,180 · bounced 9 · hard-failed 15."_ Expanding gives a per-recipient list with each reason and a **Copy failures**. The campaign is a success, not a failure — 1,180 people got the message, and the 24 who did not are individually addressable.
  - **Failed (total).** _"We couldn't send this campaign. Request ID req_8f2k1."_ + **Retry send** + **Download failures**. **A send is not resumable after a full failure** — resending a campaign that partly went out is how a student gets the same message twice. Recovery requires a **new send** with an explicit confirmation: _"This campaign failed before any delivery. Send again?"_; if any delivery succeeded, the only offered path is **Send to failures only**, which is a new campaign record linked to the original, never a replay.
  - **Delivery failures per recipient:** surfaced in the breakdown, never in a summary that implies universal success.
  - **Metrics Lag:** sent campaigns show "metrics updating" for the first hour; **Telegram and in-app legs report delivery, not opens** — a message delivered in-app is _seen_ only if the student opens the app, and an "open rate" for a channel that cannot report one would be a fabricated number. The funnel states which legs report which metric: _"Telegram: delivered 1,180, read 0 — the relay reports delivery only."_
  - **Error:** "We couldn't load your campaigns — nothing you did was lost." + Retry + a request ID.
- **Resilience:**
  - **403:** _"You don't have access to campaign financials."_ for Support on revenue-linked fields, with a request ID and **Ask an Admin for access**; Support sees the list read-only via `students.read` and the **Send Now / Schedule** controls are **absent** for them, not disabled — they have no send capability. Revenue figures are **redacted server-side**, so Support's payload never carries them.
  - **404:** _"This campaign was deleted, or you followed an old link."_ + **Back to Campaigns** + a request ID. A campaign whose **template** was deleted still renders with the pinned version it used — templates are versioned and a campaign pins the version, so a deleted template never 404s a sent campaign.
  - **Offline:** Persistent banner; the campaign list renders read-only from cache with the last known statuses. **Send Now, Schedule, and Send Test** are disabled-with-a-reason (_"Reconnect to send campaigns."_) — a queued send would fire against a segment that may have changed.
  - **Reconnected:** A **scheduled** campaign that came due while offline is reported, not fired silently: _"Black Friday was due at 6:00 PM EAT while you were offline. It has not been sent."_ with **Send now** / **Reschedule**. Drafts edited offline reconcile their `rowVersion` through Conflict.
  - **Session expired:** The 2-minute warning names this screen and any **in-flight send** explicitly; on return the user lands on the same campaign and the send's terminal state is shown, not resumed. An expired session never leaves a send in an unknown state.
  - **Conflict:** Two staff editing the same campaign's audience or content → _"Changed by {actor} {N} minutes ago."_ with **Review changes / Keep mine / Take theirs**. A **schedule** conflict — two people setting a send time — is the same pattern and states the other time. **A campaign already Sending cannot be edited**; the surface is replaced with an explanation of what locked it and how to stop it, which is the correct case-3 rendering.
  - **Partial failure:** per-reason breakdown with **Retry failed only**; each retry is itself reported, so a retry that fails 3 of 24 is visible rather than merged into the original.
  - **Server error:** Retry + a request ID. **A 5xx mid-send does not silently retry the whole campaign** — it moves the campaign to `Failed` with the deliveries that succeeded already recorded, so recovery is a targeted retry.
- **Keyboard & Focus:**
  - The list is a [S-7.12 DataTable](09-Shared-Components.md#scr-7-12): `role="grid"`, 25-row pages, `aria-sort`, arrow-key row and cell navigation, `Enter` opens a campaign.
  - **During the send delay, focus moves to the Cancel control** and the countdown is a polite live region that announces each 5-second mark — a keyboard user is not left to discover a timer they cannot see. `Esc` during the delay also cancels.
  - **The send confirmation is a `role="alertdialog"`** with focus on the primary action, reading the final per-channel count and the exclusion count on open; the count is the accessible name of the confirm button, so the action states what it will do.
  - The segment builder is a form: labelled controls, `role="radiogroup"` for filter types, and a running result count in a polite live region as each filter is added.
  - **Preview against a real student** is a dialog with a focus trap and a `combobox` for the recipient; the rendered preview is a labelled region so its content is reachable, and the channel badges are announced in text.
  - A failed send announces assertively with its request ID; partial progress and metric lag announce politely.
- **Instrumentation & acceptance:**
  - **Events:** `campaign_composed` `{templateId, templateVersion, segmentId, recipientCount, channelCounts{inApp, telegram, email}, excludedCount}` · `campaign_test_sent` `{channels[], failedChannels[]}` · `campaign_scheduled` `{at, recipientCount}` · `campaign_send_started` `{recipientCount}` · `campaign_send_progress` `{delivered, failed}` (throttled) · `campaign_send_cancelled` `{atDelivered, inFlightAtCancel}` · `campaign_send_completed` `{delivered, bounced, hardFailed, durationMs}` · `campaign_retry_failed_only` `{attempted, succeeded}` · `campaign_excluded` `{reasonCounts}`. **No message content, no student names, no addresses in any event property.**
  - **Acceptance:**
    1. The composer shows the per-channel breakdown and the exclusion count with reasons **before** send, and the confirmation's count equals the number that will actually be delivered to.
    2. A send above 100 recipients shows a 10-second countdown with a working **Cancel**, and cancelling stops new sends while in-flight sends finish; the campaign always reaches a terminal state.
    3. A partial failure reports delivered / bounced / hard-failed counts separately and offers **Retry failed only**; a retry that partly fails is reported again rather than merged.
    4. A total failure offers no silent replay: the only route is a new, explicitly confirmed send, or **Send to failures only** as a linked new campaign.
    5. `{{display_name}}` renders for every recipient; `{{first_name}}` is flagged as deprecated, and a segment containing students with no first name raises the stated missing-value warning rather than an empty greeting.
    6. A scheduled campaign that came due while offline is reported as not sent, with Send now / Reschedule.
    7. The metric legend states which channels report opens and which report delivery only; no open rate is shown for a channel that cannot report one.
  - **Budgets:** Segment evaluation < 2 s for 50k students; the per-channel breakdown renders < 400 ms after evaluation; send progress updates at most once per second; the 10-second delay starts only after the confirmation is accepted; a 1,200-recipient in-app send completes within 5 minutes; the failures list virtualises.
- **Navigation:**
  - Opened from [S-A.1](02-Global-Navigation.md#scr-a-1) Marketing group; cohort **Send** actions in [S-4.4](06-Students.md#scr-4-4) deep-link here with a pre-filtered audience
  - "Template" → [S-8.2](#scr-8-2) Template Editor
  - Campaign row → detail panel (same screen); attributed enrollments → [S-5.1](07-Analytics.md#scr-5-1) Course Performance
  - "Consent log" → [S-6.10](08-Settings.md#scr-6-10) Privacy & Data Retention
  - "Preview against a real student" → [S-4.2](06-Students.md#scr-4-2) Student Profile

<a id="scr-8-2"></a>

##### Screen Name: S-8.2 Email Template Editor 🔄 CHANGED

- **Purpose:** Author and maintain reusable message templates — Welcome, Course Announcement, Lesson Reminder, Promotion, Certificate Issued, Re-engagement — with merge tags, a live preview against a real student, and test sends. Campaigns in [S-8.1](#scr-8-1) and automations in [S-4.8](06-Students.md#scr-4-8) compose from these templates.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Template Editor"          [+ New] [Pre-built media ▾]  │
  │ Editor: "Course Announcement"                                   │
  │ Subject:    [{{course_name}} starts {{start_date}} — save your   │
  │              seat]        Preheader: [Seats are limited…]       │
  │ +----------------------+ +-----------------------------------+  │
  │ | Blocks (drag & drop):| | Preview against: [Tigist M. ▾]    │  │
  │ | [Hero] [Text] [Btn]  | |   {{display_name}} → "Tigist"     │  │
  │ | [Course card]        | | Your course {{course_name}}…      │  │
  │ | [Footer w/ unsub.]   | | Channels: in-app · Telegram ✔    │  │
  │ |                      | |          email — not verified    │  │
  │ +----------------------+ +-----------------------------------+  │
  │ Merge tags: {{display_name}} {{course_name}} {{start_date}}     │
  │             {{progress_url}} {{unsubscribe_url}}                │
  │ ⚠ {{first_name}} is deprecated — empty for 3 students in your  │
  │   Sept. TOEFL push audience.                                    │
  │ [Send Test]  [Save Template]                                    │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Start from a pre-built template or a blank canvas; compose with drag-and-drop blocks (hero, text, button, course card, footer).
  2. Insert merge tags with the picker; **preview against a chosen real student**.
  3. **Send a test to your own verified channels** and see which were reached.
  4. Save — publishing a new version. Templates are versioned; campaigns pin the version they used.
- **Data Displayed/Modified:** Writes `message_templates`, `message_template_versions`; reads student records for preview (read-only, in-workspace, no PII leaves the workspace).
- **Validation & Feedback:**
  - **Send Test reports which channels were reached**, and the Revision 1 toast — _"Test email sent to jane@abugida.com"_ — is gone. It assumed the sender has an address, and a Telegram-authenticated Editor does not. The test goes to the **sender's verified channels** and says so: _"Test sent — in-app ✓, Telegram ✓ (@yourhandle), email not available on your account."_ Where the email leg is unavailable it is shown as **unavailable with the reason**, never as a silent omission and never as a failure.
  - **`{{display_name}}` is the default tag**, valid in any script, one un-split name. **`{{first_name}}` is deprecated**: it renders where a first name exists so existing templates keep working, and the editor flags it with the count of affected students in the audiences that use this template. It is never _required_ by a new template — the picker lists it under **Deprecated** with the one-line reason.
  - **Preview against a real student.** The preview renders the message **for a chosen recipient from the workspace**, in that student's own language and locale, with that student's actual merge values. This replaces static sample data, which could only ever show a fabricated English student with a two-part name. The picker is a search over students (a subset of [S-4.1](06-Students.md#scr-4-1) filters) and the preview is **in-app only** — it sends nothing, and the rendered result is a labelled region so it is screen-reader reachable. Switching recipients announces the new render politely.
  - **Missing values are stated, never rendered blank.** A tag with no value for the chosen recipient renders as a visible inline marker in the editor and a stated line beneath the preview: _"3 students in this segment have no first name — the greeting will use their display name."_ The composer blocks a save whose greeting would render empty for **every** student in the template's audience.
  - **Line length and expansion.** The preview column caps prose at ~75 characters as a **max-width**, and text wraps — Ge'ez at `line-height: 1.6` in the Noto Sans Ethiopic stack, `letter-spacing: normal`, **no fixed-px line clamp** at any viewport ([Part 11](11-Global-Standards.md#localization--formatting)). A 300-character Amharic title and a single-word patronymic both render in full.
  - **Block drag has a keyboard equivalent** — blocks reorder with **Move up / Move down** controls, and a block is insertable from a `+` menu without any drag gesture.
- **States:**
  - **Loading:** skeleton blocks in the editor and in the live preview; the merge-tag picker stays interactive so a template can be written against a still-loading preview.
  - **Default:** Template list with last-updated and usage counts (_"used by 6 campaigns"_), each showing the pinned version used.
  - **Editing:** Autosave drafts on a 60 s idle timer with the [S-7.8](09-Shared-Components.md#scr-7-8) indicator; **Save Template** publishes a new version. The indicator is never a bespoke "Saving…" string.
  - **Deprecated tag used:** the inline warning above, with a one-click **Replace with {{display_name}}** action.
  - **Merge Tag Invalid:** an unknown or broken tag highlights with a suggestion list, and **Save is blocked** with the tag focused — an unrendered tag ships a literal `{{coures_name}}` to 1,204 students.
  - **Missing value:** the inline marker and the stated count.
  - **Test Sent:** the per-channel result line above, never a single-address assertion.
  - **Test Failed:** _"Test sent — in-app ✓, Telegram failed (handle not reachable), email not available."_ with **Retry failed only** and a request ID.
  - **Error:** "We couldn't load this template — nothing you did was lost." + Retry + a request ID.
- **Resilience:**
  - **403:** _"You don't have access to these templates."_ with a request ID and **Ask an Admin for access**. Reviewer, Viewer, and Support have no access; a direct link is a 403.
  - **404:** _"This template was deleted, or you followed an old link."_ + **Back to Template Editor** + a request ID. A **version** of a deleted template still renders read-only from a campaign that pinned it — a sent campaign's content is part of its record.
  - **Offline:** Persistent banner; the editor renders **read-only** from cache with the draft preserved. Editing, saving, and **Send Test** are disabled-with-a-reason (_"Reconnect to save templates."_; _"Reconnect to send a test."_) — a test send is an outbound message and is never queued.
  - **Reconnected:** Queued draft edits flush; a template whose `rowVersion` went stale resolves to Conflict rather than overwriting a colleague's block.
  - **Session expired:** The 2-minute warning names this screen and the unsaved draft explicitly; on return the editor is restored with the block list and the preview's chosen recipient.
  - **Conflict:** Two staff editing one template is normal — a marketing Editor and a course lead both touch the Welcome template. _"Changed by {actor} {N} minutes ago."_ with **Review changes / Keep mine / Take theirs**, and the diff is **block-level**, not a whole-document replace, so non-overlapping block edits merge: _"Merged — {actor} changed the footer block, you changed the hero."_ **Publish** is a distinct, versioned act, so a conflict never silently becomes a new version.
  - **Partial failure:** _"Saved 6 of 7 blocks. The 'Course card' block references {{course_id}}, which isn't set on this template."_ The rest is kept and the offending block is focused.
  - **Server error:** Retry + a request ID, in the product's voice.
- **Keyboard & Focus:**
  - The block list is a `role="list"` with each block focusable and operable: `Enter` edits, `↑`/`↓` via the block's own **Move up / Move down** buttons, `Delete` removes (with confirmation), and `Alt+↑`/`Alt+↓` reorder as the keyboard equivalent of the drag.
  - The block picker is a `+` button opening a menu; every block type is reachable and insertable without a drag gesture.
  - The merge-tag picker is a `combobox`: typing filters, `↑`/`↓` move, `Enter` inserts, `Esc` closes — and the inserted tag is announced in context so the author hears _"{{display_name}} inserted at the start of the greeting block."_
  - **The preview is a labelled region** (`role="region"`, `aria-label="Preview as {recipient}"`) and is a Tab stop; switching recipients announces the re-render politely. The deprecated-tag warning is associated with the block via `aria-describedby`.
  - Publish is a `role="alertdialog"` naming the version being created and the campaigns that will pick it up on their next send.
- **Instrumentation & acceptance:**
  - **Events:** `template_opened` `{templateId, version}` · `template_block_changed` `{blockType, action: add|edit|remove|reorder}` · `template_merge_tag_inserted` `{tag, deprecated}` · `template_previewed` `{studentId}` · `template_test_sent` `{channels[], failedChannels[]}` · `template_published` `{version}` · `template_conflict` `{resolution, blockCount}`. **No message content, no student names, no addresses.**
  - **Acceptance:**
    1. **Send Test** reports each channel's outcome, including _"email not available on your account"_ with the reason, and never asserts a single address.
    2. `{{display_name}}` is the default and only-new-template-safe tag; `{{first_name}}` is listed under Deprecated with a reason and renders where a value exists.
    3. The preview renders a chosen real student in that student's own language and locale, and switches to a **single-word Ge'ez name** without a line clamp at 320px width.
    4. A missing merge value renders a visible inline marker and a stated count, never an empty greeting.
    5. An unknown tag blocks Save with the tag focused.
    6. Every block drag has a **Move up / Move down** equivalent, and a block is insertable from a `+` menu with no drag gesture.
    7. Two staff editing different blocks of one template merge without a prompt; a conflict on the same block offers **Review changes / Keep mine / Take theirs**.
- **Navigation:**
  - Opened from [S-8.1](#scr-8-1) ("Template" links), [S-A.1](02-Global-Navigation.md#scr-a-1) Marketing group, and the welcome-message picker in [S-4.8](06-Students.md#scr-4-8)
  - "Save Template" → publishes a new version and returns to the caller or the template list
  - "Preview against" → the student's [S-4.2](06-Students.md#scr-4-2) profile
  - Test result → [S-8.1](#scr-8-1) for campaign-level sends

<a id="scr-8-3"></a>

##### Screen Name: S-8.3 Discount & Coupon Codes 🔄 CHANGED

- **Purpose:** Generate and manage single-use or multi-use discount codes for specific courses, with currency, usage limits, expiry, stacking rules, revenue attribution, and per-code redemption logs.
- **User Role(s):** Admin, Editor (payout-adjacent settings: Admin)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Discount & Coupon Codes"  [+ Generate Codes] [Filter ▾]  │
  ├──────────────────────────────────────────────────────────────────┤
  │ | Code         | Discount   | Currency | Scope        | Usage  |   │
  │ | TOEFL25      | 25%        | —        | TOEFL Comp.  | 61/∞   |   │
  │ | ACME-a3f8…   | 100%       | —        | Workplace ES | 1 (×8)  |   │
  │ | EARLY10      | 10 off     | ETB      | Any course   | 124/500|   │
  ├──────────────────────────────────────────────────────────────────┤
  │ Generator:                                                       │
  │ Type: (● Percentage ○ Fixed amount ○ 100% access)                │
  │ Value: [25]   Currency: [— n/a ▾]  (ETB · USD — code always shown)│
  │ Scope: [Specific courses ▾]  Limit: (● Multi-use [500]           │
  │        ○ Single-use batch: [500] unique codes → export CSV)      │
  │ Expiry: [2026-10-31]                                             │
  │ ☐ Stackable with course discounts                               │
  │    ON  → 25% code + 10% course sale = 35% off (ETB 1,300 → 910)  │
  │    OFF → only one discount applies; the better one wins          │
  │ [Generate]  Revenue influenced: ETB 4,212.00 (visible per code)   │
  │ Code detail: [TOEFL25] → 61 redemptions · [View redemption list]  │
  │   Sep 28, 6:00 PM EAT  Alemayehu K.  TOEFL Complete  ETB 1,300.00│
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Generate codes: percentage, fixed amount, or full access; set the **currency**, scope, usage limits, and expiry.
  2. Generate single-use batches (e.g., 500 unique codes) and export as CSV for distribution partners.
  3. **Deactivate** or **Reactivate** a code; **revoke** a compromised one with a reason.
  4. Inspect per-code revenue influence and the **redemption list**.
- **Currency:**
  - A **`Currency` field** on every code: **ETB** or **USD**, required for fixed amounts and `— (n/a)` for percentage and 100% codes. A code is bound to **one** currency; the amount is never re-interpreted.
  - Every rendered amount follows [Part 11](11-Global-Standards.md#localization--formatting): `Intl.NumberFormat` with the **currency code always visible** — `ETB 1,300.00`, `USD 25.00` — including where a symbol is available. The bare `$` in the Revision 1 wireframe is gone; a student in Addis and a partner in New York must both be able to read the number.
  - A **fixed-amount code is only valid on courses priced in the same currency.** Selecting USD for an ETB-priced course is rejected with the fix named: _"IELTS Advanced is priced in ETB. A USD code can't apply to it."_ The currency of a course is set in [S-2.20](04-Courses.md#scr-2-20).
  - Revenue influenced renders per code and totals **only in the code's own currency**; a cross-currency total is not summed, because a mixed total without a rate is a fabricated number.
- **Stacking rules (the Revision 1 checkbox had no consequence):**
  - `☐ Stackable with course discounts` now has a **stated outcome for both states**, shown live in the generator, because a checkbox whose meaning is invisible is a pricing bug waiting to happen.
    | State             | Outcome at checkout                                                                                                                                                                                                                                                                                                                                       |
    | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | **Off** (default) | **Only one discount applies, and the customer gets the better one.** A 25% code on a course already at 10% off applies the 25%; the course discount is dropped. The checkout says which was applied and why: _"TOEFL25 applied. Your course discount wasn't applied — codes don't stack."_ The customer is never charged more than the better of the two. |
    | **On**            | **Both apply, and the order is fixed and stated: the code applies to the price after the course discount.** A 25% code on a 10%-off course totals 35% off: `ETB 1,300.00 → ETB 910.00`. The checkout shows the arithmetic as two lines, not one.                                                                                                          |
  - **Stacking never produces a negative price.** A code that would reduce the price below zero floors at `ETB 0.00` and says so: _"TOEFL25 applied — this order is now free."_ It does not create a credit.
  - A 100%-access code is inherently non-stacking and the checkbox is **disabled with a reason**: _"100% access already covers the full price — stacking doesn't apply."_ A control that cannot mean anything is explained, not left clickable.
- **Revoke vs deactivate (distinct, and both needed):**
  | Action         | Effect                                                                                                                                                                                                                                                                                                                                                             |
  | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
  | **Deactivate** | Stops **new** redemptions. Existing redemptions stand — the discount was given and is not clawed back. The code and its history stay visible for reporting. Reversible: **Reactivate** restores it.                                                                                                                                                                |
  | **Revoke**     | Stops new redemptions **and** flags the code as compromised or mis-issued, typically after a leak. Requires a **reason** (leaked publicly, issued in error, wrong audience, superseded) and writes a distinct audit entry. Existing redemptions are **not** reversed — a discount already granted is honoured, and the revocation is recorded as a _future_ block. |
  - Revoke is [S-7.1](09-Shared-Components.md#scr-7-1)-confirmed with its consequence named: _"Revoke TOEFL25? No new redemptions from now on. 61 existing redemptions stand."_ It is the destructive sibling of Deactivate and is separated in the `⋯` menu, after Deactivate.
  - A revoked code is badged **`Revoked`** — distinct from `Deactivated`, `Expired`, and `Exhausted` — with a tooltip giving the reason, actor, and timestamp.
- **Redemption list (so a leaked code is actionable):**
  - Every code has a **per-code redemption list**: who redeemed, when (`6:00 PM EAT`), which course, the order value, the code's currency, and the source (checkout, campaign link, affiliate). This is the evidence base for a revoke decision, and it is what makes _"Revoke because it leaked"_ an informed action rather than a guess.
  - The list is filterable by student, date, and course, and **exportable to CSV** as a [S-5.4](07-Analytics.md#scr-5-4) asynchronous export.
  - It shows **suspicious patterns inline**: velocity (redemptions per hour above the code's own baseline) and geography, surfaced as an advisory, not an automatic block. _"14 redemptions in the last hour, 6× this code's average."_ Refund patterns link to [S-1.2](03-Dashboard.md#scr-1-2) Revenue Analytics.
  - Viewing a redemption list requires `finance`-adjacent capability; a Support user's view is **redacted server-side** — no order values — and the header says so.
- **Data Displayed/Modified:** Writes `coupons`, `coupon_redemptions`; checkout validates codes and attributes revenue in [S-1.2](03-Dashboard.md#scr-1-2) Revenue Analytics. Revoke writes one `coupon_revocations` row with actor, reason, and timestamp.
- **Validation & Feedback:**
  - Code strings are validated at generation: uppercase, `[A-Z0-9-]`, 4–24 characters, unique per workspace. A duplicate is rejected at creation with the existing code named, and an existing code is offered for editing instead.
  - A **fixed amount must be less than the course price** and is validated per scoped course at generation, not at redemption: a code that would exceed every scoped course's price is rejected with the course named.
  - The stacking outcome, the currency constraint, and the free-access impact are all stated **in the generator, before Generate is pressed** — the consequences are visible while the decision is still reversible.
  - Redemption counts are `tabular-nums` and right-aligned, and revenue is [Money](09-Shared-Components.md#scr-7-12) with the currency code always visible.
- **States:**
  - **Loading:** skeleton rows while codes resolve; the generator stays interactive.
  - **Empty:** "No codes yet. Generate a code to track redemptions and revenue." with **Generate Codes** as the single CTA. **Zero-result:** "No codes match this filter." with **Clear filters**.
  - **`Active` / `Expired` / `Deactivated` / `Exhausted` / `Revoked`** pills, each a [fill/text/tint triple](11-Global-Standards.md#status-colour-mapping) with a label and an icon. Exhausted and revoked codes remain visible for reporting.
  - **Batch Generating:** Progress → _"500 codes created"_ with an immediate CSV export link.
  - **Deactivating:** [S-7.1](09-Shared-Components.md#scr-7-1) confirmation if the code has redemptions in the last 24 hours.
  - **Revoking:** the confirmation above, with a **required reason**; the confirm button is disabled with `aria-describedby` "Choose a reason — it is written to the audit log" until one is chosen.
  - **100% on a paid course:** the confirmation is retained because it is a revenue event, and the **audit entry is stated**: _"This grants free access to a paid course. 1 audit-log entry will record your name, the code, the scope, and this confirmation."_ The confirmation names the **projected revenue impact** where the course price is known: _"TOEFL Complete is ETB 1,300.00. Unlimited free access has no revenue ceiling."_ — which is precisely why it is confirmed rather than a checkbox.
  - **Redemption Failure (checkout side):** clear student-facing reasons, each naming the fix: invalid, expired, wrong course, wrong currency (_"This code is USD and this course is priced in ETB."_), limit reached, revoked, or not stackable (_"This code doesn't stack with the sale on this course."_).
  - **Error:** "We couldn't load your codes — nothing you did was lost." + Retry + a request ID.
- **Resilience:**
  - **403:** _"You don't have access to coupon revenue."_ with a request ID and **Ask an Admin for access**. Support has view-only; the revenue columns are **redacted server-side**, so Support's payload never carries them and the column renders an explanation. **Generate**, **Deactivate**, and **Revoke** are **absent** for Support.
  - **404:** _"This coupon was deleted, or you followed an old link."_ + **Back to Coupons** + a request ID. A **revoked** or **expired** code is a 200 with its pill, never a 404 — its redemption history is a record.
  - **Offline:** Persistent banner; the code table renders read-only from cache. Generate, Deactivate, Revoke, and batch export are disabled-with-a-reason (_"Reconnect to manage coupons."_) — issuing 500 codes from a queued offline action would create 500 codes nobody can see.
  - **Reconnected:** a queued redemption-list export refreshes; a code whose usage limit was consumed while offline resolves per-row, not as one failure.
  - **Session expired:** The 2-minute warning names an open Generate dialog with unsaved parameters; on return the dialog is restored. A **batch generation in flight completes regardless** — the codes are real once created, so the user is told _"500 codes were created while you were signed out"_ and the result is offered, not discarded.
  - **Conflict:** Two staff deactivating or revoking the same code, or two generating against the same limit — _"TOEFL25 was already revoked by {actor} {N} minutes ago."_ with the reason and actor. A **limit race** at redemption resolves server-side and the losing customer sees the limit reason, not a generic failure.
  - **Partial failure:** _"Created 480 of 500 codes. 20 were rejected — the code prefix collided with an existing batch."_ The 480 are kept and offered for export, with the collision named.
  - **Server error:** Retry + a request ID, in the product's voice.
- **Keyboard & Focus:**
  - The code table is a [S-7.12 DataTable](09-Shared-Components.md#scr-7-12): `role="grid"`, `aria-sort` on Code and Usage, arrow-key navigation, `Enter` opens the redemption list.
  - The **Currency** field is a labelled `select` whose disabled state is explained (_"n/a for percentage codes"_) rather than a mystery grey box.
  - The **stackable checkbox is never a bare checkbox** — it has a described outcome region that updates live as it is toggled, and the outcome text is associated via `aria-describedby`, so a screen-reader user hears the consequence on toggle.
  - The revoke reason `radiogroup` uses arrow keys; the confirm control is a `role="alertdialog"` reading the consequence and the standing-redemption count on open.
  - The redemption list is a focusable region with a filter form; an export completion is announced politely, a failure assertively with its request ID.
- **Instrumentation & acceptance:**
  - **Events:** `coupon_generated` `{type, currency, scopeCount, codeCount}` · `coupon_batch_completed` `{requested, created, rejected}` · `coupon_deactivated` `{codeId, redemptionsIn24h}` · `coupon_revoked` `{codeId, reasonCode, standingRedemptions}` · `coupon_redemption_viewed` `{codeId, rowCount}` · `coupon_stacking_changed` `{stackable}` · `coupon_free_access_confirmed` `{courseId, priceAmount, priceCurrency}`. **No student names, no order values in event properties.**
  - **Acceptance:**
    1. A fixed-amount code requires a **currency**, rendered with the code always visible (`ETB 10 off`, never `$10`).
    2. A fixed-amount code whose currency differs from the course's is rejected with the reason and the fix.
    3. The stacking control states its outcome for **both** states, updates live, and the checkout result matches: off → the better single discount, on → the code applies after the course discount with the arithmetic shown.
    4. A 100% code on a paid course is confirmed, names the projected impact, and writes exactly one audit-log entry recording actor, code, scope, and the confirmation.
    5. **Revoke** is distinct from **Deactivate**: revoke requires a reason, is audited separately, and standing redemptions are stated and honoured; deactivate is reversible.
    6. Every code exposes a **per-code redemption list** — who, when, which course, which value, which currency — sufficient to justify a revoke.
    7. Support's view of a redemption list renders no order values, and the absence is explained rather than blank.
  - **Budgets:** 25-row pages; first paint < 1.5 s; a redemption list for 5,000 rows paginates and virtualises, first page < 1 s; a 500-code batch generates in < 10 s with a progress state; filtering by velocity < 400 ms.
- **Navigation:**
  - Opened from [S-A.1](02-Global-Navigation.md#scr-a-1) Marketing group; linked from [S-2.20](04-Courses.md#scr-2-20) → _Pricing & enrollment_, where a course references the codes that apply to it
  - Course name in Scope → [S-2.6](04-Courses.md#scr-2-6) Course Workspace · Overview
  - Redemption row → [S-4.2](06-Students.md#scr-4-2) Student Profile
  - "Revenue influenced" → [S-1.2](03-Dashboard.md#scr-1-2) Revenue Analytics, filtered to this code
  - CSV export → [S-5.4](07-Analytics.md#scr-5-4) Export Reports

<a id="scr-8-4"></a>

##### Screen Name: S-8.4 Affiliate Program 🔄 CHANGED

- **Purpose:** Manage affiliates who promote courses and earn commissions on sales: applications, referral links, per-affiliate performance, commission tracking, reconciliation, and payout runs.
- **User Role(s):** Admin (payout runs), Editor (affiliate management)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Affiliate Program"  [Program Settings] [+ Invite Affil.]  │
  ├──────────────────────────────────────────────────────────────────┤
  │ Commission 20% · Cookie window 30 days · Payout at ETB 1,800.00   │
  │ via [Bank transfer ▾]      Pending payouts: ETB 830.00 [Run …]   │
  ├──────────────────────────────────────────────────────────────────┤
  │ | Affiliate  | Link/Code   | Clicks | Sales | Revenue | Owed     │
  │ | Sara B.    | sara/TOEFL  | 1,204  | 38    | ETB 2,128.00 | ETB 425.60 │
  │ | Daniel W.  | DANIEL20    |   540  | 12    | USD 674.00   | USD 134.80 │
  ├──────────────────────────────────────────────────────────────────┤
  │ Reconciliation — Sep payout                                     │
  │   Expected  ETB 830.00  (12 affiliates)                          │
  │   Payable   ETB 768.40  (2 affiliates short — see below)         │
  │   Variance  −ETB 61.60                                          │
  │    • Daniel W. — bank details incomplete since Sep 3              │
  │    • Affiliate #51 — payout returned by the bank                 │
  │ Applications: 2 pending [Review]                                 │
  │ Fraud flag: self-referral pattern on affiliate #44               │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Configure the program: commission percentage, cookie/attribution window, payout threshold, **payout currency**, and payout methods.
  2. Approve or decline affiliate applications; generate unique referral links/codes per course.
  3. Track clicks, conversions, revenue, and commissions owed per affiliate; flag suspicious self-referrals.
  4. **Reconcile** a period, then **run payouts** — Admin only — and resolve every variance line.
  5. **Retry a failed payout with new details**; request missing payout details from an affiliate.
- **Payout methods and currency:**
  | Method                   | Detail                                                                                                                                                                                                                                                                                                                                                    |
  | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
  | **Bank transfer**        | Retained. Account name, number, and bank; validated per the account's country.                                                                                                                                                                                                                                                                            |
  | **USD (bank or wallet)** | Payout denominated in **USD**, converted at the rate recorded **on the day of the run** and frozen onto the payout record. The rate is shown on the run and the audit entry, so a later rate change never rewrites a paid payout.                                                                                                                         |
  | **Telebirr** 🆕          | Payout to a Telebirr wallet number (`09xxxxxxxx`), verified by a **micro-deposit** before the first payout: _"We sent ETB 1.00 to 09xx…4471. Confirm it arrived before your first payout."_ This is the primary method for Ethiopian affiliates and its absence in Revision 1 was the reason USD and bank transfer alone was a materially incomplete set. |
  - **A stated payout currency** is set per run, not per affiliate: the run is denominated in one currency, each affiliate's owed amount is **converted to it at the run's rate**, and the conversion is visible per row. Amounts render with the **currency code always visible** — `ETB 425.60`, `USD 134.80` — never a bare `$`, per [Part 11](11-Global-Standards.md#localization--formatting). A run in a single currency produces a single-currency total; a cross-currency total is never summed without a stated rate and date.
  - Mixed-currency commission ledgers are expected: a course priced in ETB and a partner deal in USD both exist, and the run is where they are reconciled.
- **Reconciliation** is a state of a payout run, and it is the screen's most useful new block:
  - **Expected vs payable.** The run compares the commission the ledger says is owed against the amount that can actually be paid, and shows the **variance** with a named reason per line. A payout that quietly pays less than the ledger says is owed is the failure this replaces.
    | Line                           | Meaning                                                                                                                                                               |
    | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | **Expected**                   | Sum of owed commissions for the period.                                                                                                                               |
    | **Payable**                    | Expected minus every deduction below.                                                                                                                                 |
    | **Variance**                   | The signed difference, always shown, including when it is `ETB 0.00`.                                                                                                 |
    | **Short — details incomplete** | The affiliate has not supplied valid payout details. Named per affiliate, with the missing field and a **Request details** action that sends in-app and via Telegram. |
    | **Short — threshold not met**  | Below the payout threshold. Carried forward and visible, never silently dropped.                                                                                      |
    | **Short — on hold**            | Held by a fraud flag. The hold is named with its evidence.                                                                                                            |
    | **Returned**                   | A previous payout failed or was returned by the bank; see below.                                                                                                      |
  - **A variance is never a rounding note.** A non-zero variance blocks the run until each line is resolved or explicitly accepted, and acceptance is recorded in the audit entry.
- **Partial payout** is a first-class outcome, not a failure: _"12 affiliates · ETB 830.00 expected · ETB 768.40 paid. 2 affiliates paid separately once their details arrive."_ A partial run commits the payable amount, marks the remainder **Deferred** with its reason, and carries it into the next run. Each deferred affiliate is notified with the reason and the expected timing, so "I got paid last month and not this month" is answerable.
- **Payout failed / returned** is a distinct state with the **bank's reason** and a **retry-with-new-details** action:
  - A failed transfer reports the reason **as the institution gave it**, not a generic error: _"Bank declined — 'invalid account number' (attributed bank ref 88213)."_ Where Telebirr returns a code, it is shown with its meaning.
  - The affiliate's commission returns to **Owed** — it is not lost and not marked paid — and the payout row shows **Failed** with the reason, the attempt count, and the last attempt time.
  - **Retry with new details** is the primary action: it opens the details form, requires a corrected value, and shows what changed. **Retry as-is** is offered only up to 3 attempts, after which the row requires new details — retrying a declined transfer unchanged is a loop, not a recovery.
  - Each attempt writes an audit entry, so a payout's history is reconstructable.
- **Historical commissions never recompute** (retained) — and the case that rule leaves open is now answered:
  - **A refund issued after a payout has already run cannot claw back cash already sent.** The money is gone; reversing a bank transfer is a recovery action, not a feature. The policy is: the refund **reverses the commission in the ledger**, creating a **negative balance** on that affiliate, and that balance **offsets their next payout**. If the balance is not recovered by the next run, it carries forward; the affiliate is notified in-app and via Telegram that a refund on a past sale has created a balance, with the amount and the original sale. Nothing is withheld silently and nothing is clawed back.
  - Commission **rate** changes apply prospectively; historical commission rows keep the rate they were earned at, and the rate is stored per row so a later change never rewrites history.
- **Data Displayed/Modified:** Writes `affiliates`, `affiliate_links`, `commissions`, `payouts`, `payout_attempts`, `commission_balances`; sales attribution flows into [S-1.2](03-Dashboard.md#scr-1-2) Revenue Analytics with an `affiliate` source tag.
- **Validation & Feedback:**
  - A payout run is blocked while its **variance is non-zero** and every deduction line is unresolved; each line's missing input has a **Fix** deep link to the exact field.
  - **Payout details are validated before submission** — a bank account number's format and length per country, a Telebirr wallet in `09` + 9 digits. An invalid value is rejected with the reason and the field focused, before any institution is called.
  - A payout run above **25 affiliates** requires [S-7.1](09-Shared-Components.md#scr-7-1) confirmation showing expected, payable, variance, and the payout currency.
  - Every money value renders as [Money](09-Shared-Components.md#scr-7-12) with the **currency code always visible**; there is no bare `$` anywhere in this screen, and a converted amount shows both the source and the rate used.
- **States:**
  - **Empty:** "No affiliates yet. Invite your first partner to earn commission on sales." with **Invite affiliate** as the single CTA, plus the program settings as secondary. **Zero-result:** "No affiliates match this filter." with **Clear filters**.
  - **Pending / Approved / Suspended** affiliate states; suspended keeps links inert but preserves history.
  - **Application:** a lightweight form (name, audience, promotion channels) → [S-7.1](09-Shared-Components.md#scr-7-1)-style approve/decline with an optional note.
  - **Payout Run:** a summary modal showing **expected, payable, and variance** with every deduction named → [S-7.1](09-Shared-Components.md#scr-7-1) confirmation → transfers, marked paid with receipts. Payouts are **Admin only**; the control is **absent** for an Editor, with a tooltip on the _section_ explaining that payouts are Admin-only.
  - **Partial payout:** as above, with **Deferred** rows and reasons.
  - **Payout failed / returned:** as above, with the institution's reason, the attempt count, and **Retry with new details**.
  - **Reconciliation variance:** a non-zero variance blocks the run until resolved or explicitly accepted.
  - **Fraud flag:** a banner with evidence (same-account purchases) and a **Hold commissions** action. A hold is reversible and states what it affects: _"Holding commissions for affiliate #44 — ETB 3,204.00 across 9 sales. Links stay active."_
  - **Error:** "We couldn't load the program — nothing you did was lost." + Retry + a request ID.
- **Resilience:**
  - **403:** _"You don't have access to affiliate payouts."_ with a request ID and **Ask an Admin for access**. Support has view-only: the revenue and commission columns are **redacted server-side**, and **Run payout** is **absent** for them. An Editor sees the ledger but the payout control is absent with the section explaining why.
  - **404:** _"This affiliate was deleted, or you followed an old link."_ + **Back to Affiliates** + a request ID. A **suspended** affiliate is a 200 with a `Suspended` pill, never a 404 — their commission history is a financial record.
  - **Offline:** Persistent banner; the program renders read-only from cache. **Run payout**, **Mark paid**, **Retry**, and **Hold commissions** are all disabled-with-a-reason (_"Reconnect to run payouts."_) — a payout is never initiated from a queued offline action.
  - **Reconnected:** a queued export or a failed-transfer retry refreshes; a payout that was in flight when the connection dropped reconciles against the institution's reference and reports its real outcome rather than assuming failure or success.
  - **Session expired:** The 2-minute warning names an open payout run and any unsaved payout-details form. **A payout run in flight completes regardless** — real money is moving — and the returning user is told _"The Sep payout for 12 affiliates completed. ETB 768.40 sent."_ rather than being invited to run it again.
  - **Conflict:** Two staff running payouts for the same period, or one marking paid while another is retrying → _"Marked paid by {actor} {N} minutes ago."_ with the actor, the amount, and the reference. A **double-run** on one period is blocked server-side: the second run is refused with the first run's ID, not silently duplicated. Two staff editing the same commission rate → the standard **Review changes / Keep mine / Take theirs**.
  - **Partial failure:** the payout run's per-line outcome, as above — paid, deferred, failed, held — never a single total.
  - **Server error:** Retry + a request ID. **A 5xx after a transfer was submitted does not re-submit it**; the run reconciles against the institution's reference, because a retried payout is a double payment.
- **Keyboard & Focus:**
  - The affiliate table is a [S-7.12 DataTable](09-Shared-Components.md#scr-7-12): `role="grid"`, `aria-sort` on Revenue and Owed, keyboard row navigation, `Enter` expands the affiliate detail.
  - The payout run is a `role="alertdialog"`: focus moves to the **variance** region on open and the modal reads **expected, payable, and variance** as its accessible description, so the number that matters is announced before any decision.
  - Each deduction row is a focusable item with the affiliate name, the reason, and a **Fix** deep link to the exact field that resolves it — a missing account number focuses the account-number input, not the payout dialog.
  - Amounts are announced with their currency (`"owed 425 Ethiopian birr"`) — a screen reader must not have to infer a currency from a symbol.
  - A payout's completion or failure is announced assertively with its amount and reference; a reconciliation refresh is polite.
- **Instrumentation & acceptance:**
  - **Events:** `affiliate_application_reviewed` `{decision}` · `payout_run_started` `{period, affiliateCount, expectedAmount, currency}` · `payout_run_completed` `{paidAmount, deferredCount, failedCount, varianceAmount, currency}` · `payout_retry` `{attempt, withNewDetails}` · `payout_failed` `{reasonCode, institutionRef}` · `commission_reversed` `{reason: refund, balanceAmount, currency, afterPayoutRun}` · `fraud_hold` `{affiliateId, heldAmount, currency}`. **No affiliate names, no bank or wallet numbers, no account details in any event property.**
  - **Acceptance:**
    1. Payout methods include **Telebirr**, USD, and bank transfer, and Telebirr is verified by micro-deposit before the first payout.
    2. A run states **expected, payable, and variance**, and every deduction is named per affiliate with a **Fix** link to the field that resolves it.
    3. A non-zero variance blocks the run until each line is resolved or explicitly accepted, and the acceptance is audited.
    4. A **partial payout** commits the payable amount, marks the remainder Deferred with a reason, and carries it into the next run with a notification.
    5. A **failed or returned** payout shows the institution's reason and reference, returns the commission to Owed, offers **Retry with new details**, and stops offering blind retries after 3 attempts.
    6. A **refund issued after a payout has run** creates a negative balance that offsets the next payout and notifies the affiliate — it does not attempt to claw back cash already sent, and the UI says so.
    7. Every rendered amount shows its currency code; no bare `$` appears anywhere in the screen.
    8. A 5xx after a transfer was submitted reconciles against the institution's reference and does not re-submit the payment.
  - **Budgets:** 25-row pages; first paint < 1.5 s; a 500-affiliate payout run's reconciliation computes < 5 s; per-affiliate transfer submission is parallel with a bounded concurrency and reports progress; export of a full commission ledger is an asynchronous [S-5.4](07-Analytics.md#scr-5-4) export.
- **Navigation:**
  - Opened from [S-A.1](02-Global-Navigation.md#scr-a-1) Marketing group
  - Affiliate name → affiliate detail (same screen, expands)
  - "Program Settings" → inline settings panel (Admin only)
  - Commission rows → [S-1.2](03-Dashboard.md#scr-1-2) Revenue Analytics, filtered to the `affiliate` source
  - Payout receipt → [S-5.4](07-Analytics.md#scr-5-4) Export Reports

<a id="scr-8-5"></a>

##### Screen Name: S-8.5 Student Testimonials 🔄 CHANGED

- **Purpose:** Collect, moderate, and display student testimonials on course landing pages: rate-limited automated requests, a consent-first moderation queue with language-aware re-confirmation, student-visible opt-out, and landing-page display controls.
- **User Role(s):** Admin, Editor, Support (moderation only)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Student Testimonials"   [+ Collect Manually]  Pending: 3 │
  │ Requests: ☑ On completion  ☑ On 5-star rating                   │
  │          ☑ At most 1 request per student per 90 days            │
  ├──────────────────────────────────────────────────────────────────┤
  │ Moderation Queue:                                                │
  │ +--------------------------------------------------------------+│
  │ | "The 12-week plan took me from 79 to 101."   Rating 5/5       ││
  │ |  — Alemayehu K., TOEFL Complete (course 4.9, completed)      ││
  │ |  ☑ Consent to display publicly confirmed                     ││
  │ |  [Approve]  [Edit quote]  [Reject]  [Hold — re-confirming]   ││
  | +--------------------------------------------------------------+│
  | | "በ12 ሳምንት እቅድ ከ79 ወደ101 አድርጌናለሁ።"  ንግግር: am │ |
  | |  — አለመዱ ካሳሁን, TOEFL Complete                               │ │
  | |  ⏳ Awaiting re-confirmation in the student's language (am)    │ │
  | |  [Review in Amharic]  [Re-confirm]  [Publish as-is]          │ │
  | +--------------------------------------------------------------+│
  | Published (12): filter by course · [★ Feature on landing page]   │
  │ Display: (● Carousel ○ Grid ○ Single highlight quote)           │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Auto-request testimonials on completion or a 5-star rating, **rate-limited**, and collect manually when needed.
  2. Moderate submissions: approve, edit with a **classified** diff, or reject; consent to public display is mandatory before approval.
  3. **Send for bilingual review** a testimonial written in a language the moderator cannot read.
  4. Feature approved testimonials on specific course landing pages; choose display format (carousel/grid/highlight).
- **Collection:**
  - **Automatic requests are rate-limited.** Revision 1 fired on completion **and** on a 5-star rating, so a student who completed a course and then left a 5-star review received two requests. The cap is **one automatic request per student per 90 days**, evaluated across all triggers — so a completion and a 5-star rating on the same day produce **one** request, and the second trigger is suppressed with a reason: _"Tigist M. was already asked on Sep 5. Next automatic request after Dec 4."_ The cap is a configurable field, shown in the trigger panel, and **the author can change it** — it is a policy, not a constant.
  - The trigger panel shows the **last request date per student** and the count suppressed by the cap, so the effect of the setting is visible rather than theoretical.
  - Requests are delivered per [Part 11 Notification Delivery](11-Global-Standards.md#notification-delivery) — in-app always, Telegram by default where a verified handle is linked, email only where verified. A student with no reachable channel is not requested; the row is badged **Unreachable** with a **Send enrollment link** action, because a testimonial is worth less than an enrolled student.
- **Consent, and the student's ability to change their mind:**
  - Consent to public display is collected **from the student**, in the request itself, with a plain-language statement of what they are agreeing to: their quote, their first name, and their course appearing on a public landing page. It is a required, unticked checkbox in the student's own language.
  - **The opt-out is visible to the student at all times** — in their account, on the testimonial itself, and in the in-app feed entry where the request was made. Opting out **unlists the testimonial immediately** (it disappears from landing pages on the next render, not at the next moderation cycle), and notifies the staff member who moderated it, because an unlisted quote still visible in production is the failure this prevents. Consent state and the consent log live in [S-6.10](08-Settings.md#scr-6-10).
  - A testimonial from a student whose privacy state is anonymised is **automatically unlisted** (retained from Revision 1), and the unlisting names the cause.
- **Ge'ez-language testimonials in an English-first moderation UI:**
  - A testimonial carries the `lang` of the text the student actually wrote. The queue renders it with a `lang` attribute and the [Part 11 typography](11-Global-Standards.md#localization--formatting) — Noto Sans Ethiopic, `line-height: 1.6`, `letter-spacing: normal`, **no fixed-px line clamp** — so አለመዱ ካሳሁን renders in full at 320px width.
  - Each row shows a **language pill** (`ንግግር: am`) so a moderator is not approving text they cannot read. **A moderator who does not read the testimonial's language cannot approve it** — the **Approve** control is **disabled with the reason** _"You can't verify this text — it's in Amharic. Send it for bilingual review."_ (case 2: present, explained, with a working alternative). The alternative is **Send for bilingual review**, which routes it to a reviewer who declares that language.
  - **Re-confirmation happens in the student's own language.** A re-confirmation request — for a heavy edit, or for a moderation decision the student should see — is sent **in the language the testimonial was written in**, not in the workspace's UI language. A student asked to approve an Amharic edit in English has not meaningfully been asked.
  - **Display-name handling is a language question, not a text question.** An Amharic testimonial shows the student's name in their own script. A testimonial with **no first name** — a single-word Ge'ez name — never gets an initial appended, because there is no initial to append and `አለመዱ ካ.` is a name the student does not have.
- **Editing, and what counts as a typo fix:**
  - **`Edit quote`** opens an editor with a **live diff** against the original and a **classification**, because Revision 1's _"edits beyond typo fixes should be re-confirmed"_ defined nothing and so was never enforceable.
    | Classification | What it covers                                                                                                                                                                                                                        | Consequence                                                                                                                                                                                                                                                                                      |
    | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
    | **Typo fix**   | Correcting **misspellings, spacing, and punctuation only**. Character-level: no word is added, removed, reordered, or substituted. Removing a doubled space, fixing `teh` → `the`, correcting a comma, capitalising a sentence start. | Applies immediately. Recorded as _"typo fix by {actor}"_ in the edit log with the diff. No student contact.                                                                                                                                                                                      |
    | **Light edit** | Removing **filler or redundancy** with no change of meaning: `basically`, `really`, a repeated word, an over-long run-on split into two sentences. No content word changes.                                                           | Applies, and the student **is notified** in their own language with a link to see the change. Not blocking.                                                                                                                                                                                      |
    | **Heavy edit** | **Any** change to a content word: substituting one for another, adding or removing a word, changing a number, a product name, or a course title.                                                                                      | **Blocks.** The testimonial is held in **Pending**, and a **re-confirmation request is sent to the student in their own language** showing the before/after. It **stays Pending until the student responds.** It is never published on a staff member's judgement that the meaning is preserved. |
  - The system **classifies automatically** and a moderator may override it — but overriding **toward** lighter is recorded with the moderator's name and reason, and the audit log holds the full original text and every intermediate version. **The original is never destroyed**; a heavy edit is reversible and the original is one click away.
  - A re-confirmation request that is **not answered within 30 days** leaves the testimonial in Pending with a stated timeout — _"No response. This testimonial stays unpublished."_ It does not lapse into Published, and it does not time out into rejection either, so a moderator can still act on it.
- **Data Displayed/Modified:** Writes `testimonials` (quote, `original_quote`, `lang`, rating, consent, state, `edit_classification`), `testimonial_requests`, `testimonial_edit_log`; course landing pages read published + featured testimonials and re-check consent on every render.
- **Validation & Feedback:**
  - Quote **20–400 characters**, counted per language; the counter states the count and never truncates. A Ge'ez quote is measured in its own characters, not in Latin-equivalents.
  - **Every edit is classified** — typo fix, light edit, or heavy edit — and the classification is shown to the moderator with a live diff. Choosing **Heavy edit** requires a reason and immediately raises the re-confirmation notice.
  - **Approve is blocked without verified consent**, with the fix named in the disabled reason. Consent is re-checked at approval time, not only at submission time.
  - **A heavy edit is never silently applied.** The original quote is retained in full and is one click away; every intermediate version is in the edit log.
  - An Amharic quote is validated and rendered in the Ethiopic stack, and a **bilingual-review flag** is required before a moderator who does not read that language can approve it.
- **States:**
  - **Empty:** "No testimonials yet. Requests go out automatically when a student completes a course or leaves a 5-star rating." with **Collect manually** as the single CTA and the triggers listed as helper text. **Zero-result:** "No testimonials match this filter." with **Clear filters**.
  - **Requested / Pending / Published / Rejected / Archived**; the pending queue is sorted by rating and course.
  - **Missing Consent:** **Approve** is disabled until consent is verified — a submission without consent cannot be published. The disabled reason names the fix: _"Confirm the student consented to public display."_
  - **Awaiting re-confirmation (new):** a heavy edit holds the testimonial in Pending with a **re-confirmation request in the student's language**, the request date, and the days remaining. The queue row says so, and the state is distinct from ordinary Pending so a queue is not silently stalled.
  - **Re-confirmed / Declined re-confirmation:** the student responded. Declining **reverts to the original quote** and the testimonial returns to Pending for a fresh decision; the staff member who made the edit is notified.
  - **Opted out:** unlisted immediately, staff notified, the row badged **Opted out** with the date.
  - **Unreachable:** no verified channel; not requested, with a **Send enrollment link** action.
  - **Rate limited by policy:** the request is suppressed and the row names the date the student was last asked and when they can be asked again.
  - **Language mismatch:** a moderator without the testimonial's language gets Approve disabled with the reason and a **Send for bilingual review** action.
  - **Featured:** featured items require [S-7.1](09-Shared-Components.md#scr-7-1) confirmation when unfeatured while live, and the confirmation states the pages affected.
  - **Student Notification:** on publish, the student is thanked and shown where their quote appears, in their own language, and told how to opt out.
  - **Error:** "We couldn't load the queue — nothing you did was lost." + Retry + a request ID.
- **Resilience:**
  - **403:** _"You don't have access to testimonial moderation."_ with a request ID and **Ask an Admin for access**. Support holds `testimonials.moderate` and reaches the queue, but has **no** access to collection triggers or the display configuration, which are **absent** for them rather than disabled. A Reviewer and a Viewer have no access at all and a direct link is a 403.
  - **404:** _"This testimonial was deleted, or you followed an old link."_ + **Back to Testimonials** + a request ID. An **opted-out** or **rejected** testimonial is a 200 with its pill, never a 404 — it is retained for reference, and an unlisted record that renders as "not found" reads as a bug to the student who opted out.
  - **Offline:** Persistent banner; the queue renders read-only from cache. **Approve**, **Reject**, **Edit quote**, **Feature**, and the collection triggers are disabled-with-a-reason (_"Reconnect to moderate."_) — publishing a student's words is never a queued offline action.
  - **Reconnected:** The moderation queue refreshes; a testimonial that changed state while offline reports the change rather than reverting the moderator's decision. A pending heavy edit still in re-confirmation is **not** re-sent.
  - **Session expired:** The 2-minute warning names the queue and any open edit or re-confirmation dialog; on return the row is restored. **A re-confirmation request already sent is not re-sent** — asking a student twice about the same edit is the failure this prevents.
  - **Conflict:** Two moderators acting on one testimonial — _"Approved by {actor} {N} minutes ago"_ or _"Rejected by {actor}"_, with a link to the published state, never a second contradictory publish. Two moderators editing the same quote → **Review changes / Keep mine / Take theirs** on the text, and the merged result is **re-classified** — two heavy edits merged can produce a different classification than either alone.
  - **Partial failure:** a bulk approve or feature reports per row: _"Featured 8 of 10. 2 could not be featured — consent was withdrawn after approval."_ The consent re-check is the point, and a withdrawn consent always blocks publication regardless of the moderation decision.
  - **Server error:** Retry + a request ID, in the product's voice.
- **Keyboard & Focus:**
  - The queue is a [S-7.12 DataTable](09-Shared-Components.md#scr-7-12): `role="grid"`, 25-row pages, `aria-sort` on Rating and Date, keyboard row navigation.
  - Each quote is a focusable region carrying its `lang`, so a screen reader **pronounces it in the language it is written in** — the single most important accessibility behaviour on this screen, since a quote read in the wrong language is a quote nobody reviewed correctly.
  - The disabled **Approve** controls are focusable and their reasons are exposed in `aria-describedby`, so a screen-reader user learns _why_ approval is unavailable rather than meeting a dead button.
  - **Edit quote** is a `role="dialog"` with the live diff in a labelled region; the classification control is a `radiogroup`, and choosing **Heavy edit** reveals the re-confirmation notice as a polite live region.
  - The re-confirmation preview is a labelled region rendered in the student's language with `lang` set, so a moderator sees exactly what the student will see.
  - A testimonial's opt-out and state changes are announced politely; a failed action is assertive with a request ID.
- **Instrumentation & acceptance:**
  - **Events:** `testimonial_requested` `{trigger, suppressedBy: rate_limit|null}` · `testimonial_received` `{lang, courseId, hasConsent}` · `testimonial_edited` `{classification: typo|light|heavy, charDelta}` · `testimonial_reconfirmation_sent` `{lang}` · `testimonial_reconfirmed` `{response: accepted|declined, hoursToRespond}` · `testimonial_published` `{featured, courseId}` · `testimonial_optout` `{byStudent, wasPublished, unlistedWithinSeconds}` · `testimonial_forwarded_for_bilingual_review` `{lang}`. **No quote text, no student names, no ratings-per-student in any event property.**
  - **Acceptance:**
    1. A completion **and** a 5-star rating on the same day produce **one** automatic request, and the suppressed one names the last request date and the next eligible date.
    2. The rate limit is a visible, editable field in the trigger panel with its current value.
    3. The opt-out is reachable by the student from their account and from the testimonial, and unlisting takes effect on the **next render**, not at the next moderation cycle, and notifies the moderator.
    4. A **typo fix** is defined as character-level correction with no word added, removed, reordered, or substituted, and applies without contacting the student; any content-word change is classified **heavy** and holds the testimonial in **Pending** until the student responds.
    5. A re-confirmation request is sent **in the language the testimonial was written in**, and an unanswered request leaves the testimonial in Pending rather than publishing or rejecting it.
    6. A moderator who does not read the testimonial's language cannot **Approve**; the control is disabled with the reason and offers **Send for bilingual review**.
    7. An Amharic quote renders in Noto Sans Ethiopic at `line-height: 1.6` with no line clamp at 320px, is announced in Amharic by a screen reader, and displays the student's name in their own script with no appended initial.
    8. A consent withdrawal after approval blocks publication and is reported per row in a bulk action.
  - **Budgets:** 25-row pages; first paint < 1.5 s; the queue for 2,000 pending testimonials filters < 400 ms; the opt-out path is unrendered on a landing page within 5 s; a landing page re-checks consent on every render and does not cache a published testimonial across a consent change.
- **Navigation:**
  - Opened from [S-A.1](02-Global-Navigation.md#scr-a-1) Marketing group
  - Course attribution → [S-2.6](04-Courses.md#scr-2-6) Course Workspace · Overview
  - Student name → [S-4.2](06-Students.md#scr-4-2) Student Profile
  - Opt-out / consent log → [S-6.10](08-Settings.md#scr-6-10) Privacy & Data Retention
  - "Send enrollment link" → [S-4.1](06-Students.md#scr-4-1) Add Student dialog
  - Collection triggers and the display configuration live on this screen for Admin and Editor only; landing-page placement is set in [S-2.20](04-Courses.md#scr-2-20) → _Pricing & enrollment_
