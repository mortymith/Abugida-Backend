# Section 5: Analytics & Reporting

> **Abugida Academy — UX Design Specification** · Part 07 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Students](06-Students.md) · [Settings →](08-Settings.md)

<a id="scr-5-1"></a>

##### Screen Name: S-5.1 Course Performance

- **Purpose:** Detailed analytics for a specific course including engagement metrics, completion rates, and student performance trends.
- **User Role(s):** Admin, Editor, Viewer
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "TOEFL Complete Course - Analytics"                    │
  │         [Date Range] [Export] [PDF Report]                    │
  ├──────────────────────────────────────────────────────────────────┤
  │ Performance Summary Cards:                                    │
  │ +----------+ +----------+ +----------+ +----------+          │
  │ | 234      | | 68%      | | 4.8 ⭐   | | 12.4 hrs |          │
  │ | Students | | Completion| | Avg Rating| | Avg Time |          │
  │ | +12% MoM | | +5% MoM  | | +0.2 MoM  | | +1.2 hrs |          │
  │ +----------+ +----------+ +----------+ +----------+          │
  ├──────────────────────────────────────────────────────────────────┤
  │ Charts Row (2 columns):                                        │
  │ +─────────────────────+ +─────────────────────+               │
  │ │ 📈 Completion Rate  │ │ 📊 Student Activity │               │
  │ │ (Line Chart)        │ │ (Bar Chart)         │               │
  │ │ Over Time           │ │ By Day of Week      │               │
  │ +─────────────────────+ +─────────────────────+               │
  ├──────────────────────────────────────────────────────────────────┤
  │ Module Breakdown:                                               │
  │ +─────────────────────────────────────────────────────────────+ │
  │ | Module             | Completion | Avg Score | Drop-off | │ │
  │ |────────────────────|────────────|───────────|──────────| │ │
  │ | Module 1: Intro    | 94%        | 85%       | 6%       | │ │
  │ | Module 2: Reading  | 72%        | 68%       | 18%      | │ │
  │ | Module 3: Listening| 45%        | 52%       | 35%      | │ │
  │ +─────────────────────────────────────────────────────────────+ │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. View performance metrics.
  2. Interact with charts.
  3. Drill down into module performance.
  4. Export reports.
- **Data Displayed/Modified:** Reads from analytics.course_performance, analytics.module_stats.
- **States:**
  - **Default:** All data populated.
  - **Loading:** Skeleton cards + skeleton charts.
  - **Empty:** "No student data available for this course."
  - **Error:** "Unable to load analytics. Retry?"
