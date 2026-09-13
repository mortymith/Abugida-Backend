# Section 7: Shared Components

> **Abugida Academy — UX Design Specification** · Part 09 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Settings](08-Settings.md) · [Marketing & Growth →](10-Marketing-and-Growth.md)

<a id="scr-7-1"></a>

##### Screen Name: S-7.1 Confirmation Dialog

- **Purpose:** Reusable confirmation dialog for destructive or irreversible actions.
- **User Role(s):** All roles
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Modal: Confirmation Dialog                                      │
  ├──────────────────────────────────────────────────────────────────┤
  │ ⚠️ [Warning Icon]                                               │
  │                                                                  │
  │ Title: "Delete Course?"                                         │
  │                                                                  │
  │ Body: "Are you sure you want to delete 'TOEFL Complete'? This   │
  │        action cannot be undone. All 234 student enrollments     │
  │        will also be affected."                                  │
  │                                                                  │
  │ [Confirm] [Cancel]                                              │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Confirm or cancel destructive action.
- **Data Displayed/Modified:** Varies by context.
- **States:**
  - **Default:** Title + body + buttons.
  - **Loading:** "Confirm" button spinner.
  - **Success:** Action executed, toast notification.
  - **Error:** "Unable to complete action. Retry?"

---

<a id="scr-7-2"></a>

##### Screen Name: S-7.2 Toast Notifications

- **Purpose:** Non-blocking feedback for user actions.
- **User Role(s):** All roles
- **Wireframe Layout (Text-Based):**
  ```
  +──────────────────────────────────────────────────────────────┐
  │ [Toast Container - Top Right Corner]                        │
  │ +──────────────────────────────────────────────────────────+ │
  │ │ ✅ Success: Course published successfully!               │ │
  │ │    (Auto-dismisses after 5 seconds)                      │ │
  │ +──────────────────────────────────────────────────────────+ │
  │                                                              │
  │ +──────────────────────────────────────────────────────────+ │
  │ │ ⚠️ Warning: Some student data is incomplete.            │ │
  │ │    (Manual dismiss required)                             │ │
  │ +──────────────────────────────────────────────────────────+ │
  │                                                              │
  │ +──────────────────────────────────────────────────────────+ │
  │ │ ❌ Error: Unable to save changes. Retry?                │ │
  │ │    [Retry] [Dismiss]                                     │ │
  │ +──────────────────────────────────────────────────────────+ │
  └──────────────────────────────────────────────────────────────┘
  ```
- **Types:** Success (green), Info (blue), Warning (orange), Error (red).
- **Behavior:** Success auto-dismisses after 5s. Errors require manual dismiss or action.

---

<a id="scr-7-3"></a>

##### Screen Name: S-7.3 Empty State Component

- **Purpose:** Standard empty state for list views with no data.
- **User Role(s):** All roles
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │                                                                  │
  │                        📚 [Empty Icon]                          │
  │                                                                  │
  │              "No courses yet. Create your first course!"        │
  │                                                                  │
  │              ┌───────────────────────────────┐                  │
  │              │        Create Course          │                  │
  │              └───────────────────────────────┘                  │
  │                                                                  │
  │              Or browse the [Content Library]                    │
  │              to get started.                                    │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Variants:** Different icon + text + CTA per module (Courses, Students, Assets, Cohorts).

---

<a id="scr-7-4"></a>

##### Screen Name: S-7.4 Help & Support Panel

- **Purpose:** Slide-out panel for in-app help: searchable knowledge base, contextual tips, and a contact-support form.
- **User Role(s):** All roles
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Help & Support                                            [X]   │
  │ [🔍 Search help articles…]                                      │
  │ Popular: "How to create a course" · "Setting up payments"        │
  │ ─────────────────────────────────────────────────────────────── │
  │ Still stuck? [Contact Support]  ·  [Watch Getting-Started Video] │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Search and read help articles inline.
  2. Submit a support ticket with the current screen auto-attached for context.
- **Data Displayed/Modified:** Read-only knowledge base; writes `support_tickets`.
- **States:**
  - **Default:** Popular articles for the current module surfaced first.
  - **Ticket Submitted:** Toast: "We'll get back to you within one business day."
