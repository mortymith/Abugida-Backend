# Section 1: Dashboard

> **Abugida Academy — UX Design Specification** · Part 03 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Global Navigation](02-Global-Navigation.md) · [Courses →](04-Courses.md)

<a id="scr-1-1"></a>

##### Screen Name: S-1.1 Analytics Overview

- **Purpose:** High-level dashboard providing immediate visibility into key business metrics: revenue, enrollments, active students, and course performance trends.
- **User Role(s):** Admin, Editor, Viewer, Support
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Dashboard"                                              │
  │          [Date Range Selector] [Export]                         │
  ├──────────────────────────────────────────────────────────────────┤
  │ Stats Row (4 cards, horizontal scroll on mobile):              │
  │ +---------+ +---------+ +---------+ +---------+              │
  │ |💰 $12,430| |📚 456   | |👨‍🎓 1,234| |⭐ 4.8  |              │
  │ |Revenue  | |Courses | |Students | |Avg Rating|              │
  │ |+23% ↑   | |+12 ↑   | |+8.5% ↑  | |+0.2 ↑  |              │
  │ +---------+ +---------+ +---------+ +---------+              │
  ├──────────────────────────────────────────────────────────────────┤
  │ Chart Row (2 columns):                                          │
  │ +─────────────────────+ +─────────────────────+               │
  │ │ 📈 Revenue Trend    │ │ 📊 Enrollments     │               │
  │ │ (Line Chart)        │ │ (Bar Chart)        │               │
  │ │ (Last 30 days)      │ │ (Last 30 days)     │               │
  │ +─────────────────────+ +─────────────────────+               │
  ├──────────────────────────────────────────────────────────────────┤
  │ Course Performance Table (scrollable, paginated):              │
  │ +─────────────────────────────────────────────────────────────+│
  │ | Course Name        | Students | Completion | Revenue    | │
  │ |────────────────────|─────────|────────────|───────────| │
  │ | TOEFL Complete     | 234     | 68%        | $4,680    | │
  │ | IELTS Advanced     | 189     | 52%        | $3,780    | │
  │ | Grammar Basics     | 567     | 81%        | $2,835    | │
  │ +─────────────────────────────────────────────────────────────+│
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. View key performance metrics.
  2. Interact with charts (hover for details, zoom).
  3. Filter by date range.
  4. Export dashboard data.
  5. Click course row to navigate to Course Detail.
- **Data Displayed/Modified:** Reads from analytics.aggregated_metrics, analytics.revenue, analytics.enrollments.
- **States:**
  - **Default:** All cards and charts populated.
  - **Loading:** Skeleton cards (4) + skeleton charts (shimmer effect).
  - **Empty (No Data):** "No data available for the selected period." + CTA to adjust date range.
  - **Error:** "Unable to load analytics. Retry?" with retry button.
  - **Date Range Applied:** Stats and charts update to reflect selected range.
