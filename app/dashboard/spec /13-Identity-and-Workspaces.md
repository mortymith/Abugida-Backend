# Identity, Workspaces & Access

> **Abugida Academy — UX Design Specification** · Part 13 of 13 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Global Standards](11-Global-Standards.md)

This part is the **identity authority** for the specification. Every other part writes "Admin, Editor, Reviewer, Viewer, Support" and defers to here for what those words mean, where they are stored, and who may change them.

The implementation is Better Auth's `organization()` and `twoFactor()` plugins, configured in `app/dashboard/src/config/auth.server.ts` and backed by `packages/database/src/schema/auth/`. **The plugin is the runtime; this part is its user-facing contract.** Where a screen needs behaviour the plugin does not yet provide, the gap is stated rather than implied.

---

## What changed in Part 13 (Revision 1 — new part)

- Establishes the **organization = workspace** model, which Parts 00–12 had been using without ever defining.
- Reconciles the **two role systems** the product actually has: Better Auth's `member.role` (workspace-scoped) and `course_roles` (course-scoped). The spec described one.
- Documents the **active-organization** concept and the workspace switcher, which had no screen anywhere.
- Makes **configuration** — limits, invitation policy, MFA policy, session policy — a first-class, visible surface in [S-6.1](08-Settings.md#scr-6-1) and [S-6.8](08-Settings.md#scr-6-8) rather than environment variables only.
- Records **four blocking implementation gaps** that the spec previously assumed away.

---

## The Workspace Model

An **organization is a workspace**. One user may belong to several; the app operates on exactly one at a time, held in the session as the **active organization**.

| Concept          | Stored in                | Scope     | Notes                                                                 |
| ---------------- | ------------------------ | --------- | --------------------------------------------------------------------- |
| **Organization** | `organization`           | —         | `name`, `slug` (unique), `logo`, `useCase`. The workspace.            |
| **Member**       | `member`                 | Workspace | `userId` + `organizationId` unique; `role` is a text field.           |
| **Invitation**   | `invitation`             | Workspace | `email` **NOT NULL**, `role`, `status`, `expiresAt`, `inviterId`.     |
| **Session**      | `session`                | User      | Carries the **active organization id**.                               |
| **Course role**  | `course_roles` → `roles` | Course    | `roleId`, `grantedBy`, `revokedAt`. **Independent of `member.role`.** |
| **Two-factor**   | `twoFactor`              | User      | Encrypted TOTP secret, hashed backup codes, `lockedUntil`.            |

> **A workspace is not a user.** A user with no `member` row is authenticated but has no workspace, which is the `403` case in [Part 11 § Resilience States](11-Global-Standards.md#resilience-states).

### Glossary addition

| Term                 | Means                                                                                                      | Never means                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------- |
| **Workspace**        | One row in `organization`. The unit of settings, branding, billing, and courses.                           | A user, or a team inside one    |
| **Member role**      | `member.role` — workspace-wide. One value per user per workspace.                                          | A course-scoped capability      |
| **Course role**      | `roles` + `course_roles` — assigned per course, grantable and revocable.                                   | The same thing as a member role |
| **Active workspace** | The `organizationId` in the current session. All reads and writes are scoped to it.                        | A UI preference                 |
| **Effective role**   | The **union** of the member role and every non-revoked course role, intersected with the active workspace. | Either alone                    |

---

## The Two Role Systems

This is the most important correction in the part. The product has **two independent role mechanisms**, and the previous specification described only one.

### 1. Member role — workspace-wide

`member.role` is a single text value per user per workspace. Better Auth's `organization()` plugin seeds `owner` and `admin`; any other string is accepted because the column is unconstrained `text`.

| Spec role    | `member.role` value | Rationale                                                                      |
| ------------ | ------------------- | ------------------------------------------------------------------------------ |
| **Admin**    | `owner` or `admin`  | Full control. `owner` is the single ownership holder; `admin` is its delegate. |
| **Editor**   | `member`            | Authors content. Default value for anyone who is not an admin.                 |
| **Reviewer** | `member` + a flag   | ⚠ **Not expressible today** — see [GAP-1](#implementation-gaps).               |
| **Viewer**   | `member`            | Read-only, enforced by the capability table, not by `member.role`.             |
| **Support**  | `member` + a flag   | ⚠ **Not expressible today** — see [GAP-1](#implementation-gaps).               |

> **Roles are enforced by capability, not by the role string.** The matrix in [Part 11 § Course Lifecycle Capabilities](11-Global-Standards.md#course-lifecycle-capabilities) is the enforcement layer; `member.role` only answers "may this person change the workspace itself". A user with `member.role = 'member'` who holds a **course role** of `reviewer` on one course can review that course and nothing else. This is why Viewer and Support are not role strings.

### 2. Course role — per course

`course_roles` joins a user to a role **within one course**, with `grantedBy` and `revokedAt` for audit. This is what lets an Instructor review their colleague's course without becoming a workspace admin.

| `roles.name` | Grants within one course                  | Typical holder |
| ------------ | ----------------------------------------- | -------------- |
| `owner`      | Everything, including deletion            | Course creator |
| `instructor` | Author and publish an ungated course      | Editor         |
| `reviewer`   | Approve, request changes, reject          | Reviewer       |
| `viewer`     | Read only                                 | Viewer         |
| `support`    | Read enrollment context, message students | Support        |

`roles.permissions` is a `jsonb` array, so a role's capability set is data, not code.

### Precedence, stated once

1. **Workspace capability is the ceiling.** A course role never grants a capability the member role denies — a `viewer` member holding an `instructor` course role can read that course, not author it.
2. **Course roles are additive within that course.** The effective role for a course is the union of member-derived and course-derived capabilities, capped by (1).
3. **`revokedAt IS NOT NULL` means the grant is void immediately**, with no session invalidation needed.
4. **Revoking a member role does not delete `course_roles` rows**; the rows go dormant and are listed under _Reassigned on next membership change_ in [S-6.2](08-Settings.md#scr-6-2).

**Self-approval guard** ([Part 11](11-Global-Standards.md#course-lifecycle-capabilities)) is enforced here: `course.review` is denied to the author of the change, so a Reviewer cannot approve their own submission. Where a workspace has one reviewer who authored the item, the queue row reads **"Yours — awaiting another reviewer"** with a Reassign action.

---

## Configuration Surface

Configuration is currently environment variables in `src/config/app.config.ts` (`TOTP_ISSUER`, `TWO_FACTOR_COOKIE_MAX_AE`, `TRUST_DEVICE_MAX_AGE`, `ACCOUNT_LOCKOUT_MAX_ATTEMPTS`, `ACCOUNT_LOCKOUT_DURATION`) plus unconfigured plugin defaults. **Workspace owners need to change some of it without a redeploy**, and need to see all of it in one place.

The split is deliberate: **security-sensitive values are env-only** (the Better Auth secret, provider credentials), **policy values are workspace-configurable** and stored on the organization.

<a id="scr-13-1"></a>

#### S-13.1 Workspace Configuration

- **Purpose:** One screen showing every workspace policy in one place, so an Admin can answer "what is configured here?" without reading five screens and guessing the defaults.
- **User Role(s):** `owner`, `admin`. Read-only for all other roles.
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Workspace Configuration                        [Save changes]   │
  ├──────────────────────────────────────────────────────────────────┤
  │ MEMBERS                                                            │
  │ Max members                [ 50        ]  ← 12 of 50 used        │
  │ Allow members to create      (●) Yes  ( ) No                     │
  │   workspaces                                                    │
  ├──────────────────────────────────────────────────────────────────┤
  │ INVITATIONS                                                       │
  │ Link expires after          [ 7 days   ▾]  Plugin default: 2 days│
  │ Max pending invitations    [ 25        ▾]                        │
  │ Re-inviting replaces the     (●) Yes  ( ) No                     │
  │   previous link                                                │
  ├──────────────────────────────────────────────────────────────────┤
  │ SECURITY                                                          │
  │ Require two-factor for       (●) Editors + Reviewers             │
  │   ...                          ( ) Everyone  ( ) No one          │
  │ Lock out after              [ 5        ] attempts               │
  │ Lock duration               [ 10 min   ▾]                        │
  │ Session timeout             [ 8 hours ▾]                         │
  │ Remember device for         [ 30 days ▾]                        │
  ├──────────────────────────────────────────────────────────────────┤
  │ ⚠ 2 values are set by environment and can't be edited here.       │
  │   [View environment values]                                      │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Read every workspace policy and its current value, env-set or default.
  2. Change a policy value within the plugin's accepted range.
  3. Restore one value, or all values, to the plugin default.
- **Data Displayed/Modified:** Reads `organization` extended fields for policy; reads effective values from `createAuth()` plugin config for env-set values. Writes workspace policy fields only.
- **Validation & Feedback:**
  - Every field shows **its default alongside the current value** when they differ: _"7 days (plugin default: 2 days)"_. A value nobody chose must be visibly different from a value somebody chose.
  - Values outside the plugin's range are rejected at input, not at save: _"Between 1 and 500."_
  - A policy that would lock the workspace out is blocked at save, not after: see [Safety interlocks](#safety-interlocks).
  - **Save semantics:** `Save changes` is the section-level explicit save from [S-7.8](09-Shared-Components.md#scr-7-8); the dirty guard fires on section switch per [Part 11](11-Global-Standards.md#global-validation-and-feedback-patterns).
- **States:**
  - **Default:** values shown with their provenance — `workspace`, `plugin default`, or `environment`.
  - **Loading:** per-field-group skeletons; env-set fields resolve first so the read-only set is known before the editable set paints.
  - **No access:** the whole screen is replaced — _"Only workspace admins can change these settings."_ with **Ask an Admin** ([Part 11 three-case rule](11-Global-Standards.md#global-validation-and-feedback-patterns), case 3).
  - **Dirty:** `Save changes` enables and the [S-7.8](09-Shared-Components.md#scr-7-8) indicator shows `dirty`; leaving with unsaved changes prompts per the [Unsaved Changes variant](09-Shared-Components.md#scr-7-1).
  - **Partial failure:** _"Saved 6 of 7 settings. Invite expiry was rejected — see below."_ with the failed field named.
  - **Error:** _"We couldn't save your workspace settings. Nothing was changed — try again."_ with Retry and a request ID.
  - **Zero pending invitations / members at limit:** counters read _"0 of 50 used"_; at the limit the field is disabled with _"Raise the limit to invite more."_
- **Resilience:**
  - **403:** non-admins see the replaced-surface state above.
  - **404:** an unknown policy key degrades to showing the default, not a broken field.
  - **Offline:** read-only with _"2 changes waiting to sync"_; policy writes are never queued optimistically, because a security policy that appears applied and is not is a lockout.
  - **Conflict:** two admins editing → _"Changed by {actor} {N} minutes ago."_ with **Review changes / Keep mine / Take theirs**.
  - **Session expired:** 2-minute warning, buffer preserved.
  - **Server error:** retry with a request ID; no field reverts silently.
- **Keyboard & Focus:** every field is labelled and ordered top-to-bottom; `Save changes` is the last tab stop; on save, focus returns to the first changed field, or to the first failed field when the save partially failed.
- **Navigation:**
  - Deep link → [S-6.1](08-Settings.md#scr-6-1) General · Teams and roles · Limits
  - Deep link → [S-6.8](08-Settings.md#scr-6-8) Security · Policies
  - Deep link → [S-6.2](08-Settings.md#scr-6-2) Team Management
  - Workspace switcher → [S-A.1](02-Global-Navigation.md#scr-a-1)
- **Instrumentation & acceptance:** Events `workspace_config_viewed{source_section}`, `workspace_config_changed{key,from_env}`, `workspace_config_saved{changed_count}`, `workspace_config_save_failed{key}`. Accept when: env-set fields render read-only with a reason; every differing default is shown; a save that would lock out the last admin is blocked with the reason; and partial failure names the field. Budget: 7 fields render in < 400 ms.

### Configurable values

| Value                             | Where it lives                       | Range / values                        | Env-overridable | Default now                       |
| --------------------------------- | ------------------------------------ | ------------------------------------- | --------------- | --------------------------------- |
| Max members per workspace         | `membershipLimit`                    | 1–500                                 | Yes             | Plugin default                    |
| Allow self-service workspaces     | `allowUserToCreateOrganization`      | on / off                              | No              | **Unconfigured** — defaults to on |
| Max workspaces per user           | `organizationLimit`                  | 1–20                                  | Yes             | **Unconfigured** — defaults to 1  |
| Invite link expiry                | `invitationExpiresIn`                | 1–30 days                             | No              | Plugin default 48 h               |
| Max pending invitations           | `invitationLimit`                    | 0–200                                 | No              | **Unconfigured** — unlimited      |
| Re-invite replaces old link       | `cancelPendingInvitationsOnReInvite` | on / off                              | No              | **Unconfigured** — off            |
| Two-factor required for           | Workspace policy                     | Everyone / Editors+Reviewers / No one | Partially       | **Unconfigured** — off            |
| Lockout threshold                 | `ACCOUNT_LOCKOUT_MAX_ATTEMPTS`       | 3–10 attempts                         | **Yes**         | 5                                 |
| Lockout duration                  | `ACCOUNT_LOCKOUT_DURATION`           | 1–60 minutes                          | **Yes**         | 10 minutes                        |
| Session timeout                   | Workspace policy                     | 15 m / 1 h / 8 h / 24 h / 7 d         | No              | **Unconfigured**                  |
| Remember device                   | `TRUST_DEVICE_MAX_AGE`               | 1–90 days                             | **Yes**         | 30 days                           |
| TOTP issuer                       | `TOTP_ISSUER`                        | Any string                            | **Yes**         | `Abugida Academy`                 |
| Two-factor cookie max age         | `TWO_FACTOR_COOKIE_MAX_AGE`          | Seconds                               | **Yes**         | 600 s                             |
| Session revocation on role change | Workspace policy                     | on / off                              | No              | **Unconfigured**                  |

> **Unconfigured** means the plugin's own default applies and nobody has decided it for this product. Those rows are the [implementation gaps](#implementation-gaps) this part closes. Showing them on S-13.1 is how a gap becomes visible instead of silent.

### Safety interlocks

Each of these blocks the save and names the fix, per [Part 11 § Gate-with-a-Way-Out](11-Global-Standards.md#global-validation-and-feedback-patterns):

| Change                          | Blocked when                                                                  | Copy                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Require MFA for all members     | The workspace has exactly one `owner`                                         | _"Add a second admin first — otherwise a lost authenticator locks the workspace."_ |
| Lockout threshold ↓             | It would be below the number of failed attempts already recorded for a member | _"3 attempts is below the 5 already recorded for Alemayehu K."_                    |
| Max members ↓                   | It is below the current member count                                          | _"You have 12 members. Lower the limit to remove someone first."_                  |
| Allow self-service workspaces ↓ | Any user is in more workspaces than the new limit allows                      | _"3 people are in 4+ workspaces. Raise the limit or remove them first."_           |
| Session timeout ↓               | An active `owner` session would be expired mid-operation                      | _"This would end your own session. Ask another admin to change it."_               |

---

<a id="scr-13-2"></a>

## S-13.2 Workspace Switcher 🆕 NEW

Every role is workspace-scoped, so a user in three workspaces needs a way to change which one they are acting in. The previous specification had **no screen for this**, and the active organization is stored in the session, not in a URL.

- **Purpose:** Switch the active workspace, create one, and see which workspaces the current user belongs to.
- **User Role(s):** All authenticated roles. Each entry shows that workspace's member role.
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ ⌘K  Switch workspace…                             [Other ▾]    │
  ├──────────────────────────────────────────────────────────────────┤
  │ Abugida Academy            ● active    Admin      12 members      │
  │ ────────────────────────────────────────────────────────────────│
  │ Addis Language School       Editor     47 members   [Switch]      │
  │ Bahir Dar Academy           Reviewer    8 members   [Switch]      │
  │ ────────────────────────────────────────────────────────────────│
  │ + Create a workspace                                                 │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Switch the active workspace — the session's `organizationId` changes and **every screen reloads against the new scope**.
  2. Open the [Command Palette](09-Shared-Components.md#scr-7-5) filtered to workspace switch.
  3. Create a workspace, subject to `allowUserToCreateOrganization` and `organizationLimit`.
- **Data Displayed/Modified:** Reads `organization` + the user's `member` rows. Writes the session's active `organizationId` via `authClient.organization.setActive`.
- **Validation & Feedback:**
  - The list is **permission-filtered server-side**: a user sees only organizations they are a `member` of. It is never a directory of all workspaces.
  - Each row shows the **member role** for that workspace, because the same person is an Admin in one and a Reviewer in another.
  - **The active workspace is always first and marked `● active`**, never a separate selection.
  - After switching, a toast confirms: _"Switched to Addis Language School. 47 members, Editor."_
- **States:**
  - **Default:** the list, active first, then the rest alphabetically.
  - **Loading:** skeleton rows; the count resolves per row so a large member count never blocks the switch.
  - **Single workspace:** the switcher is **absent**, not a disabled control — there is nothing to switch to ([Part 11 three-case rule](11-Global-Standards.md#global-validation-and-feedback-patterns), case 1).
  - **No workspaces:** _"You're not a member of any workspace yet."_ with **Create a workspace** or **Ask an admin for an invite**.
  - **At the organization limit:** **Create a workspace** is disabled with _"You've reached your limit of 1 workspace. Ask an admin to raise it."_
  - **Creation disabled by policy:** the entry is absent with the entry point explanation in [S-6.1](08-Settings.md#scr-6-1).
  - **Not found:** a workspace the user was removed from mid-session → _"You no longer have access to this workspace."_, and the app returns to the remaining workspaces.
- **Resilience:**
  - **403:** removed from a workspace → the Not-found state above, never a blank app.
  - **Offline:** the cached list renders read-only; switching is blocked with _"You're offline — switching needs a connection."_ because the session cookie must be reissued.
  - **Conflict:** two tabs on different workspaces → the tab that switches last wins, and the other tab shows _"This tab is now viewing a different workspace. Reload to match."_
  - **Session expired:** re-authenticate, then restore the requested workspace rather than dropping the user to the default.
  - **Server error:** _"We couldn't switch workspaces — you're still in {current}."_ with Retry.
- **Keyboard & Focus:** opened with `⌘/Ctrl+Shift+O`; `↑`/`↓` move, `Enter` switches, `Esc` closes and returns focus to the trigger. On switch, focus moves to the workspace name in the header and the new name is announced in a polite live region. The active row carries `aria-current="true"`.
- **Navigation:**
  - Header workspace name → this screen
  - `⌘/Ctrl+Shift+O` → this screen from anywhere, including the item editor
  - Create a workspace → [S-0.2](01-Authentication-and-Onboarding.md#scr-0-2) Step 2, reusing the org-creation path
  - Deep link `?workspace=<slug>` → resolves to an `organizationId`, then redirects to the canonical slug
- **Instrumentation & acceptance:** Events `workspace_switcher_opened{entry_point}`, `workspace_switched{from_slug,to_slug}`, `workspace_switch_failed{reason}`, `workspace_create_started`. Accept when: a single-workspace user sees no switcher; the list is permission-filtered server-side; a removed member is told explicitly rather than shown an empty app; and the destination workspace name is announced after a switch. Budget: opens in < 150 ms from cache.

### Placement

- **Desktop:** the header's leftmost element, showing the workspace name and a chevron. It sits **before** the breadcrumb, because the workspace scopes everything below it.
- **Mobile:** the workspace name is the first row of the slide-out drawer, above the nav items.
- **Command palette:** `Switch workspace…` is the first result group.

---

<a id="scr-13-3"></a>

## S-13.3 Role Assignment 🆕 NEW

[S-6.2](08-Settings.md#scr-6-2) manages **membership** (who is here). This screen manages **what they can do**, and is the screen the previous specification folded into Roles & Permissions without a surface of its own.

- **Purpose:** Grant, change, and revoke a member role or a per-course role, with every change attributable.
- **User Role(s):** `owner`, `admin` for member roles. `owner`, `admin`, or the course's own owner for course roles.
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Roles & Access                                                    │
  │                                                                  │
  │ MEMBER ROLES (workspace-wide)                                     │
  │ Name                Member role      MFA    Last active  ⋯        │
  │ Jane Smith          ● owner          ✔      2h ago       [⋯]      │
  │ Alemayehu K.        admin            ✔      1d ago       [⋯]      │
  │ Sara B.             member           —      3d ago       [⋯]      │
  │ ────────────────────────────────────────────────────────────────│
  │ COURSE ROLES (per course)                          [Add ▾]       │
  │ Course                  Name          Role         ⋯             │
  │ TOEFL Complete          Jane Smith   ● owner      [⋯]            │
  │ TOEFL Complete          Tigist M.    reviewer    [⋯]            │
  │ IELTS Advanced          —            —            + Assign       │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Change a member's `member.role`.
  2. Grant, change, or revoke a course role — writes `course_roles` with `grantedBy`.
  3. Revoke a role, which sets `revokedAt` rather than deleting the row.
  4. Transfer `owner`, which requires the incoming member to accept.
- **Data Displayed/Modified:** Reads `member`, `roles`, `course_roles`. Writes `member.role`, and `course_roles` rows with `grantedBy` set to the acting user and `revokedAt` on revocation.
- **Validation & Feedback:**
  - **The two systems are visually separated** and never merged into one dropdown. A column heading states which is which, because conflating them is how an Editor silently becomes a workspace admin.
  - **Course roles show only courses the acting user can see.** A course the Admin cannot open is not assignable, so a grant can never grant access to a hidden course.
  - **The last `owner` cannot be demoted or removed.** The action is **disabled with the reason** _"Transfer ownership to another admin first"_ — [Part 11](11-Global-Standards.md#global-validation-and-feedback-patterns) case 2, not a silent failure.
  - Every change names its effect: changing a member role shows _"Sara becomes an admin. She will be able to invite members and change workspace settings."_
  - Revocation is **immediate** and states that it is not undone by signing back in.
- **States:**
  - **Default:** member roles and course roles in separate blocks.
  - **Loading:** skeleton rows; role definitions resolve before rows so a role is never rendered unnamed.
  - **No course roles yet:** the block reads _"No course roles assigned. Members use their workspace role for every course."_ — **not** a call to action, because this is the normal state.
  - **Self:** the acting user's own row is read-only with _"This is you."_ You cannot change your own access.
  - **Last owner:** the `owner` control is disabled with the reason above.
  - **Pending acceptance:** an ownership transfer reads _"Awaiting {name}'s acceptance"_ with **Cancel transfer**.
  - **Revoked:** a revoked course role shows in a collapsed **Revoked** section with `revokedBy`/`revokedAt`, not deleted.
  - **Error / Partial failure:** a bulk change reports _"3 roles granted · 1 failed — Retry"_ naming the member.
- **Resilience:**
  - **403:** non-admins do not reach this screen; the Forbidden state replaces it.
  - **404:** a member removed in another tab → _"This member is no longer in this workspace."_
  - **Offline:** read-only; role changes are never queued, because a queued grant that appears applied is a privilege escalation.
  - **Conflict:** two admins changing one role → **Review changes / Keep mine / Take theirs**; the losing write is refused, not merged.
  - **Session expired:** 2-minute warning; the in-progress change is preserved.
  - **Server error:** _"We couldn't change {name}'s role — nothing was applied."_ with Retry and a request ID.
- **Keyboard & Focus:** the `⋯` menu is `aria-haspopup="menu"` with roving focus and `Esc` returning focus to the trigger. A role change moves focus to the new role pill and announces _"Sara is now an admin"_ in a polite live region.
- **Navigation:**
  - From [S-6.2](08-Settings.md#scr-6-2) Team Management · member row `⋯ → Manage roles`
  - From [S-2.6](04-Courses.md#scr-2-6) Course Workspace · `⋯ → Access`
  - From [S-2.14](04-Courses.md#scr-2-14) Approval Queue · submission `⋯ → Reassign`
- **Instrumentation & acceptance:** Events `member_role_changed{from,to}`, `course_role_granted{role}`, `course_role_revoked{role}`, `owner_transfer_initiated`, `owner_transfer_accepted`. Accept when: the two role systems are never merged into one control; the last owner cannot be demoted; self-assignment is impossible; revoking takes effect on the next request without a re-login; and every change is attributable to an actor. Budget: 200 members render in < 500 ms.

---

## Implementation Gaps

The specification previously assumed capabilities that the configured plugin does not provide. These are **P0 for implementation** — each is a screen in Parts 01/06/08/13 that cannot be built as written until the gap is closed.

| ID    | Gap                                                                                                                                                                                                                                                           | Spec that depends on it                                                   | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GAP-1 | `member.role` is a bare `text` column. **Reviewer and Support are not expressible** as member roles; they are capability-shaped, not role-shaped.                                                                                                             | [S-6.9](08-Settings.md#scr-6-9), [S-6.2](08-Settings.md#scr-6-2)          | Either enable `dynamicAccessControl` and create real roles, or add a `member_flags` jsonb. The spec assumes the **effective-role union** model, which works either way.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| GAP-2 | `invitation.email` is **`notNull()`**. The [claimable-link invite](11-Global-Standards.md#notification-delivery) required by [Part 11 § Notification Delivery](11-Global-Standards.md#notification-delivery) for Telegram users **cannot be stored**.         | [S-6.2](08-Settings.md#scr-6-2), [S-4.1](06-Students.md#scr-4-1)          | ✅ **Closed — but not the way this row originally said.** Making `email` nullable is **unsafe**: Better Auth dereferences `invitation.email.toLowerCase()` unguarded in `accept-invite`, `reject-invite` and `cancel-invite`, so a null email is a 500 on a working feature — in prebuilt code that never fails our typecheck. `invitation` is left exactly as Better Auth defines it, and a sibling **`invite_link`** table stores the claimable invite: `token_hash` / `code_hash` (SHA-256 digests, never the raw secret), `handle` for the no-email case, 7-day single use. A claim is one conditional `UPDATE … RETURNING`, so a link can only be spent once. See [`DESIGN.md` §15 #22](DESIGN.md#15-spec-conflict-register). |
| GAP-3 | `organization()` is configured with **only** an `additionalFields.useCase`. `organizationLimit`, `membershipLimit`, `invitationExpiresIn`, `invitationLimit`, and `cancelPendingInvitationsOnReInvite` are all unset, and `sendInvitationEmail` is not wired. | [S-13.1](#scr-13-1), [S-0.2](01-Authentication-and-Onboarding.md#scr-0-2) | Configure them. `sendInvitationEmail` must route through the [Notification Delivery](11-Global-Standards.md#notification-delivery) channels — in-app first, Telegram second, email only where verified — never email alone.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| GAP-4 | `client` has **no `organizationClient()`** plugin, so `setActive`, `inviteMember`, `getInvitationURL`, `hasPermission`, and team calls are unavailable from the dashboard.                                                                                    | [S-13.2](#scr-13-2), [S-13.3](#scr-13-3)                                  | Add `organizationClient()` in `src/lib/auth-client.ts`. The active-workspace switcher cannot be built without it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |

> **GAP-2 was the critical path and is now closed.** Parts 01, 06, 08, 10, and 13 all ship Telegram-safe invite and delivery flows; the storage they were blocked on is the `invite_link` table. **GAP-3 and GAP-4 remain open** — the delivery channels (GAP-3) and the active-workspace switcher (GAP-4) are still unbuilt, and GAP-4 in particular is required before the workspace switcher in [S-13.2](#scr-13-2) can be written as specified.

### Audit

Every change in this part writes an immutable entry to the [audit log](08-Settings.md#scr-6-8) with the acting actor, the target, and the before/after value:

`auth.signin` · `auth.signout` · `auth.mfa_enabled` · `auth.mfa_disabled` · `auth.mfa_recovery_used` · `auth.lockout` · `workspace.created` · `workspace.switched` · `member.invited` · `member.joined` · `member.removed` · `member.role_changed` · `course_role.granted` · `course_role.revoked` · `owner_transfer.initiated` · `owner_transfer.accepted` · `workspace.config_changed` · `workspace.deleted`

---

## Cross-References

| Concern                      | Owned by                                                                                                    |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Role capabilities            | [Part 11 § Course Lifecycle Capabilities](11-Global-Standards.md#course-lifecycle-capabilities)             |
| Role assignment surfaces     | This part · [S-6.2](08-Settings.md#scr-6-2) · [S-6.9](08-Settings.md#scr-6-9)                               |
| MFA challenge and enrollment | [S-0.3](01-Authentication-and-Onboarding.md#scr-0-3) · [S-0.4](01-Authentication-and-Onboarding.md#scr-0-4) |
| Security policy              | [S-6.8](08-Settings.md#scr-6-8) · [S-13.1](#scr-13-1)                                                       |
| Notification delivery        | [Part 11 § Notification Delivery](11-Global-Standards.md#notification-delivery)                             |
| Workspace scoping in the UI  | [S-A.1](02-Global-Navigation.md#scr-a-1) · [S-13.2](#scr-13-2)                                              |