- **Navigation:**
  - Opened from a "?" icon available on every screen in [S-A.1](02-Global-Navigation.md#scr-a-1)

---

<a id="scr-7-5"></a>

##### Screen Name: S-7.5 Command Palette

- **Purpose:** Keyboard-driven quick-actions launcher (⌘K / Ctrl+K) for jumping to any screen or triggering common actions without the mouse.
- **User Role(s):** All roles
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ [Type a command or search…]                                     │
  │  → Create Course                                                 │
  │  → Go to Student Directory                                      │
  │  📚 TOEFL Complete Course                                        │
  │  👨‍🎓 Alemayehu K.                                                │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Fuzzy-search screens, courses, and students.
  2. Trigger quick actions ("Create Course", "Invite Team Member").
- **Data Displayed/Modified:** Read-only; same index as [S-1.3](03-Dashboard.md#scr-1-3).
- **States:**
  - **Empty Query:** Shows recent + suggested actions.
  - **No Match:** "No matches. Try a different term."
- **Navigation:**
  - Result select → target screen; Esc → dismiss, returns to prior screen

---

<a id="scr-7-6"></a>

##### Screen Name: S-7.6 Onboarding Tour

- **Purpose:** Contextual, dismissible product tour spotlighting key UI elements for first-time users, auto-launched after [S-0.2](01-Authentication-and-Onboarding.md#scr-0-2) sign-up.
- **User Role(s):** All roles (first login only, replayable from Help)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │            ┌─────────────────────────────┐                      │
  │            │ 1 of 5                        │                      │
  │            │ This is your Dashboard — track │                      │
  │            │ revenue and enrollments here.  │                      │
  │            │            [Skip] [Next →]     │                      │
  │            └─────────────┬───────────────┘                       │
  │                          ▼ (points at Dashboard nav item)         │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Step through spotlighted UI elements.
  2. Skip or replay the tour at any time from [S-7.4](#scr-7-4) Help & Support.
- **Data Displayed/Modified:** Writes `onboarding_progress.tour_completed`.
- **States:**
  - **In Progress:** Step counter and progress dots.
  - **Skipped/Completed:** Does not auto-launch again.
- **Navigation:**
  - "Next" advances the spotlight across [S-1.1](03-Dashboard.md#scr-1-1), [S-2.1](04-Courses.md#scr-2-1), [S-4.1](06-Students.md#scr-4-1), [S-5.1](07-Analytics.md#scr-5-1), [S-6.1](08-Settings.md#scr-6-1)

---

<a id="scr-7-7"></a>

##### Screen Name: S-7.7 Duplicate Lesson Modal

- **Purpose:** Clone a lesson from one course into another, preserving its content, media, and attached quiz. Reuse proven lessons across related courses without copy-paste errors or lost quizzes.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Modal: "Duplicate Lesson to Another Course"          [X] Close   │
  ├──────────────────────────────────────────────────────────────────┤
  │ Source: "Skimming Basics"                                        │
  │         (TOEFL Complete ▸ Module 2: Reading Skills)              │
  │                                                                  │
  │ Target course: [IELTS Advanced ▾]                                │
  │ Target module: [Module 1: Overview ▾]    or  [+ New module]      │
  │ Position: (○ End of module  ● After "Course Orientation")        │
  │                                                                  │
  │ Include:                                                         │
  │   ☑ Lesson content & media   ☑ Attached quiz (copied, unlinked)  │
  │   ☐ Unlock rules (not transferable)  ☐ Publish immediately       │
  │                                                                  │
  │ ⚠️ "Skimming Basics" already exists in this module → will be     │
  │    saved as "Skimming Basics (copy)"                             │
  │                                                                  │
  │ [Duplicate Lesson]                                               │
  │  → Progress → ✅ "Lesson duplicated." [Open in IELTS Advanced]   │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Choose the target course and module (or create a new module inline) and position.
  2. Choose what to include: content & media, attached quiz, immediate publish.
  3. Duplicate and jump straight to the new lesson.
- **Data Displayed/Modified:** Reads source lesson (`lessons`, `quizzes`); writes a new lesson record (and a **copy** of the quiz — the copy is independently editable and analytics are not merged).
- **States:**
  - **Default:** Source pre-filled from the triggering row; defaults to the most recently edited course as target.
  - **Name Conflict:** Existing lesson with the same title in the target module → automatic " (copy)" suffix (shown before confirming).
  - **Duplicating:** Progress indicator; large media references resolve instantly (media is referenced, not re-uploaded, when the asset lives in [S-3.1](05-Content-Library.md#scr-3-1)).
  - **Success:** Toast: "Lesson duplicated to IELTS Advanced." with "Open" deep link.
  - **Review-Gated Target:** If the target course requires approval ([S-2.14](04-Courses.md#scr-2-14)), the duplicate is created in Draft and cannot bypass the workflow.
- **Validation & Feedback:**
  - Target course selector lists only courses where the user has edit rights.
  - Quiz copies are detached from the original's analytics; a note in the modal makes this explicit.
  - Unlock rules are never copied blindly (cross-course references would be invalid); re-configure them in the target via [S-2.15](04-Courses.md#scr-2-15).
- **Navigation:**
  - Triggered from [S-2.6](04-Courses.md#scr-2-6) curriculum lesson-row "⋯ → Duplicate to another course" and [S-2.7](04-Courses.md#scr-2-7) Lesson Editor "⋯" menu
  - "Open in …" → [S-2.7](04-Courses.md#scr-2-7) Lesson Editor for the new copy
  - "X" Close → returns to the triggering screen
