# Section 1: Dashboard

> **Abugida Academy — UX Design Specification** · Part 03 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Global Navigation](02-Global-Navigation.md) · [Courses →](04-Courses.md)

## What changed in Part 03 (Revision 3)

- **Revenue is redacted server-side.** S-1.1 no longer hands a role a figure the [Part 11 matrix](11-Global-Standards.md#roles--permissions-matrix) denies it. A role without `finance.view_revenue` receives a **Revenue hidden for your role** card; the number is absent from the payload, not hidden by CSS. S-1.2 states the same rule.
- **Reviewer is added to S-1.1**, which omitted a role the matrix grants view access to. S-1.3 and S-1.4 are reconciled with it too.
- **Emoji status dots are gone.** `🟣 Published` / `🟠 Draft` taught the purple-`Published` error the [Status Colour Mapping](11-Global-Standards.md#status-colour-mapping) resolves. Wireframes use `● Published` / `● Draft`; **emoji are never UI icons** ([Part 11](11-Global-Standards.md#localization--formatting)).
- **The date range control is specified** — presets, custom range, comparison mode, `?from=&to=&compare=` persistence, `Africa/Addis_Ababa`, and one range governing every card, chart, and table row.
- **The stat card contract is defined** — a stated comparison basis, and a delta without history renders `—`, never `0%`.
- **Zero-result is separated from true empty** in the course table and on search, per [Part 11](11-Global-Standards.md#global-validation-and-feedback-patterns).
- **S-1.3 gains a search contract** — 2-character minimum, 250 ms debounce, per-tab counts, arrow-key navigation, permission-filtered recents, Ge'ez 2-syllable n-gram matching.
- **`Resilience` and `Instrumentation & acceptance` are added to all four screens**, which adopts the [LCP < 2.5 s budget](11-Global-Standards.md#success-criteria--instrumentation) and the requirement that a chart's data table renders on demand.

## What changed in Part 03 (Revision 2)

No new screens and no layout changes. Three deep-link targets moved because course work now lives in a workspace with tabs:

- **Course row** → [S-2.6](04-Courses.md#scr-2-6) Course Workspace · **Overview** (was: a flat Course Detail screen)
- **Curriculum item search result** → [S-2.17](04-Courses.md#scr-2-17) Curriculum tab with **that item's pane open** (was: the standalone Lesson Editor route)
- **Publish notification** → [S-2.22](04-Courses.md#scr-2-22) Publish Readiness, showing that course's publication history

The course performance table also gains a **state** column carrying each course's lifecycle pill, so a published course and a draft are distinguishable at a glance — the same [status pill](11-Global-Standards.md#status-colour-mapping) used in the catalog and the workspace header. A course in review shows its pending-decision count, and a draft with unfinished items shows how many items need content, so the dashboard answers _what needs me_ without opening every course.

<a id="scr-1-1"></a>

##### Screen Name: S-1.1 Analytics Overview

- **Purpose:** High-level dashboard providing immediate visibility into key business metrics: revenue, enrollments, active students, and course performance trends.
- **User Role(s):** Admin, Editor, Reviewer, Viewer, Support — per the [Part 11 matrix](11-Global-Standards.md#roles--permissions-matrix). Support and Reviewer are view-only and receive **no revenue figure**.
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Dashboard"                                              │
  │   [Date Range: Last 30 days ▾] [☐ Compare vs previous period]    │
  │   [Export]                                                       │
  ├──────────────────────────────────────────────────────────────────┤
  │ Stats Row (4 cards, horizontal scroll on mobile):               │
  │ +-------------+ +-------------+ +-------------+ +-------------+  │
  │ |ETB 12,430.00| |456         | |1,234        | |4.8          |  │
  │ |Revenue      | |Courses     | |Students     | |Avg Rating   |  │
  │ |+23% ↑       | |+12 ↑       | |+8.5% ↑      | |+0.2 ↑       |  │
  │ |vs prev 30d  | |prev 30d    | |prev 30d     | |prev 30d     |  │
  │ +-------------+ +-------------+ +-------------+ +-------------+  │
  │ Without finance.view_revenue, card 1 renders:                    │
  │ |Revenue — Restricted|  "Revenue is limited to Admins and       │
  │ |                     |   Editors. Ask an Admin if you need     │
  │ |                     |   this figure."  [Ask an Admin]          │
  ├──────────────────────────────────────────────────────────────────┤
  │ Chart Row (2 columns), each with a [View as table] toggle:       │
  │ +--------------------------+ +--------------------------+        │
  │ | Revenue Trend (Line)     | | Enrollments (Bar)        |        │
  │ | Last 30 days             | | Last 30 days             |        │
  │ | Sep 29 is still in       | |                          |        │
  │ | progress                 | |                          |        │
  │ +--------------------------+ +--------------------------+        │
  ├──────────────────────────────────────────────────────────────────┤
  │ Course Performance Table:                                        │
  │ | Course Name    | State         | Students | Compl. | Revenue   | │
  │ |----------------|---------------|---------|--------|-----------|│
  │ | TOEFL Complete | ● Published   | 234     | 68%    |ETB 4,680 ││
  │ | IELTS Advanced | ● Draft       | 189     | 52%    |ETB 3,780 ││
  │ | Grammar Basics | ● Published   | 567     | 81%    |ETB 2,835 ││
  │ Revenue column and Revenue cards are omitted for roles without  │
  │ finance.view_revenue. Lifecycle uses the status pill.            │
  └──────────────────────────────────────────────────────────────────┘
  ```
  > **Wireframe convention:** status is written as a **text label** (`● Published`, `● Draft`) because emoji are never UI icons. Rendered, each is the full pill — tint background, text-token label, fill-token icon, 1px hairline — never coloured text.
- **Date range control:** presets **Last 7 / 30 / 90 days · This month · Last month · All time**, plus a custom from/to range; a **Compare vs previous period** toggle; state lives in the URL as `?from=&to=&compare=` so a link reproduces the view. **One range governs every card, chart, and table row on the screen** — there is no per-card date picker. All timestamps resolve in **`Africa/Addis_Ababa`**, and a partial trailing day is labelled, never silently compared: _"Sep 29 is still in progress."_ The calendar follows the user's Gregorian / Ethiopian toggle ([Part 11](11-Global-Standards.md#localization--formatting)).
- **Stat card contract:** every card names its **comparison basis** — the **previous equal-length period** ending the day before the range starts — and the window under the delta. A delta with insufficient history (no prior period, or fewer than `MIN_SAMPLE_SIZE = 5` contributing records) renders **`—`**, never `0%`; `0%` means "measured, unchanged". Money uses `Intl.NumberFormat` with the **currency code always visible** (`ETB 12,430.00`). The comparison basis is also exposed as a tooltip so a copied screenshot is self-describing.
- **Primary Actions:**
  1. View key performance metrics.
  2. Interact with charts (hover for details, zoom).
  3. Filter by date range; toggle period comparison.
  4. Export dashboard data.
  5. Click a course row to open its Course Workspace.
- **Data Displayed/Modified:** Reads from `analytics.aggregated_metrics`, `analytics.revenue`, `analytics.enrollments`. `finance.view_revenue` is enforced in the query, not the view.
- **Validation & Feedback:**
  - Custom range requires **end ≥ start**, rejects any future date, and caps the span at **2 years**; the rejected field states the fix inline and keeps the last valid range applied rather than blanking the screen.
  - Switching the range re-queries without a page load; cards hold their previous value under a skeleton rather than flashing `—`.
  - A role without `finance.view_revenue` never receives a validation prompt about revenue — the card is not an input.
- **States:**
  - **Default:** All cards and charts populated.
  - **Loading:** Skeleton cards (4) + skeleton charts (shimmer effect); the shell, date control, and table header stay mounted.
  - **True empty (brand-new workspace):** _"No history yet — data appears once your first course is published."_ Cards render skeleton dashes, not zeros, with a link to [S-2.2](04-Courses.md#scr-2-2).
  - **Empty (no data in range):** _"No data for the selected period — adjust the date range."_ + **Clear filters**.
  - **Zero-result (course table):** _"No matches — adjust filters."_ + **Clear filters**. This is **not** the true-empty state and offers no creation CTA, because courses exist and the filter excluded them.
  - **Revenue hidden for your role:** _"Revenue is limited to Admins and Editors. Ask an Admin if you need this figure."_ + **Ask an Admin for access**. The figure is absent from the payload.
  - **Restricted stat card (Editor):** Editor holds `finance.view_revenue` at view-only — the figure renders, with no export or refund action.
  - **Error:** _"We couldn't load your dashboard — your work is safe."_ + retry + request ID.
  - **Date Range Applied:** Stats and charts update to reflect selected range.
- **Resilience:**
  - **403:** dedicated page, not an empty dashboard — _"You don't have access to workspace analytics."_ + request ID + **Ask an Admin for access**.
  - **404:** _"This dashboard link is out of date."_ + **Back to Courses** + request ID.
  - **Offline:** persistent banner; the screen renders **read-only** with the last-known values and the label _"Last updated 4:12 PM EAT"_. Cached values are marked stale, never presented as current.
  - **Session expired:** 2-minute modal; on expiry the buffer and the selected range are preserved and the user returns to the same view.
  - **Server error:** per-card partial failure — _"Revenue couldn't load. Completion and Enrollments are up to date."_ + **Retry** for that card only.
- **Keyboard & Focus:** the date control, comparison toggle, and each card are in the tab order in reading order. Every chart is focusable and exposes a keyboard-reachable **View as table** toggle; the table is the screen-reader alternative and is **not loaded until requested**, to protect the LCP budget. `↑`/`↓` move between table rows, and sorting announces `aria-sort`.
- **Navigation:**
  - Course Row → [S-2.6](04-Courses.md#scr-2-6) Course Workspace · Overview
  - Chart Interaction → [S-2.19](04-Courses.md#scr-2-19) workspace Analytics (course-scoped)
  - "Export" → [S-5.4](07-Analytics.md#scr-5-4) Export Reports
- **Instrumentation & acceptance:** events `dashboard_viewed{range,compare,courseCount}`, `dashboard_range_changed{preset,compare}`, `dashboard_export_clicked`, `dashboard_course_opened{courseId}` — IDs and counts only, no PII. Budget: **LCP < 2.5 s**; range change paints < 1 s; a chart's data table renders in < 300 ms on request.
  - Given a Support session, no revenue figure is present in the dashboard payload and the revenue card reads **Restricted** with the explanation.
  - Given a workspace with no published course, cards render dashes with the **No history yet** copy, not `0`.
  - A custom range with `end < start`, a future end date, or a span over 2 years is rejected inline and the last valid range stays applied.
  - Every chart has a keyboard-reachable **View as table** toggle, and the table is not fetched on initial load.
  - A Support user with a `students.read` grant sees no student name anywhere on the dashboard.

---

<a id="scr-1-2"></a>

##### Screen Name: S-1.2 Revenue Analytics

- **Purpose:** Detailed revenue breakdown including subscription vs. one-time purchases, refund rate, and revenue by course.
- **User Role(s):** Admin, Editor — per the [Part 11 matrix](11-Global-Standards.md#roles--permissions-matrix). Editor is **view only** (`finance.view_revenue`, view-only). Support, Reviewer, and Viewer are **not** granted this screen and receive a **403**, not a redacted page.
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Revenue Analytics"                                     │
  │          [Date Range] [Export] [PDF Report]                    │
  ├──────────────────────────────────────────────────────────────────┤
  │ Revenue Summary Cards:                                          │
  │ +----------+ +----------+ +----------+ +----------+          │
  │ |ETB 12,430| |ETB 8,450 | |ETB 3,980 | |ETB 230  |          │
  │ |.00 Total | |.00 One-Time| |.00 Subscr| |.00 Refund|          │
  │ | +23%     | | +18%     | | +35%     | | -5%     |          │
  │ | prev 12mo | | prev 12mo| | prev 12mo| | prev 12mo|          │
  │ +----------+ +----------+ +----------+ +----------+          │
  │ Chart: Revenue by Course (Horizontal Bar, [View as table]):     │
  │ TOEFL Complete     ████████████████████░░░░ ETB 4,680.00       │
  │ IELTS Advanced     ████████████████░░░░░░░░ ETB 3,780.00       │
  │ Grammar Basics     ████████████░░░░░░░░░░░░ ETB 2,835.00       │
  │ Vocabulary Builder ██████░░░░░░░░░░░░░░░░░░ ETB 1,125.00       │
  │ Revenue Breakdown (Pie ≤ 4 slices + equivalent table):         │
  │ | Payment Gateway | Transactions | Amount  |                 │
  │ |-----------------|--------------|---------|                 │
  │ | Telebirr        | 156          |ETB 8,500|                 │
  │ | PayPal / Card   | 89           |ETB 3,900|                 │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Date range control / stat cards:** as specified on [S-1.1](#scr-1-1); the same `?from=&to=&compare=` contract and the same **`—`-not-`0%`** rule apply. Comparison here defaults to the **previous 12 months** for the YoY-labelled cards and is labelled as such.
- **Primary Actions:**
  1. Drill down into revenue by course.
  2. Export revenue reports.
  3. Filter by payment gateway.
- **Data Displayed/Modified:** Reads from `analytics.revenue`, `analytics.payment_transactions`. `finance.view_revenue` is checked in the query; a role without it never receives these keys.
- **Validation & Feedback:** custom range requires **end ≥ start**, rejects future dates, caps the span at 2 years; a gateway filter with no matching transactions shows **No matches — adjust filters** + **Clear filters**, distinct from the true-empty state.
- **States:**
  - **Default:** Charts and tables populated.
  - **Loading:** Skeleton cards + skeleton charts.
  - **True empty:** _"No revenue recorded yet."_ — the workspace has never taken a payment.
  - **Empty (no data in range):** _"No data for the selected period — adjust the date range."_ + **Clear filters**.
  - **403 (redacted capability):** _"Revenue is limited to Admins and Editors. Ask an Admin if you need this figure."_ + request ID + **Ask an Admin for access**. This screen is reached only by a permitted role; anyone else is stopped at the route, so the figure is never on the page and never in the payload.
  - **Error:** _"We couldn't load revenue data — nothing has changed."_ + retry + request ID.
- **Resilience:** **403** as above; **404** on a retired gateway or transaction deep link + **Back to Dashboard** + request ID; **offline** renders read-only with the last-known figures marked _"Last updated 4:12 PM EAT"_; **session expiry** preserves the selected range and filters; **server error** offers a per-card retry with a request ID.
- **Keyboard & Focus:** filters and format controls are in the tab order; the pie chart is focusable with a keyboard-reachable **View as table** toggle, and the table is loaded on demand only.
- **Navigation:**
  - Course Row → [S-2.6](04-Courses.md#scr-2-6) Course Workspace · Overview
  - Export → [S-5.4](07-Analytics.md#scr-5-4) Export Reports
- **Instrumentation & acceptance:** events `revenue_viewed{range,gatewayFilter}`, `revenue_course_opened{courseId}`, `revenue_export_clicked`. Budget: LCP < 2.5 s; gateway filter repaints < 1 s.
  - A request from a role without `finance.view_revenue` returns no revenue keys in the payload, and the screen renders the 403.
  - The pie chart never exceeds 4 slices; a 5th category folds into **Other** and the table lists it.
  - A delta with no prior period renders `—`, never `0%`.
  - Money renders with the currency code visible in the card, the chart labels, and the table.

---

<a id="scr-1-3"></a>

##### Screen Name: S-1.3 Global Search Results

- **Purpose:** Unified results page for the header search bar in [S-A.1](02-Global-Navigation.md#scr-a-1), spanning courses, curriculum items, students, and content-library assets. Revision 2 adds curriculum items as a first-class result type.
- **User Role(s):** Admin, Editor, Reviewer, Viewer, Support — per the [Part 11 matrix](11-Global-Standards.md#roles--permissions-matrix); the result types each role may see are filtered **server-side**.
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: Results for "toefl"                          [🔍 toefl] │
  │ Tabs: [All (18)] [Courses (4)] [Items (9)] [Students (3)]      │
  │       [Assets (2)]                                               │
  ├──────────────────────────────────────────────────────────────────┤
  │ Recent searches:  እንግሊዝ  ·  TOEFL  ·  ፕርዛ ምርምር  [Clear]      │
  ├──────────────────────────────────────────────────────────────────┤
  │ Courses                                                          │
  │  TOEFL Complete Course — 234 students — ● Published             │
  │  TOEFL Speaking Intensive — 41 students — ● Draft                │
  │ Curriculum items                                                 │
  │  Skimming Basics — TOEFL Complete ▸ S2 Reading Skills            │
  │  Reading check ✎ Quiz — IELTS Advanced ▸ S1 Overview            │
  │ Students                                                         │
  │  Alemayehu K. — enrolled in TOEFL Complete                       │
  │ Assets                                                           │
  │  TOEFL_Syllabus.pdf — 2.3 MB                                     │
  └──────────────────────────────────────────────────────────────────┘
  ```
  > **Wireframe convention:** status is a **text label** (`● Published`, `● Draft`); emoji are never UI icons. Rendered, each is the full tint/text/fill pill.
- **Search contract:** a **2-character minimum** (a 1-character query is not sent, and the field says _"Type at least 2 characters"_), a **250 ms debounce** on the query, and **per-tab counts** returned with the result set so a tab never promises results it does not have. Arrow keys move through results with the active row exposed as `aria-activedescendant`; `Enter` opens it; `Esc` closes and returns focus to the search field. Ge'ez queries tokenize as **2-syllable n-grams** so `እንግሊዝ` matches `እንግሊዝኛ`; matched spans are **highlighted** in course titles, item titles, and tree rows.
- **Primary Actions:**
  1. Filter results by entity type via tabs.
  2. Click or `Enter` on a result to open its detail screen.
  3. Refine query without leaving the results page.
  4. Re-run a recent search or clear the recents list.
- **Data Displayed/Modified:** Read-only; queries `courses`, `lessons`, `users`, `asset_library` via a search index. **Recent searches are filtered server-side by read permission** — a role without `students.read` never receives a student name in the recents payload, and the Students tab is absent rather than empty.
- **Validation & Feedback:**
  - Fewer than 2 characters → no request is sent; the field shows _"Type at least 2 characters"_ and a spinner is never shown.
  - No matches → _"No results for {query}."_ with **Clear search** and a suggestion to check spelling; a result set that exists but is excluded by the active tab shows **No matches — adjust filters** + **Clear filters**.
  - Clearing the search returns to an idle state with the recents row and an empty tab-count row, not a blank page.
- **States:**
  - **Default:** Grouped, ranked results.
  - **Below minimum / debouncing:** the previous result set stays visible under a thin progress bar; it is never replaced by a flash of skeletons.
  - **Loading:** skeleton rows per group, sized to the previous result count to avoid layout shift.
  - **Item Results (new):** An item result shows its kind icon, its course, and its section path, so two items with the same title in different courses are distinguishable. A result belonging to an archived item is badged **Archived** and its parent section is shown.
  - **Archived Courses (new):** Archived-course results are dimmed and badged; they never compete with live results in ranking unless the query matches nothing else.
  - **No Results:** [S-7.3](09-Shared-Components.md#scr-7-3) Empty State: "No results for {query}. Try a different term." + **Clear search**.
  - **Error:** _"We couldn't search right now — your recent searches are safe."_ + **Retry** + request ID. Search never degrades to a bare "Retry?" with no context, and a failed index is reported as a search failure rather than as zero results.
  - **403:** a role hitting a result it may not open gets _"You don't have access to {name}."_ + **Ask an Admin for access**, with the row remaining visible.
- **Resilience:** **403** on an individual result; **404** on a result whose target was hard-deleted — _"This result no longer exists."_ + the remaining results intact; **offline** renders the recents and any cached last result set read-only under a persistent banner; **session expiry** preserves the query and active tab; **server error** retries per tab, so a failing index for assets does not blank courses.
- **Keyboard & Focus:** the field owns focus on arrival. `↓`/`↑` move the active result, `Home`/`End` jump to the ends, `Enter` opens, `Esc` closes. `Tab` moves to the tab list, then to the recents row. A deep-linked result is focused on arrival and announced in a polite live region.
- **Navigation:**
  - Course result → [S-2.6](04-Courses.md#scr-2-6) Course Workspace · Overview
  - Curriculum item result → [S-2.17](04-Courses.md#scr-2-17) Curriculum tab with that item selected and its pane open — the author lands on the thing they searched for, already in context
  - Student result → [S-4.2](06-Students.md#scr-4-2) Student Profile
  - Asset result → [S-3.3](05-Content-Library.md#scr-3-3) Asset Detail View
- **Instrumentation & acceptance:** events `search_submitted{queryLength,tab,resultCount,entityType}`, `search_result_opened{entityType,position}`, `search_recent_used{position}`, `search_cleared{scope}` — **query text and result names are never logged**. Budget: results in < 400 ms after debounce; the first group paints < 200 ms; INP < 200 ms on arrow navigation.
  - A 1-character query issues no request and shows the minimum-length message.
  - A role without `students.read` sees no Students tab and no student name in the recents row, in the HTML, or in the network payload.
  - `እንግሊዝ` returns items containing `እንግሊዝኛ`, with the matched span highlighted.
  - Tab counts match the number of results actually returned in each group.
  - Arrow-key navigation moves `aria-activedescendant` without moving DOM focus off the field, and `Enter` opens the active result.

---

<a id="scr-1-4"></a>

##### Screen Name: S-1.4 Notifications Center

- **Purpose:** Central feed of system and workflow notifications (enrollments, publish events, payment failures, team invites), reached from the bell icon in the header.
- **User Role(s):** Admin, Editor, Reviewer, Viewer, Support — per the [Part 11 matrix](11-Global-Standards.md#roles--permissions-matrix).
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Notifications          Tabs: [All] [Mentions] [System] [Archive]│
  │                        [Mark all as read] [Preferences] [⋯]     │
  ├──────────────────────────────────────────────────────────────────┤
  │ ● New enrollment: Tigist M. joined "IELTS Advanced"  2m ago ✕   │
  │ ● Payment failed for Alemayehu K.'s subscription    1h ago ✕   │
  │   "Grammar Basics" was published                     3h ago ✕   │
  │   Jane Smith invited you to review "TOEFL Complete"  1d ago ✕   │
  │   ⚠ Delivered in-app only — Telegram link expired.   1d ago      │
  └──────────────────────────────────────────────────────────────────┘
  ```
  > **Wireframe convention:** notifications are text rows with a status label; emoji are never UI icons.
- **Primary Actions:**
  1. Read, filter, and mark notifications as read.
  2. Dismiss one notification, or all of them.
  3. Click a notification to jump to its source screen.
  4. Open **Preferences**.
  5. Reopen a dismissed notification from the **Archive** tab.
- **Data Displayed/Modified:** Reads/writes the `notifications` table (read/unread, dismissed). **The in-app feed is the system of record** for every message ([Part 00](00-Overview-and-Sitemap.md#feeds-toasts-and-destructive-actions)); Telegram is the default secondary channel and email is optional.
- **Validation & Feedback:**
  - **Dismiss** is reversible for 10 seconds via a timed **Undo** in the toast; the row moves to **Archive** rather than being deleted, and says so: _"Moved to Archive."_
  - **Mark all as read** reports what it did: _"Marked 24 as read."_ If the write partially fails, the failure is stated per the partial-failure pattern — _"Marked 20 of 24 as read."_ — and the remaining 4 keep their unread dot.
  - The **Archive** tab is only enabled once something is in it; it is a view, never a delete.
- **States:**
  - **Loading:** skeleton rows per group, with the tab counts resolving first so the layout does not shift when rows arrive.
  - **Unread Badge:** the header bell shows the unread count, **capped at 99+** — 100 unread renders `99+`, never a three-digit badge, and never a widening pill that pushes the header layout.
  - **Empty (All):** [S-7.3](09-Shared-Components.md#scr-7-3) Empty State: "You're all caught up."
  - **Empty (Archive):** _"Nothing archived. Dismissed notifications stay here for 90 days."_
  - **Real-Time:** New items stream in without a manual refresh; a streamed item is announced politely and does not steal focus.
  - **Delivery failure (new):** a notification whose secondary channel was unavailable says so on the row — _"Telegram delivery failed — shown in-app only."_ Per [Part 11 § Notification Delivery](11-Global-Standards.md#notification-delivery), email never assumed an address existed: _"Alemayehu K. has no email on file — sent in-app and via Telegram."_
  - **Authoring Notifications (new):** the feed gains the events the workspace produces — _item moved_, _section renamed_, _item archived_, _duplicated_, _submitted for review_, _changes requested_, _course published/unpublished/archived_, _readiness check failed_. Each carries the course and the affected section, and clicking one opens the exact place to fix it, not the course root.
  - **Grouping (new):** Workflow notifications group by course, so a bulk operation does not produce twenty separate rows.
  - **Error:** _"We couldn't load your notifications — nothing has been lost."_ + **Retry** + request ID. A failed feed is never rendered as an empty feed, because "You're all caught up" is a claim about data the client does not have.
- **Resilience:** **403** on a notification whose target the role cannot open — _"You don't have access to {course}."_ + **Ask an Admin for access**, the notification stays in the feed; **404** on a notification whose source was deleted — _"This item no longer exists"_ with a **Dismiss** action; **offline** renders the last-known feed read-only under a persistent banner with _"Notifications will resume when you reconnect"_; **session expiry** preserves the active tab and scroll position; **server error** retries the feed without discarding locally-marked read state.
- **Keyboard & Focus:** the bell is a single tab stop that opens the panel and moves focus into it; `Esc` closes and returns focus to the bell; `↑`/`↓` move between rows, `Enter` opens the source, `Delete`/`Backspace` dismisses with the Undo toast. Each row is a link with an accessible name that includes the notification text and its absolute time.
- **Navigation:**
  - Enrollment notification → [S-4.2](06-Students.md#scr-4-2) Student Profile
  - Payment notification → [S-1.2](#scr-1-2) Revenue Analytics
  - Publish notification → [S-2.22](04-Courses.md#scr-2-22) Publish Readiness for that course
  - Team invite → [S-6.2](08-Settings.md#scr-6-2) Team Management
  - Review requested / decision → [S-2.14](04-Courses.md#scr-2-14) Approval Queue, filtered to the submission
  - Authoring event (moved, renamed, archived, duplicated) → [S-2.17](04-Courses.md#scr-2-17) Curriculum tab with the affected row selected
  - Readiness check failed → [S-2.22](04-Courses.md#scr-2-22) with the failing check expanded
  - **Preferences** → [S-6.1](08-Settings.md#scr-6-1) General Settings, **Notifications** section. Notification channels are workspace settings, so for a role without Settings access the action is **absent entirely** (three-case rule: out of capability), not disabled.
- **Instrumentation & acceptance:** events `notifications_opened{unreadCount,tab}`, `notification_opened{type}`, `notification_dismissed{type,undone}`, `notifications_mark_all_read{count,failed}`, `notification_preferences_opened`. Budget: panel opens in < 200 ms from cache; the unread count resolves < 1 s; no more than one streamed re-render per batch.
  - 100 unread notifications render a badge reading `99+`, and the header layout does not shift.
  - A dismissed notification appears in **Archive** and is restorable; nothing is deleted from the feed's data.
  - A notification with an unreachable secondary channel states which channel failed on the row itself.
  - A failed feed load renders an error with a request ID, never "You're all caught up".
  - A role without Settings access sees **no** Preferences action in the panel.
