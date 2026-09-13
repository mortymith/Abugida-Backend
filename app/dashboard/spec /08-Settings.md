# Section 6: Settings & Configuration

> **Abugida Academy — UX Design Specification** · Part 08 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Analytics](07-Analytics.md) · [Shared Components →](09-Shared-Components.md)

<a id="scr-6-1"></a>

##### Screen Name: S-6.1 General Settings

- **Purpose:** Manage system-wide settings, configurations, and preferences.
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Settings"                                             │
  │         [General] [Team] [Integrations] [Branding]            │
  ├──────────────────────────────────────────────────────────────────┤
  │ ┌─ General Tab ────────────────────────────────────────────────┤
  │ │ +──────────────────────────────────────────────────────────+ │
  │ │ │ Platform Settings:                                      │ │
  │ │ │ Platform Name: [Abugida Academy]                       │ │
  │ │ │ Support Email: [support@abugida.com]                   │ │
  │ │ │ Timezone: [Africa/Addis_Ababa]                         │ │
  │ │ │ Date Format: [DD/MM/YYYY]                              │ │
  │ │ │                                                        │ │
  │ │ │ Course Settings:                                       │ │
  │ │ │ Default Instructor: [Select]                           │ │
  │ │ │ Default Category: [Select]                             │ │
  │ │ │                                                        │ │
  │ │ │ Notification Settings:                                 │ │
  │ │ │ [ ] Auto-notify on course publication                  │ │
  │ │ │ [ ] Daily digest emails                                │ │
  │ │ │                                                        │ │
  │ │ │ [Save Changes] [Cancel]                                │ │
  │ │ +──────────────────────────────────────────────────────────+ │
  │ └─────────────────────────────────────────────────────────────┘ │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Update platform settings.
  2. Configure default values.
  3. Save configuration changes.
- **Data Displayed/Modified:** Reads/Writes to system_settings table.
- **States:**
  - **Default:** Current settings populated.
  - **Unsaved Changes:** "Save Changes" active.
  - **Saving:** Spinner on save button.
  - **Success:** Toast: "Settings saved successfully."
  - **Error:** "Unable to save settings. Retry?"
- **Navigation:**
  - Tabs → Switch between sections
  - "Save Changes" → Save config

---

<a id="scr-6-2"></a>

##### Screen Name: S-6.2 Team Management

- **Purpose:** Manage team members, their roles within the platform, and access levels.
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Settings"                                             │
  │         [General] [Team] [Integrations] [Branding]            │
  ├──────────────────────────────────────────────────────────────────┤
  │ ┌─ Team Tab ───────────────────────────────────────────────────┤
  │ │ +──────────────────────────────────────────────────────────+ │
  │ │ │ Team Members:                                            │
  │ │ │ +──────────────────────────────────────────────────────+│ │
  │ │ │ | Name         | Email           | Role    | Status | │ │
  │ │ │ |──────────────|─────────────────|─────────|────────| │ │
  │ │ │ | John Doe     | john@...        | Admin   | Active │ │
  │ │ │ | Jane Smith   | jane@...        | Editor  | Active │ │
  │ │ │ | Alex Johnson | alex@...        | Viewer  | Inactive│ │
  │ │ │ +──────────────────────────────────────────────────────+│ │
  │ │ │ [+ Invite Team Member]                                  │ │
  │ │ +──────────────────────────────────────────────────────────+ │
  │ │                                                          │ │
  │ │ Role Definitions:                                        │ │
  │ │ +──────────────────────────────────────────────────────────+ │
  │ │ │ Admin: Full access to all features                     │ │
  │ │ │ Editor: Can create, edit, and manage courses           │ │
  │ │ │ Reviewer: Approves or rejects lessons for publication  │ │
  │ │ │ Viewer: Read-only access to courses and analytics      │ │
  │ │ │ Support: Can view students and send communications     │ │
  │ │ +──────────────────────────────────────────────────────────+ │
  │ │                                                          │ │
  │ │ [Save Changes] [Cancel]                                 │ │
  │ └─────────────────────────────────────────────────────────────┘ │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. View team members and their roles.
  2. Invite new team members.
  3. Edit team member roles.
  4. Remove team members.
