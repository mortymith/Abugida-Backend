# Section 0: Authentication & Onboarding

> **Abugida Academy — UX Design Specification** · Part 01 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Overview & Sitemap](00-Overview-and-Sitemap.md) · [Global Navigation →](02-Global-Navigation.md)

Sign-in is exclusively federated: every staff member authenticates with **Google** or **Telegram**. The platform stores no passwords, so there is no email/password form and no self-service password reset — account recovery is handled by the identity provider itself. Both providers are configured per workspace in [S-6.3](08-Settings.md#scr-6-3) Integrations, and all authentication events are written to the audit trail in [S-6.8](08-Settings.md#scr-6-8).

<a id="scr-0-1"></a>

##### Screen Name: S-0.1 Login

- **Purpose:** Entry point for all users. Authenticates staff (Admin, Editor, Reviewer, Viewer, Support) against the organization's account through Google or Telegram, then routes them into the app shell.
- **User Role(s):** Unauthenticated (pre-login)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │                         [Abugida Academy Logo]                  │
  │                                                                  │
  │                     Sign in to your workspace                   │
  │                                                                  │
  │              +──────────────────────────────────────+           │
  │              │ [G]  Continue with Google              │           │
  │              +──────────────────────────────────────+           │
  │                                                                  │
  │              +──────────────────────────────────────+           │
  │              │ [✈]  Continue with Telegram            │           │
  │              +──────────────────────────────────────+           │
  │                                                                  │
  │      No password needed — sign-in is handled by Google and      │
  │      Telegram. Providers are managed in Workspace Settings.     │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Continue with Google — opens the Google OAuth consent screen, then completes sign-in.
  2. Continue with Telegram — opens the Telegram Login confirmation (bot deep link or Login Widget), then completes sign-in.
  3. Navigate to workspace sign-up.
- **Data Displayed/Modified:** Reads `users`/`auth_identities`/`sessions`; writes an audit entry to `login_events` (see [S-6.8](08-Settings.md#scr-6-8)). On first sign-in, links the provider identity (`auth_identities`) to the invited user record.
- **States:**
  - **Default:** Both provider buttons enabled; the page remembers the provider used last and lists it first.
  - **Redirecting:** Full-screen spinner with "Contacting Google…" / "Contacting Telegram…".
  - **Provider Cancelled:** Returns to the login screen with buttons re-enabled; no error toast (cancelling is a normal action).
  - **Provider Error:** "Google sign-in failed. Try again or use Telegram." (and vice versa).
  - **Unknown Account:** "This account isn't linked to any workspace. Ask your Admin to invite you, or create a workspace."
  - **Invite Email Mismatch:** "You signed in as jane@personal.com, but your invitation was sent to jane@abugida.com. Sign in with the matching Google/Telegram account."
  - **MFA Required:** Redirects to [S-0.3](#scr-0-3) Multi-Factor Authentication Challenge.
  - **Success:** Redirect to last-visited module or [S-1.1](03-Dashboard.md#scr-1-1) Analytics Overview.
- **Navigation:**
  - Sign-in success (no MFA) → [S-1.1](03-Dashboard.md#scr-1-1) Analytics Overview
  - Sign-in success (MFA enabled) → [S-0.3](#scr-0-3) MFA Challenge
  - "Create a workspace" → [S-0.2](#scr-0-2) Organization Sign-Up & Onboarding

---

<a id="scr-0-2"></a>

##### Screen Name: S-0.2 Organization Sign-Up & Onboarding

- **Purpose:** First-run wizard for a brand-new workspace: authenticate with Google or Telegram, create the organization and the first Admin account, and land on a starter checklist.
- **User Role(s):** Unauthenticated → becomes Admin on completion
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Step 1/3: Account & Org        Step 2/3: You   Step 3/3: Tour    │
  │ ●━━━━━━━━━━━━━○━━━━━━━━━━━━━━○                                   │
  │ +────────────────────────────+  +───────────────────────────+    │
  │ │ [G] Continue with Google    │  │ [✈] Continue with Telegram│    │
  │ +────────────────────────────+  +───────────────────────────+    │
  │ (your workspace profile is created from your verified provider   │
  │  identity — no password is ever set)                             │
  │ Workspace Name: [Abugida Academy]                                │
  │ Subdomain: [abugida].abugida.app                                 │
  │ Primary Use Case: (○ Language Courses ○ Corporate Training …)    │
  │ [Continue]                                                       │
  ├──────────────────────────────────────────────────────────────────┤
  │ Getting Started Checklist (post sign-up, shown as dismissible    │
  │ card on [S-1.1] until complete):                                 │
  │ [ ] Invite your team ([S-6.2](08-Settings.md#scr-6-2))                         │
  │ [ ] Brand your workspace ([S-6.4](08-Settings.md#scr-6-4))                     │
  │ [ ] Create your first course — blank ([S-2.2](04-Courses.md#scr-2-2)),        │
  │     template ([S-2.12](04-Courses.md#scr-2-12)), or AI draft ([S-2.11])       │
  │ [ ] Connect a payment gateway ([S-6.3](08-Settings.md#scr-6-3))                │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Authenticate with Google or Telegram; the Admin profile is created from the verified provider identity (name, email/avatar).
  2. Create the workspace and choose a subdomain.
  3. Complete or dismiss the guided checklist.
- **Data Displayed/Modified:** Writes `organizations`, `users` (role = Admin), `auth_identities`, `onboarding_progress`.
- **States:**
  - **Provider Cancelled:** Returns to step 1 with both provider buttons enabled.
  - **Email Already Registered:** "This Google/Telegram account already belongs to a workspace. Sign in instead." with a link back to [S-0.1](#scr-0-1).
  - **Subdomain Taken:** Inline error with suggested alternatives.
  - **Provisioning:** "Setting up your workspace…" progress screen (a few seconds).
  - **Success:** Redirect into app shell with [S-7.6](09-Shared-Components.md#scr-7-6) Onboarding Tour auto-launched.
- **Navigation:**
  - Completion → [S-1.1](03-Dashboard.md#scr-1-1) Analytics Overview (with [S-7.6](09-Shared-Components.md#scr-7-6) tour overlay)
  - Checklist items → their respective linked screens

---

<a id="scr-0-3"></a>

##### Screen Name: S-0.3 Multi-Factor Authentication Challenge

- **Purpose:** Second authentication factor (TOTP authenticator app) enforced after a successful Google/Telegram sign-in when MFA is required by workspace policy ([S-6.8](08-Settings.md#scr-6-8)).
- **User Role(s):** Unauthenticated (mid-login)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Enter the 6-digit code from your authenticator app               │
  │ [ _ _ _ _ _ _ ]                                                  │
  │ [Verify]                                                         │
  │ Can't access your app? [Use a backup code]                       │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Enter and submit the one-time code from the authenticator app.
  2. Fall back to a backup recovery code.
- **Data Displayed/Modified:** Writes `login_events` on success/failure.
- **States:**
  - **Invalid Code:** "That code didn't work. Try again."
  - **Expired Window:** Inline hint: "Codes rotate every 30 seconds — wait for the next one."
  - **Locked Out:** After 5 failed attempts, "Contact your workspace Admin to regain access."
  - **Success:** Proceed to app shell.
- **Navigation:**
  - Success → [S-1.1](03-Dashboard.md#scr-1-1) Analytics Overview
  - "Use a backup code" → inline alternate input, same screen
