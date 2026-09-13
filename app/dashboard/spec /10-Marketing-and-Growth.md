# Section 8: Marketing & Growth

> **Abugida Academy — UX Design Specification** · Part 10 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Shared Components](09-Shared-Components.md) · [Global Standards →](11-Global-Standards.md)

Screens for attracting, converting, and retaining students: email campaigns with open/click metrics, reusable email templates, discount and coupon codes, the affiliate program, and student testimonials for course landing pages. Revenue-sensitive surfaces (coupons, affiliate payouts) are restricted per the [Roles & Permissions Matrix](11-Global-Standards.md#roles--permissions-matrix), and bulk messaging always routes through [S-7.1](09-Shared-Components.md#scr-7-1)-grade confirmations and consent-aware audiences.

<a id="scr-8-1"></a>

##### Screen Name: S-8.1 Email Campaigns

- **Purpose:** Plan, send, and measure announcement, reminder, and promotion emails to student segments, with campaign metrics including **open rate** and **click rate** at campaign and link level.
- **User Role(s):** Admin, Editor (Support: view only)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Email Campaigns"             [+ New Campaign] [Filter ▾]│
  ├──────────────────────────────────────────────────────────────────┤
  │ | Campaign         | Audience      | Status   | Sent | Open| Click│
  │ |──────────────────|───────────────|──────────|──────|─────|──────│
  │ │ Sept. TOEFL push │ All contacts  │ 🟢 Sent  │ 1,204| 54% | 12%  │
  │ │ Reminder: M2 due │ TOEFL Jan coh.│ 🟢 Sent  │   24 | 71% | 33%  │
  │ │ Black Friday     │ Newsletter    │ 🟠 Sched.│  —   |  —  |  —   │
  ├──────────────────────────────────────────────────────────────────┤
  │ Campaign Detail (per row):                                       │
  │ Delivered 1,190 → Opened 650 (54%) → Clicked 145 (12%) →         │
  │   Enrollments 18                                                 │
  │ Link clicks: [View syllabus · 88]  [Enroll now · 57]             │
  │ Compose: Template [Announcement ▾]  Audience [Segment builder ▾] │
  │ [Send Test]  [Schedule ▾]  [Send Now]                            │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Create a campaign: pick a template ([S-8.2](#scr-8-2)), build the audience segment (cohort, course, tags, activity filters), and send or schedule.
  2. Read per-campaign funnels: delivered → opened → clicked → enrolled, plus link-level click breakdowns.
  3. Duplicate a past campaign as a starting point; cancel a scheduled send before it fires.
- **Data Displayed/Modified:** Writes `campaigns`, `campaign_sends`; reads aggregates (opens, clicks, attributed enrollments) from the email service integration ([S-6.3](08-Settings.md#scr-6-3)).
- **States:**
  - **Draft / Scheduled / Sending / Sent / Cancelled** pills; scheduled rows show countdown and timezone ([S-6.1](08-Settings.md#scr-6-1) workspace timezone).
  - **Segment Empty:** "This audience matches 0 recipients — adjust filters." blocks send.
  - **Large Send:** > 500 recipients requires [S-7.1](09-Shared-Components.md#scr-7-1) confirmation with the final count.
  - **Metrics Lag:** Sent campaigns show "metrics updating" shimmer for the first hour.
- **Validation & Feedback:**
  - Subject and preheader required; merge tags validate against the chosen template ([S-8.2](#scr-8-2)).
  - Unsubscribed/bounced recipients are excluded automatically; the composer shows the final deliverable count.
  - Sends comply with consent state: marketing audiences exclude non-consented students (log available in [S-6.10](08-Settings.md#scr-6-10)).
- **Navigation:**
  - Opened from [S-A.1](02-Global-Navigation.md#scr-a-1) Marketing group; cohort "Email" buttons in [S-4.4](06-Students.md#scr-4-4) deep-link here with a pre-filtered audience
  - "Template" → [S-8.2](#scr-8-2) Email Template Editor
  - Campaign row → detail panel (same screen); attributed enrollments → [S-5.1](07-Analytics.md#scr-5-1) Course Performance

---

<a id="scr-8-2"></a>

##### Screen Name: S-8.2 Email Template Editor

- **Purpose:** Author and maintain pre-built, customizable email templates — Welcome, Course Announcement, Lesson Reminder, Promotion, Certificate Issued, Re-engagement — with merge tags, live preview, and test sends. Campaigns in [S-8.1](#scr-8-1) and automations in [S-4.8](06-Students.md#scr-4-8) compose from these templates.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Email Templates"          [+ New] [Pre-built library ▾] │
  ├──────────────────────────────────────────────────────────────────┤
  │ Pre-built: Welcome · Announcement · Reminder · Promotion ·       │
  │ Certificate Issued · Re-engagement      (each starts a new copy) │
  ├──────────────────────────────────────────────────────────────────┤
  │ Editor: "Course Announcement"                                    │
  │ Subject:    [{{course_name}} starts {{start_date}} — save your   │
  │              seat]        Preheader: [Seats are limited…]        │
  │ +──────────────────────+ +────────────────────────────────────+  │
  │ │ Blocks (drag & drop):│ │ Live preview (Desktop/Mobile ▾)    │  │
  │ │ [Hero] [Text] [Btn]  │ │ Hi {{first_name}},                 │  │
  │ │ [Course card]        │ │ Your course {{course_name}}…       │  │
  │ │ [Footer w/ unsub.]   │ │                                    │  │
  │ └──────────────────────┘ └────────────────────────────────────┘  │
  │ Merge tags: {{first_name}} {{course_name}} {{start_date}}        │
  │             {{progress_url}} {{unsubscribe_url}}                 │
  │ [Send Test]  [Save Template]                                     │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Start from a pre-built template or a blank canvas; compose with drag-and-drop blocks (hero, text, button, course card, footer).
  2. Insert merge tags with the picker; preview with real sample data (a chosen test student).
  3. Send a test to your own address, then save. Templates are versioned; campaigns pin the version they used.
- **Data Displayed/Modified:** Writes `email_templates`, `email_template_versions`; reads student sample data for preview (read-only, no PII leaves the workspace).
- **States:**
  - **Default:** Template list with last-updated and usage counts ("used by 6 campaigns").
  - **Editing:** Autosave drafts; "Save Template" publishes a new version.
  - **Merge Tag Invalid:** Unknown/broken tag highlights with a suggestion list.
  - **Test Sent:** Toast: "Test email sent to jane@abugida.com."
- **Validation & Feedback:**
  - Subject ≤ 150 characters; every template must include the unsubscribe footer block (cannot be deleted).
  - Saving with unresolved sample data warnings (e.g., missing course binding for {{course_name}}) prompts a confirmation.
- **Navigation:**
  - Opened from [S-8.1](#scr-8-1) ("Template" links) and [S-A.1](02-Global-Navigation.md#scr-a-1) Marketing group
  - "Save Template" → back to caller or template list

---

<a id="scr-8-3"></a>

##### Screen Name: S-8.3 Discount & Coupon Codes

- **Purpose:** Generate and manage single-use or multi-use discount codes for specific courses, with usage limits, expiry, revenue attribution, and redemption logs.
- **User Role(s):** Admin, Editor (payout-adjacent settings: Admin)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Discount & Coupon Codes"   [+ Generate Codes] [Filter ▾]│
  ├──────────────────────────────────────────────────────────────────┤
  │ | Code         | Discount | Scope          | Usage   | Expires |  │
  │ |──────────────|──────────|────────────────|─────────|──────────| │
  │ │ TOEFL25      │ 25%      │ TOEFL Complete │ 61 / ∞  │ Oct 31   │  │
  │ │ ACME-a3f8…   │ 100%     │ Workplace ES   │ 1 (×8)  │ Never    │  │
  │ │ EARLY10      │ $10 off  │ Any course     │ 124/500 │ Sep 15   │  │
  ├──────────────────────────────────────────────────────────────────┤
  │ Generator:                                                       │
  │ Type: (● Percentage ○ Fixed amount ○ 100% access)  Value: [25]   │
  │ Scope: [Specific courses ▾]  Limit: (● Multi-use [500]           │
  │         ○ Single-use batch: [500] unique codes → export CSV)     │
  │ Expiry: [2026-10-31]  ☐ Stackable with course discounts          │
  │ [Generate]   Revenue influenced: $4,212 (visible per code)       │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Generate codes: percentage, fixed amount, or full access; scope to specific courses; set usage limits and expiry.
  2. Generate single-use batches (e.g., 500 unique codes) and export as CSV for distribution partners.
  3. Deactivate or extend codes; watch per-code revenue influence and redemption history.
- **Data Displayed/Modified:** Writes `coupons`, `coupon_redemptions`; checkout validates codes and attributes revenue in [S-1.2](03-Dashboard.md#scr-1-2) Revenue Analytics.
- **States:**
  - **Active / Expired / Deactivated / Exhausted** pills; exhausted codes remain visible for reporting.
  - **Batch Generating:** Progress → "500 codes created" with immediate CSV export link.
  - **Deactivating:** [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation if the code has redemptions in the last 24 hours.
  - **Redemption Failure (checkout side):** Clear student-facing reasons: invalid, expired, wrong course, or limit reached.
- **Validation & Feedback:**
  - Percentage 1–99; fixed amount > 0 and < course price; expiry in the future; duplicate codes rejected at creation.
  - Codes are case-insensitive at checkout and displayed uppercase in the table.
  - 100%-access codes on paid courses require [S-7.1](09-Shared-Components.md#scr-7-1) confirmation (revenue impact).
- **Navigation:**
  - Opened from [S-A.1](02-Global-Navigation.md#scr-a-1) Marketing group; linked from [S-2.4](04-Courses.md#scr-2-4) Pricing step ("Discount Options")
  - Course name in Scope → [S-2.6](04-Courses.md#scr-2-6) Course Detail

---

<a id="scr-8-4"></a>

##### Screen Name: S-8.4 Affiliate Program

- **Purpose:** Manage affiliates who promote courses and earn commissions on sales: applications, referral links, per-affiliate performance, commission tracking, and payout runs.
- **User Role(s):** Admin (payout runs), Editor (affiliate management)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Affiliate Program"   [Program Settings] [+ Invite Affil.]│
  ├──────────────────────────────────────────────────────────────────┤
  │ Program: Commission [20%] · Cookie window [30 days] · Payout at  │
  │ $50 via [Bank transfer ▾]      Pending payouts: $830 [Run Payout] │
  ├──────────────────────────────────────────────────────────────────┤
  │ | Affiliate  | Link/Code   | Clicks | Sales | Revenue | Owed     │
  │ |────────────|─────────────|────────|───────|─────────|──────────| │
  │ │ Sara B.    │ sara/TOEFL  │ 1,204  │ 38    │ $2,128  │ $426     │
  │ │ Daniel W.  │ DANIEL20    │   540  │ 12    │   $674  │ $135     │
  ├──────────────────────────────────────────────────────────────────┤
  │ Applications: 2 pending [Review]                                 │
  │ 🚩 Fraud flag: self-referral pattern detected on affiliate #44    │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Configure the program: commission percentage, cookie/attribution window, payout threshold and method.
  2. Approve or decline affiliate applications; generate unique referral links/codes per course.
  3. Track clicks, conversions, revenue, and commissions owed per affiliate; flag suspicious self-referrals.
  4. Run payouts: mark commissions as paid, generate a payout report, and notify affiliates.
- **Data Displayed/Modified:** Writes `affiliates`, `affiliate_links`, `commissions`, `payouts`; sales attribution flows into [S-1.2](03-Dashboard.md#scr-1-2) Revenue Analytics with an "affiliate" source tag.
- **States:**
  - **Pending / Approved / Suspended** affiliate states; suspended keeps links inert but preserves history.
  - **Application:** Lightweight form (name, audience, promotion channels) → [S-7.1](09-Shared-Components.md#scr-7-1) style approve/decline with optional note.
  - **Payout Run:** Summary modal: "12 affiliates · $830 total" → [S-7.1](09-Shared-Components.md#scr-7-1) confirmation → "Paid" marks and receipts.
  - **Fraud Flag:** 🚩 banner with evidence (same-account purchases) and "Hold commissions" action.
- **Validation & Feedback:**
  - Commission changes apply prospectively; historical commissions never recompute.
  - Payout requires threshold met and valid payout details; failing rows are listed per affiliate with reasons.
  - Refund of an affiliate-attributed sale automatically reverses the pending commission.
- **Navigation:**
  - Opened from [S-A.1](02-Global-Navigation.md#scr-a-1) Marketing group
  - Affiliate name → affiliate detail (same screen, expands)
  - "Program Settings" → inline settings panel (Admin only)

---

<a id="scr-8-5"></a>

##### Screen Name: S-8.5 Student Testimonials

- **Purpose:** Collect, moderate, and display student testimonials on course landing pages: automated collection requests, a consent-first moderation queue, and landing-page display controls.
- **User Role(s):** Admin, Editor, Support (moderation)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Student Testimonials"   [+ Collect Manually]  Pending: 3│
  ├──────────────────────────────────────────────────────────────────┤
  │ Moderation Queue:                                                │
  │ +─────────────────────────────────────────────────────────────+ │
  │ │ "The 12-week plan took me from 79 to 101."  ⭐⭐⭐⭐⭐          │ │
  │ │  — Alemayehu K., TOEFL Complete (course rating 4.9, done)    │ │
  │ │  ☑ Consent to display publicly confirmed                     │ │
  │ │  [Approve]  [Edit quote]  [Reject]                           │ │
  │ +─────────────────────────────────────────────────────────────+ │
  │ Published (12): filter by course · [★ Feature on landing page]   │
  │ Display: (● Carousel ○ Grid ○ Single highlight quote)            │
  │ Collection trigger: ☑ On completion  ☑ On 5-star course rating   │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Auto-request testimonials when a student completes a course or leaves a 5-star rating (configurable triggers); collect manually when needed.
  2. Moderate submissions: approve, light-edit (with editor initials note), or reject; consent to public display is mandatory before approval.
  3. Feature approved testimonials on specific course landing pages; choose display format (carousel/grid/highlight).
- **Data Displayed/Modified:** Writes `testimonials` (quote, rating, consent, state), `testimonial_requests`; course landing pages read published + featured testimonials.
- **States:**
  - **Requested / Pending / Published / Rejected / Archived**; pending queue sorted by rating and course.
  - **Missing Consent:** Approve is disabled until the consent checkbox is verified — a submission without consent cannot be published.
  - **Featured:** ⭐ marks; featured items require [S-7.1](09-Shared-Components.md#scr-7-1) confirmation when unfeatured while live.
  - **Student Notification:** On publish, the student is thanked and shown where their quote appears.
- **Validation & Feedback:**
  - Quote 20–400 characters; edits beyond typo fixes should be re-confirmed with the student (system flags heavy edits).
  - Rejected submissions notify the student politely and are retained (archived) for reference.
  - Testimonial display respects [S-6.10](08-Settings.md#scr-6-10) privacy state: anonymized students' testimonials are automatically unlisted.
- **Navigation:**
  - Opened from [S-A.1](02-Global-Navigation.md#scr-a-1) Marketing group
  - Course attribution → [S-2.6](04-Courses.md#scr-2-6) Course Detail
  - Student name → [S-4.2](06-Students.md#scr-4-2) Student Profile
