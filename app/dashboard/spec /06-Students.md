# Section 4: Student & Enrollment Management

> **Abugida Academy — UX Design Specification** · Part 06 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Content Library](05-Content-Library.md) · [Analytics →](07-Analytics.md)

<a id="scr-4-1"></a>

##### Screen Name: S-4.1 Student Directory

- **Purpose:** Complete directory of all students with search, filtering, and bulk actions.
- **User Role(s):** Admin, Editor, Support
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Students"                                              │
  │         [🔍 Search] [Filter: All Courses] [Export CSV]        │
  │         [+ Add Student] [+ Create Cohort]                     │
  ├──────────────────────────────────────────────────────────────────┤
  │ Stats Row:                                                      │
  │ +----------+ +----------+ +----------+ +----------+          │
  │ | 1,234    | | 456      | | 78       | | 12      |          │
  │ | Total    | | Active   | | Inactive | | Courses |          │
  │ | Students | | This Week| | This Week| | Avg/User|          │
  │ +----------+ +----------+ +----------+ +----------+          │
  ├──────────────────────────────────────────────────────────────────┤
  │ Student Table:                                                  │
  │ +─────────────────────────────────────────────────────────────+ │
  │ | ☑ | Name        | Email            | Courses | Progress | │
  │ |───|─────────────|──────────────────|─────────|──────────| │
  │ | ☐ | Alemayehu K.| alemayehu@...    | 3       | 68%      │ │
  │ | ☐ | Tigist M.   | tigist@...       | 2       | 45%      │ │
  │ | ☐ | Daniel W.   | daniel@...       | 4       | 82%      │ │
  │ | ☐ | Sara B.     | sara@...         | 1       | 23%      │ │
  │ +─────────────────────────────────────────────────────────────+ │
  │                                                               │
  │ Pagination: 1-25 of 1,234 students                            │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Search and filter students.
  2. Bulk actions: Add to cohort, Enroll in course, Export.
  3. View student profile.
  4. Create new student account.
- **Data Displayed/Modified:** Reads from users table with enrollments aggregated.
- **States:**
  - **Default:** Table populated.
  - **Empty:** "No students enrolled yet."
  - **Add Student:** Modal collects name + email and sends a Google/Telegram sign-in invite — student accounts never store passwords.
  - **Loading:** Skeleton table rows.
  - **Error:** "Unable to load students. Retry?"