- **Navigation:**
  - Module Row → [S-5.2](#scr-5-2) Quiz Analytics (drill-down)
  - "Export" → [S-5.4](#scr-5-4) Export Reports

---

<a id="scr-5-2"></a>

##### Screen Name: S-5.2 Quiz Analytics

- **Purpose:** Question-level performance analysis for quizzes built in [S-2.8](04-Courses.md#scr-2-8), drilled into from the module breakdown in [S-5.1](#scr-5-1).
- **User Role(s):** Admin, Editor, Viewer
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Quiz Analytics — Module 2 Reading Check"                │
  │         [Date Range] [Export]                                   │
  ├──────────────────────────────────────────────────────────────────┤
  │ Summary: 189 attempts · Avg score 74% · Pass rate 81%            │
  ├──────────────────────────────────────────────────────────────────┤
  │ Per-Question Breakdown:                                          │
  │ | Q# | Prompt (trunc.)         | Correct % | Avg Time |         │
  │ |────|-------------------------|-----------|----------|         │
  │ | 1  | "What is the main idea…"| 92%       | 0:45     |         │
  │ | 2  | "Which detail supports…"| 58%       | 1:20     |         │
  │ | 3  | "The author's tone is…" | 41%       | 1:55     | ⚠️      │
  ├──────────────────────────────────────────────────────────────────┤
  │ 💡 Question 3 has a high miss rate — consider revising wording. │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Identify low-performing questions.
  2. Drill into an individual question to see the answer-choice distribution.
  3. Jump to the quiz editor to revise a flagged question.
  4. Export the report.
- **Data Displayed/Modified:** Reads `quiz_attempts`, `quiz_answers`.
- **States:**
  - **Default:** Table sorted by correct % ascending (worst first).
  - **Flagged Question:** ⚠️ badge when correct % < 50%.
  - **Empty:** "No attempts recorded yet for this quiz."
- **Navigation:**
  - Question row → answer-distribution drill-down (same screen, expands row)
  - "Revise" → [S-2.8](04-Courses.md#scr-2-8) Quiz Builder
  - "Export" → [S-5.4](#scr-5-4) Export Reports

---

<a id="scr-5-3"></a>

##### Screen Name: S-5.3 Drop-off Analysis

- **Purpose:** Funnel view showing exactly where students disengage within a course, module-by-module and lesson-by-lesson.
- **User Role(s):** Admin, Editor, Viewer
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Drop-off Analysis — TOEFL Complete Course"              │
  │         [Date Range] [Export]                                   │
  ├──────────────────────────────────────────────────────────────────┤
  │ Enrollment Funnel:                                               │
  │ Enrolled      █████████████████████████████████ 234             │
  │ Module 1 done █████████████████████████████░░░░ 220 (94%)       │
  │ Module 2 done ████████████████████░░░░░░░░░░░░░░ 168 (72%) ⚠️   │
  │ Module 3 done ██████████░░░░░░░░░░░░░░░░░░░░░░░░ 105 (45%)      │
  │ Completed     ████████░░░░░░░░░░░░░░░░░░░░░░░░░░  92 (39%)      │
  ├──────────────────────────────────────────────────────────────────┤
  │ Biggest Drop: Module 2 → Module 3 (-27 pts). Likely cause:      │
  │ Lesson "Listening Practice 4" (avg watch time 18% of runtime).  │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Identify the module/lesson with the steepest drop-off.
  2. Drill into a lesson's engagement detail (watch-time heatmap for video).
  3. Export the funnel report.
- **Data Displayed/Modified:** Reads `lesson_progress`, `enrollments`.
- **States:**
  - **Default:** Funnel bars scaled to enrollment count.
  - **Steep Drop Flag:** ⚠️ on any step-to-step decline greater than 20 points.
  - **Empty:** "Not enough data yet — check back once more students enroll."
- **Navigation:**
  - Funnel step → [S-2.7](04-Courses.md#scr-2-7) Lesson Editor (for the flagged lesson)
  - "Export" → [S-5.4](#scr-5-4) Export Reports

---

<a id="scr-5-4"></a>

##### Screen Name: S-5.4 Export Reports

- **Purpose:** Export analytics data in various formats (CSV, PDF, Excel) with configurable data selection.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Modal: "Export Reports"                                         │
  ├──────────────────────────────────────────────────────────────────┤
  │ Report Configuration:                                           │
  │ +─────────────────────────────────────────────────────────────+ │
  │ │ Report Type:                                                 │ │
  │ │ ○ Course Performance                                        │ │
  │ │ ○ Student Progress                                          │ │
  │ │ ○ Quiz Analytics                                            │ │
  │ │ ○ Revenue Report                                            │ │
  │ │                                                              │ │
  │ │ Date Range: [Start] [End]                                   │ │
  │ │                                                              │ │
  │ │ Select Courses: (Multi-select)                              │ │
  │ │ ☑ TOEFL Complete                                            │ │
  │ │ ☑ IELTS Advanced                                            │ │
  │ │ ☐ Grammar Basics                                            │ │
  │ │                                                              │ │
  │ │ Format:                                                     │ │
  │ │ ○ CSV    ○ Excel    ○ PDF                                  │ │
  │ │                                                              │ │
  │ │ [ ] Include aggregated charts                               │ │
  │ │ [ ] Include student-level data                             │ │
  │ +─────────────────────────────────────────────────────────────+ │
  │                                                              │
  │ [Generate Report] [Cancel]                                   │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Configure report parameters.
  2. Generate and download report.
- **Data Displayed/Modified:** Reads analytics tables, generates downloadable file.
- **States:**
  - **Default:** Configuration form.
  - **Generating:** Spinner with progress indicator.
  - **Success:** File downloaded, toast: "Report generated successfully."
  - **Error:** "Unable to generate report. Retry?"
- **Navigation:**
  - "Generate Report" → File download
  - "Cancel" → Close modal

---

<a id="scr-5-5"></a>

##### Screen Name: S-5.5 Cohort Comparison Report

- **Purpose:** Side-by-side comparison of two or more cohorts ([S-4.4](06-Students.md#scr-4-4)) on completion rate, average score, and time-to-complete.
- **User Role(s):** Admin, Editor, Viewer
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Compare Cohorts: [TOEFL Jan 2026 ✕] [TOEFL Apr 2026 ✕] [+ Add]  │
  ├──────────────────────────────────────────────────────────────────┤
  │ Metric              | TOEFL Jan 2026 | TOEFL Apr 2026 |          │
  │ ────────────────────|─────────────────|─────────────────         │
  │ Avg. Completion     | 68%             | 74%             ▲        │
  │ Avg. Quiz Score     | 79%             | 81%             ▲        │
  │ Avg. Time-to-Finish | 6.2 weeks       | 5.4 weeks       ▲        │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Add or remove cohorts from the comparison.
  2. Export the comparison as a report.
- **Data Displayed/Modified:** Reads aggregated `cohort_stats`.
- **States:**
  - **Default:** Two most recent cohorts pre-selected.
  - **Fewer Than 2 Cohorts Exist:** "Create at least two cohorts to compare."
- **Navigation:**
  - Cohort name → [S-4.4](06-Students.md#scr-4-4) Cohort Management
  - "Export" → [S-5.4](#scr-5-4) Export Reports
