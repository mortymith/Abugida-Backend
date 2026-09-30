# Section 0: Authentication & Onboarding

> **Abugida Academy — UX Design Specification** · Part 01 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Overview & Sitemap](00-Overview-and-Sitemap.md) · [Global Navigation →](02-Global-Navigation.md)

## What changed in Part 01 (Revision 3)

- **Email-dependent states are gone.** A Telegram user may have no address, so _Invite Email Mismatch_ and _Email Already Registered_ now describe the **provider identity**, per [Part 11 § Notification Delivery](11-Global-Standards.md#notification-delivery). Added **Invite not found / expired / already consumed**.
- **New screen [S-0.4 Multi-Factor Enrollment](#scr-0-4)** — three steps, QR **or** manual key `XXXX-XXXX-XXXX-…` (the full secret, grouped), verified before the toggle flips, then 10 single-use backup codes shown exactly once. Nothing in the previous revision showed a user _enabling_ MFA.
- **Admin lockout is no longer a dead end.** "Contact your workspace Admin" was useless when the locked-out user _is_ the only Admin. Replaced by **Request an admin reset** (30-minute single-use code over Telegram) and **Verified support recovery** (24-hour unlock), both audit-logged.
- **Login gains the states it was missing:** per-provider rate limiting with a live countdown, offline, and a provider **disabled for this workspace** — disabled-with-reason, never hidden, per the [three-case permission rule](11-Global-Standards.md#global-validation-and-feedback-patterns).
- **The checklist is conditional on `Primary Use Case`**, so a workspace that will never charge is not shown an item it can never complete; the card is hidden once complete and a **Resume** affordance replaces it.
- Every screen gains **Resilience**, **Keyboard & Focus**, and **Instrumentation & acceptance** blocks per [Part 11](11-Global-Standards.md#success-criteria--instrumentation).

Sign-in is exclusively federated: every staff member authenticates with **Google** or **Telegram**. The platform stores no passwords, so there is no email/password form and no self-service password reset — account recovery is handled by the identity provider itself. Both providers are configured per workspace in [S-6.3](08-Settings.md#scr-6-3) Integrations, and all authentication events are written to the audit trail in [S-6.8](08-Settings.md#scr-6-8). **A user authenticated by Telegram may have no email address at all**; no screen in this part assumes one.

<a id="scr-0-1"></a>

##### Screen Name: S-0.1 Login 🔄 CHANGED

- **Purpose:** Entry point for all users. Authenticates staff (Admin, Editor, Reviewer, Viewer, Support) against the organization's account through Google or Telegram, then routes them into the app shell.
- **User Role(s):** Unauthenticated (pre-login)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │                         [Abugida Academy Logo]                  │
  │                                                                  │
  │                     Sign in to your workspace                   │
  │                                                                  │
  │              +--------------------------------------+           │
  │              │ [G]  Continue with Google              │           │
  │              +--------------------------------------+           │
  │                                                                  │
  │              +--------------------------------------+           │
  │              │ [✈]  Continue with Telegram            │           │
  │              +--------------------------------------+           │
  │                                                                  │
  │      No password needed — sign-in is handled by Google and      │
  │      Telegram. Providers are managed in Workspace Settings.     │
  │                                                                  │
  │      [ Create a workspace ]   [ Sign in with an invite link ]  │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Continue with Google — opens the Google OAuth consent screen, then completes sign-in.
  2. Continue with Telegram — opens the Telegram Login confirmation (bot deep link or Login Widget), then completes sign-in.
  3. Claim an invitation via **Sign in with an invite link** — `/invite/:token` or an 8-character code, per Part 11.
  4. Navigate to workspace sign-up.
- **Data Displayed/Modified:** Reads `users`/`auth_identities`/`sessions`; writes an audit entry to `login_events` (see [S-6.8](08-Settings.md#scr-6-8)). On first sign-in, links the provider identity (`auth_identities`) to the invited user record.
- **States:**
  - **Default:** Both provider buttons enabled; the page remembers the provider used last and lists it first.
  - **Redirecting:** Full-screen spinner with "Contacting Google…" / "Contacting Telegram…".
  - **Provider Cancelled:** Returns to the login screen with buttons re-enabled; no error toast (cancelling is a normal action).
  - **Provider Error:** "Google sign-in failed. Try again or use Telegram." (and vice versa).
  - **Provider Disabled for This Workspace:** The button renders **disabled with a reason** in a tooltip and via `aria-describedby` — _"Google sign-in is turned off for this workspace. Ask an Admin to enable it, or use Telegram."_ **Never hidden**: a user must be able to learn that a route exists and is closed.
  - **Rate Limited (per provider):** _"Too many attempts. Try again in 4 minutes."_ The affected button is disabled, a live countdown ticks every second, and the other provider stays enabled. Countdown survives reload (server-authoritative).
  - **Unknown Account:** _"This account isn't linked to any workspace. Ask your Admin to invite you, or create a workspace."_
  - **Invite Identity Mismatch:** _"You signed in with an account that isn't linked to an invitation. Sign in with the account the invitation was issued to, or request a new invitation."_ No address is named.
  - **Invite Not Found / Expired / Already Consumed:** _"This invitation is no longer valid. Ask for a new one — it takes a moment."_ Primary action **Request a new invitation**, which re-sends to the inviter's chosen channel (in-app + Telegram per Part 11) and records the request in `login_events`. A consumed invite never reveals who consumed it.
  - **MFA Required:** Redirects to [S-0.3](#scr-0-3) Multi-Factor Authentication Challenge.
  - **Success:** Redirect to last-visited module or [S-1.1](03-Dashboard.md#scr-1-1) Analytics Overview.
- **Resilience:**
  - **403 — not a member of any workspace:** the provider callback returns 403; render the **Unknown Account** state above, never a blank redirect loop back to `/login`. An authenticated user with no workspace gets one clear path: ask an Admin, or create a workspace.
  - **404 — stale invite link:** the **Invite Not Found** state, with a route back to the plain login screen.
  - **Offline:** the two provider buttons render **disabled with a reason** — _"You're offline. Sign in needs a connection."_ A persistent banner (not a toast) sits above the form; nothing is queued, because a federated round-trip cannot be replayed safely.
  - **Session expiry mid-auth:** the pre-auth session is discarded, the user returns to the login screen with _"Your sign-in took too long. Try again."_ and a re-auth affordance; no orphaned `auth_identities` row is left half-linked.
  - **Server error:** _"We couldn't reach {Google|Telegram} — your account is fine. Try again."_ with Retry and a request ID. Never a bare "Retry?".
  - **No dirty-buffer risk:** the screen holds no form state, so it never needs a flush or an Unsaved Changes dialog.
- **Keyboard & Focus:** On arrival focus lands on the first **enabled** provider button (a disabled one is skipped, not focused). `Tab` order: provider buttons → invite-link link → create-workspace link. `Enter`/`Space` activate a button; there is no `Esc` behaviour because there is no dismissible layer. On error, focus moves to the message container (`role="alert"`, `tabindex="-1"`) so it is announced and reachable; the rate-limit countdown is a `aria-live="polite"` region that announces at 4 minutes, 1 minute, and 30 seconds only — not every second.
- **Navigation:**
  - Sign-in success (no MFA) → [S-1.1](03-Dashboard.md#scr-1-1) Analytics Overview
  - Sign-in success (MFA enabled) → [S-0.3](#scr-0-3) MFA Challenge
  - "Create a workspace" → [S-0.2](#scr-0-2) Organization Sign-Up & Onboarding
  - "Sign in with an invite link" → claim flow on this screen; consumed → [S-0.1](#scr-0-1) (already registered)
  - "Ask an Admin to enable it" → [S-7.4](09-Shared-Components.md#scr-7-4) Help & Support Panel
- **Instrumentation & acceptance:**
  - **Events:** `auth.signin_attempted{provider,surface}` · `auth.signin_succeeded{provider,has_mfa}` · `auth.signin_blocked{reason}` where `reason ∈ {rate_limited, provider_disabled, unknown_account, invite_mismatch, invite_invalid, offline}` · `auth.invite_reissue_requested{reason}`.
  - **Criteria:** (1) No state on this screen displays an email address. (2) A provider disabled for the workspace renders visibly disabled with a reachable reason, and its `auth.signin_attempted` never fires. (3) After 5 attempts on one provider the other provider still works. (4) `Esc` is not required to reach or dismiss anything. (5) Every error names a next action.
  - **Budgets:** LCP < 1.2 s on 4G; provider redirect initiated within 100 ms of activation; login HTML < 40 kB gzipped.

---

<a id="scr-0-2"></a>

##### Screen Name: S-0.2 Organization Sign-Up & Onboarding 🔄 CHANGED

- **Purpose:** First-run wizard for a brand-new workspace: authenticate with Google or Telegram, create the organization and the first Admin account, and land on a starter checklist.
- **User Role(s):** Unauthenticated → becomes Admin on completion
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Step 1/3: Account & Org        Step 2/3: You   Step 3/3: Tour    │
  │ ●━━━━━━━━━━━━━○━━━━━━━━━━━━━━○                                   │
  │ +---------------------------+  +---------------------------+   │
  │ | [G] Continue with Google   |  | [✈] Continue with Telegram|   │
  │ +---------------------------+  +---------------------------+   │
  │ (your workspace profile is created from your verified provider    │
  │  identity — no password is ever set, and an email address is     │
  │  never required)                                                │
  │ Workspace Name: [Abugida Academy]                                │
  │ Subdomain: [abugida].abugida.app                                 │
  │ Primary Use Case: ( ) Sell courses for payment                    │
  │                 ( ) Run courses for members (no payment)         │
  │                 ( ) Train employees (private, no payment)         │
  │ [Continue]                                                       │
  ├──────────────────────────────────────────────────────────────────┤
  │ Getting Started Checklist — items are CONDITIONAL on Primary     │
  │ Use Case above (post sign-up, on [S-1.1] until complete):        │
  │  SELLING     [ ] Invite your team      [S-6.2]                   │
  │              [ ] Brand your workspace  [S-6.4]                   │
  │              [ ] Create your first course  [S-2.2 / S-2.12 / S-2.11]│
  │              [ ] Connect a payment gateway  [S-6.3]              │
  │  NO PAYMENT  [ ] Invite your team      [S-6.2]                   │
  │              [ ] Create your first course  [S-2.2 / S-2.12 / S-2.11]│
  │  (payment + billing items are absent, not disabled)              │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Authenticate with Google or Telegram; the Admin profile is created from the verified provider identity (display name, avatar, and an email address **only if the provider supplies one**).
  2. Create the workspace, choose a subdomain, and select a **Primary Use Case**.
  3. Complete the guided checklist, or dismiss it — a **Resume** affordance on the dashboard reopens it later.
- **Data Displayed/Modified:** Writes `organizations` (including `primaryUseCase`), `users` (role = Admin), `auth_identities`, `onboarding_progress`.
- **Checklist rules:**
  - Items are **derived from `Primary Use Case`**, stored on the organization. A non-selling workspace never sees _Connect a payment gateway_, _Set pricing_, or _Billing_ — they are **absent**, not disabled (Part 11 three-case rule).
  - The card is **hidden once every applicable item is complete**; a toast offers **Show the checklist again**, which sets `onboarding_progress.checklistDismissed = false`.
  - A single **Resume setup** link on [S-1.1](03-Dashboard.md#scr-1-1) replaces the permanent card. It is hidden while the checklist is complete.
  - Each item is a real completion check, not a click counter: it flips when the destination screen's own criterion is met (course `Draft` created, ≥1 team member accepted, `primaryColor` set).
- **States:**
  - **Loading:** each step shows a skeleton for its own fields only; the step indicator and the fields already entered stay put, so a slow subdomain check never blanks the form.
  - **Provider Cancelled:** Returns to step 1 with both provider buttons enabled.
  - **Account Already in a Workspace:** _"This account already belongs to a workspace. Sign in instead."_ with a link to [S-0.1](#scr-0-1) and the workspace's name. No address is shown — the same account may hold a role in several workspaces.
  - **Subdomain Taken:** Inline error with suggested alternatives; the input keeps focus and the suggestions are operable buttons.
  - **Provisioning:** "Setting up your workspace…" progress screen (a few seconds). Skeleton, never a blank page.
  - **Success:** Redirect into app shell with [S-7.6](09-Shared-Components.md#scr-7-6) Onboarding Tour auto-launched.
- **Resilience:**
  - **403 / duplicate workspace:** creating a second workspace on the same account is permitted only up to a plan limit; beyond it, the server returns a partial failure — _"Your workspace is ready, but the plan allows 1. Your previous workspace is {name}."_ with actions **Open it** / **Upgrade**. The workspace is **not** half-created.
  - **404:** a subdomain that was taken between check and commit returns to step 1 with the taken error, not a 404.
  - **Offline:** provisioning is a write and is **not** queued — the wizard blocks with _"You're offline. We'll finish creating your workspace when you're back."_ No partial `organizations` row is left behind.
  - **Session expiry mid-wizard:** the in-progress wizard state is preserved in session storage; on re-authentication the user returns to the step they left, with the entered workspace name intact.
  - **Conflict:** the subdomain is the only contended field; a `taken` result is a field error, not a screen-level failure. The rest of step 1 is preserved.
  - **Server error:** _"We couldn't create your workspace — nothing was saved. Try again."_ with Retry and a request ID.
  - **No dirty-buffer risk** beyond the three wizard fields, which are held in component state and explicitly preserved across the steps above.
- **Keyboard & Focus:** On arrival focus lands on the Workspace Name field. `Tab` order per step: provider buttons → workspace name → subdomain → Primary Use Case radio group → **Continue**; the radio group is one Tab stop with arrow-key selection. On step change, focus moves to that step's **first field** and the step is announced in an `aria-live="polite"` region — _"Step 2 of 3: You"_ — so a screen-reader user is never left guessing. `Esc` is inert mid-wizard (nothing is dismissible; abandoning means the Back control). On a validation error, focus moves to the first invalid field and the error summary is linked by `aria-describedby`. **Back** from step 2 or 3 never discards entered data.
- **Navigation:**
  - Completion → [S-1.1](03-Dashboard.md#scr-1-1) Analytics Overview (with [S-7.6](09-Shared-Components.md#scr-7-6) tour overlay)
  - "Sign in instead" → [S-0.1](#scr-0-1)
  - Checklist items → [S-6.2](08-Settings.md#scr-6-2) · [S-6.4](08-Settings.md#scr-6-4) · [S-6.3](08-Settings.md#scr-6-3) · [S-2.2](04-Courses.md#scr-2-2) · [S-2.12](04-Courses.md#scr-2-12) · [S-2.11](04-Courses.md#scr-2-11)
- **Instrumentation & acceptance:**
  - **Events:** `onboarding.started{provider}` · `onboarding.use_case_selected{use_case}` · `onboarding.step_completed{step}` · `onboarding.completed{use_case,checklist_items}` · `onboarding.checklist_resumed` · `onboarding.blocked{reason}`.
  - **Criteria:** (1) With `Primary Use Case = no payment`, the payment item is **absent** from the DOM, not disabled. (2) Every checklist item flips on a real server-side criterion, never on click. (3) Once complete, no checklist card renders on [S-1.1](#scr-0-1). (4) A step change moves focus to the step's first field and announces the step. (5) A failed provision leaves no `organizations` row.
  - **Budgets:** wizard step transition < 200 ms; provisioning resolves in < 3 s; checklist card renders in the dashboard's first paint budget.

---

<a id="scr-0-3"></a>

##### Screen Name: S-0.3 Multi-Factor Authentication Challenge 🔄 CHANGED

- **Purpose:** Second authentication factor (TOTP authenticator app) enforced after a successful Google/Telegram sign-in when MFA is required by workspace policy ([S-6.8](08-Settings.md#scr-6-8)).
- **User Role(s):** Unauthenticated (mid-login)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ 🔒 Two-factor authentication                                     │
  │ Enter the 6-digit code from your authenticator app               │
  │ [ _ _ _ _ _ _ ]   (inputmode=numeric, autocomplete=one-time-code)│
  │ [Verify]                                                         │
  │                                                                  │
  │ Can't access your app? [Use a backup code]                       │
  ├──────────────────────────────────────────────────────────────────┤
  │ After 5 failed attempts:                                         │
  │   🔒 Locked for 15 minutes. Try again at 14:32.                 │
  │   [Request an admin reset]  [Get help from support]              │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Enter and submit the one-time code from the authenticator app.
  2. Fall back to a backup recovery code (single-use; consumed on use).
  3. **Request an admin reset** — only rendered when another verified Admin exists.
  4. **Get help from support** — only rendered when the user is the workspace's only Admin.
- **Data Displayed/Modified:** Writes `login_events` on success/failure; consumes a `backup_codes` row on backup use; writes an immutable `audit_log` entry for every recovery event.
- **States:**
  - **Loading:** the Verify button enters a pending state for the length of one verification attempt; the code input stays enabled so a mistyped code can be replaced immediately.
  - **Invalid Code:** "That code didn't work. Try again." Remaining attempts are shown, not hidden.
  - **Expired Window:** Inline hint: "Codes rotate every 30 seconds — wait for the next one."
  - **Code Input Contract:** the field is `inputmode="numeric"`, `autocomplete="one-time-code"`, `maxlength=6`, **accepts paste and SMS-style autofill**, strips spaces, and announces per-digit validity in a `aria-live="polite"` region only on a change of state — never one character at a time.
  - **Last Attempt Before Lockout:** _"2 attempts left."_ in `--color-warning-text` on `--color-warning-tint`, with an icon — never colour alone.
  - **Locked Out:** _"Too many attempts. Locked for 15 minutes — try again at 14:32."_ A live countdown runs, the input is disabled with a reason, and the input **keeps its typed value** so the user can submit it the moment the lock lifts.
  - **Locked Out, Another Admin Exists:** _"Locked for 15 minutes. You can also **request an admin reset** — {Admin name} has been notified in-app and on Telegram."_
  - **Locked Out, User Is The Only Admin:** _"You're the only Admin in this workspace, so there's no one to ask. Open a support request to unlock 2FA for 24 hours."_ Primary action **Open a support request**. There is never a dead end.
  - **Admin Reset Requested:** a single-use code valid **30 minutes**, delivered to a **second verified contact** over Telegram, consumed by another Admin entering it. Status is shown: _"Awaiting {Admin name} — code expires at 15:04."_ Re-requesting invalidates the previous code.
  - **Support Recovery Open:** _"2FA is unlocked for 24 hours. Set up a new authenticator before the window closes."_ with a deep link to [S-0.4](#scr-0-4).
  - **Backup Code Accepted:** the code is consumed on success and cannot be reused; the in-app feed records which one.
  - **Success:** Proceed to app shell.
- **Recovery paths (both audit-logged immutably):**

  | Path                          | Available to                                         | Mechanism                                                                                                                             | Audit                                                                                                      |
  | ----------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
  | **Request an admin reset**    | Any locked user where a second verified Admin exists | Single-use code, **30-minute TTL**, delivered to a second verified contact via **Telegram** (never email), consumed by another Admin  | `auth.lockout_recovery_used{method:"admin_reset"}` + `audit_log` with actor, requester, code id, timestamp |
  | **Verified support recovery** | The only Admin, or any user with no reachable Admin  | Support verifies identity and opens a **24-hour** window in which 2FA is bypassed; on entry the user is pushed into [S-0.4](#scr-0-4) | `auth.lockout_recovery_used{method:"support"}` + `audit_log` with support agent, user, window expiry       |
  | **Backup code**               | The user themselves                                  | Any unused `backup_codes` row                                                                                                         | `auth.signin_blocked{reason:"backup_code"}`                                                                |

  **Cooldown:** 15 minutes after 5 failed attempts, counted server-side. The lock is per user, not per device, and a successful admin reset clears it. After **3** lockouts in 30 days the account is flagged for Admin review in [S-6.8](08-Settings.md#scr-6-8); the user is never silently locked out of the workspace.

- **Resilience:**
  - **403 / 404:** a user whose session was revoked mid-challenge (e.g. removed from the workspace) sees _"Your access to this workspace has ended."_ with a route to [S-0.1](#scr-0-1). A code tied to a deleted user never verifies.
  - **Offline:** the input is **disabled with a reason** — _"You're offline. 2FA needs a connection."_ Codes are short-lived, so **nothing is queued**; verifying a stale code is a guaranteed failure.
  - **Session expiry mid-challenge:** the half-authenticated session is discarded and the user returns to [S-0.1](#scr-0-1) with _"Your sign-in took too long. Try again."_ The attempt count survives, so a user cannot evade a lockout by reloading.
  - **Server error:** _"We couldn't check that code — nothing was consumed. Try again."_ with Retry and a request ID. Verification is **not** counted as a failed attempt on a 5xx.
  - **No dirty-buffer risk:** the only buffer is the 6-digit code, deliberately retained across lockout and reload.
- **Keyboard & Focus:** On arrival focus is in the code input with the first segment selected. `Tab` order: code input → **Verify** → **Use a backup code** → recovery links. Digits auto-advance within the single input; `Backspace` at position 0 does not leave the field. `Esc` is inert — the challenge is not dismissible, and a mid-challenge `Esc` must not drop the user back to a half-authenticated app. On a wrong code, focus **stays in the input**, the field is cleared, and the message is announced assertively; on lockout, focus moves to the lockout message container (`role="alert"`, `tabindex="-1"`) and the input becomes disabled. Switching to a backup code replaces the field in place and moves focus to it.
- **Navigation:**
  - Success → [S-1.1](03-Dashboard.md#scr-1-1) Analytics Overview
  - "Use a backup code" → inline alternate input, same screen
  - "Request an admin reset" → [S-7.4](09-Shared-Components.md#scr-7-4) Help & Support Panel, request type `lockout_recovery`
  - Support recovery granted → [S-0.4](#scr-0-4) Multi-Factor Enrollment
  - "Ask an Admin to enable it" (provider disabled) → [S-6.3](08-Settings.md#scr-6-3) Integrations
- **Instrumentation & acceptance:**
  - **Events:** `auth.mfa_challenge_shown{policy}` · `auth.signin_attempted{provider:"mfa",surface:"challenge"}` · `auth.signin_blocked{reason}` where `reason ∈ {invalid_code, locked_out, backup_code, offline, session_expired}` · `auth.lockout_recovery_used{method}` where `method ∈ {admin_reset, support}` · `auth.admin_reset_code_sent{channel}`.
  - **Criteria:** (1) A locked-out user with zero other Admins always sees a working path — no state renders a bare "contact your Admin". (2) An admin-reset code is invalidated on re-request and after 30 minutes. (3) A 5xx never increments the failure count. (4) Both recovery paths produce an `audit_log` row with an actor. (5) The code field is pasteable and never re-authenticates via a full page load.
  - **Budgets:** verification resolves in < 400 ms; the lockout countdown is server-authoritative and re-syncs within 2 s of a reconnect.

---

<a id="scr-0-4"></a>

##### Screen Name: S-0.4 Multi-Factor Enrollment 🆕

- **Purpose:** The one place a user **enables** MFA on their own account — reached from [S-6.8](08-Settings.md#scr-6-8) Security, from a workspace policy prompt at first login, and from a support recovery window. Revision 2 defined the _challenge_ (S-0.3) but never the act of turning MFA on, so the toggle could not be specified honestly.
- **User Role(s):** Any authenticated role (Admin, Editor, Reviewer, Viewer, Support)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Two-factor authentication — Setup                 Step 1 of 3     │
  │ ●━━○━━○                                                     │
  │                                                                  │
  │  1. Scan this code with your authenticator app                    │
  │  ┌────────────┐   [ Can't scan? Show the key instead ]            │
  │  │ ▓▓ ▓▓ ▓▓   │                                                  │
  │  │ ▓  QR  ▓   │                                                  │
  │  └────────────┘                                                  │
  │                                                                  │
  │  2. …or enter this key manually                                  │
  │     A3F2-B19C-77D4-…   [Copy]                                    │
  │                                                                  │
  │  3. Enter the 6-digit code to confirm                             │
  │     [ _ _ _ _ _ _ ]   [Verify and turn on 2FA]                   │
  │                                                                  │
  │  ⚠ Two-factor is still OFF. Closing this page leaves it off.     │
  └──────────────────────────────────────────────────────────────────┘
  ```
  **After success:**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ ✅ Two-factor authentication is on                               │
  │ Save these 10 backup codes now — this is the only time we        │
  │ will show them.                                                  │
  │  1. x4k9-2mqw   2. 7rtb-h3fn   3. p2zc-w9kd   4. m4vb-jx7s   …   │
  │  [Download .txt]  [Copy all]   [✓ I saved them]                    │
  │                                                                  │
  │ Regenerate backup codes · Replace authenticator                   │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. **Choose and scan.** The user picks an authenticator app from a short list (Google Authenticator, Authy, 1Password, Aegis) and scans a QR code carrying an `otpauth://` URI.
  2. **Manual key fallback.** The same secret is shown as a **manual key in 4-character groups covering the whole secret** (`XXXX-XXXX-XXXX-…`, a base32 TOTP secret is 32 characters) with a **Copy** button, always visible — not hidden behind the "can't scan" toggle — because a phone camera failure is common and the recovery must not depend on a re-render of a QR. The key is **never truncated**: a partial key enrols nowhere and fails silently. See [`DESIGN.md` §15 #23](DESIGN.md#15-spec-conflict-register).
  3. **Confirm.** A 6-digit code is entered. **The MFA toggle does not flip until this code verifies.** A 6-digit code is not proof the key was saved correctly; the real proof is that the user's device generates the next code.
  4. **Save backup codes.** Shown exactly once; the screen is not dismissible until the user confirms **I saved them** (an explicit acknowledgement, not a timeout). Never emailed, never shown again. Regenerating invalidates all previous codes with a warning naming the count.
  5. **Regenerate backup codes** — reissues 10 new codes, invalidates the old set, and requires confirmation because it silently breaks any copy already saved.
  6. **Replace authenticator** — restarts at step 1. The old authenticator stays active until the new one verifies, so a mis-scan cannot lock the user out.
- **Data Displayed/Modified:** Reads `users.two_factor_enabled` and the authenticator enrolment date; writes `users.two_factor_enabled`, a TOTP secret record, and 10 single-use backup codes; appends to `login_events` per [S-6.8](08-Settings.md#scr-6-8). The secret is invalidated server-side 15 minutes after issue.
- **States:**
  - **Loading:** secret generation shows a skeleton QR and a disabled manual key for the length of the request; **Verify** enters a pending state for one attempt. Neither blocks Cancel back to step 1.
  - **QR Unreadable (camera denied, low contrast, no camera):** the manual key section is **revealed automatically** — not behind a toggle the user must find — with _"Enter this key by hand in your app."_
  - **Authenticator Not Set Up Yet:** the user has not yet installed an app; the step-1 panel links to the store listing for their platform and keeps the manual key visible.
  - **Wrong Code:** _"That code didn't work. Check that your app is on the right account and try again."_ MFA remains **off**; the toggle and the fact box are unchanged.
  - **Clock Skew:** _"Your device clock is off by more than a minute, so codes are rejected. Turn on automatic date and time."_ — a distinct message from a wrong code, because the fix differs.
  - **Network Failure:** the enrollment is a write and is **not** queued. _"You're offline — nothing was changed. Try again when you're back."_ The QR and key stay rendered for the duration.
  - **Already Enrolled:** visiting the screen shows status, the authenticator's enrolment date, the remaining backup-code count, and **Replace authenticator** / **Regenerate backup codes** — never a second QR.
  - **Partial Failure:** backup-code generation fails after the authenticator verifies — _"2FA is on, but your backup codes couldn't be generated. Generate them again before you close this page."_ The user is **not** left with an account protected by zero recovery codes.
  - **Success:** confirmation screen with the one-time backup codes, then **Done**.
  - **Mid-flow abandonment:** closing at any point leaves MFA **off**, and the screen says so: _"Two-factor is still off. Closing this page leaves it off."_ No half-enrolled state is persisted.
  - **Device lost:** _"Lost your device?"_ → [S-0.3](#scr-0-3) lockout recovery — a backup code, **Request an admin reset**, or **Verified support recovery**. Enrollment is the only place this path is surfaced before the user needs it.
- **Resilience:**
  - **403:** a Viewer or Support user with a workspace policy that forbids self-service MFA sees the whole surface replaced with an explanation: _"Your workspace manages two-factor for your role. Ask an Admin to enable it."_ The QR and key are **absent** — not rendered behind a disabled button (three-case rule: whole surface locked).
  - **404:** a `secretId` that no longer exists (already replaced in another tab) returns to the enrollment status state with _"This setup link expired. Start again."_
  - **Offline:** as above — the write is not queued, and the screen states that nothing changed.
  - **Session expiry mid-enrollment:** the flow returns to step 1 after re-authentication. **A secret is invalidated server-side 15 minutes after issue**, so a partially-completed flow can never be resumed with a stale secret.
  - **Conflict:** two tabs enrolling at once — the second write returns a conflict, and the user is told an authenticator is already enrolled rather than silently overwriting the first.
  - **Server error:** _"We couldn't turn on 2FA — nothing was changed. Try again."_ with Retry and a request ID. The toggle never flips on a 5xx.
  - **No dirty-buffer risk** beyond the 6-digit confirmation code.
- **Keyboard & Focus:** On arrival focus lands on the **Copy** button for the manual key, so a keyboard user reaches the recovery path before the QR. `Tab` order: app chooser → Copy → code input → **Verify and turn on 2FA**. Step change moves focus to the step's first control and announces it in an `aria-live="polite"` region — _"Step 3 of 3: Confirm."_ On the success screen focus moves to the code list heading (`tabindex="-1"`) so a screen reader starts at the codes, and the count is announced: _"10 backup codes."_ `Esc` on the backup-code screen does **not** close it — the codes would be lost; the only exits are **I saved them** and **Done**. **Download** and **Copy** both confirm inline (_"Copied."_ / _"Downloaded."_), and `Esc` is otherwise inert.
- **Navigation:**
  - Entry → [S-6.8](08-Settings.md#scr-6-8) Security · first-login policy prompt · [S-0.3](#scr-0-3) support-recovery window
  - "Lost your device?" → [S-0.3](#scr-0-3) MFA Challenge (backup code / lockout recovery)
  - "Ask an Admin to enable it" → [S-7.4](09-Shared-Components.md#scr-7-4) Help & Support Panel
  - Done → previous screen, or [S-1.1](03-Dashboard.md#scr-1-1)
- **Instrumentation & acceptance:**
  - **Events:** `auth.mfa_enrollment_started{entry_point}` where `entry_point ∈ {settings, policy_prompt, support_recovery}` · `auth.mfa_enrollment_step_completed{step}` · `auth.mfa_enrollment_completed{step3_attempts}` · `auth.mfa_enrollment_abandoned{at_step}` · `auth.mfa_backup_codes_shown` · `auth.mfa_backup_codes_regenerated{invalidated_count}` · `auth.mfa_authenticator_replaced`.
  - **Criteria:** (1) The MFA toggle reads **off** until step 3 verifies — a failing code leaves the account unprotected. (2) Backup codes render exactly once; a reload after acknowledgement never reveals them again. (3) Closing at any step leaves MFA off and the screen says so. (4) The manual key is reachable by keyboard without interacting with the QR. (5) **Download** and **Copy** both work from the keyboard alone.
  - **Budgets:** QR and secret render < 300 ms; verification resolves in < 400 ms; step transition < 200 ms; the codes list is not virtualised (10 items) and paints in one frame.