- **Navigation:**
  - Course Row → [S-2.6](04-Courses.md#scr-2-6) Course Detail
  - Chart Interaction → [S-5.1](07-Analytics.md#scr-5-1) Course Performance (drill-down)
  - "Export" → [S-5.4](07-Analytics.md#scr-5-4) Export Reports

---

<a id="scr-1-2"></a>

##### Screen Name: S-1.2 Revenue Analytics

- **Purpose:** Detailed revenue breakdown including subscription vs. one-time purchases, refund rate, and revenue by course.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Revenue Analytics"                                     │
  │          [Date Range] [Export] [PDF Report]                    │
  ├──────────────────────────────────────────────────────────────────┤
  │ Revenue Summary Cards:                                          │
  │ +----------+ +----------+ +----------+ +----------+          │
  │ | Total    | | One-Time | | Subscr.  | | Refund   |          │
  │ | $12,430  | | $8,450   | | $3,980   | | $230     |          │
  │ | +23% YoY | | +18% YoY | | +35% YoY | | -5% YoY |          │
  │ +----------+ +----------+ +----------+ +----------+          │
  ├──────────────────────────────────────────────────────────────────┤
  │ Chart: Revenue by Course (Horizontal Bar Chart):              │
  │ TOEFL Complete     ████████████████████░░░░ $4,680         │
  │ IELTS Advanced     ████████████████░░░░░░░░ $3,780         │
  │ Grammar Basics     ████████████░░░░░░░░░░░░ $2,835         │
  │ Vocabulary Builder ██████░░░░░░░░░░░░░░░░░░ $1,125         │
  ├──────────────────────────────────────────────────────────────────┤
  │ Revenue Breakdown (Pie Chart + Table):                         │
  │ +───────────────+ +──────────────────────────────────────────+│
  │ │ One-Time: 68% │ │ | Payment Gateway | Transactions | Amt |│
  │ │ Subscription:│ │ |─────────────────|─────────────|──────|│
  │ │ 32%           │ │ | Stripe          | 156         | $8.5k|│
  │ +───────────────+ │ | PayPal          | 89          | $3.9k|│
  │                   │ +──────────────────────────────────────────+│
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Drill down into revenue by course.
  2. Export revenue reports.
  3. Filter by payment gateway.
- **Data Displayed/Modified:** Reads from analytics.revenue, analytics.payment_transactions.
- **States:**
  - **Default:** Charts and tables populated.
  - **Loading:** Skeleton cards + skeleton charts.
  - **Empty:** "No revenue data available."
  - **Error:** "Unable to load revenue data. Retry?"
- **Navigation:**
  - Course Row → [S-2.6](04-Courses.md#scr-2-6) Course Detail
  - Export → [S-5.4](07-Analytics.md#scr-5-4) Export Reports

---

<a id="scr-1-3"></a>

##### Screen Name: S-1.3 Global Search Results

- **Purpose:** Unified results page for the header search bar in [S-A.1](02-Global-Navigation.md#scr-a-1), spanning courses, lessons, students, and content-library assets.
- **User Role(s):** Admin, Editor, Viewer, Support
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: Results for "toefl"                          [🔍 toefl] │
  │ Tabs: [All (18)] [Courses (4)] [Lessons (9)] [Students (3)]      │
  │       [Assets (2)]                                               │
  ├──────────────────────────────────────────────────────────────────┤
  │ 📚 Courses                                                       │
  │  TOEFL Complete Course — 234 students — Published                │
  │  TOEFL Speaking Intensive — 41 students — Draft                  │
  │ 👨‍🎓 Students                                                     │
  │  Alemayehu K. — enrolled in TOEFL Complete                       │
  │ 📁 Assets                                                        │
  │  TOEFL_Syllabus.pdf — 2.3 MB                                     │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Filter results by entity type via tabs.
  2. Click a result to open its detail screen.
  3. Refine query without leaving the results page.
- **Data Displayed/Modified:** Read-only; queries `courses`, `lessons`, `users`, `asset_library` via a search index.
- **States:**
  - **Default:** Grouped, ranked results.
  - **No Results:** [S-7.3](09-Shared-Components.md#scr-7-3) Empty State: "No results for “{query}”. Try a different term."
  - **Loading:** Skeleton rows per group.
- **Navigation:**
  - Course result → [S-2.6](04-Courses.md#scr-2-6) Course Detail
  - Lesson result → [S-2.7](04-Courses.md#scr-2-7) Lesson Editor
  - Student result → [S-4.2](06-Students.md#scr-4-2) Student Profile
  - Asset result → [S-3.3](05-Content-Library.md#scr-3-3) Asset Detail View

---

<a id="scr-1-4"></a>

##### Screen Name: S-1.4 Notifications Center

- **Purpose:** Central feed of system and workflow notifications (enrollments, publish events, payment failures, team invites), reached from the bell icon in the header.
- **User Role(s):** Admin, Editor, Viewer, Support
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Notifications                         [Mark all as read] [⚙️]   │
  │ Tabs: [All] [Mentions] [System]                                  │
  ├──────────────────────────────────────────────────────────────────┤
  │ ● 🟣 New enrollment: Tigist M. joined "IELTS Advanced" — 2m ago  │
  │ ● 🟠 Payment failed for Alemayehu K.'s subscription — 1h ago     │
  │   🟢 "Grammar Basics" was published — 3h ago                     │
  │   🔵 Jane Smith invited you to review "TOEFL Complete" — 1d ago  │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Read, filter, and mark notifications as read.
  2. Click a notification to jump to its source screen.
  3. Configure notification preferences.
- **Data Displayed/Modified:** Reads/writes `notifications` table (read/unread state).
- **States:**
  - **Unread Badge:** Sidebar bell shows count of unread items.
  - **Empty:** [S-7.3](09-Shared-Components.md#scr-7-3) Empty State: "You're all caught up."
  - **Real-Time:** New items stream in without a manual refresh.
- **Navigation:**
  - Enrollment notification → [S-4.2](06-Students.md#scr-4-2) Student Profile
  - Payment notification → [S-1.2](#scr-1-2) Revenue Analytics
  - Publish notification → [S-2.6](04-Courses.md#scr-2-6) Course Detail
  - Team invite → [S-6.2](08-Settings.md#scr-6-2) Team Management
  - Review requested / decision → [S-2.14](04-Courses.md#scr-2-14) Approval Queue
  - "⚙️" → [S-6.1](08-Settings.md#scr-6-1) General Settings (Notifications section)