- **Data Displayed/Modified:** Reads/Writes to team_members table.
- **States:**
  - **Default:** Team list populated.
  - **Empty:** "No team members added yet. Invite your first team member."
  - **Loading:** Skeleton table rows.
  - **Inviting:** Invitation modal with email and role selection.
  - **Success:** Toast: "Invitation sent successfully."
  - **Error:** "Unable to send invitation. Retry?"
  - **Reviewer Role:** Selecting "Reviewer" grants approve/reject rights ([S-2.14](04-Courses.md#scr-2-14)) without authoring permissions.
- **Navigation:**
  - "Invite Team Member" → Invitation modal
  - "Edit" → Role selection dropdown

---

<a id="scr-6-3"></a>

##### Screen Name: S-6.3 Integrations

- **Purpose:** Configure external integrations: authentication providers (Google, Telegram), payment gateways, email service, and analytics.
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Settings"                                             │
  │         [General] [Team] [Integrations] [Branding]            │
  ├──────────────────────────────────────────────────────────────────┤
  │ ┌─ Integrations Tab ───────────────────────────────────────────┤
  │ │ Payment Gateways:                                            │
  │ │ +──────────────────────────────────────────────────────────+ │
  │ │ │ Stripe      🔵 Active    [Configure] [Disable]           │ │
  │ │ │ PayPal      ⚪ Inactive  [Configure] [Activate]           │ │
  │ │ │ Telebirr    ⚪ Inactive  [Configure] [Activate]           │ │
  │ │ │ Bank Transfer ⚪ Inactive  [Configure] [Activate]          │ │
  │ │ +──────────────────────────────────────────────────────────+ │
  │ │                                                              │
  │ │ Email Service:                                              │
  │ │ +──────────────────────────────────────────────────────────+ │
  │ │ │ SendGrid    🔵 Active    [Configure]                     │ │
  │ │ │ SMTP        ⚪ Inactive  [Configure]                     │ │
  │ │ │ Test Email Sending: [Send Test]                         │ │
  │ │ +──────────────────────────────────────────────────────────+ │
  │ │                                                              │
  │ │ Authentication (sign-in):                                 │ │
  │ │ +──────────────────────────────────────────────────────────+ │ │
  │ │ │ Google OAuth   🔵 Active   [Configure]                   │ │
  │ │ │ Telegram Login 🔵 Active   [Configure]                   │ │
  │ │ │ ☑ Both providers enabled (see S-0.1)                    │ │
  │ │ +──────────────────────────────────────────────────────────+ │ │
  │ │                                                              │
  │ │ Analytics:                                                  │
  │ │ +──────────────────────────────────────────────────────────+ │
  │ │ │ Google Analytics: [UA-12345678-1]                       │ │
  │ │ │ Mixpanel: [Project Token]                               │ │
  │ │ │ [Save] [Test Connection]                                │ │
  │ │ +──────────────────────────────────────────────────────────+ │
  │ └─────────────────────────────────────────────────────────────┘ │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Configure payment gateways.
  2. Test email service.
  3. Configure analytics integrations.
  4. Configure sign-in providers (Google OAuth, Telegram Login) used by [S-0.1](01-Authentication-and-Onboarding.md#scr-0-1).
  5. Save configuration.
- **Data Displayed/Modified:** Reads/Writes to integration_configs table.
- **States:**
  - **Default:** Current configs displayed.
  - **Testing:** Spinner on "Test" buttons.
  - **Success:** Toast: "Test successful" or "Config saved."
  - **Error:** "Test failed: Invalid API key."
- **Navigation:**
  - "Configure" → Integration-specific config modal

---

<a id="scr-6-4"></a>

##### Screen Name: S-6.4 Branding

- **Purpose:** Configure platform branding: logo, colors, favicon, and custom CSS.
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Settings"                                             │
  │         [General] [Team] [Integrations] [Branding]            │
  ├──────────────────────────────────────────────────────────────────┤
  │ ┌─ Branding Tab ───────────────────────────────────────────────┤
  │ │ +──────────────────────────────────────────────────────────+ │
  │ │ │ Logo Upload:                                             │
  │ │ │ +──────────+  +──────────────────────────────────────+ │ │
  │ │ │ | [Current |  │ Company Name: [Abugida Academy]     │ │
  │ │ │ | Logo]   |  │                                      │ │
  │ │ │ | 160x40 |  │ [Upload New Logo]                    │ │
  │ │ │ +──────────+  │ [Upload Favicon]                    │ │
  │ │ │                +──────────────────────────────────────+ │ │
  │ │ │                │ Primary Color: [ #8b5cf6 ]          │ │
  │ │ │                │ Secondary Color: [ #6d28d9 ]       │ │
  │ │ │                │ Background Color: [ #f8fafc ]      │ │
  │ │ │                +──────────────────────────────────────+ │ │
  │ │ │                │ Custom CSS: [Textarea]              │ │
  │ │ │                │ (Advanced styling overrides)       │ │
  │ │ │                +──────────────────────────────────────+ │ │
  │ │ │                │ [Live Preview]                      │ │
  │ │ │                │ [Save Branding] [Reset to Default] │ │
  │ │ +──────────────────────────────────────────────────────────+ │
  │ └─────────────────────────────────────────────────────────────┘ │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Upload logo and favicon.
  2. Set brand colors.
  3. Add custom CSS.
  4. Preview changes.
  5. Reset to default branding.
- **Data Displayed/Modified:** Reads/Writes to branding_settings table.
- **States:**
  - **Default:** Current branding displayed.
  - **Logo Uploading:** Progress indicator.
  - **Preview Mode:** Live preview of changes.
  - **Saving:** "Save" spinner.
  - **Success:** Toast: "Branding updated successfully."
  - **Error:** "Unable to save branding. Retry?"
- **Navigation:**
  - "Save Branding" → Save and apply
  - "Reset to Default" → [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation → Reset

---

<a id="scr-6-5"></a>

##### Screen Name: S-6.5 My Profile & Account

- **Purpose:** Personal account settings for the signed-in user — separate from workspace-wide settings — reached from the header avatar in [S-A.1](02-Global-Navigation.md#scr-a-1).
- **User Role(s):** Admin, Editor, Viewer, Support
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "My Profile"                                             │
  ├──────────────────────────────────────────────────────────────────┤
  │ [Avatar 96px] [Change Photo]   Name: [Jane Smith]                │
  │                                 Email: [jane@abugida.com]        │
  │                                 Role: Editor (assigned by Admin) │
  ├──────────────────────────────────────────────────────────────────┤
  │ Security:                                                        │
  │  Connected accounts: Google ✓ · Telegram ✓  [Manage]             │
  │  Two-Factor Authentication: [ ] Enabled  [Set Up]                │
  │  Active Sessions: 2 devices  [View & Sign Out]                  │
  ├──────────────────────────────────────────────────────────────────┤
  │ Preferences: Language [English ▾]  Timezone [Africa/Addis_Ababa] │
  │ [Save Changes]                                                   │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Edit name, photo, and personal preferences.
  2. Manage connected Google/Telegram sign-ins and configure MFA.
  3. Review and revoke active sessions.
- **Data Displayed/Modified:** Reads/writes `users` (own record only), `sessions`.
- **States:**
  - **Default:** Current profile populated; role field read-only (managed in [S-6.2](#scr-6-2)).
  - **Unlink Blocked:** Removing the last connected provider is blocked: "You need at least one sign-in method to access your account."
  - **Saving:** Spinner on "Save Changes".
  - **Success:** Toast: "Profile updated."
  - **Session Revoked:** Confirmation via [S-7.1](09-Shared-Components.md#scr-7-1); target device signed out immediately.
- **Navigation:**
  - "Set Up" MFA → inline QR-code enrollment flow → [S-0.3](01-Authentication-and-Onboarding.md#scr-0-3) pattern reused
  - Logout (header) → [S-0.1](01-Authentication-and-Onboarding.md#scr-0-1) Login

---

<a id="scr-6-6"></a>

##### Screen Name: S-6.6 Billing & Subscription

- **Purpose:** Manage the workspace's own subscription plan for the Abugida platform (distinct from course-payment gateways in [S-6.3](#scr-6-3)): current plan, usage, invoices, and payment method.
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Billing & Subscription"                                 │
  ├──────────────────────────────────────────────────────────────────┤
  │ Current Plan: Growth — $99/mo         [Upgrade] [Cancel Plan]   │
  │ Usage: 456 / 1,000 course seats · 1,234 / 5,000 students        │
  │ ▓▓▓▓▓▓▓▓▓░░  46%             ▓▓▓░░░░░░░  25%                    │
  ├──────────────────────────────────────────────────────────────────┤
  │ Payment Method: Visa •••• 4242         [Update Card]            │
  │ Billing Email: [billing@abugida.com]                            │
  ├──────────────────────────────────────────────────────────────────┤
  │ Invoices:                                                        │
  │ | Date       | Amount | Status | |                              │
  │ | 2026-08-01 | $99.00 | Paid   | [Download PDF]                 │
  │ | 2026-07-01 | $99.00 | Paid   | [Download PDF]                 │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Upgrade, downgrade, or cancel the subscription plan.
  2. Update the payment method and billing email.
  3. Download past invoices.
- **Data Displayed/Modified:** Reads/writes `subscriptions`, `invoices`, `payment_methods`.
- **States:**
  - **Default:** Current plan and usage populated.
  - **Approaching Limit:** 🟠 banner at 90% of seat/student usage: "You're close to your plan limit."
  - **Payment Failed:** 🔴 banner: "Your last payment failed. Update your card to avoid service interruption."
  - **Cancelling:** [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation with retention offer.
- **Navigation:**
  - "Upgrade" → plan comparison modal
  - "Download PDF" → invoice file download

---

<a id="scr-6-7"></a>

##### Screen Name: S-6.7 API & Webhooks

- **Purpose:** Manage API keys and outbound webhooks for integrating Abugida with external systems (CRMs, data warehouses, custom apps).
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "API & Webhooks"                                         │
  ├──────────────────────────────────────────────────────────────────┤
  │ API Keys:                                                        │
  │ | Name        | Key (masked)      | Created    | |              │
  │ | Zapier      | sk_live_••••3f2a  | 2026-06-01 | [Revoke]       │
  │ [+ Generate New Key]                                             │
  ├──────────────────────────────────────────────────────────────────┤
  │ Webhooks:                                                        │
  │ | Event               | Target URL             | Status |      │
  │ | enrollment.created  | https://crm.example.../ | 🟢 OK  | [Edit]│
  │ | course.published    | https://hooks.slack…    | 🟢 OK  | [Edit]│
  │ [+ Add Webhook]                     [View Delivery Logs]        │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Generate and revoke API keys.
  2. Add, edit, and test webhook endpoints.
  3. Inspect delivery logs and retry failed deliveries.
- **Data Displayed/Modified:** Writes to `api_keys`, `webhooks`, `webhook_deliveries`.
- **States:**
  - **Key Generated:** One-time reveal modal: "Copy this key now — you won't see it again."
  - **Webhook Failing:** 🔴 status with "3 consecutive failures" and a "Retry" action.
  - **Testing:** "Send Test Event" shows request/response payload inline.
- **Navigation:**
  - "View Delivery Logs" → expands inline log table (same screen)

---

<a id="scr-6-8"></a>

##### Screen Name: S-6.8 Security & Audit Log

- **Purpose:** Workspace-wide security policy configuration and a searchable, exportable audit trail of sensitive actions (logins, permission changes, deletions, exports).
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Security & Audit Log"                                   │
  │ Tabs: [Policies] [Audit Log]                                     │
  ├──────────────────────────────────────────────────────────────────┤
  │ ┌─ Policies ───────────────────────────────────────────────────┐ │
  │ │ [✓] Require MFA for all Admins                                │ │
  │ │ Session Timeout: [8 hours ▾]                                  │ │
  │ │ Sign-in Methods: Google OAuth · Telegram Login (S-6.3)        │ │
  │ │ Allowed Login IP Ranges: [10.0.0.0/8, ...] (optional)         │ │
  │ └────────────────────────────────────────────────────────────────┘ │
  │ ┌─ Audit Log ──────────────────────────────────────────────────┐ │
  │ │ | Time       | Actor      | Action              | Target |   │ │
  │ │ | 09:14 today| Jane Smith | role.changed         | Alex J.|   │ │
  │ │ | Yesterday  | John Doe   | course.deleted       | GRE 101│   │ │
  │ │ [Filter by actor/action] [Export CSV]                        │ │
  │ └────────────────────────────────────────────────────────────────┘ │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Configure MFA enforcement, session timeout, and sign-in method policy.
  2. Restrict logins to allow-listed IP ranges.
  3. Search, filter, and export the audit log.
- **Data Displayed/Modified:** Reads/writes `security_policies`; reads `audit_log` (append-only).
- **States:**
  - **Default:** Current policies populated; audit log paginated, newest first.
  - **Saving Policy:** Toast: "Security policy updated."
  - **Export:** Routes through [S-5.4](07-Analytics.md#scr-5-4)-style generation flow.
- **Navigation:**
  - Audit row "Target" → the relevant screen (e.g., a deleted course row links to [S-2.1](04-Courses.md#scr-2-1) if still recoverable from trash)

---

<a id="scr-6-9"></a>

##### Screen Name: S-6.9 Roles & Permissions

- **Purpose:** Dedicated, granular permission matrix editor — complements the simple role assignment in [S-6.2](#scr-6-2) Team Management with per-module capability toggles for custom roles.
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Roles & Permissions"              [+ Create Custom Role]│
  ├──────────────────────────────────────────────────────────────────┤
  │ Role: [Editor ▾]                                                 │
  │ | Module            | View | Create | Edit | Delete | Publish | │
  │ |────────────────────|------|--------|------|--------|---------| │
  │ | Courses            | ✓    | ✓      | ✓    | ✗      | ✓       | │
  │ | Students           | ✓    | ✓      | ✓    | ✗      | —       | │
  │ | Analytics          | ✓    | —      | —    | —      | —       | │
  │ | Settings           | ✗    | ✗      | ✗    | ✗      | —       | │
  │ | Billing            | ✗    | ✗      | ✗    | ✗      | —       | │
  │ [Save Permissions]                                               │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Select a role and toggle per-module capabilities.
  2. Create a new custom role by cloning an existing one.
  3. Save and apply changes immediately to all users with that role.
- **Data Displayed/Modified:** Writes to `roles`, `role_permissions`.
- **States:**
  - **Built-In Role:** Admin role's core permissions are locked (cannot remove the last full-Admin to avoid workspace lockout).
  - **Saving:** Toast: "Permissions updated. Changes apply immediately."
  - **Conflict:** Warns if saving would leave zero users able to manage Billing/Settings.
- **Navigation:**
  - "Create Custom Role" → inline role-naming step, then the same matrix
  - Back → [S-6.2](#scr-6-2) Team Management

---

<a id="scr-6-10"></a>

##### Screen Name: S-6.10 Privacy & Data Retention

- **Purpose:** GDPR/CCPA compliance toolkit: automated retention policies that anonymize or delete student data after a period of inactivity, a queue for data-subject requests (export/erase) with SLA countdowns, and a consent log. Sensitive actions are always dual-confirmed and fully audited.
- **User Role(s):** Admin
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Privacy & Data Retention"                               │
  │ Tabs: [Retention Policies] [Data Requests (2)] [Consent Log]     │
  ├──────────────────────────────────────────────────────────────────┤
  │ ┌─ Retention Policies ──────────────────────────────────────────┐│
  │ │ [✓] Anonymize inactive students                               ││
  │ │     Inactivity: [12 months ▾] → Anonymize PII, keep progress  ││
  │ │     Warning email: [14 days ▾] before action                  ││
  │ │ [ ] Delete students inactive for [24 months ▾]                ││
  │ │ Scope: ☑ Profile & contact  ☑ Messages  ☐ Certificates        ││
  │ │        (kept for audit)                                       ││
  │ │ Next run: 2026-10-01 · 42 students currently match [Preview]  ││
  │ └───────────────────────────────────────────────────────────────┘│
  │ ┌─ Data Requests ───────────────────────────────────────────────┐│
  │ │ | Student  | Type   | Requested | SLA       | Action           ││
  │ │ | Tigist M.| Export | Sep 5     | 26d left  | [Prepare Export] ││
  │ │ | Daniel W.| Delete | Sep 3     | 24d left  | [Review & Erase] ││
  │ └───────────────────────────────────────────────────────────────┘│
  │ Legal-basis notes + full trail → [S-6.8](#scr-6-8) Security      │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Configure retention policies: inactivity threshold, action (anonymize PII vs. hard delete), scope (profile, messages, progress, certificates), and advance warning email.
  2. Preview the exact set of students a policy currently matches before it next runs.
  3. Process data-subject requests: generate a portable data export, or review and execute a verified erasure request.
  4. Review the consent log (marketing opt-ins, terms acceptance) with timestamps and source.
- **Data Displayed/Modified:** Writes `retention_policies`, `data_requests`, `consent_records`; anonymization nulls PII fields while preserving `student_id` integrity for historical analytics.
- **States:**
  - **Policy Enabled:** Shows next run date and current match count; changes require [S-7.1](09-Shared-Components.md#scr-7-1) confirmation with an impact summary.
  - **Preview:** "42 students match. 5 received a warning email already." with the full list before any action.
  - **Executed:** Run summary: "38 anonymized · 4 skipped (active in last 14 days)" — logged to the audit trail.
  - **Export Request:** Prepares an archive (profile, enrollments, progress, certificates) → secure download link emailed to the requester when ready.
  - **Delete Request:** Two-step: verify identity → [S-7.1](09-Shared-Components.md#scr-7-1) typed-confirmation ("Type ERASE") → irreversible deletion with a completion receipt.
  - **SLA Warning:** 🔴 badge when a request is within 5 days of its 30-day statutory deadline.
- **Validation & Feedback:**
  - Deletion scope never silently removes financial records; invoices/transactions are retained per tax rules and shown as exceptions.
  - Anonymized students disappear from [S-4.1](06-Students.md#scr-4-1) directory filters by default but remain in aggregate analytics (clearly labeled "anonymized").
  - All policy runs, exports, and erasures write immutable entries to [S-6.8](#scr-6-8) Security & Audit Log.
- **Navigation:**
  - Opened from [S-A.1](02-Global-Navigation.md#scr-a-1) Settings group
  - "Security & Audit Log" → [S-6.8](#scr-6-8) (filtered to privacy events)
  - Student name in Data Requests → [S-4.2](06-Students.md#scr-4-2) Student Profile