- **Navigation:**
  - Student Row → [S-4.2](#scr-4-2) Student Profile
  - "+ Add Student" → Registration modal
  - "+ Create Cohort" → [S-4.4](#scr-4-4) Cohort Management

---

<a id="scr-4-2"></a>

##### Screen Name: S-4.2 Student Profile

- **Purpose:** Detailed view of an individual student's information, enrollment history, progress across courses, and communication logs.
- **User Role(s):** Admin, Editor, Support
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Student Profile"                         [X] Close    │
  │         Alemayehu K.                                         │
  ├──────────────────────────────────────────────────────────────────┤
  │ Student Card:                                                   │
  │ +─────────────────────────────────────────────────────────────+ │
  │ │ [Avatar 64px]  Alemayehu K.              [Edit] [Message]   │ │
  │ │ alemayehu@email.com   +251 912 345 678                     │ │
  │ │ Joined: 2026-01-15   Last Active: 2 days ago              │ │
  │ │ Status: 🟢 Active                                          │ │
  │ +─────────────────────────────────────────────────────────────+ │
  │                                                              │
  │ Tabs: [Courses] [Progress] [Activity Log] [Messages]        │
  ├──────────────────────────────────────────────────────────────────┤
  │ ┌─ Courses Tab ────────────────────────────────────────────────┤
  │ │ Enrolled Courses:                                            │
  │ │ +──────────────────────────────────────────────────────────+ │
  │ │ | Course Name           | Progress | Completion | Status | │
  │ │ |───────────────────────|──────────|────────────|────────| │
  │ │ | TOEFL Complete        | 68%      | 16/24      | Active | │
  │ │ | IELTS Advanced        | 45%      | 9/20       | Active | │
  │ │ | Grammar Basics        | 100%     | 12/12      | 🏆 Done | │
  │ │ +──────────────────────────────────────────────────────────+ │
  │ │ [Enroll in New Course]                                     │
  │ └─────────────────────────────────────────────────────────────┘ │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. View student details and status.
  2. Edit student information.
  3. Send message to student.
  4. Enroll student in new course.
- **Data Displayed/Modified:** Reads/Writes to users and enrollments.
- **States:**
  - **Default:** Profile populated.
  - **Edit Mode:** Inline edit for name, email, phone.
  - **Saving:** "Save" spinner.
  - **Error:** "Unable to save changes. Retry?"
- **Navigation:**
  - "Enroll in New Course" → [S-2.1](04-Courses.md#scr-2-1) Course Catalog (selection mode)
  - "Message" → Opens messaging modal

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
- **States:**
  - **Default:** Charts populated per enrolled course.
  - **No Activity Yet:** "No activity recorded since enrollment."
  - **At Risk Flag:** 🟠 badge when a student has been inactive 14+ days.
- **Navigation:**
  - Course card → [S-5.1](07-Analytics.md#scr-5-1) Course Performance (student filtered)
  - "Export" → [S-5.4](07-Analytics.md#scr-5-4) Export Reports (pre-filtered to this student)
  - Back → [S-4.2](#scr-4-2) Student Profile

---

<a id="scr-4-4"></a>

##### Screen Name: S-4.4 Cohort Management

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
  │ | [Manage] [Email] | | [Manage] [Email] | | [Manage] [Email] | │
  │ +──────────────────+ +──────────────────+ +──────────────────+ │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Create new cohort.
  2. Manage cohort (add/remove students).
  3. Send batch emails to cohort.
  4. View cohort progress.
- **Data Displayed/Modified:** Reads/Writes to cohorts and cohort_enrollments.
- **States:**
  - **Default:** Cohort cards populated.
  - **Empty:** "No cohorts created yet. Create your first cohort."
  - **Loading:** Skeleton cards.
  - **Error:** "Unable to load cohorts. Retry?"
- **Navigation:**
  - "Create Cohort" → Cohort Creation Modal
  - "Manage" → [S-4.2](#scr-4-2) Student Profile (cohort view)
  - "Email" → [S-8.1](10-Marketing-and-Growth.md#scr-8-1) Email Campaigns (audience pre-filtered to this cohort)

---

<a id="scr-4-5"></a>

##### Screen Name: S-4.5 Messaging Center

- **Purpose:** Threaded, one-to-one and broadcast messaging with students, supporting the "Message" action in [S-4.2](#scr-4-2) and cohort emails in [S-4.4](#scr-4-4).
- **User Role(s):** Admin, Support
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Threads                    │ Alemayehu K.                        │
  │ ─────────────              │ ──────────────────────────────────  │
  │ ● Alemayehu K.  2m         │ [Sep 5] Hi, having trouble with     │
  │   Tigist M.     1d         │ Module 2 quiz…                      │
  │   Cohort: TOEFL Jan (bulk) │                                     │
  │                            │ [Reply: type a message…]  [Send]   │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Read and reply to individual student threads.
  2. Compose a broadcast message to a cohort or filtered student list.
  3. Attach files or lesson links to a message.
- **Data Displayed/Modified:** Reads/writes `messages`, `message_threads`.
- **States:**
  - **Unread:** Bold thread with dot indicator.
  - **Sending:** Optimistic send with retry on failure.
  - **Broadcast Confirmation:** [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation: "Send to 24 students in TOEFL Jan 2026?"
- **Navigation:**
  - Thread click → conversation pane (same screen)
  - Student name → [S-4.2](#scr-4-2) Student Profile

---

<a id="scr-4-6"></a>

##### Screen Name: S-4.6 Enrollment Requests / Waitlist

- **Purpose:** Review and approve pending enrollment requests for capacity-limited cohorts, and manage waitlists.
- **User Role(s):** Admin, Editor, Support
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Enrollment Requests"          [Approve All] [Filter]   │
  ├──────────────────────────────────────────────────────────────────┤
  │ | Student      | Course           | Requested   | Action       |│
  │ |──────────────|──────────────────|─────────────|──────────────|│
  │ | Sara B.      | IELTS Advanced   | Sep 5, 2026 | [Approve][Deny]│
  │ | Daniel W.    | TOEFL Complete   | Sep 6, 2026 | [Approve][Deny]│
  ├──────────────────────────────────────────────────────────────────┤
  │ Waitlist — IELTS Advanced (Full, 24/24): 3 waiting              │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Approve or deny individual requests.
  2. Bulk-approve.
  3. Promote a waitlisted student when a seat opens.
- **Data Displayed/Modified:** Writes to `enrollment_requests`, `enrollments`, `waitlists`.
- **States:**
  - **Empty:** "No pending requests."
  - **Approving:** Row transitions with success check, then removes from list.
  - **Auto-Notify:** Approved/denied students receive an email automatically.
- **Navigation:**
  - "Approve" → moves student into [S-4.1](#scr-4-1) Student Directory
  - Student name → [S-4.2](#scr-4-2) Student Profile

---

<a id="scr-4-7"></a>

##### Screen Name: S-4.7 Badges & Achievements

- **Purpose:** Create and manage gamification badges that reward student milestones — first lesson completed, 7-day streak, perfect quiz score — with automatic triggers, manual awards, and in-app/email notifications. Badge awards surface on the student's [S-4.3](#scr-4-3) Progress Dashboard.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Badges & Achievements"             [+ Create Badge]     │
  ├──────────────────────────────────────────────────────────────────┤
  │ Badge Grid:                                                      │
  │ +────────────+ +────────────+ +────────────+ +────────────+      │
  │ │ 🥇 First    │ │ 🔥 7-Day   │ │ 💯 Perfect │ │ 🏆 Course  │      │
  │ │   Steps    │ │   Streak   │ │   Score    │ │   Complete │      │
  │ │ Trigger:   │ │ Trigger:   │ │ Trigger:   │ │ Trigger:   │      │
  │ │ 1st lesson │ │ 7-day      │ │ 100% quiz  │ │ any course │      │
  │ │  done      │ │ streak     │ │ score      │ │ completed  │      │
  │ │ 🟢 Active  │ │ 🟢 Active  │ │ 🟢 Active  │ │ 🟢 Active  │      │
  │ +────────────+ +────────────+ +────────────+ +────────────+      │
  ├──────────────────────────────────────────────────────────────────┤
  │ Badge Editor (modal):                                            │
  │ Name: [First Steps]   Icon: [🥇 ▾]   Description: [Completed     │
  │ your first lesson — the journey begins!]                         │
  │ Trigger: (● First lesson completed  ○ Streak ≥ [7] days          │
  │           ○ Quiz score = 100%  ○ Course completed                │
  │           ○ Manual award)                                        │
  │ Notify student: ☑ in-app + email    Visibility: [All students ▾] │
  │ Award History: | Badge | Student | Awarded | Source |            │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Create a badge with icon, name, description, and an automatic trigger (first lesson completed, streak ≥ N days, quiz score = 100%, course completed) or manual awarding.
  2. Edit, pause, or archive badges; pausing stops new awards without revoking existing ones.
  3. Manually award a badge to one student or a filtered selection (e.g., a whole cohort).
  4. Inspect the award history: who earned what, when, and via which trigger.
- **Data Displayed/Modified:** Writes `badges`, `awarded_badges`; triggers evaluate on progress events (`lesson_progress`, `quiz_attempts`, streaks).
- **States:**
  - **Default:** Badge grid sorted by total awards; 🟢 Active / ⏸️ Paused / 🗄️ Archived pills.
  - **Creating:** Trigger previews: "1,842 students currently match this trigger — they will be awarded on the next evaluation."
  - **Manual Award:** Student picker with search ([S-4.1](#scr-4-1) filters reusable) + optional note; batch award requires [S-7.1](09-Shared-Components.md#scr-7-1) confirmation above 25 students.
  - **Awarded:** Toast on manual award; automatic awards fire a student notification and appear in [S-1.4](03-Dashboard.md#scr-1-4) for staff only when manually granted.
- **Validation & Feedback:**
  - Badge names unique per workspace; one trigger per badge (combine behaviors by awarding multiple badges).
  - Streak definition is fixed by platform policy (a day with any lesson activity) and shown as helper text to avoid misconfiguration.
  - Archiving a badge keeps historical awards visible on student profiles.
- **Navigation:**
  - Opened from [S-A.1](02-Global-Navigation.md#scr-a-1) Students group
  - Student name in Award History → [S-4.2](#scr-4-2) Student Profile
  - Badge icons also render on [S-4.3](#scr-4-3) Student Progress Dashboard

---

<a id="scr-4-8"></a>

##### Screen Name: S-4.8 Automated Enrollment Rules

- **Purpose:** Rule engine that auto-enrolls students in courses based on criteria — prerequisite course completion, tags, or cohort assignment — replacing repetitive manual enrollment with auditable, previewable automation.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Automated Enrollment Rules"    [+ New Rule] [Run ⚙️]    │
  ├──────────────────────────────────────────────────────────────────┤
  │ | Rule name        | Trigger            | Enrolls into | State    │
  │ |──────────────────|────────────────────|──────────────|──────────│
  │ │ TOEFL→IELTS path │ TOEFL Complete     │ IELTS Adv.   │ 🟢 On    │
  │ │                  │ completed          │              │          │
  │ │ Corporate cohort │ Tag = "acme-2026"  │ Workplace ES │ 🟢 On    │
  │ │ Alumni refresher │ Course completed + │ Grammar Adv. │ ⏸️ Paused│
  │ │                  │ 90 days idle       │              │          │
  ├──────────────────────────────────────────────────────────────────┤
  │ Rule Builder (WHEN / AND / THEN):                                │
  │ WHEN  (● student completes [course ▾]  ○ tag added [▾]           │
  │        ○ assigned to cohort [▾]  ○ account created)              │
  │ AND   [condition ▾]  [+ Add condition]                           │
  │ THEN  enroll in [IELTS Advanced ▾]   ☑ Send welcome email        │
  │       (template: Welcome — [S-8.2](10-Marketing-and-Growth.md#scr-8-2))                    │
  │ [Dry Run: "Would enroll 34 students → Preview list"]             │
  │ [Save & Activate]        Last run: 34 enrolled · 2 already in    │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Build a rule: pick a WHEN trigger (course completed, tag added, cohort assigned, account created), optional AND conditions, and a THEN target course.
  2. Dry-run the rule to preview exactly which students would be enrolled before activating.
  3. Pause, edit, duplicate, or delete rules; inspect each run's result log.
  4. Optionally attach a welcome email from the campaign templates ([S-8.2](10-Marketing-and-Growth.md#scr-8-2)).
- **Data Displayed/Modified:** Writes `enrollment_rules`, `enrollment_rule_runs`; creates rows in `enrollments` exactly as manual enrollment does (fully auditable in [S-6.8](08-Settings.md#scr-6-8)).
- **States:**
  - **Draft:** Rule saved but not evaluating; activate explicitly.
  - **Dry Run Preview:** List of matched students with "Enroll 34" confirmation; students already enrolled are listed as "will skip (already enrolled)".
  - **Running:** Fires in real time on trigger events; a nightly sweep catches misses (e.g., retroactive tag imports).
  - **Conflict:** Paid courses require [S-7.1](09-Shared-Components.md#scr-7-1) confirmation: "This will grant paid access at no charge."
  - **Run Log:** Per run: matched, enrolled, skipped, failed — exportable via [S-5.4](07-Analytics.md#scr-5-4).
- **Validation & Feedback:**
  - A rule cannot target its own trigger course (no self-enrollment loops).
  - Capacity limits are respected: rules stop enrolling into a full cohort and log "capacity reached" instead of overfilling.
  - Rule edits apply prospectively; past enrollments are never reversed by editing.
- **Navigation:**
  - Opened from [S-A.1](02-Global-Navigation.md#scr-a-1) Students group
  - "Enrolled into" course → [S-2.6](04-Courses.md#scr-2-6) Course Detail (Students tab)
  - Cohort trigger → [S-4.4](#scr-4-4) Cohort Management
