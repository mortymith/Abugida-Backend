# Section 6: Settings & Configuration

> **Abugida Academy — UX Design Specification** · Part 08 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Analytics](07-Analytics.md) · [Shared Components →](09-Shared-Components.md)

## What changed in Part 08 (Revision 3)

- **The settings IA is now stated exactly once**, in [Settings Information Architecture](#settings-information-architecture): one `/settings` route, a persistent left sub-nav, every section deep-linkable. The `[General][Team][Integrations][Branding]` tab strip in four Revision 2 wireframes was a third, contradictory description of the same navigation — it is deleted.
- **Every screen gained a `Resilience` block** — 403 / 404 / offline / reconnected / session-expired / conflict / partial failure / server error — per [Part 11 § Resilience States](11-Global-Standards.md#resilience-states).
- **No screen assumes an email address.** Team invites ([S-6.2](#scr-6-2)), GDPR exports, retention warnings, and consent records ([S-6.10](#scr-6-10)) all use [Part 11 § Notification Delivery](11-Global-Standards.md#notification-delivery): in-app always, Telegram by default, email only when a verified address exists.
- **Nothing is keyed on email.** Team rows are keyed on **Name** with a Sign-in-method column; invites are a claimable link or an 8-character code, and the invitee supplies their own name after signing in.
- **[S-6.11 Danger Zone](#scr-6-11) is new** — transfer, export, and delete of the workspace. _(The sitemap in `00-Overview-and-Sitemap.md` still needs a row for it; not added in this pass.)_
- **Capabilities have one vocabulary.** [S-6.9](#scr-6-9) is a flat tri-state list identical to [Part 11 § Course Lifecycle Capabilities](11-Global-Standards.md#course-lifecycle-capabilities), replacing a module × CRUD matrix and a free-text second table. **Support now has rows.**
- **Escapes are bounded.** Custom CSS sets design tokens only; branding sets `--color-primary` and `--color-primary-tint` only, each validated live for contrast against white text.
- **One save contract.** Every section footer renders the [S-7.8](09-Shared-Components.md#scr-7-8) save-state indicator with `Save changes` / `Discard changes`; the per-section "Saving…" strings are gone.
- **Added `Instrumentation & acceptance`** to S-6.2, S-6.6, S-6.8, S-6.9, and S-6.10.

## What changed in Part 08 (Revision 2)

- **[S-6.1](08-Settings.md#scr-6-1) General Settings lost its _Course Settings_ block.** Per-course configuration — pricing, enrollment window, completion rules, live sessions, the approval gate — now lives in the course's own workspace ([S-2.20](04-Courses.md#scr-2-20)). Workspace Settings keeps only **defaults applied to new courses**; anything that changes an existing course belongs with that course, not behind a global page.
- **[S-6.9](08-Settings.md#scr-6-9) Roles & Permissions** gained the course-lifecycle capabilities (`course.submit_review`, `course.publish`, `course.unpublish`, `course.archive`, `course.archive_item`, `assignment.grade`), so a workspace can separate _may author_ from _may publish_.
- No other screen in this part changed.

---

## Settings Information Architecture

Defined here once. This **supersedes** the `[General][Team][Integrations][Branding]` tab strip carried in four Revision 2 wireframes and matches `DESIGN.md` §6 (_Left sub-nav, section-level Save, unsaved-change guard_). No screen in this part restates it.

| Rule                             | Behaviour                                                                                                                                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **One route, one shell**         | `/settings` renders a **persistent left sub-nav** listing every section. It never scrolls away and never collapses to a strip on desktop.                                                                                              |
| **Every section is a URL**       | `/settings/general` · `/team` · `/roles` · `/integrations` · `/branding` · `/billing` · `/api` · `/security` · `/privacy` · `/danger`. A pasted link opens that section directly and the sub-nav marks it active.                      |
| **My Profile is separate**       | [S-6.5](#scr-6-5) is **not** in the sub-nav. It is personal, not workspace-scoped, so it lives on its own route reached from the header avatar.                                                                                        |
| **Independent save**             | Each section writes its own `rowVersion` and has its own **sticky section footer** holding the [S-7.8](09-Shared-Components.md#scr-7-8) save-state indicator and `Save changes` / `Discard changes`. Saving Team never saves Branding. |
| **Flush on switch**              | Switching sections **flushes the dirty buffer first**. If the flush fails, navigation is blocked with **Retry / Discard / Stay** ([S-7.1](09-Shared-Components.md#scr-7-1)). A dirty buffer is never discarded silently.               |
| **Out-of-capability is absent**  | A section the role cannot reach does not appear in the sub-nav at all. A section that is reachable but temporarily locked renders with an explanation and the step that unlocks it.                                                    |
| **Sub-section tabs are allowed** | A screen with genuinely more than one view inside it (Security → Policies / Audit Log; Privacy → Retention / Requests / Consent) may keep a local tab row **inside** the content region. Those tabs flush the buffer the same way.     |

---

<a id="scr-6-1"></a>

##### Screen Name: S-6.1 General Settings 🔄 CHANGED

- **Purpose:** Manage **workspace-wide** settings, defaults, and preferences. Course configuration is **not** here — it lives in the course's own workspace ([S-2.20](04-Courses.md#scr-2-20)). What remains is what a course inherits when it is created, plus what applies to every course at once, plus the workspace notification policy.
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Settings"                                               │
  │ Sub-nav (left, persistent):                                      │
  │   General · Team · Roles · Integrations · Branding · Billing     │
  │   API & Webhooks · Security · Privacy · Danger Zone              │
  ├──────────────────────────────────────────────────────────────────┤
  │ ┌─ General ──────────────────────────────────────────────────┐   │
  │ │  Platform                                                   │  │
  │ │    Platform Name        [Abugida Academy]                    │ │
  │ │    Support Contact      [@abugida_support · Telegram]        │ │
  │ │    Workspace Timezone   [Africa/Addis_Ababa]  EAT+03:00      │ │
  │ │    Workspace Language   [English ▾]                          │ │
  │ │    Default Calendar     [Ethiopian ▾]  (exports: Gregorian)  │ │
  │ │    Workspace Currency   [ETB ▾]                              │ │
  │ │    Date Format          [DD/MM/YYYY ▾]                       │ │
  │ │                                                             │  │
  │ │  Defaults for New Courses                                   │  │
  │ │    Default Instructor [Select ▾] · Default Category [Select] │ │
  │ │    New items start as:  (● Draft)  ( ○ Published )           │ │
  │ │    ⚠ Applies to new courses only — never to existing ones.  │  │
  │ │                                                             │  │
  │ │  Notification preferences  ▸ see below                       │ │
  │ └──────────────────────────────────────────────────────────────┘ │
  ├──────────────────────────────────────────────────────────────────┤
  │ ● All changes saved 14:02   [Discard changes] [Save changes ⌘S]  │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Update platform identity, timezone, language, default calendar, currency, and date format.
  2. Configure the defaults applied to newly created courses.
  3. Configure notification channels, per-type routing, digest, and quiet hours.
  4. Save this section independently via its sticky footer.
- **Data Displayed/Modified:** `system_settings`, `notification_preferences` (workspace defaults), `user_preferences` (per-user overrides written in [S-6.5](#scr-6-5)).
- **Notification Preferences (new):**
  - **Channels** — **In-app:** `On`, not user-disableable; every notification and system message is written to the in-app feed first. **Telegram:** `On / Off`, off-state shows the linked handle — _"Your Telegram is linked as @handle."_ **Email:** `On / Off`, and **disabled with the reason** _"No verified email on this account"_ when `users.email` is null or unverified. Never hidden, never silently omitted.
  - **Per-type toggles** — review assigned · review decided · course published · new enrollment · student question · payment failed · retention warning · webhook delivery failed. Each is a tri-state (In-app / Telegram / Email); Email is disabled-with-reason where no verified address exists.
  - **Digest** — Off · Daily 08:00 · Weekly Mon 08:00, evaluated in the **user's** timezone, never the workspace's. A digest links to the in-app item; it never duplicates it.
  - **Quiet hours** — `22:00 – 07:00` by default, editable, timezone-explicit with a duration picker. Under the control: _"Critical alerts always come through"_ and a preview of the **next two notifications that would be suppressed**, with their times. `payment.failed` and `security.*` are never suppressible.
- **Localization & Formatting:** These fields set the **workspace** defaults. A signed-in user's own language, calendar, and timezone override them for that user ([S-6.5](#scr-6-5)) — the two are never merged into one field. Money renders via `Intl.NumberFormat` in the workspace currency with the **code always visible** (`ETB 1,240.00`). Times render `6:00 PM EAT` with the UTC offset in a tooltip.
- **Validation & Feedback:**
  - Platform name and support contact are required; the support contact accepts **either** a verified address **or** a Telegram handle, and labels which one it is.
  - A timezone change previews the effect on scheduled digest and quiet-hours windows before saving.
  - Changing the workspace currency does **not** restate historical invoices; those keep the currency they were billed in, and the row says so.
- **States:**
  - **Loading:** skeleton per field group, never for the whole section — the sub-nav and the section footer stay mounted so a slow save never blurs the IA.
  - **Default:** Current settings populated; the footer reads `All changes saved`.
  - **Dirty:** Footer switches to `Unsaved changes · ⌘S`; `Discard changes` becomes active.
  - **Saving / Saved / Error / Conflict / Offline:** rendered by the [S-7.8](09-Shared-Components.md#scr-7-8) indicator in the sticky footer — no bespoke strings.
  - **Error copy:** _"We couldn't save your settings. Check your connection; your draft is kept on this device."_
  - **Defaults Are Not Live Edits (new):** every default field carries the caption that it applies only to new courses, with a link to the catalog filtered by that value. A global default silently rewriting existing courses is the failure this prevents.
  - **Default New-item State (new):** _Published_ is offered for trusted teams and is blocked with an explanation when the workspace requires approval, because a course cannot begin in a state its own workflow forbids.
- **Resilience:**
  - **Forbidden (403):** non-Admin sees a dedicated page — _"You don't have access to workspace settings."_ — with a request ID and **Ask an admin for access**. The sub-nav item is absent, not disabled.
  - **Not found (404):** an unknown `/settings/*` segment offers **Back to Settings** plus a request ID.
  - **Offline:** a persistent banner, not a toast — _"You're offline. Settings are read-only until you reconnect."_ Queued writes flush in order on reconnect; a stale `rowVersion` resolves to Conflict, never a silent overwrite.
  - **Session expired:** a 2-minute warning modal lists this section's unsaved work; on expiry the buffer is preserved and the user returns to the same section.
  - **Partial failure:** a field-level error with the rest of the section saved — _"Saved 8 of 9 fields. Default currency was rejected — see below."_
  - **Server error:** _"We couldn't load workspace settings — your work is safe."_ with a retry and the request ID.
- **Navigation:**
  - Sub-nav → sibling sections; **My Profile** is not in the sub-nav (own route, from the header avatar).
  - Course list link → [S-2.1](04-Courses.md#scr-2-1); per-course configuration → [S-2.20](04-Courses.md#scr-2-20)
  - Default-filtered catalog link → [S-2.1](04-Courses.md#scr-2-1) filtered by the default in question
- **Instrumentation & acceptance:** `settings.general_saved` · `settings.notification_pref_changed` (`channel`, `type`, `group`) · `settings.discard_confirmed`.
  - Saving one section never writes another section's `rowVersion`.
  - Email channel is disabled-with-reason, not hidden, for a user with no verified address.
  - A digest time is evaluated in the user's timezone — a user at UTC−7 does not receive it at 08:00 local.
  - The sticky footer reports `Saved` only after the server confirms.
  - Budget: section interactive < 800 ms; footer state change < 100 ms.

---

<a id="scr-6-2"></a>

##### Screen Name: S-6.2 Team Management 🔄 CHANGED

- **Purpose:** Manage team members, their roles within the platform, and access levels. **Members are keyed on Name, never on email** — sign-in is Google or Telegram only, so a member may have no address at all.
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Settings"                                               │
  │ Sub-nav (left, persistent):  [Team] is the active item           │
  ├──────────────────────────────────────────────────────────────────┤
  │ ┌─ Team ───────────────────────────────────────────────────────┐ │
  │ │  Team Members                                     [Invite]  │  │
  │ │  +----------------------------------------------------------+│ │
  │ │  | Name        | Email   | Sign-in method | Role    | Status |││
  │ │  |-------------|---------|----------------|---------|--------|││
  │ │  | John Doe    | john@…  | Google         | Admin   | Active |││
  │ │  | Tigist M.   | —       | Telegram       | Editor  | Active |││
  │ │  | Jane Smith  | jane@…  | Google+Telegram| Reviewer| Active |││
  │ │  | Alex Johnson| —       | Telegram       | Viewer  |Invite ││ │
  │ │  +----------------------------------------------------------+│ │
  │ │  Roles in this workspace:                                    │ │
  │ │    Admin · Editor · Reviewer · Viewer · Support → S-6.9     │  │
  │ └─────────────────────────────────────────────────────────────┘  │
  ├──────────────────────────────────────────────────────────────────┤
  │ ● All changes saved 14:02   [Discard changes] [Save changes ⌘S]  │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. View team members, their sign-in method, and their role.
  2. Invite a new member — role selection plus **Copy invite link** or **Copy invite code**.
  3. Edit a member's role.
  4. Remove a member (reversible: an invited-but-unaccepted member is revoked, never deleted).
- **Data Displayed/Modified:** Reads/Writes `team_members`; issues `invites`.
- **Notification Delivery (new):** an invitation is a **claimable link** (`/invite/:token`, single-use, 7-day expiry) **or an 8-character code**, shared over whatever channel the inviter chooses. The inviter never types the invitee's email, and **the invitee supplies their own name after signing in** — a name is never collected from the inviter. Nothing here sends an email by default.
- **Validation & Feedback:**
  - The **primary field in the invite modal is Role**, not email. A role is chosen first because it is the only thing the inviter actually knows.
  - A member with no address renders `—` in the Email column. **Never an empty cell** — a blank reads as a loading failure.
  - Sign-in method renders `Google` / `Telegram` / `Google + Telegram`, derived from the linked provider accounts, and is the only channel-identity column in the table.
  - Success toast: _"Invite link copied — share it over Telegram or any channel."_
  - A member cannot be removed if they are the last Admin, or the actor; both are blocked with a named reason.
- **States:**
  - **Default:** Team list populated, sorted by Name, newest role change surfaced in the row.
  - **Empty:** "No team members added yet. Invite your first team member."
  - **Loading:** Skeleton table rows — the sub-nav and sticky footer stay mounted.
  - **Zero-result:** a search that matches nothing shows "No members match — clear the search", not the empty state.
  - **Inviting:** _"Inviting: modal with role selection and Copy invite link / Copy invite code."_
  - **Invite Accepted:** the row moves from `Invited` to `Active` and records which provider the invitee signed in with.
  - **Invite Expired (7 days):** the row reads `Expired` with **Reissue**; the old link and code are dead.
  - **Invite Revoked:** **Revoke** on a pending row; the link returns _"This invitation was revoked by {actor} {N} minutes ago."_ + **Back to Team**.
  - **Invite Consumed:** opening a used link returns _"This invitation was already used. Sign in to continue, or ask an admin for a new one."_
  - **Reviewer Role:** selecting "Reviewer" grants approve/reject rights ([S-2.14](04-Courses.md#scr-2-14)) without authoring permissions.
  - **Self-approval guard:** the row of the acting user is read-only, with the reason stated.
  - **Error copy:** _"We couldn't send that invitation. Check your connection and try again — nothing was sent."_
- **Resilience:**
  - **Forbidden (403):** a non-Admin gets a dedicated page with a request ID and **Ask an admin for access**; the Team item is absent from the sub-nav.
  - **Offline:** persistent banner; the table renders read-only and row actions are disabled with the reason _"You need to reconnect to change roles."_ Queued role changes flush in order on reconnect.
  - **Session expired:** 2-minute warning modal; a pending role change is preserved and reapplied on return.
  - **Conflict:** a role changed by another Admin surfaces as _"Changed by {actor} {N} minutes ago — Review changes / Keep mine."_
  - **Partial failure:** a multi-row role change saves per row and reports the failures individually; successful rows stay saved.
  - **Server error:** _"We couldn't load the team list — nothing was changed."_ with retry and request ID.
- **Navigation:**
  - "Invite" → invite modal (role → copy link or code)
  - Role cell → role dropdown; role definitions deep-link → [S-6.9](#scr-6-9) Roles & Permissions
  - Back → [S-6.1](#scr-6-1) General
- **Instrumentation & acceptance:**
  - Events: `team.invite_created` (`method`: link | code, `role`) · `team.invite_accepted` (`method`, `provider`) · `team.role_changed` (`from`, `to`) · `team.member_removed` (`actor_is_self`).
  - A row for a member with no address shows `—` in Email, never an empty cell.
  - A link that has been opened once cannot be opened again, even from the same browser.
  - The last Admin and the acting user cannot be removed, and the block names which.
  - An expired or revoked invite link lands on a page that names the reason, not a generic error.
  - Budget: 100-row table interactive < 700 ms; role change optimistic within 100 ms and reconciled on server ordering.

---

<a id="scr-6-3"></a>

##### Screen Name: S-6.3 Integrations 🔄 CHANGED

- **Purpose:** Configure external integrations: payment gateways, the transactional email service, sign-in providers, and analytics.
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Settings"                                               │
  │ Sub-nav (left, persistent):  [Integrations] is the active item   │
  ├──────────────────────────────────────────────────────────────────┤
  │ ┌─ Integrations ───────────────────────────────────────────────┐ │
  │ │  Payment Gateways                                            │ │
  │ │    Stripe        ● Active      [Configure] [Disable]         │ │
  │ │    Telebirr      ○ Inactive    [Configure] [Activate]         ││
  │ │    Bank Transfer ○ Inactive    [Configure] [Activate]         ││
  │ │                                                              │ │
  │ │  Transactional Email (outbound only — not user notification)  ││
  │ │    SMTP          ● Active      [Configure] [Send test]        ││
  │ │    "Tested 14:02 · 2 recipients · 1 has no email on file —    ││
  │ │     sent in-app and via Telegram."                            ││
  │ │                                                              │ │
  │ │  Authentication (sign-in) — see S-0.1                        │ │
  │ │    Google OAuth   ● Active    ☑ Both providers enabled       │ │
  │ │    Telegram Login ● Active                                   │ │
  │ │                                                              │ │
  │ │  Analytics: GA4 [G-XXXXXXXX] · Mixpanel [Project Token]      │ │
  │ └─────────────────────────────────────────────────────────────┘  │
  ├──────────────────────────────────────────────────────────────────┤
  │ ● All changes saved 14:02   [Discard changes] [Save changes ⌘S]  │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Configure and activate payment gateways.
  2. Configure the transactional email service and send a test.
  3. Configure analytics integrations.
  4. Configure sign-in providers (Google OAuth, Telegram Login) used by [S-0.1](01-Authentication-and-Onboarding.md#scr-0-1).
  5. Save this section independently.
- **Data Displayed/Modified:** `integration_configs`.
- **Notification Delivery (new):** the email block is for **outbound transactional mail only** — receipts, invoices, passwordless-free notices. It is not the notification system, and configuring SMTP does not imply any user has an address. The test result states the per-channel breakdown: _"2 recipients · 2 in-app · 2 Telegram · 1 email (1 has no email on file)."_
- **Validation & Feedback:**
  - Provider credentials are stored server-side and never returned to the client; the field shows `configured · updated {relative}` instead of the secret.
  - `[Send test]` reports the exact HTTP outcome and the request ID.
  - A gateway cannot be disabled while it is the workspace's only method for a currency it is the sole processor of; the block names the invoices affected.
- **States:**
  - **Empty:** each integration card is independently connected or not; a card is never hidden for being unconfigured — it shows **Not connected** with a **Configure** action.
  - **Default:** Current configs displayed; secrets masked.
  - **Testing:** Spinner on "Send test", result inline under the block.
  - **Success:** Footer reports `All changes saved at HH:MM`; no bespoke "Config saved." string.
  - **Error:** _"We couldn't save this integration. Your other changes in this section are saved."_
  - **Test failed:** _"Test failed: the provider rejected the API key. Generate a new key in {provider} and paste it here."_ — the fix, not just the verdict.
- **Resilience:**
  - **Forbidden (403):** dedicated page with a request ID and **Ask an admin for access**; the sub-nav item is absent.
  - **Not found (404):** an unknown provider deep-link offers **Back to Integrations** + request ID.
  - **Offline:** persistent banner; the section renders read-only with _"2 changes waiting to sync."_
  - **Session expired:** 2-minute warning modal; the draft is preserved and the section reopened.
  - **Conflict:** a credentials change made in another tab surfaces as _"Changed by {actor} {N} minutes ago — Review changes / Keep mine."_
  - **Partial failure:** a multi-provider save reports per-provider results; a rejected webhook URL does not discard the analytics token saved alongside it.
  - **Server error:** _"We couldn't load integrations — your work is safe."_ with retry and request ID.
- **Navigation:**
  - "Configure" → integration-specific config modal
  - Sign-in provider row → [S-0.1](01-Authentication-and-Onboarding.md#scr-0-1); payment rows → [S-6.6](#scr-6-6) Billing

---

<a id="scr-6-4"></a>

##### Screen Name: S-6.4 Branding 🔄 CHANGED

- **Purpose:** Configure workspace branding: logo, favicon, primary colour, and design-token overrides.
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Settings"                                               │
  │ Sub-nav (left, persistent):  [Branding] is the active item       │
  ├──────────────────────────────────────────────────────────────────┤
  │ ┌─ Branding ───────────────────────────────────────────────────┐ │
  │ │  [Logo 160x40]  Company Name [Abugida Academy]               │ │
  │ │  [Favicon]      [Upload New Logo] [Upload Favicon]           │ │
  │ │                                                              │ │
  │ │  Primary colour     #7c3aed   white on this: 5.70:1  ✔       │ │
  │ │  Primary tint       #ede9fe   selected row / active nav       ││
  │ │  ⚠ Only these two tokens are tenant-themable. Status, focus,  ││
  │ │    and danger colours are fixed.                             │ │
  │ │                                                              │ │
  │ │  Design-token overrides (Custom CSS)                          ││
  │ │  ┌────────────────────────────────────────────────────────┐  │ │
  │ │  │ --color-primary-tint: #ede9fe;                          │  ││
  │ │  │ --color-radius-card: 8px;                               │  ││
  │ │  └────────────────────────────────────────────────────────┘  │ │
  │ │  Rejected: line 3 — !important is not allowed                │ │
  │ │  Rejected: line 4 — bare selectors are not allowed           │ │
  │ │                                                              │ │
  │ │  [Live preview]                                              │ │
  │ └─────────────────────────────────────────────────────────────┘  │
  ├──────────────────────────────────────────────────────────────────┤
  │ ● All changes saved 14:02   [Discard changes] [Save changes ⌘S]  │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Upload logo and favicon.
  2. Set the primary colour and primary tint, each validated live.
  3. Add design-token overrides.
  4. Preview changes against a realistic surface set.
  5. Discard the whole section back to the last saved state.
- **Data Displayed/Modified:** `branding_settings`, `asset` (logo/favicon).
- **Validation & Feedback — Live contrast (new):**
  - Every swatch shows its **computed contrast against white text, live as the hex is typed**, with the ratio and a pass/fail mark. Colour is never the only signal.
  - A primary below **4.5:1** blocks save with: _"White text on this colour is 3.1:1 — pick a darker shade"_, plus an **Auto-adjust** button that proposes the nearest passing value (`#7c3aed`) as a one-click apply.
  - Per [Part 11 § Color Palette](11-Global-Standards.md#color-palette), branding may set **`--color-primary` and `--color-primary-tint` only**. Status (`-success/-warning/-danger/-info/-archived`), the focus ring, and `--color-ai-*` are **not tenant-themable** and are not offered as fields.
- **Validation & Feedback — Custom CSS is bounded (new):**
  - The field accepts **only CSS custom-property declarations** matching `/^--[a-z0-9-]+\s*:/`. Everything else is an escape hatch that breaks the status, focus, and danger guarantees above.
  - `!important` and bare element/class/id selectors are **rejected** with: _"Custom CSS can only set design tokens. Status, focus, and danger colours are fixed."_
  - Rejected declarations are listed **with their line number** and the declaration is quoted, so the fix is a deletion rather than a hunt.
  - **Save is blocked** until every rejected declaration is removed or commented out (`/* … */` is the documented escape for parking a line).
- **States:**
  - **Default:** Current branding displayed with live ratios.
  - **Logo Uploading:** Progress indicator; the footer reads `Saving…` for that row only.
  - **Preview Mode:** Live preview of changes against sample surfaces, including a 200%-zoom and a Ge'ez string.
  - **Saving / Saved / Error / Conflict / Offline:** rendered by the [S-7.8](09-Shared-Components.md#scr-7-8) indicator in the sticky footer.
  - **Error copy:** _"We couldn't save your branding. Your logo uploaded fine — check the colour and try again."_
  - **Reset to Default:** [S-7.1](09-Shared-Components.md#scr-7-1) confirmation listing exactly which tokens will be cleared; the logo is never cleared silently.
- **Resilience:**
  - **Forbidden (403):** dedicated page with a request ID and **Ask an admin for access**; the sub-nav item is absent.
  - **Offline:** persistent banner; the section renders read-only. A completed upload resumes from the last byte rather than restarting.
  - **Session expired:** 2-minute warning modal; unsaved hex values and rejected-line list are preserved.
  - **Conflict:** a colour changed by another Admin shows _"Changed by {actor} {N} minutes ago — Review changes / Keep mine."_
  - **Partial failure:** logo and favicon save independently — _"Logo saved. Favicon upload failed — it's 1.2 MB over the 512 KB limit."_
  - **Server error:** _"We couldn't load branding — your work is safe."_ with retry and request ID.
- **Navigation:**
  - Sticky footer → `Save changes` / `Discard changes` for this section
  - Reset → [S-7.1](09-Shared-Components.md#scr-7-1) confirmation → Reset
  - "Auto-adjust" → applies the nearest passing `--color-primary` in place; it is a proposal, never an automatic commit

---

<a id="scr-6-5"></a>

##### Screen Name: S-6.5 My Profile & Account 🔄 CHANGED

- **Purpose:** Personal account settings for the signed-in user — separate from workspace-wide settings — reached from the header avatar in [S-A.1](02-Global-Navigation.md#scr-a-1). **This is a standalone route, not a section of `/settings`** (see [Settings IA](#settings-information-architecture)).
- **User Role(s):** Admin, Editor, Reviewer, Viewer, Support
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "My Profile"                                             │
  ├──────────────────────────────────────────────────────────────────┤
  │ [Avatar 96px] [Change photo]                                     │
  │   Name      [Jane Smith]            (one field, never a split)   │
  │   Email     jane@abugida.com   ✓ verified                        │
  │   Sign-in   Google ✓ · Telegram @jane ✓        [Manage]          │
  │   Role      Editor — assigned by an admin (read-only)            │
  ├──────────────────────────────────────────────────────────────────┤
  │ Security                                                         │
  │   Two-factor authentication     ○ Off        [Set up]            │
  │   Backup codes                 — shown once after setup          │
  │   [Regenerate backup codes]   [Replace authenticator]            │
  │   Active sessions  2 devices   [View & sign out]                 │
  ├──────────────────────────────────────────────────────────────────┤
  │ Preferences                                                      │
  │   Language [English ▾]  Calendar [Ethiopian ▾]                   │
  │   Timezone [Africa/Addis_Ababa ▾] — "Your timezone wins over     │
  │            the workspace default for times and relative dates."  │
  ├──────────────────────────────────────────────────────────────────┤
  │ ● All changes saved 14:02              [Discard] [Save changes]  │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Edit name, photo, and personal preferences.
  2. Manage connected Google/Telegram sign-ins and enroll in MFA.
  3. Review and revoke active sessions.
- **Data Displayed/Modified:** Reads/writes `users` (own record only), `sessions`, `mfa_credentials`, `backup_codes`.
- **MFA Enrolment (new) — an inline three-step flow, not a checkbox:**
  1. **Choose a method** — authenticator app. There is no SMS or email factor, because a Telegram-only user may have no address.
  2. **Scan or copy** — a QR code **and** a revealed manual key formatted `XXXX-XXXX-XXXX` with a **Copy** button, for users who cannot scan. The key is shown until the flow completes and never again.
  3. **Confirm** — enter the 6-digit code from the app. **Only on success does the toggle flip.** A wrong code is a field error, not a failed setup.
  - **On success:** **10 single-use backup codes** are shown **once**, with **Download (.txt)** and **Copy**. Leaving the page after that copy is the user's responsibility, and the UI says so once, plainly.
  - **Persistent afterwards:** **Regenerate backup codes** (regenerating invalidates the previous set) and **Replace authenticator** (full flow again, old credential revoked only after the new one confirms).
  - **Every step is independently recoverable.** Closing or navigating away mid-flow leaves 2FA **off** and says so: _"Setup wasn't finished — two-factor is still off."_ A half-enrolled credential is never left in a state that prompts for a code at sign-in.
- **Sessions (new) — a modal, not a count:**
  - Each row: **device**, **browser / OS**, **provider used** (Google or Telegram), **IP**, **last activity**. The current device is marked **"This device"** and cannot be signed out from here.
  - Per-row **Sign out**; plus **Sign out all other devices** behind **re-authentication**.
  - Signing out is immediate and confirmed by [S-7.1](09-Shared-Components.md#scr-7-1); the target session is dead on the next request, not on expiry.
- **Localization & Formatting (new):** the **personal timezone overrides the workspace timezone** for both absolute times and every **relative-time string** ("2 hours ago", "today") on this screen. The workspace default ([S-6.1](#scr-6-1)) applies only where no personal value exists. The calendar toggle applies to every date shown here.
- **Validation & Feedback:**
  - Name is **one field**. Forms never require a first/last split, and the field never truncates below 40 characters.
  - A user with no email shows `—` with the reason _"Signed in with Telegram only."_ and an **Add a verified email** action — never a blank field and never a broken avatar.
  - Language, calendar, and timezone changes apply immediately to the session; the save-state indicator still governs, because these are persisted.
- **States:**
  - **Loading:** skeleton for the profile card; the save-state indicator resolves immediately as `idle` so the author is never shown a phantom `dirty`.
  - **Default:** Current profile populated; role field read-only (managed in [S-6.2](#scr-6-2)).
  - **Unlink Blocked:** Removing the last connected provider is blocked: _"You need at least one sign-in method to access your account."_
  - **MFA Mid-flow:** as above — recoverable at every step, and 2FA stays off until confirmed.
  - **MFA Enabled:** the toggle is on and locked behind `Replace authenticator`; losing the authenticator is recoverable through [S-6.8](#scr-6-8) Account recovery.
  - **Backup codes viewed:** a one-time panel; navigating away is a deliberate act and the warning is shown before it.
  - **Session Revoked:** confirmation via [S-7.1](09-Shared-Components.md#scr-7-1); target device signed out immediately.
  - **Error copy:** _"We couldn't save your profile. Your draft is kept on this device."_
- **Resilience:**
  - **Forbidden (403):** out-of-role a user cannot view or change **anyone else's** profile — the route only ever resolves the signed-in user, and a tampered `:id` returns this page with a request ID and **Back to My Profile**.
  - **Offline:** persistent banner; the section renders read-only. A queued profile save flushes in order on reconnect.
  - **Session expired:** a 2-minute warning modal; an in-flight MFA setup is discarded explicitly (2FA stays off) and the screen says so rather than half-resuming.
  - **Conflict:** a profile edited in another tab shows _"Changed by {actor} {N} minutes ago — Review changes / Keep mine."_
  - **Partial failure:** _"Name and photo saved. Timezone was rejected — that zone is not in the current tz database."_
  - **Server error:** _"We couldn't load your profile — nothing was changed."_ with retry and request ID.
- **Navigation:**
  - "Set up" MFA → the inline three-step flow in place, reusing the [S-0.3](01-Authentication-and-Onboarding.md#scr-0-3) pattern
  - "Regenerate backup codes" / "Replace authenticator" → [S-7.1](09-Shared-Components.md#scr-7-1) confirmation
  - "View & sign out" → sessions modal (same screen)
  - Logout (header) → [S-0.1](01-Authentication-and-Onboarding.md#scr-0-1) Login

---

<a id="scr-6-6"></a>

##### Screen Name: S-6.6 Billing & Subscription 🔄 CHANGED

- **Purpose:** Manage the workspace's own platform subscription: plan, usage, payment method, and invoices. Distinct from course-payment gateways in [S-6.3](#scr-6-3).
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Billing & Subscription"                                 │
  ├──────────────────────────────────────────────────────────────────┤
  │ Current plan: Growth — ETB 5,900.00 / month (USD 99.00)          │
  │               Next charge 2026-10-01        [Change plan]        │
  │ Usage   Seats  46 / 100   ▓▓▓▓░░░░░░ 46%                         │
  │         Students 246 / 1,000   ▓▓░░░░░░░░ 25%                    │
  ├──────────────────────────────────────────────────────────────────┤
  │ Plans                                                            │
  │ | Tier    | Price / month        | Seats | Students | Over limit │
  │ |---------|----------------------|-------|----------|------------│
  │ | Starter | ETB 2,900.00 (USD 49)|   25  |      200 | Read-only  │
  │ | Growth  | ETB 5,900.00 (USD 99)|  100  |    1,000 | Enrolment |│
  │ | Scale   | ETB 14,900.00(USD249)|  500  |    5,000 | Overage    │
  │          |                       |       |          | ETB 12/stu │
  ├──────────────────────────────────────────────────────────────────┤
  │ Payment method                                                   │
  │   Card         Visa •••• 4242        exp 04/28   [Replace]       │
  │   Telebirr     +251 91…  · ETB 5,900.00   Transfer pending       │
  │   Bank transfer Acct •••• 4417            Transfer pending       │
  │                                           verification           │
  ├──────────────────────────────────────────────────────────────────┤
  │ Invoices   | Period     | Amount              | Status |       | │
  │            | 2026-09    | ETB 5,900.00 ($99)  | Paid   | [PDF]  |│
  │            | 2026-08    | ETB 5,900.00 ($99)  | Paid   | [PDF]  |│
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Change plan (upgrade, downgrade, or cancel).
  2. Add or replace a payment method — card, Telebirr, or bank transfer.
  3. Download past invoices.
- **Data Displayed/Modified:** Reads/writes `subscriptions`, `invoices`, `payment_methods`.
- **Localization & Formatting (new):** every amount renders through **`Intl.NumberFormat` in the workspace currency with the currency code always visible** — `ETB 5,900.00` — with the USD equivalent in parentheses where the plan is priced in both. A symbol alone is never shown. The plan prices below are the real tiers; Revision 2's single undefined "Growth — $99/mo" figure is gone.
  - Telebirr and bank-transfer amounts render with their **status** attached, per [Part 11 § Localization & Formatting](11-Global-Standards.md#localization--formatting).
- **Notification Delivery (new):** receipts and invoices follow [Part 11 § Notification Delivery](11-Global-Standards.md#notification-delivery) — in-app always, Telegram by default, email only where the billing contact has a verified address. When the contact is Telegram-only, the receipt states it: _"{contact} has no email on file — sent in-app and via Telegram."_ Every invoice is downloadable **in-app regardless of channel**, so email is a convenience and never the only route.
- **Validation & Feedback:**
  - The plan table is the source of what a change costs; the confirmation quotes the amount in the workspace currency before any charge.
  - A downgrade that would put the workspace over the new limit lists the exact seats and students that must go first.
  - Telebirr and bank transfer show **"Transfer pending verification"** until the payment is matched; the workspace is **not** downgraded while a transfer is pending.
- **States:**
  - **Loading:** skeleton rows for invoices and the plan table.
  - **Empty:** "No invoices yet. Your first invoice appears here after a payment clears." — deliberately **not** a CTA, because there is nothing for the user to do.
  - **Default:** Current plan, usage, and payment methods populated.
  - **Approaching Limit:** warning-tinted banner at 90% of seat/student usage: _"You're close to your plan limit."_ with the over-limit behaviour named in the same sentence.
  - **Transfer Pending Verification:** informational pill + the pending amount; the invoice row reads Pending, not Failed.
  - **Payment Failed:** danger-tinted banner: _"Your last payment failed. Update your payment method to avoid service interruption."_
  - **Cancelling:** [S-7.1](09-Shared-Components.md#scr-7-1) confirmation with a retention offer, stating the end date and what is lost.
  - **Error copy:** _"We couldn't load your billing details. Nothing was charged."_
- **Resilience:**
  - **Forbidden (403):** a non-Admin gets a dedicated page with a request ID and **Ask an admin for access**; the Billing sub-nav item is absent. **Revenue figures are redacted server-side for the Support role** — absent from the payload, not hidden by CSS.
  - **Not found (404):** an invoice that has been purged offers **Back to Billing** + request ID.
  - **Offline:** persistent banner; the section renders read-only. **A plan change cannot be submitted offline** — it is disabled with the reason, because a paid change must not be queued optimistically.
  - **Session expired:** a 2-minute warning modal; a half-entered plan change is preserved and reopened.
  - **Conflict:** a plan change made in another tab shows _"Changed by {actor} {N} minutes ago — Review changes / Keep mine."_
  - **Partial failure:** _"Plan changed. The new payment method was rejected — your old card is still active."_
  - **Server error:** _"We couldn't reach the billing provider — you have not been charged."_ with retry and request ID.
- **Navigation:**
  - "Change plan" → plan comparison modal (this table)
  - Invoice `[PDF]` → in-app download
  - Payment rows → [S-6.3](#scr-6-3) Integrations
- **Instrumentation & acceptance:**
  - Events: `billing.plan_changed` (`from`, `to`, `method`) · `billing.payment_method_added` (`method`) · `billing.transfer_submitted` (`method`, `amount_currency`) · `billing.invoice_downloaded`.
  - No amount renders without its currency code.
  - A Telebirr or bank-transfer invoice reads Pending until matched — never Paid and never Failed.
  - A Support-role response payload contains no revenue figure at all.
  - A plan change submitted while offline is blocked with a reason, not queued.
  - Budget: billing section interactive < 1 s; the plan table renders all three tiers without a network round trip after first paint.

---

<a id="scr-6-7"></a>

##### Screen Name: S-6.7 API & Webhooks 🔄 CHANGED

- **Purpose:** Manage API keys and outbound webhooks for integrating Abugida with external systems (CRMs, data warehouses, custom apps).
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "API & Webhooks"                                         │
  ├──────────────────────────────────────────────────────────────────┤
  │ API Keys                                     [+ Create API key]  │
  │ | Name   | Scopes                | Last used | Expires | By |    │
  │ |--------|------------------------|----------|---------|----|    │
  │ | Zapier | read:courses,          | 2h ago   | never   | JD |    │
  │ |        | read:students          |          |         |    |…   │
  │ | ETL    | read:revenue, admin    | 31d ago  | 2027-01 | JD |    │
  │ |        | CIDR 197.1.2.0/24      |          |         |    |    │
  │           [Rotate] [Revoke]                                      │
  ├──────────────────────────────────────────────────────────────────┤
  │ Webhooks                              [+ Add webhook]            │
  │ | Event              | Status | Last delivery | Lat. | HTTP | …  │
  │ |--------------------|--------|---------------|------|------|…   │
  │ | enrollment.created | ● OK   | 4m ago       | 210ms| 200  |…   |│
  │ | course.published   | ✕ Fail | 3d ago       |  —   | 500  |…   |│
  │ |                     6 consecutive failures    [Pause] [Retry] ││
  │ [View delivery logs]   Signing secret: X-Hub-Signature-256       │
  │                        (HMAC-SHA256 over the raw body; once only)│
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Create an API key with a name, an **explicit scope list**, an optional expiry, and an optional CIDR restriction.
  2. **Rotate** a key — issues a successor with a **24-hour overlap**, so the consumer can be updated before the old key dies.
  3. Revoke a key.
  4. Add, edit, pause, and test a webhook endpoint.
  5. Inspect delivery logs and retry failed deliveries.
- **Data Displayed/Modified:** Reads/writes `api_keys`, `webhooks`, `webhook_deliveries`.
- **API key contract (new):**
  - Creation is a form, not a button: **name**, **scopes** (multi-select from `read:courses`, `write:courses`, `read:students`, `read:revenue`, `admin` — no wildcard), **expiry** (optional; `never` is explicit and labelled as such), **CIDR restriction** (optional).
  - The key table gains **Last used**, **Expires**, **Created by**, and a **`[Rotate]`** action alongside `[Revoke]`. A rotated key enters a visible "superseded — expires in 24h" state rather than vanishing, so an unnoticed consumer failure is diagnosable.
  - `admin` scope is confirmed with [S-7.1](09-Shared-Components.md#scr-7-1) and named in the audit entry.
- **Webhook contract (new):**
  - Each row gains **Last delivery**, **Latency**, **HTTP status**, **Consecutive failures**, and **[Pause]**.
  - The **signing secret is shown once** at creation, with the **HMAC header documented in the same modal**: `X-Hub-Signature-256: sha256=<hex>`, computed over the raw request body, plus the delivery-ID header used to deduplicate.
  - Retries use **exponential backoff**, and after **10 attempts** the delivery moves to a **dead-letter queue** viewable in the delivery log with a **Retry** action. A failing endpoint is **never retried indefinitely**, and never silently.
- **Validation & Feedback:**
  - Endpoint URLs must be HTTPS; a plaintext URL is rejected with the reason.
  - A paused webhook keeps its configuration and its history; pausing is a labelled toggle, not a delete.
- **States:**
  - **Empty (keys):** "No API keys. Create one to read or write course data programmatically." with **Create key** as the single CTA. **Empty (webhooks):** "No endpoints. Add one to receive events." These are two independent empty states, not one.
  - **Key Generated / Rotated:** one-time reveal modal — _"Copy this key now — you won't see it again."_ The modal cannot be dismissed without an acknowledgement that it was not copied.
  - **Superseded Key:** visible for 24h with its own `Revoke now`.
  - **Webhook Failing:** danger pill, the consecutive-failure count, and `[Retry]`.
  - **Dead-lettered:** a distinct pill — not "Failed" — and the log row links to the payload.
  - **Paused:** archived-tint pill; the row is collapsed but the history is one click away.
  - **Testing:** `[Send test event]` shows request/response payload inline with headers and signature.
- **Resilience:**
  - **Forbidden (403):** a dedicated page with a request ID and **Ask an admin for access**; the sub-nav item is absent.
  - **Not found (404):** a revoked or purged key row offers **Back to API & Webhooks** + request ID.
  - **Offline:** persistent banner; the section renders read-only — a key must never be created from a queued write.
  - **Session expired:** a 2-minute warning modal; **a pending one-time key reveal is re-revealed on return** rather than lost.
  - **Conflict:** a webhook edited elsewhere shows _"Changed by {actor} {N} minutes ago — Review changes / Keep mine."_
  - **Partial failure:** _"Webhook saved. The test delivery failed — the endpoint returned 401."_ — configuration and verification are reported separately.
  - **Server error:** _"We couldn't load your API keys and webhooks. Nothing was revoked."_ with retry and request ID.
- **Navigation:**
  - `[Rotate]` / `[Revoke]` → [S-7.1](09-Shared-Components.md#scr-7-1) confirmation
  - "View delivery logs" → expands an inline log table (same screen)
  - Dead-letter row → delivery detail with the full payload and `[Retry]`

---

<a id="scr-6-8"></a>

##### Screen Name: S-6.8 Security & Audit Log 🔄 CHANGED

- **Purpose:** Workspace-wide security policy configuration and a searchable, exportable audit trail of sensitive actions (logins, permission changes, deletions, exports).
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Security & Audit Log"                                   │
  │ Tabs (inside the section): [Policies] [Audit Log]                │
  ├──────────────────────────────────────────────────────────────────┤
  │ ┌─ Policies ──────────────────────────────────────────────────┐  │
  │ │  [✓] Require MFA for all admins                              │ │
  │ │  Session timeout: [8 hours ▾] 15m · 1h · 8h · 24h · 7d      │  │
  │ │  "You'll be warned 2 minutes before expiry.                  │ │
  │ │   Unsaved drafts are kept."                                  │ │
  │ │  Sign-in methods: Google · Telegram (configured in S-6.3)    │ │
  │ │  Allowed login IP ranges: [10.0.0.0/8, 197.1.2.0/24]         │ │
  │ │    2 ranges. ⚠ Your current address 197.1.2.3 is outside     │ │
  │ │    these ranges — you will lock yourself out on save.         ││
  │ │    Confirm emergency recovery code to continue.               ││
  │ └──────────────────────────────────────────────────────────────┘ │
  │ ┌─ Audit Log ─────────────────────────────────────────────────┐  │
  │ │  Filters: [2026-01-01 → 2026-09-29] [Actor ▾] [Action ▾]      ││
  │ │          [Target ▾] [Search] [Export CSV]                     ││
  │ │  | Time (ISO-8601 + offset) | Actor | Action | Target |        │
  │ │  | 2026-09-29T09:14+03:00 | Jane S.| role.changed | Alex J. |  │
  │ │  | 2026-09-28T16:02+03:00 | John D.| course.deleted | GRE101|  │
  │ │  1–50 of 1,284        ‹ 1 2 3 … 26 ›   Retained 24 months    │ │
  │ └──────────────────────────────────────────────────────────────┘ │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Configure MFA enforcement, session timeout, and sign-in method policy.
  2. Restrict logins to allow-listed IP ranges.
  3. Search, filter, and export the audit log.
  4. Recover a locked-out member via the **Account recovery** block.
- **Data Displayed/Modified:** Reads/writes `security_policies`; reads `audit_log` (append-only).
- **Account Recovery (new):** two paths, both writing **immutable audit entries** and both unavailable to a user with no second trusted party.
  - **Request an admin reset** — the locked-out member raises a request; a **single-use code valid for 30 minutes** is delivered **over Telegram to a second verified contact**, and is consumed by a **different Admin**. The requester never receives a credential.
  - **Verified support recovery** — a Support agent with a verified identity **unlocks a 24-hour window** on a second admin or support role, allowing them to complete the reset. The window, its scope, and its expiry are all written to the audit log.
  - Neither path can be used by the sole Admin of a workspace, and neither can be self-granted.
- **Session Timeout (new):** the control enumerates **15m · 1h · 8h · 24h · 7d** with the copy: _"You'll be warned 2 minutes before expiry. Unsaved drafts are kept."_ The 2-minute warning is a modal per [Part 11 § Resilience States](11-Global-Standards.md#resilience-states), listing the surfaces with unsaved work.
- **IP allow-list (new):**
  - Every entry is **CIDR-validated**; a bare address or a malformed range is rejected with the reason and the corrected form offered.
  - A **live count of ranges** sits under the field.
  - A **self-lockout check** runs against the acting user's current address on every keystroke and before save: _"Your current address 197.1.2.3 is outside these ranges — you will lock yourself out on save."_
  - **Save is blocked until an emergency recovery code is confirmed** whenever the check trips. There is no override flag.
- **Audit Log (new):**
  - **Action enum** — `auth.login`, `auth.logout`, `role.changed`, `member.invited`, `member.removed`, `settings.updated`, `branding.updated`, `apikey.created`, `apikey.revoked`, `webhook.updated`, `retention.executed`, `data.exported`, `data.erased`, `course.deleted`. Anything not in this list is not emitted.
  - **Filter row** — date range, actor, action, target type. Filters are reflected in the export.
  - **50-row pagination**, with server-side filtering and sort.
  - **24-month retention**, stated in-product on the screen. **30 days before the purge an in-product notice appears** naming the purge date and the export option; the log is never purged silently.
- **Localization & Formatting (new):** the audit log renders **absolute ISO-8601 with offset** — `2026-09-29T09:14+03:00` — and **never** "today" or "Yesterday". This holds in the UI, in the CSV export, and in any compliance context, so a screenshot and the export agree.
- **Validation & Feedback:**
  - **"Require MFA for all admins" is blocked when the workspace has exactly one Admin**, with: _"Add a second admin first — otherwise a lost authenticator locks the workspace."_ plus a deep link to [S-6.2](#scr-6-2).
  - Narrowing the session timeout shows what it will sign out.
- **States:**
  - **Loading:** skeleton rows; the filter row is interactive from the first paint so a user can narrow the log while it loads.
  - **Default:** Current policies populated; audit log paginated, newest first.
  - **Saving Policy:** footer reports `All changes saved at HH:MM`; the entry appears in the audit log.
  - **Self-Lockout Blocked:** the allow-list field is in an error state and the save button is disabled with the reason in `aria-describedby`.
  - **Zero-result:** "No entries match these filters — clear filters", with a **Clear filters** action, not the empty state.
  - **Export:** routes through the [S-5.4](07-Analytics.md#scr-5-4)-style generation flow and is itself an audited `data.exported` entry.
  - **Error copy:** _"We couldn't save this policy. Your other changes in this section are saved."_
- **Resilience:**
  - **Forbidden (403):** a dedicated page with a request ID and **Ask an admin for access**; the sub-nav item is absent. `audit_log` is Admin-only, and Support sees `audit.read_own_actions` rather than the whole log.
  - **Not found (404):** a target link whose resource was hard-deleted offers **Back to Audit Log** + request ID and says _"This course was deleted, or you followed an old link."_
  - **Offline:** persistent banner; the section renders read-only with a queued-count line. **Policy changes are never queued** — a security policy is not applied optimistically.
  - **Session expired:** a 2-minute warning modal; a half-entered CIDR range and its validation state are preserved.
  - **Conflict:** two Admins editing policies shows _"Changed by {actor} {N} minutes ago — Review changes / Keep mine."_
  - **Partial failure:** _"Session timeout saved. The IP allow-list was rejected — one range is malformed."_
  - **Server error:** _"We couldn't load the audit log — nothing was changed."_ with retry and request ID.
- **Navigation:**
  - Audit row "Target" → the relevant screen (e.g. a deleted course row links to [S-2.1](04-Courses.md#scr-2-1) if still recoverable from trash)
  - "Add a second admin" → [S-6.2](#scr-6-2) Team Management
  - Account recovery requests → [S-6.2](#scr-6-2) (the consuming Admin's Team view)
- **Instrumentation & acceptance:**
  - Events: `security.policy_changed` (`policy`, `from`, `to`) · `security.ip_lockout_blocked` (`ranges`) · `security.recovery_requested` (`path`) · `security.recovery_consumed` (`path`, `actor`) · `audit.exported` (`row_count`, `filter_count`).
  - A workspace with exactly one Admin cannot enable "Require MFA for all admins", and the block names the reason.
  - An allow-list that excludes the actor's own address cannot be saved without a confirmed recovery code.
  - Every audit row renders absolute ISO-8601 with offset; the string "yesterday" never appears in the table or the export.
  - Account recovery — either path — produces exactly one immutable audit entry, visible to a second Admin.
  - Budget: audit log first 50 rows < 1.2 s; a filter change re-queries in < 600 ms; export streams rather than buffering.

---

<a id="scr-6-9"></a>

##### Screen Name: S-6.9 Roles & Permissions 🔄 CHANGED

- **Purpose:** Edit the capability set of each workspace role. Revision 3 **replaces the module × CRUD matrix and the free-text lifecycle table with one flat capability list**, so there is a single vocabulary across the product.
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Roles & Permissions"          [+ Create custom role]    │
  │ Role: [Editor ▾]                                                 │
  │ Source of truth: Part 11 — Course Lifecycle Capabilities         │
  ├──────────────────────────────────────────────────────────────────┤
  │ | Capability            | Editor     | What it does            | │
  │ |-----------------------|-------------|-------------------------|│
  │ | course.create         | ● Granted   | Create a course.  → S-2 |│
  │ | course.edit_pricing   | ● Granted   | Price a course.   → S-2 |│
  │ | course.submit_review  | ● Granted   | Draft → In Review. →S-2 |│
  │ | course.review         | ✖ Denied    | Approve or reject.→S-2 | │
  │ | course.publish        | ● Granted   | Publish; gated.   →S-2 | │
  │ | course.unpublish      | ✖ Denied    | Admin only.        →S-2 |│
  │ | course.delete         | ✖ Denied    | Admin only.        →S-2 |│
  │ | assignment.grade      | ● Granted   | Score, release.   →S-2 | │
  │ | finance.view_revenue  | ● Granted   | See revenue.  → Sec 5  | │
  │ | students.read         | ● Granted   | Read students.→ Sec 4  | │
  │ | students.message      | ◌ N/A       | Support only.     → S-4 |│
  │                                              [Save changes]      │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Capability vocabulary (new):** the list is **identical to [Part 11 § Course Lifecycle Capabilities](11-Global-Standards.md#course-lifecycle-capabilities)**, **plus `finance.view_revenue` and `students.read`**, and it includes an explicit row for the **Support** role's full grant (`students.read`, `students.message`, `courses.read_enrolled_context`, `assets.read`, `testimonials.moderate`, `audit.read_own_actions`).
  - **Part 11 is the single source of truth for the default value of every cell.** This screen edits them; it does not restate them. No value is duplicated here that could drift from the matrix.
  - **Each cell is a tri-state checkbox: `granted` / `denied` / `not applicable`.** There is **no free text in any cell** — Revision 2's "own only", "ungated", and "granted" strings inside a matrix are gone, because three different vocabularies for one permission is how a permission ends up enforced in one place and ignored in another.
  - Where Part 11 makes a grant **conditional** (an Editor's `course.publish` on a gated course), the cell is `granted`, the condition is stated in the row's explanation, and the condition is enforced server-side. The control never carries a fourth value.
  - **Every row carries a one-line explanation and a link to the screen that exercises it**, so an administrator configures against real behaviour rather than guessing from a name.
- **Primary Actions:**
  1. Select a role and set each capability to granted, denied, or not applicable.
  2. Create a custom role by cloning an existing one.
  3. Save and apply changes to all users holding that role.
- **Data Displayed/Modified:** Reads/writes `roles`, `role_permissions`.
- **Validation & Feedback:**
  - The built-in **Admin** core permissions are locked, with the reason stated inline — a workspace may not be left with no full Admin.
  - A save that would leave zero users able to manage Billing or Settings is **blocked**, naming the roles affected and who holds them.
  - A save that would leave no user able to `course.review` a gated course is **blocked**; where the only reviewer authored the change, the row reads **"Yours — awaiting another reviewer"** with a Reassign action.
- **States:**
  - **Loading:** skeleton capability rows; the role selector resolves first so the Admin sees their own permissions before the matrix paints.
  - **Built-In Role:** locked cells are visible and disabled with a reason in `aria-describedby`, never hidden.
  - **Dirty:** the sticky footer reads `Unsaved changes · ⌘S`; the role switcher is blocked until flushed.
  - **Saving:** `Permissions updated — changes apply immediately.` (the apply is immediate, not queued).
  - **Zero-result:** a capability search that matches nothing offers **Clear filters**.
  - **Error copy:** _"We couldn't save these permissions. No changes were applied."_
- **Resilience:**
  - **Forbidden (403):** a dedicated page with a request ID and **Ask an admin for access**; the Roles sub-nav item is absent.
  - **Offline:** persistent banner; the matrix renders read-only. **Permission changes are never queued** — a permission is not granted optimistically.
  - **Session expired:** a 2-minute warning modal; the edited matrix is preserved and reopened.
  - **Conflict:** two Admins editing the same role shows _"Changed by {actor} {N} minutes ago — Review changes / Keep mine."_
  - **Partial failure:** a multi-row save reports per-capability results — _"6 of 7 saved. `finance.view_revenue` was rejected — it cannot be granted without `students.read`."_
  - **Server error:** _"We couldn't load the roles — no changes were applied."_ with retry and request ID.
- **Navigation:**
  - "Create custom role" → inline role-naming step, then the same list
  - Capability help link → the owning screen ([S-2.22](04-Courses.md#scr-2-22), [S-2.23](04-Courses.md#scr-2-23), [S-5.1](07-Analytics.md#scr-5-1), [S-4.1](06-Students.md#scr-4-1))
  - Back → [S-6.2](#scr-6-2) Team Management
- **Instrumentation & acceptance:**
  - Events: `roles.capability_changed` (`role`, `capability`, `from`, `to`) · `roles.custom_created` (`source_role`) · `roles.save_blocked` (`reason`).
  - No cell renders free text; every value is one of the three tri-state options.
  - The **Support** role's full grant is listed in the capability list, and `finance.view_revenue` is **absent from the Support payload** rather than rendered as denied.
  - A configuration that would leave zero Billing/Settings managers cannot be saved.
  - A configuration that would leave a gated course with no reviewer cannot be saved.
  - Budget: the capability list renders and is interactive < 500 ms; a save confirms in < 800 ms.

---

<a id="scr-6-10"></a>

##### Screen Name: S-6.10 Privacy & Data Retention 🔄 CHANGED

- **Purpose:** GDPR/CCPA compliance toolkit: automated retention policies that anonymize or delete student data after a period of inactivity, a queue for data-subject requests (export/erase) with SLA countdowns, and a consent log. Sensitive actions are always dual-confirmed and fully audited.
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Privacy & Data Retention"                               │
  │ Tabs (inside the section): [Retention] [Data requests (2)]       │
  │                            [Consent log]                         │
  ├──────────────────────────────────────────────────────────────────┤
  │ ┌─ Retention Policies ───────────────────────────────────────┐   │
  │ │ [✓] Anonymize inactive students                               ││
  │ │     Inactivity [12 months ▾] → Anonymize PII, keep progress   ││
  │ │     Warning [14 days ▾] before action                         ││
  │ │     Delivered: in-app + Telegram, and email where verified.   ││
  │ │ [ ] Delete students inactive for [24 months ▾]                ││
  │ │     Scope: ☑ Profile & contact ☑ Messages ☐ Certificates     │ │
  │ │            (kept for audit)                                   ││
  │ │ Next run: 2026-10-01 · 42 students match        [Preview]     ││
  │ └──────────────────────────────────────────────────────────────┘ │
  │ ┌─ Data Requests ────────────────────────────────────────────┐   │
  │ | Student   | Type   | Requested | SLA      | Action            |│
  │ | Tigist M. | Export | Sep 5     | 26d left | [Prepare export]  |│
  │ | Daniel W. | Erase  | Sep 3     | 24d left | [Review & erase]  |│
  │ Export ready: [Download in-app] (re-auth · expires in 7 days)    │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Configure retention policies: inactivity threshold, action (anonymize PII vs. hard delete), scope (profile, messages, progress, certificates), and advance warning.
  2. Preview the exact set of students a policy currently matches before it next runs.
  3. Process data-subject requests: generate a portable data export, or review and execute a verified erasure request.
  4. Review the consent log (marketing opt-ins, terms acceptance) with timestamps and source.
- **Data Displayed/Modified:** Writes `retention_policies`, `data_requests`, `consent_records`; anonymization nulls PII fields while preserving `student_id` integrity for historical analytics.
- **Notification Delivery (new) — three places, one rule:** exports, retention warnings, and consent records all follow [Part 11 § Notification Delivery](11-Global-Standards.md#notification-delivery). **The requester is notified on every channel they have a verified address for**: in-app always, Telegram when linked, email only when `users.email` is non-null and verified. **Email is never the only route to anything.**
  - **Data export retrieval (new).** A prepared export is downloadable **in-app behind re-authentication** at **`/settings/privacy/requests/:id/download`**, with a **7-day expiry**. An emailed copy, where the address is verified, is an additional convenience.
  - **When no channel exists at all** — a user who is in-app only and unlinked — the copy is: _"We can't reach you automatically. Ask your workspace admin to release this export to a verified address."_ The request stays open and the SLA keeps counting; the admin is not left to guess.
- **Validation & Feedback:**
  - Deletion scope never silently removes financial records; invoices/transactions are retained per tax rules and shown as exceptions.
  - Anonymized students disappear from [S-4.1](06-Students.md#scr-4-1) directory filters by default but remain in aggregate analytics (clearly labeled "anonymized").
  - All policy runs, exports, and erasures write immutable entries to [S-6.8](#scr-6-8) Security & Audit Log.
- **States:**
  - **Loading:** skeleton for the requests table and the retention rules; the export action is disabled with the reason "Loading retention policy…" rather than silently inert.
  - **Policy Enabled:** shows the next run date and current match count; changes require a [S-7.1](09-Shared-Components.md#scr-7-1) confirmation with an impact summary.
  - **Preview:** "42 students match. 5 have already been warned — 5 in-app · 5 Telegram · 3 email (2 have no email on file)." with the full list before any action.
  - **Executed:** run summary — "38 anonymized · 4 skipped (active in last 14 days)" — logged to the audit trail.
  - **Export Request:** prepares an archive (profile, enrollments, progress, certificates) → retrievable at `/settings/privacy/requests/:id/download` behind re-auth, 7-day expiry, notified on every available channel.
  - **Export Expired:** the download link is dead after 7 days; the row offers **Regenerate export** rather than a broken link.
  - **Unreachable Requester:** the _"We can't reach you automatically…"_ copy, with the request still open and the SLA still counting.
  - **Delete Request:** two-step — verify identity → [S-7.1](09-Shared-Components.md#scr-7-1) typed confirmation ("Type ERASE") → irreversible deletion with a completion receipt.
  - **SLA Warning:** danger pill when a request is within 5 days of its 30-day statutory deadline.
- **Resilience:**
  - **Forbidden (403):** a dedicated page with a request ID and **Ask an admin for access**; the Privacy sub-nav item is absent. Support has no access to this section at all.
  - **Not found (404):** an expired or purged request offers **Back to Privacy** + request ID.
  - **Offline:** persistent banner; the section renders read-only. **A retention run cannot be triggered offline** — a destructive automated action is never queued.
  - **Session expired:** a 2-minute warning modal; an in-progress erasure confirmation is preserved and reopened, and **never completes on expiry** — an unattended irreversible action requires a live session.
  - **Conflict:** a policy edited by another Admin shows _"Changed by {actor} {N} minutes ago — Review changes / Keep mine."_
  - **Partial failure:** a multi-student erasure reports per-student results — _"Erased 37 of 38. Daniel W. is in an open financial dispute — see exceptions."_
  - **Server error:** _"We couldn't load privacy settings. No retention run was started."_ with retry and request ID.
- **Navigation:**
  - Opened from the settings sub-nav (or [S-A.1](02-Global-Navigation.md#scr-a-1) Settings group)
  - "Security & Audit Log" → [S-6.8](#scr-6-8) (filtered to privacy events)
  - Student name in Data Requests → [S-4.2](06-Students.md#scr-4-2) Student Profile
  - Export download → `/settings/privacy/requests/:id/download` (re-authenticated)
- **Instrumentation & acceptance:**
  - Events: `retention.policy_updated` (`action`, `threshold_months`, `scope`) · `retention.previewed` (`match_count`) · `retention.executed` (`processed`, `skipped`) · `privacy.export_downloaded` (`request_id`, `authed`) · `privacy.erase_completed` (`request_id`).
  - A completed export is downloadable in-app without any email being sent.
  - A request from a user with no verified email and no linked Telegram shows the "We can't reach you automatically…" copy and stays open.
  - An export link older than 7 days returns an expiry page with **Regenerate export**, not a 500.
  - Retention warnings show a per-channel breakdown including the "has no email on file" count.
  - Budget: request queue first 50 rows < 1 s; a preview of 500 matching students returns in < 2 s.

---

<a id="scr-6-11"></a>

##### Screen Name: S-6.11 Danger Zone 🆕 NEW

- **Purpose:** The three irreversible or workspace-level actions, gathered in one section so they are never adjacent to an ordinary save. Reached from the last entry in the settings sub-nav.
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Danger Zone"                                            │
  │ Sub-nav (left, persistent):  [Danger Zone] is the active item    │
  ├──────────────────────────────────────────────────────────────────┤
  │  ⚠ These actions affect every member, every course, and every    │
  │    student's record in this workspace.                           │
  │                                                                  │
  │  Transfer ownership to another admin                             │
  │    Not reversible by you once the new owner accepts.             │
  │                                            [Transfer ownership]  │
  │                                                                  │
  │  Export workspace data                                           │
  │    Everything: courses, students, grades, billing records.       │
  │    Always available — never gated, never disabled.               │
  │                                              [Export workspace]  │
  │                                                                  │
  │  Delete this workspace                                           │
  │    Deletes all content. Recoverable for 30 days.                 │
  │    Cannot run while a payout run is active.                      │
  │                                             [Delete workspace]   │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. **Transfer ownership** — hand the workspace to a **current Admin**.
  2. **Export workspace data** — always available, never gated.
  3. **Delete workspace** — typed confirmation, 30-day soft delete.
- **Data Displayed/Modified:** Reads/writes `workspaces` (owner), `workspace_deletion_requests`, and triggers a workspace-scoped export job.
- **Validation & Feedback:**
  - **Transfer ownership** — the target must already be a **current Admin** of this workspace. Both parties confirm: the outgoing owner selects the target and confirms; the **incoming owner must accept** before ownership moves. Neither party can act alone, and the outgoing owner remains owner until acceptance. A declined or expired request leaves ownership unchanged and says so.
  - **Export workspace data** — **never gated**: it is available even to a workspace with a pending deletion request, and even when a payout run is active. It exports courses, enrollments, grades, messages, and billing records. Delivery follows [Part 11 § Notification Delivery](11-Global-Standards.md#notification-delivery), and the archive is downloadable **in-app** at `/settings/privacy/requests/:id/download` behind re-authentication, 7-day expiry.
  - **Delete workspace** — confirmed by typing the **exact workspace name** into the [S-7.1](09-Shared-Components.md#scr-7-1) destructive variant. The dialog states, before the field is enabled: what is deleted, what is retained (invoices and audit records, per tax and compliance rules), and the **30-day** recovery window.
- **States:**
  - **Soft-deleted banner** — a persistent, non-dismissible banner across the whole workspace: _"This workspace is scheduled for deletion on {date}. {N} days left to restore."_ with a **Restore** action. The workspace is read-only apart from Restore and Export.
  - **Purge confirmation (day 30)** — on the final day the Restore action is replaced by an irreversible purge confirmation, which itself requires typing the workspace name a second time.
  - **Blocked by payout run** — Delete is **disabled with a reason**: _"A payout run started 12 minutes ago and finishes in about 4 minutes. Try again after it completes."_ plus a **View payout run** link. It is never silently queued behind the run.
  - **Transfer pending** — the action reads `Awaiting acceptance from {name}` with **Cancel transfer**.
  - **Transfer accepted** — the acting user is no longer an Admin; the workspace re-resolves their role and the sub-nav drops the sections they lost, naming what changed.
  - **Restore** — [S-7.1](09-Shared-Components.md#scr-7-1) confirmation; the workspace returns to its exact prior state and the banner disappears.
  - **Hard purge** — after the window, the workspace and its content are removed; the audit trail for the purge itself is retained.
- **Resilience:**
  - **Forbidden (403):** a non-Admin gets a dedicated page with a request ID and **Ask an admin for access**; the Danger Zone sub-nav item is absent. **Transfer, Export, and Delete are all Admin-only and enforced server-side.**
  - **Not found (404):** a purged workspace offers **Back to sign in** + request ID.
  - **Offline:** persistent banner; the section renders read-only. **Transfer and Delete cannot be submitted offline** — ownership and deletion are never queued.
  - **Session expired:** a 2-minute warning modal; a typed confirmation is **cleared**, never preserved, because a restored half-typed workspace name is a hazard.
  - **Conflict:** a second Admin acting on the same workspace shows _"Changed by {actor} {N} minutes ago — Review changes / Keep mine."_ — for a transfer this means the incoming owner is asked again.
  - **Partial failure:** _"Export prepared. 2 of 3 asset classes failed to archive — retry the export to include them."_ The export is marked incomplete rather than delivered as if whole.
  - **Server error:** _"We couldn't schedule the deletion. Nothing has been changed."_ with retry and request ID.
- **Navigation:**
  - Reached from the last settings sub-nav entry; every destination is Admin-only.
  - Restore returns the user to [S-6.1](#scr-6-1) General with the banner cleared.
  - "View payout run" → [S-8.4](10-Marketing-and-Growth.md#scr-8-4) affiliate payout runs
  - Purge, transfer acceptance, and restore all write immutable audit entries visible in [S-6.8](#scr-6-8)
- **Instrumentation & acceptance:**
  - Events: `danger.transfer_requested` (`to`) · `danger.transfer_accepted` (`by`) · `danger.export_requested` (`scope`) · `danger.deletion_scheduled` (`purge_date`) · `danger.restored` (`days_elapsed`) · `danger.purged`.
  - **Export is available in every state** — including a pending deletion — and is never disabled.
  - Delete is blocked while a payout run is active, and the block names the run and its ETA.
  - Ownership does not move until the **incoming** owner accepts; cancelling before acceptance leaves the original owner intact.
  - Deletion requires typing the exact workspace name, and a soft-deleted workspace can be restored for the full 30 days.
  - Budget: the screen renders with no blocking calls; a full export job is queued in < 1 s and reported in-app when ready.
