# Section 5: Analytics & Reporting

> **Abugida Academy — UX Design Specification** · Part 07 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Students](06-Students.md) · [Settings →](08-Settings.md)

## What changed in Part 07 (Revision 3)

- **A normative Metric Dictionary is added.** _Completion_, _Drop-off_, _Avg time_, _Reached_, _Pass rate_, _Time-to-complete_, _Active_, and _At risk_ were used across [Part 03](03-Dashboard.md) and Part 07 with no definition. Every metric now states numerator, denominator, window, timezone, and inclusion rule.
- **Three definitions that were actively misleading** are fixed: **Completion** counts an item completed (a course completion needs every required item); **Drop-off** is a step-to-step decline where a step is "done" when all its items are done; **Reach** is students who _started_ the item, not enrolled — otherwise an unpublished item reads as 0% failure.
- **A metric below `MIN_SAMPLE_SIZE = 5` renders `—`**, never a misleading percentage, and carries the tooltip _"Not enough students for a reliable figure"_.
- **Preview and test identities are excluded from every student-count metric and from the roster**, so a staff preview never inflates engagement.
- **Insights always display `n`** when they are shown at all, and the suppression threshold is a named constant rather than a silent cut-off.
- **Export is asynchronous and permission-filtered** ([S-5.4](#scr-5-4)): over 1 MB it is a queued job with a `Generating / Queued / Ready / Expired / Failed` state set, a row estimate, and **revenue redacted server-side** — the option is absent, not disabled.
- **Thresholds become named constants with tooltips** — quiz correct-rate, funnel step decline — and each carries a concrete next action instead of a bare ⚠️.
- **Drop-off and cohort comparison gain honesty guards** — a minimum-cohort floor on every funnel bar, and a "not like-for-like" statement when cohorts cover different courses.
- **`Validation & Feedback`, `Resilience`, `Keyboard & Focus`, and `Instrumentation & acceptance` are added to all five screens**, separating true-empty from zero-result from not-yet-computable.

## What changed in Part 07 (Revision 2)

No screen was added or removed. Two relationships were made explicit, and one capability added:

- **[S-5.1](07-Analytics.md#scr-5-1) Course Performance is the canonical implementation** behind the Course Workspace's **Analytics** tab ([S-2.19](04-Courses.md#scr-2-19)). The workspace tab is this analysis with the course filter locked, plus an **Items** tab and an actionable insights block. It is not a second analytics implementation.
- **[S-5.3](07-Analytics.md#scr-5-3) Drop-off Analysis** becomes a tab of that workspace view rather than a separate destination. It remains reachable standalone for cross-course comparison.
- **Per-item engagement (new):** [S-5.1](07-Analytics.md#scr-5-1) now has a row per curriculum item — reach, completion, time-on-item, quiz average — whose rows deep-link into the workspace item pane. This is the bridge from "the numbers are bad" to "here is the paragraph to rewrite", and it is what makes analytics actionable for an author rather than only for a manager.

---

## Metric Definitions

**Normative.** These terms are used across [Part 03](03-Dashboard.md), [Part 04](04-Courses.md), [Part 06](06-Students.md), and this part. A screen that displays a metric here must use this definition or state its deviation. The Part 11 [Glossary](00-Overview-and-Sitemap.md#glossary) fixes the vocabulary; this table fixes the arithmetic.

| Metric                | Numerator                                                               | Denominator                                                  | Window                  | Timezone                                                             | Inclusion rule                                                                                   |
| --------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Enrolled**          | Distinct enrollments created                                            | — (a count)                                                  | `enrolled_at` in range  | `Africa/Addis_Ababa`                                                 | `published` courses only; preview/test identities excluded                                       |
| **Active**            | Distinct students with ≥ 1 progress event                               | Enrolled in the course                                       | Rolling 7/30/90 d       | `Africa/Addis_Ababa`                                                 | Progress events only — opening a page is not activity                                            |
| **Reach**             | Students who **started** the item                                       | Enrolled at the item's publish time                          | Per item, in range      | `Africa/Addis_Ababa`                                                 | **Started, not enrolled** — an item nobody opened must not read as 0% failure                    |
| **Item completion**   | Students who completed the item                                         | Students who **started** the item                            | Per item, in range      | `Africa/Addis_Ababa`                                                 | `published` items only; an unpublished item reads **unpublished**, never 0%                      |
| **Course completion** | Students who completed **every required item**                          | Students enrolled                                            | Per course, in range    | `Africa/Addis_Ababa`                                                 | Required items = `visibility = published`; optional items never block completion                 |
| **Drop-off**          | `done(step n) − done(step n+1)`, in **percentage points**               | `done(step n)`                                               | Funnel over range       | `Africa/Addis_Ababa`                                                 | A step is **done** only when _all_ its items are done; scheduled items count from their schedule |
| **Time-on-item**      | Active seconds, **idle > 5 min removed**                                | Started sessions for the item (per-student median, not mean) | Per item, in range      | `Africa/Addis_Ababa`                                                 | Excludes sessions from **preview/test identities**; video counts watch time, not runtime         |
| **Pass rate**         | Graded attempts scoring ≥ the item's pass mark                          | Graded attempts                                              | Per quiz, in range      | `Africa/Addis_Ababa`                                                 | Untimed or void attempts excluded; each student contributes their **latest** attempt only        |
| **Avg score**         | Sum of scores                                                           | Graded attempts                                              | Per quiz/item, in range | `Africa/Addis_Ababa`                                                 | Same population as Pass rate, so the two never disagree                                          |
| **Return rate**       | Students active in this window who were also active in the previous one | Students active in the previous window                       | Consecutive windows     | `Africa/Addis_Ababa` (relative label uses the **personal** timezone) | New enrollees count in the numerator, not the denominator                                        |
| **Time-to-complete**  | Median days from first start to course completion                       | Students who completed the course                            | Per course, lifetime    | `Africa/Addis_Ababa`                                                 | Median, not mean — one student parked for a year must not distort the figure                     |
| **Churn**             | Enrolled students with no activity in the window                        | Students enrolled at the window start                        | Rolling 30 d            | `Africa/Addis_Ababa`                                                 | A student who completed the course leaves the denominator                                        |
| **At risk**           | Enrolled, not completed, no activity for `AT_RISK_DAYS = 14`            | Students enrolled and not completed                          | Rolling 30 d            | `Africa/Addis_Ababa`                                                 | Never applied to a course with fewer than `MIN_SAMPLE_SIZE` students                             |

**Rules that hold for every metric:**

1. **Preview and test identities are excluded from every student-count metric and from the roster** — not merely hidden in the directory. Their progress events never enter a denominator.
2. **`MIN_SAMPLE_SIZE = 5`.** A metric with fewer than 5 contributing students renders **`—`** with the tooltip _"Not enough students for a reliable figure"_, never a percentage. `0%` always means "measured, and nobody succeeded".
3. **The window is the selected date range**, in `Africa/Addis_Ababa`. An insight never fires on data older than that window.
4. **Unpublished items are labelled, not zeroed** — an item inside a published course that is not `published` reads **unpublished** and is excluded from funnel steps.
5. Money uses `Intl.NumberFormat` with the **currency code always visible**; times use one format, `6:00 PM EAT`.

---

<a id="scr-5-1"></a>

##### Screen Name: S-5.1 Course Performance 🔄 CHANGED

- **Purpose:** Detailed analytics for a specific course including engagement metrics, completion rates, and student performance trends. In Revision 2 it is also the canonical implementation of the Course Workspace's Analytics tab ([S-2.19](04-Courses.md#scr-2-19)) and gains per-item engagement rows.
- **User Role(s):** Admin, Editor, Reviewer, Viewer — per the [Part 11 matrix](11-Global-Standards.md#roles--permissions-matrix). Editor holds `finance.view_revenue` (view only); no financial figure is on this screen regardless.
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "TOEFL Complete Course - Analytics"                    │
  │   [Date Range] [☐ Compare vs previous period] [Export]         │
  ├──────────────────────────────────────────────────────────────────┤
  │ Performance Summary Cards (n=234):                             │
  │ +----------+ +----------+ +----------+ +----------+          │
  │ | 234      | | 68%      | | 4.8      | | 12.4 h   |          │
  │ | Students | | Course   | | Avg Rating| | Median   |          │
  │ | +12%     | | completion| | +0.2    | | time-on- |          │
  │ | prev 30d | | prev 30d | | prev 30d | | item     |          │
  │ +----------+ +----------+ +----------+ | prev 30d |          │
  │                                          +----------+          │
  │ Charts Row (2 columns), each with a [View as table] toggle:     │
  │ +--------------------------+ +--------------------------+        │
  │ | Completion Rate (Line)   | | Student Activity (Bar)   |        │
  │ +--------------------------+ +--------------------------+        │
  │ Module Breakdown (n per row shown in the row caption):         │
  │ | Module        | Completion | Avg Score | Drop-off | n   |   │
  │ | Module 1: Intro| 94%       | 85%       | 6 pts    | 231 |   │
  │ | Module 2: Read| 72%       | 68%       | 18 pts ⚠ | 228 |   │
  │ | Module 3: List| 45%       | 52%       | 35 pts ⚠ | 105 |   │
  │ Item Engagement (24), ordered as the curriculum:              │
  │ | Item                | Reach | Completed | Avg time |      │
  │ | S1 · What is TOEFL? | 231   | 96%       | 11m      |      │
  │ | S2 · Test format  ⚠| 228   | 41%       | 4m       |      │
  │ | ✎ Essay draft       | —     | unpublished | —      |      │
  │ 💡 S2 · Test format — item completion 41%, n=228, last 30 days.│
  │    [Edit item]  [Preview as student]  [Append a distractor]     │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Period comparison:** the **vs previous period** toggle is always available and defaults **on** in the unscoped all-courses view, **off** inside the workspace instance ([S-2.19](04-Courses.md#scr-2-19)) where a month-over-month delta is noise on a course opened for one item. Comparing a partial window to a full one is allowed but **warns explicitly** — _"Sep 1–14 compared with Jul 18–31 — different lengths and weekdays; treat this as indicative."_ The user can **hide the comparison** entirely when the periods are not comparable; the toggle is not a requirement.
- **Primary Actions:**
  1. View performance metrics.
  2. Interact with charts.
  3. Drill down into module performance.
  4. Toggle the period comparison on or off.
  5. Export reports.
  6. **Act on an item (new):** open an item's editor, or see it as a student does, straight from any item-engagement row.
- **Data Displayed/Modified:** Reads from `analytics.course_performance`, `analytics.module_stats`, `lesson_completions`, `lesson_progress`. Metric semantics per [Metric Definitions](#metric-definitions).
- **Validation & Feedback:**
  - Custom range requires **end ≥ start**, rejects future dates, and caps the span at **2 years**; an invalid range is rejected inline and the last valid range stays applied.
  - Selecting a course resets any per-item filter and announces the change, because a stale item filter under a new course reads as missing data.
  - Every ⚠️ is a tooltip, not a bare glyph: it names the metric, the threshold constant, `n`, and the window.
- **States:**
  - **Default:** All data populated.
  - **Loading:** Skeleton cards + skeleton charts; the course selector and date control stay mounted.
  - **True empty:** _"No students have enrolled in this course yet."_ + link to [S-2.17](04-Courses.md#scr-2-17) to review the curriculum.
  - **Zero-result:** _"No data for the selected period — adjust the date range."_ + **Clear filters**. Enrolments exist; the window excludes them.
  - **Not yet computable:** any figure below `MIN_SAMPLE_SIZE = 5` renders `—` with _"Not enough students for a reliable figure"_.
  - **Error:** _"We couldn't load analytics — your work is safe."_ + **Retry** + request ID.
  - **Item Engagement (new):** one row per non-archived item, ordered as the curriculum is, with reach, completion, time-on-item, and quiz average where a quiz is attached. Unpublished items read **unpublished** rather than 0%, so absence of data is never mistaken for failure.
  - **Actionable Insight (new):** a row under the weakest items names the item, the metric, the sample size, and the window, and offers _Edit item_ and _Preview as student_. **An insight displays `n` whenever it is displayed at all**; below `MIN_INSIGHT_N = 5` it is not rendered rather than rendered without its sample size. **An insight never fires on data older than the selected window.**
  - **Workspace Instance (new):** inside [S-2.19](04-Courses.md#scr-2-19) the course filter is locked and non-removable, with a _View all courses_ escape hatch; outside it the course selector is editable.
- **Resilience:** **403** — _"You don't have access to {course}."_ + request ID + **Ask an Admin for access**; **404** — _"This course was deleted, or you followed an old link."_ + **Back to Courses** + request ID; **offline** — read-only render of the last-known values under a persistent banner, marked _"Last updated 4:12 PM EAT"_; **session expiry** — the selected course, range, and comparison toggle are preserved; **server error** — per-panel partial failure (_"Item engagement couldn't load. Summary is up to date."_) with a retry for that panel only.
- **Keyboard & Focus:** charts are focusable and expose a keyboard-reachable **View as table** toggle; the table is the screen-reader alternative and loads **on demand only**. Tables support `↑`/`↓` row navigation, and a column change announces `aria-sort`. Every insight action is a labelled control, not a hover-only affordance.
- **Navigation:**
  - Module Row → [S-5.2](#scr-5-2) Quiz Analytics (drill-down)
  - **Item row / Edit item** → [S-2.17](04-Courses.md#scr-2-17) Curriculum tab with that item's pane open
  - **Preview as student** → [S-2.21](04-Courses.md#scr-2-21) at that item
  - "Export" → [S-5.4](#scr-5-4) Export Reports
- **Instrumentation & acceptance:** events `course_performance_viewed{courseId,window,compare}`, `insight_shown{itemId,metric,n}`, `insight_action_taken{itemId,action}`, `chart_table_toggled{chartId}`, `period_compare_toggled{on}`. Budget: **LCP < 2.5 s**; range change repaints < 1 s; data table renders < 300 ms on request.
  - An insight rendered on screen always displays `n`; no insight is rendered for `n < 5`.
  - No insight is shown when the underlying data falls entirely outside the selected window.
  - An unpublished item row reads **unpublished** with `—`, never `0%`.
  - Every funnel, module, and item figure below `MIN_SAMPLE_SIZE` renders `—` with the reliability tooltip.
  - Every chart has a keyboard-reachable **View as table** toggle, and no chart fetches its data table on initial load.

---

<a id="scr-5-2"></a>

##### Screen Name: S-5.2 Quiz Analytics

- **Purpose:** Question-level performance analysis for quizzes built in [S-2.8](04-Courses.md#scr-2-8), drilled into from the module breakdown in [S-5.1](#scr-5-1).
- **User Role(s):** Admin, Editor, Reviewer, Viewer — per the [Part 11 matrix](11-Global-Standards.md#roles--permissions-matrix). Reviewer is view-only and **Revise** is absent for them, not disabled.
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Quiz Analytics — Module 2 Reading Check"                │
  │   [Date Range] [Export]                                          │
  ├──────────────────────────────────────────────────────────────────┤
  │ Summary: 189 attempts · Avg score 74% · Pass rate 81% · n=131    │
  ├──────────────────────────────────────────────────────────────────┤
  │ Per-Question Breakdown:                                          │
  │ | Q# | Prompt (trunc.)         | Correct % | Avg Time | n   |   │
  │ |----|-------------------------|-----------|----------|-----|   │
  │ | 1  | "What is the main idea…"| 92%       | 0:45     | 131 |   │
  │ | 2  | "Which detail supports…"| 58%       | 1:20     | 129 |   |
  │ | 3  | "The author's tone is…" | 41% ⚠     | 1:55     | 127 |   |
  │ | 4  | "Which word means…"     | 98%  ⬤ too easy | 121 |   │
  │ 💡 Q3 — 59% miss rate, n=127, last 30 days. Two options were     │
  │    chosen by 22% each; the distractors may be the problem.       │
  │    [Revise Q3]  [Append the top wrong answer as a distractor]   │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Thresholds:** `QUIZ_LOW_CORRECT_PCT = 50` flags a question students get wrong more than half the time; `QUIZ_TOO_EASY_PCT = 95` flags a question almost everyone gets right. Both are **named constants**, both render a ⚠️ badge **with a tooltip naming the miss rate, the threshold, and `n`** — never a bare glyph — and neither is a save error: an author may leave a question exactly as written.
- **Primary Actions:**
  1. Identify low-performing questions.
  2. Drill into an individual question to see the answer-choice distribution.
  3. Jump to the quiz editor at **that specific question**.
  4. Apply the suggested fix — append the top wrong answer as a distractor.
  5. Export the report.
- **Data Displayed/Modified:** Reads `quiz_attempts`, `quiz_answers`. Pass rate and average score share one population per [Metric Definitions](#metric-definitions).
- **Validation & Feedback:**
  - Custom range requires **end ≥ start**, rejects future dates, caps the span at 2 years; the last valid range stays applied on rejection.
  - A question with fewer than `MIN_SAMPLE_SIZE = 5` attempts renders `—` and is excluded from the flagged sort, because a 50% rate off two attempts is noise.
  - The **Revise** deep link carries `?item=<publicId>&question=<questionId>` and moves **focus to the question**, per the [Part 00 Fix rule](00-Overview-and-Sitemap.md#glossary) — not to the top of the quiz.
- **States:**
  - **Loading:** skeleton summary cards and question rows; the attempt count resolves first so the header does not shift.
  - **Default:** Table sorted by correct % ascending (worst first).
  - **Flagged Question:** ⚠️ badge when correct % < `QUIZ_LOW_CORRECT_PCT` (50), with a tooltip naming the miss rate, the threshold, and `n`.
  - **Too Easy:** a distinct flag at `QUIZ_TOO_EASY_PCT` (95). **A high correct rate may mean the question is ambiguous, not that it is wrong** — the per-question note says so: _"High correct rate. If the wording is ambiguous, students may be guessing correctly rather than understanding."_ A question is never auto-flagged as broken.
  - **Expanded row (answer distribution):** each option with its selection share, a "no answer" row, and the top wrong answer named.
  - **True empty:** _"No attempts recorded yet for this quiz."_ + link to share the quiz.
  - **Zero-result:** _"No attempts in the selected period — adjust the date range."_ + **Clear filters**.
  - **Not yet computable:** `—` with _"Not enough students for a reliable figure"_ below `MIN_SAMPLE_SIZE`.
  - **Error:** _"We couldn't load quiz analytics."_ + **Retry** + request ID.
- **Resilience:** **403** — _"You don't have access to {quiz}."_ + request ID + **Ask an Admin for access**; **404** on a deleted question — _"This question was deleted. 6 of 8 questions remain."_ with the rest of the quiz intact; **offline** — read-only last-known distribution marked stale; **session expiry** — the range and expanded row are preserved; **server error** — the answer distribution retries independently of the summary line.
- **Keyboard & Focus:** `↑`/`↓` move between question rows, `→`/`Enter` expands the answer distribution, `Enter` on a flagged row follows **Revise**. `aria-sort` is announced when the sort changes, and the expanded row is announced via a polite live region.
- **Navigation:**
  - Question row → answer-distribution drill-down (same screen, expands row)
  - **"Revise"** → [S-2.8](04-Courses.md#scr-2-8) Quiz Builder with **that question selected and focused**
  - "Export" → [S-5.4](#scr-5-4) Export Reports
- **Instrumentation & acceptance:** events `quiz_analytics_viewed{quizId,window}`, `question_expanded{questionId}`, `question_revise_clicked{questionId,correctPct,n}`, `distractor_appended{questionId,optionId}`, `quiz_analytics_exported{quizId}`. Budget: LCP < 2.5 s; distribution expand < 300 ms; INP < 200 ms on sort.
  - A ⚠️ badge is never rendered without a tooltip that names the miss rate, the threshold constant, and `n`.
  - **Revise** lands on the specific question with focus on it, not on the quiz's first question.
  - The insight for a flagged question offers **append the top wrong answer as a distractor** as a named action.
  - A question above `QUIZ_TOO_EASY_PCT` carries the ambiguity note, and a low correct rate is never described as a wrong question without the wording caveat.
  - A question with fewer than 5 attempts renders `—` and is absent from the flagged sort.

---

<a id="scr-5-3"></a>

##### Screen Name: S-5.3 Drop-off Analysis 🔄 CHANGED

- **Purpose:** Funnel view showing exactly where students disengage within a course, section-by-section and item-by-item. Revision 2 makes it a tab of the course-scoped analytics view ([S-2.19](04-Courses.md#scr-2-19)) and deep-links every funnel step into the item editor.
- **User Role(s):** Admin, Editor, Reviewer, Viewer — per the [Part 11 matrix](11-Global-Standards.md#roles--permissions-matrix).
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Drop-off Analysis — TOEFL Complete Course"             │
  │   [Date Range] [Export]                                          │
  ├──────────────────────────────────────────────────────────────────┤
  │ Enrollment Funnel (n=234):                                      │
  │ Enrolled      ███████████████████████████████████ 234          │
  │ Module 1 done ██████████████████████████████░░░░░ 220 (94%)     │
  │ Module 2 done ██████████████████░░░░░░░░░░░░░░░░ 168 (72%) ⚠   │
  │ Module 3 done ██████████░░░░░░░░░░░░░░░░░░░░░░░░ 105 (45%)      │
  │ Completed     ████████░░░░░░░░░░░░░░░░░░░░░░░░░░  92 (39%)      │
  │ S4 · Grammar Lab                            —   not enough data  │
  │ Biggest Drop: Section 2 → Section 3 (−27 pts, threshold 20 pts, │
  │ n=168). Likely cause: ✎ "Listening Practice 4" — students watch  │
  │ 18% of the runtime on average (n=151).                          │
  │                        [Edit item]  [Preview as student]         │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Funnel arithmetic:** step-to-step decline is a **percentage-point difference** (`done(step n)/enrolled − done(step n+1)/enrolled`), never a ratio of the previous step, and is labelled **pts** rather than **%** so it cannot be misread. A step is **done** only when _all_ of its items are done. The funnel follows the same **item-visibility rules as the rest of the specification**: an item that is not `published` **never appears as a step**, so an unpublished draft cannot be reported as a point where students drop out.
- **Primary Actions:**
  1. Identify the section/item with the steepest drop-off.
  2. Drill into an item's engagement detail (watch-time heatmap for video).
  3. **Edit the flagged item or preview it as a student** (new) — a funnel step is a link into the workspace, not a dead end.
  4. Export the funnel report.
- **Data Displayed/Modified:** Reads `lesson_progress`, `enrollments`, `lesson_completions`. Step definitions per [Metric Definitions](#metric-definitions).
- **Validation & Feedback:**
  - Custom range requires **end ≥ start**, rejects future dates, caps the span at 2 years; the last valid range stays applied.
  - Switching course resets the funnel; the change is announced so a stale funnel is never read against the wrong course.
  - Every ⚠️ is a tooltip naming the decline, the constant, and `n`.
- **States:**
  - **Loading:** skeleton funnel steps at their final heights once the enrollment total is known, so the bars do not jump when the data lands.
  - **Default:** Funnel bars scaled to enrollment count.
  - **Steep Drop Flag:** ⚠️ on any step-to-step decline greater than `FUNNEL_STEEP_DROP_PTS = 20` percentage points, with a tooltip naming the decline, the threshold, and `n`.
  - **Minimum cohort guard:** a step whose denominator is below `MIN_SAMPLE_SIZE = 5` students renders **`—`** with _"Not enough students for a reliable figure"_, never a bar. A 3-student step is not 90% worse than its predecessor.
  - **True empty:** _"No students have enrolled in this course yet."_
  - **Zero-result:** _"No data for the selected period — adjust the date range."_ + **Clear filters**.
  - **Not yet computable:** `—` on any step below the minimum cohort.
  - **Error:** _"We couldn't load the funnel."_ + **Retry** + request ID.
  - **As a Workspace Tab (new):** the course filter is locked; the funnel sits beside [S-5.1](#scr-5-1) performance and [S-5.2](#scr-5-2) quizzes in one view, so an author moves between _what happened_ and _what to change_ without leaving the workspace.
- **Resilience:** **403** — _"You don't have access to {course}."_ + request ID + **Ask an Admin for access**; **404** — _"This course was deleted, or you followed an old link."_ + **Back to Courses** + request ID; **offline** — read-only last-known funnel, marked stale; **session expiry** — course and range preserved; **server error** — the watch-time heatmap retries independently of the funnel.
- **Keyboard & Focus:** the funnel is focusable and exposes a keyboard-reachable **View as table** toggle listing every step with its count, percentage, and decline in points. `↑`/`↓` move between steps, `Enter` opens the flagged item, and the ⚠️ tooltip is reachable by keyboard on `Enter`, not hover only.
- **Navigation:**
  - Funnel step → [S-2.7](04-Courses.md#scr-2-7) item pane for the flagged item
  - **Preview as student** → [S-2.21](04-Courses.md#scr-2-21) at that item
  - "Export" → [S-5.4](#scr-5-4) Export Reports
- **Instrumentation & acceptance:** events `funnel_viewed{courseId,window}`, `funnel_step_opened{stepId}`, `funnel_heatmap_opened{itemId}`, `funnel_exported{courseId}`. Budget: LCP < 2.5 s; funnel repaint on range change < 1 s; data table < 300 ms on request.
  - A funnel step with fewer than 5 students in its denominator renders `—`, not a bar.
  - An item that is not `published` never appears as a funnel step.
  - Every ⚠️ tooltip names the decline in percentage points, the `FUNNEL_STEEP_DROP_PTS` constant, and `n`.
  - The steepest-drop sentence names the decline in **points**, not a percentage of a percentage.
  - The funnel's step list is reachable by keyboard and each step is a link, not a dead end.

---

<a id="scr-5-4"></a>

##### Screen Name: S-5.4 Export Reports

- **Purpose:** Export analytics data in various formats (CSV, PDF, Excel) with configurable data selection. Exports are **asynchronous jobs** and **permission-filtered server-side**.
- **User Role(s):** Admin, Editor — per the [Part 11 matrix](11-Global-Standards.md#roles--permissions-matrix). Reviewer, Viewer, and Support are **not** granted this screen and receive a **403**. A role without `finance.view_revenue` (none of the permitted roles, but custom roles exist per [S-6.9](08-Settings.md#scr-6-9)) sees **no revenue option at all**.
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Modal: "Export Reports"                                         │
  ├──────────────────────────────────────────────────────────────────┤
  │ Report Type:                                                    │
  │ │ ○ Course Performance  ○ Student Progress                      │
  │ │ ○ Quiz Analytics      ○ Revenue Report  ← absent without      │
  │ │                            finance.view_revenue                │
  │ Date Range: [Start] [End]   (end ≥ start, ≤ 2 years)            │
  │ Select Courses: [Multi-select] (max 25)                         │
  │   ☑ TOEFL Complete   ☑ IELTS Advanced   ☐ Grammar Basics        │
  │ Format:  ○ CSV   ○ Excel   ○ PDF                               │
  │ [ ] Include aggregated charts                                   │
  │ [ ] Include student-level data      ← gated by students.read    │
  │ ─────────────────────────────────────────────────────────────── │
  │ Row estimate: ≈ 1,204 students × 24 items — about 4.2 MB,       │
  │ over the 1 MB limit, so this will run as a queued job.          │
  │                                        [Generate Report] [Cancel]│
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Asynchronous contract:** an export under **1 MB** downloads directly. At or over **1 MB** it becomes a **queued job** — the modal closes, a row appears in the **Exports** list with its state, and completion is announced **in-app** per [Part 11 § Notification Delivery](11-Global-Standards.md#notification-delivery) (_"Your Student Progress export is ready"_). The download link is valid for **7 days**, then the state becomes **Expired**; it is retrievable **in-app behind re-authentication** at `/settings/privacy/requests/:id/download`, and a Telegram message is a convenience, never the only route. A **row estimate** (_"≈ 1,204 students × 24 items"_) is shown before generating so the user can narrow the selection rather than queue a job they did not intend.
- **Redaction:** the export filter runs **server-side** against the requesting user's capabilities. A role without `finance.view_revenue` **can never produce a report containing revenue** — the option is **absent, not disabled**, and a hand-crafted request for it returns no revenue columns. The same rule applies to the **student-level data** checkbox, which requires `students.read` and is absent without it.
- **Primary Actions:**
  1. Configure report parameters.
  2. Generate the report (direct download, or a queued job).
  3. Download a Ready export before it expires.
  4. Regenerate a Failed export.
- **Data Displayed/Modified:** Reads analytics tables, generates a downloadable file. Reads `export_jobs` for job state.
- **Validation & Feedback:**
  - **Date range** requires **end ≥ start**, rejects future dates, and caps the span at **2 years**; the offending field states the fix and the form keeps its other values.
  - **Course multi-select** accepts at most **`MAX_EXPORT_COURSES = 25`**; the 26th selection is refused inline — _"25 courses is the maximum for one export. Remove one to add another."_ The count is always visible.
  - **Student-level data** is gated by `students.read`; the checkbox is **absent** without it, and unchecking it removes student-identifying columns from the estimate.
  - **Generate** is disabled with a reason until a report type and a valid range exist.
- **States:**
  - **Default:** Configuration form with a live row estimate.
  - **Generating:** progress indicator with the current stage (_"Collecting 4,120 progress rows…"_).
  - **Queued:** _"Queued — position 2 of 3. We'll notify you in-app when it's ready."_ The modal is dismissible; the job survives.
  - **Ready:** download link plus _"Available for 7 days, until {date}."_
  - **Expired:** _"This export expired on {date}. Generate it again."_ + **Generate again**.
  - **Failed:** _"We couldn't finish this export — nothing was shared."_ + reason + **Retry** + request ID.
  - **True empty:** a report type with no underlying records offers **"Nothing to export for this selection"** rather than producing a zero-byte file.
  - **Error:** _"Unable to generate report."_ + **Retry** + request ID.
- **Resilience:** **403** — _"You don't have access to exports in this workspace."_ + request ID + **Ask an Admin for access**, and a request naming revenue without the capability returns no revenue data rather than a partial file; **404** on an expired or purged job — _"This export no longer exists."_ + **Generate again**; **offline** — the configuration form stays open and readable, **Generate is disabled with the reason** _"You're offline — exports need a connection"_, and no job is queued; **session expiry** — the configuration is preserved; **server error** — a failed job is retryable and the parameters are kept.
- **Keyboard & Focus:** every control, including **Generate Report** and the format radio group, is reachable and operable without a mouse; the multi-select supports type-ahead and `Space` to toggle; the row estimate is an `aria-live="polite"` region so it announces as selections change; focus moves to the error summary on validation failure.
- **Navigation:**
  - "Generate Report" → a direct download, or the **Exports** list when the job is queued
  - "Cancel" → Close modal
  - Ready job → in-app download behind re-authentication, and [S-6.10](08-Settings.md#scr-6-10) Privacy & Data Retention for the request record
- **Instrumentation & acceptance:** events `export_configured{type,format,courseCount,studentLevel,estimatedRows,queued}`, `export_generated{type,queued,durationMs}`, `export_downloaded{type}`, `export_expired{type}`, `export_retry_clicked{type}`. Budget: configuration form interactive in < 1 s; the row estimate returns in < 400 ms; direct downloads start within 2 s; queued jobs are announced in-app within 60 s of completion.
  - A role without `finance.view_revenue` sees **no** revenue report type, and a crafted request returns a file with no revenue columns.
  - A selection estimating over 1 MB queues the job, closes the modal, and the state is visible in the Exports list.
  - A Ready export's download stops working after 7 days and the state reads **Expired** with a **Generate again** action.
  - A selection of 26 courses is refused inline with the 25-course limit named.
  - A failed job keeps its parameters and offers **Retry** with a request ID.

---

<a id="scr-5-5"></a>

##### Screen Name: S-5.5 Cohort Comparison Report

- **Purpose:** Side-by-side comparison of two or more cohorts ([S-4.4](06-Students.md#scr-4-4)) on completion rate, average score, and time-to-complete.
- **User Role(s):** Admin, Editor, Reviewer, Viewer — per the [Part 11 matrix](11-Global-Standards.md#roles--permissions-matrix).
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Compare Cohorts: [TOEFL Jan 2026 (n=48) ✕] [TOEFL Apr (n=51) ✕]  │
  │                    [+ Add]                                       │
  ├──────────────────────────────────────────────────────────────────┤
  │ Metric              | TOEFL Jan 2026 | TOEFL Apr 2026 | Δ       │
  │ ────────────────────|────────────────|────────────────|───────  │
  │ Course completion   | 68%            | 74%            | ▲ +6   │
  │                     |                |                | pts,  │
  │                     |                |                | n≈99  │
  │                     |                |                | ns    │
  │ Avg. quiz score     | 79%            | 81%            | ▲ +2   │
  │                     |                |                | pts,  │
  │                     |                |                | n≈97  │
  │                     |                |                | ns    │
  │ Avg. time-to-complete| 6.2 weeks     | 5.4 weeks     | ▼ −0.8 │
  │ ⚠ TOEFL Jan and TOEFL Apr cover different courses — the        │
  │   comparison is not like-for-like.                               │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Comparability rules:** every cohort is labelled with its **`n`**, because a 6-point difference between cohorts of 48 and 51 is not a finding. Each ▲/▼ delta carries a **significance statement** — a two-proportion comparison at 95% — or, where the difference does not clear it, the explicit text **"difference not meaningful at this sample size"** and no arrow. A comparison across cohorts that do not cover the same set of courses **says so above the table** and marks the affected rows, because comparing an intro course against a full track measures the curriculum, not the cohort.
- **Primary Actions:**
  1. Add or remove cohorts from the comparison.
  2. Read a delta with its sample size and significance.
  3. Export the comparison as a report.
- **Data Displayed/Modified:** Reads aggregated `cohort_stats`. Metric semantics per [Metric Definitions](#metric-definitions).
- **Validation & Feedback:**
  - A cohort is compared once; adding it twice is refused with _"TOEFL Jan 2026 is already in this comparison."_
  - A cohort with fewer than `MIN_SAMPLE_SIZE = 5` students can be added, but its column renders `—` with _"Not enough students for a reliable figure"_ and is excluded from every delta — the comparison never silently drops it.
  - The window is the cohorts' own enrolment dates; there is no date range, so none is validated.
- **States:**
  - **Loading:** skeleton metric rows while cohort aggregates resolve.
  - **Empty (no cohorts):** "No cohorts yet. Cohorts group students so you can compare how each group is doing." with **Create cohort** as the single CTA. **One cohort:** "Add a second cohort to compare." — naming the single cohort and offering to add another, never a blank comparison table. **Zero-result:** "No cohorts match this filter." with **Clear filters**.
  - **Default:** Two most recent cohorts pre-selected.
  - **One cohort selected:** _"Add a second cohort to compare."_ + the single cohort's figures, dimmed, with a **+ Add** call to action.
  - **Fewer Than 2 Cohorts Exist:** "Create at least two cohorts to compare." + link to [S-4.4](06-Students.md#scr-4-4).
  - **Not comparable:** the coverage warning above the table, with the differing courses named.
  - **Not yet computable:** any cell or delta below `MIN_SAMPLE_SIZE` renders `—`.
  - **Error:** _"We couldn't load this comparison."_ + **Retry** + request ID.
- **Resilience:** **403** — _"You don't have access to {cohort}."_ + request ID + **Ask an Admin for access**; **404** on a deleted cohort — _"TOEFL Jan 2026 was deleted. 1 of 2 cohorts remains."_ with the surviving column intact; **offline** — read-only last-known comparison marked stale; **session expiry** — the selected cohorts are preserved; **server error** — a third cohort failing to load leaves the two already-rendered columns usable, stated as _"TOEFL Sep couldn't load."_
- **Keyboard & Focus:** cohort chips are removable by keyboard (`Backspace` on a focused chip) with an announced label; the table supports `↑`/`↓` row navigation and announces `aria-sort` on column change; the coverage warning is a `role="status"` region read on load; **Export** is reachable without a mouse.
- **Navigation:**
  - Cohort name → [S-4.4](06-Students.md#scr-4-4) Cohort Management
  - "Export" → [S-5.4](#scr-5-4) Export Reports
- **Instrumentation & acceptance:** events `cohort_comparison_viewed{cohortIds,metricCount}`, `cohort_added{cohortId,size}`, `cohort_removed{cohortId}`, `cohort_comparison_exported{cohortCount}`. Budget: LCP < 2.5 s; adding a cohort reflows the table < 1 s.
  - Every cohort column displays `n`.
  - No ▲/▼ delta is rendered without either a significance statement or the explicit "difference not meaningful at this sample size".
  - Comparing cohorts that cover different courses shows the not-like-for-like warning above the table.
  - With exactly one cohort selected, the screen shows the add-a-second-cohort state rather than a broken two-column table.
  - A cohort below `MIN_SAMPLE_SIZE` renders `—` and is excluded from every delta, not silently dropped.
