# Section 2: Course Management (Primary Focus)

> **Abugida Academy — UX Design Specification** · Part 04 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Dashboard](03-Dashboard.md) · [Content Library →](05-Content-Library.md)

### Detailed Screen-by-Screen Breakdown

<a id="scr-2-1"></a>

##### Screen Name: S-2.1 Course Catalog / Grid

- **Purpose:** The primary course management view displaying all courses in a visually rich grid format, matching the provided visual reference. Provides filtering, searching, and quick actions for course creation and management.
- **User Role(s):** Admin, Editor, Viewer, Support
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header Row:                                                     │
  │ "Courses"                              [🔍 Search] [Filter]    │
  │                                       [+ Create Course ▾]      │
  ├──────────────────────────────────────────────────────────────────┤
  │ Filter Bar:                                                     │
  │ [All] [Published] [Draft] [Archived] [Self Paced] [Live]      │
  │ Status Pills (toggle)                                          │
  ├──────────────────────────────────────────────────────────────────┤
  │ Results Count: "Showing 24 courses"                            │
  ├──────────────────────────────────────────────────────────────────┤
  │ 3-Column Course Grid:                                          │
  │ +──────────────────+ +──────────────────+ +──────────────────+ │
  │ | [Thumbnail 160px]| | [Thumbnail 160px]| | [Thumbnail 160px]| │
  │ | ┌──────────────┐ | | ┌──────────────┐ | | ┌──────────────┐ | │
  │ | │ Self Paced   │ | | │ Live         │ | | │ Self Paced   │ | │
  │ | └──────────────┘ | | └──────────────┘ | | └──────────────┘ | │
  │ | TOEFL Complete   | | IELTS Advanced   | | Grammar Basics   | │
  │ | Course Description | | Course Description | | Course Descript.| │
  │ | (2-line trunc)   | | (2-line trunc)   | | (2-line trunc)   | │
  │ |──────────────────| |──────────────────| |──────────────────| │
  │ | 🟣 Published    | | 🟠 Draft        | | 🟣 Published    | │
  │ | 24 Lessons      | | 18 Lessons      | | 42 Lessons      | │
  │ | 234 Students    | | 0 Students      | | 567 Students    | │
  │ +──────────────────+ +──────────────────+ +──────────────────+ │
  │                                                               │
  │ [Load More] or Pagination                                      │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Create new course via the split button: blank, template ([S-2.12](#scr-2-12)), AI ([S-2.11](#scr-2-11)), or bulk import ([S-2.13](#scr-2-13)).
  2. Search and filter courses by status, type, or instructor.
  3. Click course card to navigate to Course Detail / Editor.
  4. Sort by title, date, or student count.
  5. Quick actions via card hover: Edit, Duplicate, Archive.
- **Data Displayed/Modified:** Reads from courses table with course_stats aggregated.
- **States:**
  - **Default (Populated):** Full grid with cards as shown.
  - **Empty State (No Courses):** Display [S-7.3](09-Shared-Components.md#scr-7-3) Empty State: "No courses yet. Create your first course!" with prominent "Create Course" CTA.
  - **Loading:** 6-9 skeleton cards (shimmer effect, 160px placeholder thumbnails).
  - **Filtered (No Results):** "No courses match your filters. Adjust filters or create a new course."
  - **Error:** "Unable to load courses. Retry?" with Retry button.
  - **Draft Status Card:** Orange badge, "Draft" label, less prominent styling.
  - **Archived Status Card:** Greyed out, "Archived" badge, hidden from default view.
  - **Hover State:** Card lifts with shadow, quick actions appear (Edit, Duplicate, Archive).
  - **Selection Mode:** Checkbox appears on cards (bulk actions: Publish, Archive, Delete).
- **Validation & Feedback:**
  - **Delete Confirmation:** [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation Dialog: "Are you sure you want to delete this course? This action cannot be undone."
  - **Archive Success:** Toast: "Course archived successfully."
  - **Publish Success:** Toast: "Course published successfully."
- **Navigation:**
  - "Create Course" split button → Blank: [S-2.2](#scr-2-2) · Template: [S-2.12](#scr-2-12) · AI: [S-2.11](#scr-2-11) · Bulk import: [S-2.13](#scr-2-13)
  - Avatar → User dropdown: [S-6.5](08-Settings.md#scr-6-5) My Profile & Account, [S-6.1](08-Settings.md#scr-6-1) Settings, Logout
  - Course Card Click → [S-2.6](#scr-2-6) Course Detail
  - "Edit" Quick Action → [S-2.6](#scr-2-6) Course Detail
  - "Duplicate" Quick Action → [S-2.2](#scr-2-2) (pre-filled with copied data)
  - Filter Pills → Filter grid by status
  - Search → Real-time filtering of grid

---

<a id="scr-2-2"></a>

##### Screen Name: S-2.2 Course Creation Wizard (Step 1: Details)

- **Purpose:** Multi-step wizard for creating new courses. Step 1 captures basic course information: title, description, category, instructor assignment, and thumbnail upload.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Modal / Full-Screen Wizard Layout                               │
  │                                                                  │
  │ Header: "Create New Course"                    [X] Close        │
  │         Step 1 of 4: Course Details                            │
  │         ●━━━━━━━○━━━━━━━○━━━━━━━○                             │
  ├──────────────────────────────────────────────────────────────────┤
  │ Form Content:                                                   │
  │ +─────────────────────────────────────────────────────────────+ │
  │ │ Thumbnail Upload:                                            │ │
  │ │ +──────────+  +──────────────────────────────────────────+ │ │
  │ │ | [Drop    |  | Course Title *                           | │ │
  │ │ | Image    |  | [Input: "Introduction to TOEFL"]        | │ │
  │ │ | Here]    |  +──────────────────────────────────────────+ │ │
  │ │ | 160x90  |  | Category *                                | │ │
  │ │ +──────────+  | [Dropdown: TOEFL / IELTS / GRE / Other] | │ │
  │ │                +──────────────────────────────────────────+ │ │
  │ │                | Instructor *                             | │ │
  │ │                | [Dropdown: Select instructor]           | │ │
  │ │                +──────────────────────────────────────────+ │ │
  │ │                | Description *                           | │ │
  │ │                | [Textarea: 2-3 sentence description]   | │ │
  │ │                | (100-500 characters)                   | │ │
  │ │                +──────────────────────────────────────────+ │ │
  │ │                | Course Type:       | Level:             | │ │
  │ │                | ○ Self Paced      | ○ Beginner         | │ │
  │ │                | ○ Instructor-Led  | ○ Intermediate     | │ │
  │ │                | ○ Hybrid          | ○ Advanced         | │ │
  │ │                +──────────────────────────────────────────+ │ │
  │ +─────────────────────────────────────────────────────────────+ │
  ├──────────────────────────────────────────────────────────────────┤
  │ Footer:                                                         │
  │ [Cancel]              [Save as Draft]       [Next: Curriculum →]│
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Input course metadata.
  2. Upload thumbnail image (drag-and-drop or click).
  3. Save as draft (partial save).
  4. Proceed to next step.
- **Data Displayed/Modified:** Writes to courses table (draft record created).
- **States:**
  - **Default:** Empty form with required field indicators (*).
  - **Validation Errors:** Red outlines + error messages for required fields.
  - **Thumbnail Uploading:** Progress indicator on drop zone.
  - **Thumbnail Uploaded:** Preview thumbnail displayed.
  - **Draft Saved:** Toast: "Course saved as draft." → [S-2.1](#scr-2-1) Course Grid.
  - **Submitting (Next):** "Next" button spinner, validation in progress.
  - **Unsaved Changes:** "You have unsaved changes. Are you sure you want to leave?" dialog on close.
  - **Pre-filled Entry:** When started from a template ([S-2.12](#scr-2-12)) or an AI draft ([S-2.11](#scr-2-11)), title and description arrive pre-filled and remain fully editable.
- **Validation & Feedback:**
  - **Title:** Required, min 3 characters, max 100.
  - **Description:** Required, min 100 characters, max 500.
  - **Category:** Required.
  - **Instructor:** Required.
  - **Thumbnail:** Recommended (160x90, PNG/JPG).
  - **Draft Save:** Partial validation only (title required).
- **Navigation:**
  - "Next: Curriculum" → [S-2.3](#scr-2-3) Course Creation Wizard (Step 2)
  - "Save as Draft" → [S-2.1](#scr-2-1) Course Grid (with draft created)
  - "Cancel" → [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation Dialog → [S-2.1](#scr-2-1) Course Grid
  - "X" Close → [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation Dialog → [S-2.1](#scr-2-1) Course Grid

---

<a id="scr-2-3"></a>

##### Screen Name: S-2.3 Course Creation Wizard (Step 2: Curriculum)

- **Purpose:** Step 2 of the wizard — build the course curriculum by adding modules and lessons using a drag-and-drop interface.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Create New Course"                    [X] Close        │
  │         Step 2 of 4: Curriculum                                │
  │         ●━━━━━━━●━━━━━━━○━━━━━━━○                             │
  ├──────────────────────────────────────────────────────────────────┤
  │ Toolbar:                                                        │
  │ [+ Add Module]  [+ Add Lesson]  [Import from Library]  [Reorder│
  ├──────────────────────────────────────────────────────────────────┤
  │ Module List (Drag & Drop Sortable):                             │
  │ +─────────────────────────────────────────────────────────────+ │
  │ │ 📁 Module 1: Introduction to TOEFL      [⋯] [✏️] [🗑️]      │ │
  │ │   ├─ 📄 Lesson 1: What is TOEFL?         [Edit] [Reorder]    │ │
  │ │   ├─ 📄 Lesson 2: Test Format           [Edit] [Reorder]    │ │
  │ │   ├─ 📄 Lesson 3: Scoring System        [Edit] [Reorder]    │ │
  │ │   └─ [+ Add Lesson]                                          │ │
  │ ├─────────────────────────────────────────────────────────────┤ │
  │ │ 📁 Module 2: Reading Section            [⋯] [✏️] [🗑️]      │ │
  │ │   ├─ 📄 Lesson 1: Overview              [Edit] [Reorder]    │ │
  │ │   └─ [+ Add Lesson]                                          │ │
  │ ├─────────────────────────────────────────────────────────────┤ │
  │ │ [+ Add Module]                                               │ │
  │ +─────────────────────────────────────────────────────────────+ │
  ├──────────────────────────────────────────────────────────────────┤
  │ Footer:                                                         │
  │ [← Back: Details]         [Save as Draft]   [Next: Pricing →]  │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Add/delete/reorder modules and lessons.
  2. Drag-and-drop to reorder entire modules or lessons within modules.
  3. Edit module or lesson properties (name, description).
  4. Import existing lessons from Content Library.
- **Data Displayed/Modified:** Writes to modules and lessons tables.
- **States:**
  - **Default:** Empty or pre-populated module list.
  - **Empty (No Modules):** "Add your first module to start building the curriculum."
  - **Drag Active:** Module/Lesson lifts with shadow, drop target highlighted.
  - **Module Expanded:** Lessons visible.
  - **Module Collapsed:** Only module header visible.
  - **Edit Mode Inline:** Name field editable inline.
  - **Deleting:** [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation Dialog: "Delete this module and all its lessons?"
  - **Loading (Import):** Spinner overlay during import.
- **Validation & Feedback:**
  - **Minimum:** At least 1 module with 1 lesson required to proceed.
  - **Module Name:** Required, min 3 characters.
  - **Lesson Name:** Required, min 3 characters.
  - **Duplicate Check:** Warn if lesson names are identical.
  - **Save Toast:** "Curriculum saved."
- **Navigation:**
  - "← Back: Details" → [S-2.2](#scr-2-2) Course Creation Wizard (Step 1)
  - "Next: Pricing" → [S-2.4](#scr-2-4) Course Creation Wizard (Step 3)
  - "+ Add Module" → Opens inline module creation
  - "+ Add Lesson" → Opens inline lesson creation
  - Module Edit → Inline name edit
  - Lesson Edit → [S-2.7](#scr-2-7) Lesson Editor (opens as slide-out or modal)
  - "Import from Library" → [S-3.1](05-Content-Library.md#scr-3-1) Content Library (selection mode)

---

<a id="scr-2-4"></a>

##### Screen Name: S-2.4 Course Creation Wizard (Step 3: Pricing)

- **Purpose:** Step 3 of the wizard — configure pricing model, payment gateway, enrollment period, and discount options.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Create New Course"                    [X] Close        │
  │         Step 3 of 4: Pricing                                   │
  │         ●━━━━━━━●━━━━━━━●━━━━━━━○                             │
  ├──────────────────────────────────────────────────────────────────┤
  │ Form Content:                                                   │
  │ +─────────────────────────────────────────────────────────────+ │
  │ │ Pricing Model:                                               │ │
  │ │ ○ Free        ○ One-Time Purchase    ○ Subscription         │ │
  │ │                                                              │ │
  │ │ [One-Time Purchase Selected]:                               │ │
  │ │ Price: [$19.99] USD                                        │ │
  │ │                                                              │ │
  │ │ [Subscription Selected]:                                    │ │
  │ │ Price: [$9.99] USD  [Monthly] [Quarterly] [Annual]         │ │
  │ │                                                              │ │
  │ │ Enrollment Period:                                          │ │
  │ │ [Start Date: 2026-09-07] [End Date: 2026-12-31]           │ │
  │ │ ○ Unlimited Access                                          │ │
  │ │                                                              │ │
  │ │ Discount Options:                                           │ │
  │ │ [Early Bird Discount: 10% before 2026-09-15]              │ │
  │ │ [Bulk Discount: 15% for 10+ enrollments]                  │ │
  │ │                                                              │ │
  │ │ Payment Gateways:                                           │ │
  │ │ ☑ Stripe   ☑ PayPal   ☐ Telebirr   ☐ Bank Transfer       │ │
  │ +─────────────────────────────────────────────────────────────+ │
  ├──────────────────────────────────────────────────────────────────┤
  │ Footer:                                                         │
  │ [← Back: Curriculum]         [Save as Draft]   [Next: Publish →]│
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Select pricing model.
  2. Set price and billing frequency.
  3. Define enrollment period.
  4. Configure discounts.
  5. Select payment gateways.
- **Data Displayed/Modified:** Writes to course_pricing, discounts, and payment_gateway_settings tables.
- **States:**
  - **Default:** "Free" selected by default.
  - **Price Type Changed:** Conditional fields appear/disappear.
  - **Discount Added:** Discount row appears with applied amount.
  - **Validation Errors:** Red outline + error message for invalid price/date.
- **Validation & Feedback:**
  - **Price:** Required if not free, numeric > 0.
  - **End Date:** Must be after start date.
  - **Gateway Selection:** At least one gateway required.
  - **Discount:** Must be valid percentage (1-99) or fixed amount > 0.
  - **Save Toast:** "Pricing saved."
- **Navigation:**
  - "← Back: Curriculum" → [S-2.3](#scr-2-3) Course Creation Wizard (Step 2)
  - "Next: Publish" → [S-2.5](#scr-2-5) Course Creation Wizard (Step 4)
  - "Save as Draft" → [S-2.1](#scr-2-1) Course Grid
  - "Discount Options" → [S-8.3](10-Marketing-and-Growth.md#scr-8-3) Discount & Coupon Codes (managed codes apply at checkout)

---

<a id="scr-2-5"></a>

##### Screen Name: S-2.5 Course Creation Wizard (Step 4: Publish)

- **Purpose:** Final step — review all course details, set visibility, and publish the course.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Create New Course"                    [X] Close        │
  │         Step 4 of 4: Publish                                   │
  │         ●━━━━━━━●━━━━━━━●━━━━━━━●                             │
  ├──────────────────────────────────────────────────────────────────┤
  │ Review Summary:                                                 │
  │ +─────────────────────────────────────────────────────────────+ │
  │ │ ✅ Details: TOEFL Complete Course                          │ │
  │ │    Category: TOEFL | Instructor: John Doe | Level: Interm. │ │
  │ │ ✅ Curriculum: 4 Modules, 24 Lessons                       │ │
  │ │ ✅ Pricing: $19.99 One-Time | Starts: 2026-09-07          │ │
  │ +─────────────────────────────────────────────────────────────+ │
  │                                                              │
  │ Publish Settings:                                             │
  │ +─────────────────────────────────────────────────────────────+ │
  │ │ Visibility:                                                 │ │
  │ │ ○ Private (Draft)    ● Published (Public)                   │ │
  │ │                                                              │ │
  │ │ Release Date:                                               │ │
  │ │ [Immediately] [Schedule: 2026-09-15 09:00]                │ │
  │ │                                                              │ │
  │ │ Notification:                                               │ │
  │ │ ☑ Notify enrolled students when published                  │ │
  │ │ ☑ Send announcement to subscribers                         │ │
  │ │                                                              │ │
  │ │ [ ] I confirm all content is complete and ready for        │ │
  │ │     publication.                                            │ │
  │ +─────────────────────────────────────────────────────────────+ │
  ├──────────────────────────────────────────────────────────────────┤
  │ Footer:                                                         │
  │ [← Back: Pricing]              [Publish Course] [Save as Draft] │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Review all course details.
  2. Set publication status (Draft/Published).
  3. Schedule release date.
  4. Toggle notification preferences.
  5. Finalize course creation.
- **Data Displayed/Modified:** Updates courses.status, schedules notifications.
- **States:**
  - **Default:** "Published" selected, "Immediately" selected, confirmation checkbox unchecked.
  - **Confirmation Checked:** "Publish Course" button active.
  - **Scheduling Mode:** Date/time picker appears.
  - **Publishing:** "Publish Course" button shows spinner and progress.
  - **Success:** Toast: "Course published successfully!" → [S-2.6](#scr-2-6) Course Detail.
  - **Validation Error:** "Please confirm all content is complete."
- **Navigation:**
  - "← Back: Pricing" → [S-2.4](#scr-2-4) Course Creation Wizard (Step 3)
  - "Publish Course" → Publish → [S-2.6](#scr-2-6) Course Detail
  - "Save as Draft" → [S-2.1](#scr-2-1) Course Grid

---

<a id="scr-2-6"></a>

##### Screen Name: S-2.6 Course Detail / Curriculum Builder

- **Purpose:** Comprehensive course management screen combining curriculum builder, student analytics, and course settings. Primary workspace for course authors.
- **User Role(s):** Admin, Editor (Viewer: read-only)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "TOEFL Complete Course"                                 │
  │         [Published] [📊 Analytics] [⚙️ Settings] [Preview]      │
  │         [Edit Details] [Duplicate] [Archive]                   │
  ├──────────────────────────────────────────────────────────────────┤
  │ Tab Navigation:                                                │
  │ [Curriculum] [Students] [Analytics] [Settings]                │
  ├──────────────────────────────────────────────────────────────────┤
  │ ┌─ Curriculum Tab ─────────────────────────────────────────────┤
  │ │ Toolbar:                                                     │
  │ │ [+ Add Module] [+ Add Lesson] [Import from Library] 🔒      │
  │ │ [Batch Actions: Reorder]                                   │
  │ │                                                             │
  │ │ Module List (Drag & Drop Sortable):                         │
  │ │ +──────────────────────────────────────────────────────────+ │
  │ │ │ 📁 Module 1: Introduction [🟣 3 lessons] [⋯] [✏️] [🗑️]  │ │
  │ │ │   ├─ 📄 Lesson 1: What is TOEFL?   [24 students] [Edit]  │ │
  │ │ │   ├─ 📄 Lesson 2: Test Format      [22 students] [Edit]  │ │
  │ │ │   └─ 📄 Lesson 3: Scoring System   [20 students] [Edit]  │ │
  │ │ ├──────────────────────────────────────────────────────────┤ │
  │ │ │ 📁 Module 2: Reading [🟠 0 lessons] [⋯] [✏️] [🗑️]      │ │
  │ │ │   └─ [+ Add Lesson]                                      │ │
  │ │ +──────────────────────────────────────────────────────────+ │
  │ │                                                             │
  │ │ 💡 Progress Summary: 68% complete (16/24 lessons)          │ │
  │ └─────────────────────────────────────────────────────────────┘ │
  │                                                                  │
  │ ┌─ Students Tab ────────────────────────────────────────────────┤
  │ │ [Search] [Export] [Add Cohort]                              │ │
  │ │ | Student Name   | Progress | Completion | Last Active   | │ │
  │ │ |────────────────|──────────|────────────|───────────────| │ │
  │ │ | Alemayehu K.   | 82%      | 18/24      | 2 days ago    │ │
  │ │ | Tigist M.      | 65%      | 14/24      | 5 days ago    │ │
  │ └─────────────────────────────────────────────────────────────┘ │
  ├──────────────────────────────────────────────────────────────────┤
  │ Footer: [Save Changes] [Revert] [View Course]                  │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Build and manage course curriculum (drag-and-drop).
  2. View student progress and enrollment data.
  3. Access course analytics.
  4. Configure course settings.
  5. Preview course as student.
  6. Define prerequisites and unlock rules per lesson ([S-2.15](#scr-2-15)).
  7. Duplicate a lesson to another course ([S-7.7](09-Shared-Components.md#scr-7-7)) or bulk-import lessons ([S-2.13](#scr-2-13)).
- **Data Displayed/Modified:** Reads/Writes to courses, modules, lessons, course_stats, enrollments.
- **States:**
  - **Default:** Full edit mode available to all users.
  - **Tab Switch:** Content area updates to selected tab.
  - **Unsaved Changes:** "Save Changes" button active; warning on tab switch.
  - **Saving:** "Save Changes" spinner; disabled during save.
  - **Error:** "Unable to save changes. Retry?" with retry button.
  - **Draft Mode:** Draft banner displayed at top: "This course is in Draft mode. Publish to make it visible."
  - **Approval Workflow Enabled:** Lesson rows show review status pills (In Review / Changes Requested / Approved); gated lessons publish only after [S-2.14](#scr-2-14) approval.
- **Navigation:**
  - "Edit Details" → [S-2.2](#scr-2-2) (pre-filled with existing data)
  - "Analytics" → [S-5.1](07-Analytics.md#scr-5-1) Course Performance
  - "Settings" → [S-6.1](08-Settings.md#scr-6-1) General Settings
  - "Preview" → Student preview mode (new tab/window)
  - "Duplicate" → [S-2.2](#scr-2-2) (pre-filled with copied data)
  - "Archive" → [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation → Archive course → [S-2.1](#scr-2-1)
  - Lesson "Edit" → [S-2.7](#scr-2-7) Lesson Editor
  - Lesson row "🔒 Rules" → [S-2.15](#scr-2-15) Prerequisites & Unlock Rules (slide-over)
  - Lesson row "⋯ → Duplicate to another course" → [S-7.7](09-Shared-Components.md#scr-7-7) Duplicate Lesson Modal

---

<a id="scr-2-7"></a>

##### Screen Name: S-2.7 Lesson Editor

- **Purpose:** Deep-dive editor for individual lessons within a course. Supports rich content creation, video embeds, PDF uploads, and quiz configuration.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Full-Screen Layout / Slide-Out Panel                           │
  │ Header: "Edit Lesson: What is TOEFL?"     [X] Close           │
  │         Course: TOEFL Complete Course                         │
  │         Module: Module 1: Introduction                        │
  ├──────────────────────────────────────────────────────────────────┤
  │ Two-Column Layout:                                             │
  │ +───────────────────────────────+ +──────────────────────────+ │
  │ │ Left: Content Editor          │ │ Right: Settings          │ │
  │ │                               │ │                          │ │
  │ │ [Title Input]                 │ │ Lesson Type:             │ │
  │ │ "What is TOEFL?"              │ │ [Video] [PDF] [Quiz]    │ │
  │ │                               │ │                          │ │
  │ │ Content Editor                │ │ Video URL:               │ │
  │ │ (Rich Text / Media Embed)     │ │ [https://youtube.com/..]│ │
  │ │ ┌──────────────────────────┐ │ │                          │ │
  │ │ │ TOEFL is the Test of     │ │ │ Duration: [30] minutes   │ │
  │ │ │ English as a Foreign     │ │ │                          │ │
  │ │ │ Language...              │ │ │ Status: [Published] [Draft]│ │
  │ │ └──────────────────────────┘ │ │                          │ │
  │ │                               │ │ Assignments:             │ │
  │ │ [+ Add Media] [+ Add Quiz]   │ │ ☑ "Lesson Quiz"          │ │
  │ │                               │ │ ☑ "Reading Assignment"   │ │
  │ │                               │ │                          │ │
  │ │                               │ │ Prerequisites:           │ │
  │ │                               │ │ ☑ "Course Overview"      │ │
  │ │                               │ │                          │ │
  │ │                               │ │ Tags:                    │ │
  │ │                               │ │ [TOEFL] [Introduction]   │ │
  │ │                               │ │                          │ │
  │ │                               │ │ [Save] [Cancel]          │ │
  │ +───────────────────────────────+ +──────────────────────────+ │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Edit lesson title and content (rich text, media embedding).
  2. Set lesson type and media URL.
  3. Configure duration and status.
  4. Link prerequisites and assignments.
  5. Add tags for searchability.
  6. Submit the lesson for review or act on reviewer feedback ([S-2.14](#scr-2-14), when approval is required).
  7. Generate or edit transcription and subtitles for video lessons ([S-3.6](05-Content-Library.md#scr-3-6)).
  8. Draft a quiz from the lesson content with AI ([S-2.16](#scr-2-16)).
- **Data Displayed/Modified:** Reads/Writes to lessons table.
- **States:**
  - **Default:** Existing lesson data populated.
  - **Unsaved Changes:** "Save" button active; "X" triggers confirmation dialog.
  - **Saving:** "Save" spinner; disabled during save.
  - **Success:** Toast: "Lesson saved successfully."
  - **Error:** "Unable to save lesson. Retry?" with retry button.
  - **Media Uploading:** Progress indicator for video/PDF uploads.
  - **Draft Status:** Lesson not visible to students.
  - **In Review:** Status pill; body editing is locked and the reviewer checklist is visible.
  - **Changes Requested:** Reviewer comments display inline with a "Re-submit for review" action once edits are made.
- **Validation & Feedback:**
  - **Title:** Required, min 3 chars.
  - **Content:** Required, min 50 chars.
  - **Video URL:** Must be valid YouTube/Vimeo URL.
  - **Duration:** Numeric > 0.
- **Navigation:**
  - "X" Close → [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation Dialog → [S-2.6](#scr-2-6) Course Detail
  - "Add Quiz" → [S-2.8](#scr-2-8) Quiz Builder
  - "Captions & transcript" → [S-3.6](05-Content-Library.md#scr-3-6) Transcription & Subtitle Editor
  - "✨ AI Quiz" → [S-2.16](#scr-2-16) AI Quiz Generator
  - "⋯ → Duplicate to another course" → [S-7.7](09-Shared-Components.md#scr-7-7) Duplicate Lesson Modal
  - "Submit for Review" → [S-2.14](#scr-2-14) Approval Queue (when the course requires approval)
  - "Add Media" → [S-3.1](05-Content-Library.md#scr-3-1) Content Library (selection mode)

---

<a id="scr-2-8"></a>

##### Screen Name: S-2.8 Quiz Builder

- **Purpose:** Dedicated authoring surface for graded and practice quizzes, opened from "+ Add Quiz" in [S-2.7](#scr-2-7) Lesson Editor.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Quiz: Reading Comprehension Check"        [X] Close     │
  │ Settings: Passing Score [70%]  Time Limit [15 min]  Attempts [2] │
  ├──────────────────────────────────────────────────────────────────┤
  │ Question 1 of 5                              [Duplicate] [🗑️]   │
  │ Type: (● Multiple Choice ○ True/False ○ Short Answer)            │
  │ Prompt: [What is the main idea of the passage?]                 │
  │ Options:  ● A. …   ○ B. …   ○ C. …   ○ D. …   [+ Add Option]     │
  │ Points: [10]     Explanation (shown after answer): [Textarea]   │
  ├──────────────────────────────────────────────────────────────────┤
  │ [+ Add Question]  [✨ AI Draft]       [Preview Quiz] [Save Quiz] │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Add, reorder, duplicate, and delete questions.
  2. Configure scoring, time limit, and allowed attempts.
  3. Preview the quiz as a student would see it.
  4. Attach the quiz to one or more lessons.
  5. Draft questions instantly with AI ([S-2.16](#scr-2-16)) — review and edit before saving.
- **Data Displayed/Modified:** Writes to `quizzes`, `quiz_questions`, `quiz_options`.
- **States:**
  - **Default:** At least one blank question on creation.
  - **Validation Error:** "Every question needs a correct answer marked." blocks save.
  - **Saving:** Spinner on "Save Quiz".
  - **Success:** Toast: "Quiz saved." → back to [S-2.7](#scr-2-7).
- **Validation & Feedback:**
  - Multiple choice requires exactly one correct option marked.
  - Passing score must be between 1–100%.
- **Navigation:**
  - "Save Quiz" → [S-2.7](#scr-2-7) Lesson Editor (quiz attached)
  - "Preview Quiz" → read-only student-view overlay
  - Quiz results roll up into [S-5.2](07-Analytics.md#scr-5-2) Quiz Analytics
  - "✨ AI Draft" → [S-2.16](#scr-2-16) AI Quiz Generator (the reviewed draft returns here for scoring and attachment)

---

<a id="scr-2-9"></a>

##### Screen Name: S-2.9 Live Session Scheduler

- **Purpose:** Scheduling and video-conferencing configuration for courses whose `course_type` is "Live" (referenced by the Live/Self-Paced toggle in [S-2.2](#scr-2-2)).
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Live Sessions — IELTS Advanced"        [+ Schedule]    │
  ├──────────────────────────────────────────────────────────────────┤
  │ Upcoming:                                                        │
  │ | Session            | Date/Time         | Host | Attendees |   │
  │ |─────────────────────|───────────────────|──────|───────────|  │
  │ | Speaking Practice 3 | Sep 12, 6:00 PM   | Jane | 18/24     |   │
  │ Conferencing Provider: (● Zoom ○ Google Meet ○ Custom URL)       │
  │ Recording: [✓] Auto-record and attach to lesson after session   │
  │ Reminder Emails: [24h before] [1h before]                       │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Schedule, edit, or cancel a live session.
  2. Choose a conferencing provider and generate a join link.
  3. Enable auto-recording and attach the recording to a lesson.
- **Data Displayed/Modified:** Writes to `live_sessions`, `session_attendance`.
- **States:**
  - **Default:** Chronological upcoming list; past sessions collapse under "History".
  - **Conflict:** Warns if a session overlaps an existing one for the same host.
  - **Cancelling:** [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation Dialog with option to notify attendees.
  - **Recording Ready:** Toast + banner: "Recording ready — attach to a lesson?"
- **Navigation:**
  - "Attach to lesson" → [S-2.7](#scr-2-7) Lesson Editor
  - Attendee count → [S-4.1](06-Students.md#scr-4-1) Student Directory (filtered)

---

<a id="scr-2-10"></a>

##### Screen Name: S-2.10 Certificates & Completion Rules

- **Purpose:** Define what counts as "complete" for a course and design the certificate awarded to students who finish it.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Certificate — TOEFL Complete Course"                   │
  ├──────────────────────────────────────────────────────────────────┤
  │ Completion Rule:                                                 │
  │ (● 100% of lessons  ○ Minimum 80% + passing final quiz)          │
  │                                                                  │
  │ Certificate Template:                                            │
  │ +──────────────────────────────+  Fields:                       │
  │ │  [Preview: Certificate of    │  Student Name  Course Title    │
  │ │   Completion — Landscape]    │  Completion Date  Signature    │
  │ +──────────────────────────────+  [Upload Signature Image]      │
  │                                                                  │
  │ [ ] Issue automatically on completion                            │
  │ [Save Rules] [Preview Certificate]                               │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Choose the completion rule for the course.
  2. Customize the certificate template and signature.
  3. Toggle automatic issuance.
- **Data Displayed/Modified:** Writes to `completion_rules`, `certificate_templates`; reads/writes `issued_certificates`.
- **States:**
  - **Default:** 100%-of-lessons rule pre-selected.
  - **Preview:** Renders a sample certificate with placeholder data.
  - **Success:** Toast: "Completion rules saved."
- **Navigation:**
  - "Save Rules" → [S-2.6](#scr-2-6) Course Detail
  - Issued certificates appear on the student's [S-4.3](06-Students.md#scr-4-3) Progress Dashboard

---

<a id="scr-2-11"></a>

##### Screen Name: S-2.11 AI Course Generator

- **Purpose:** Generate a complete course draft — outline, modules, lessons, descriptions, and quiz seeds — from a single natural-language prompt, drastically reducing manual setup time. Output always lands in an editable draft state; nothing is published without human review.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Modal: "AI Course Generator ✨"                   [X] Close      │
  ├──────────────────────────────────────────────────────────────────┤
  │ Step 1 — Describe the course:                                    │
  │ +─────────────────────────────────────────────────────────────+ │
  │ │ [Create a 12-week TOEFL preparation course for intermediate  │ │
  │ │  English learners, with weekly quizzes and a final mock test.]│ │
  │ +─────────────────────────────────────────────────────────────+ │
  │ Audience: [Adult learners ▾]   Level: [Intermediate ▾]           │
  │ Scale: [~8 modules] [~3 lessons each]   ☑ Include quiz seeds     │
  │ Language: [English ▾]                [✨ Generate Outline]       │
  ├──────────────────────────────────────────────────────────────────┤
  │ Step 2 — Review & edit the generated draft:                      │
  │ +─────────────────────────────────────────────────────────────+ │
  │ │ ☑ Module 1: TOEFL Foundations                    [↻] [✏️]    │ │
  │ │   ├─ ☑ What is the TOEFL?   (video + reading, ~20 min)       │ │
  │ │   ├─ ☑ Scoring & Test-Day Strategy (lesson + quiz seed)      │ │
  │ │ ☑ Module 2: Reading Skills…                       [↻] [✏️]    │ │
  │ │ [+ Expand module with 3 more lessons]                        │ │
  │ │ 💡 AI draft — every item is editable before importing.       │ │
  │ +─────────────────────────────────────────────────────────────+ │
  │ [↻ Regenerate All]  [Deselect All]   [Cancel] [Create Course]    │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Write a prompt and set audience, level, scale, and language parameters.
  2. Generate the outline and watch it stream in module-by-module.
  3. Edit any generated title/description inline, regenerate a single module, or expand a module with more lessons.
  4. Select/deselect items, then create the course from the accepted draft.
- **Data Displayed/Modified:** Writes `ai_generation_jobs` (prompt, params, tokens, status); on accept, writes a draft course, modules, and lessons via the standard course tables.
- **States:**
  - **Default:** Prompt empty → "Generate" disabled until ≥ 10 characters.
  - **Generating:** Skeleton outline streams in; "Cancel" aborts and discards the partial draft.
  - **Generated:** Editable tree with per-item checkboxes; all items selected by default.
  - **Partial Failure:** "Module 3 couldn't be generated." with a per-module Retry; accepted modules are kept.
  - **Usage Notice:** Shows remaining AI credits for the billing cycle when below 20%, linking to [S-6.6](08-Settings.md#scr-6-6) Billing & Subscription.
  - **Accepted:** Course created as **Draft** → opens [S-2.6](#scr-2-6) Course Detail with the generated curriculum loaded.
- **Validation & Feedback:**
  - Prompt: required, 10–2,000 characters.
  - Generated lessons with empty bodies are flagged ⚠️ "needs content" and cannot be published until filled (enforced by the normal publish checks).
  - AI output is always labeled with the ✨ marker and is never applied silently — every import requires an explicit "Create Course" confirmation.
- **Navigation:**
  - Opened from [S-2.1](#scr-2-1) Course Catalog ("Create Course ▾ → AI generator") and the [S-7.5](09-Shared-Components.md#scr-7-5) Command Palette
  - "Create Course" → [S-2.6](#scr-2-6) Course Detail (draft with generated curriculum)
  - "X" Close → [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation Dialog if a generation is in progress or a draft is unaccepted

---

<a id="scr-2-12"></a>

##### Screen Name: S-2.12 Template Library

- **Purpose:** Browse, preview, and import pre-built course templates — such as **12-Week TOEFL Prep** and **2-Day Workshop** — then customize the imported copy. Templates give teams a professional starting structure instead of a blank canvas.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Template Library"          [🔍 Search] [Category ▾]     │
  ├──────────────────────────────────────────────────────────────────┤
  │ Category chips: [All] [Exam Prep] [Corporate Training] [Language]│
  │                 [Onboarding] [Workshops]                         │
  ├──────────────────────────────────────────────────────────────────┤
  │ Template Gallery (3 columns):                                    │
  │ +──────────────────+ +──────────────────+ +──────────────────+   │
  │ │ 📚 12-Week TOEFL │ │ 📚 2-Day Workshop│ │ 📚 IELTS Crash   │   │
  │ │    Prep          │ │    (Corporate)   │ │    Course        │   │
  │ │ 12 modules       │ │ 2 days           │ │ 6 modules        │   │
  │ │ 48 lessons       │ │ 8 sessions       │ │ 24 lessons       │   │
  │ │ 6 quizzes        │ │ Handouts + form  │ │ 5 quizzes        │   │
  │ │ [Preview] [Use]  │ │ [Preview] [Use]  │ │ [Preview] [Use]  │   │
  │ +──────────────────+ +──────────────────+ +──────────────────+   │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Search and filter templates by category.
  2. Preview a template's full structure (modules, lessons, sample quizzes) in a read-only viewer.
  3. Use a template — creates a draft course pre-filled with the template's curriculum, ready to customize.
  4. Save a custom course as a workspace template (from [S-2.6](#scr-2-6) "⋯" menu) for internal reuse.
- **Data Displayed/Modified:** Reads `course_templates`; on import writes a draft course, modules, lessons, and sample quizzes tagged `source: template`.
- **States:**
  - **Default:** Featured templates first; categories filter the gallery.
  - **Preview:** Full-screen read-only curriculum viewer with "Use this template" CTA.
  - **Importing:** Progress overlay: "Copying 12 modules and 48 lessons…".
  - **Success:** Toast: "Template imported. Customize it in Course Detail." → [S-2.6](#scr-2-6).
  - **Empty:** [S-7.3](09-Shared-Components.md#scr-7-3) Empty State if a filter matches nothing: "No templates in this category yet."
- **Navigation:**
  - Opened from [S-2.1](#scr-2-1) ("Create Course ▾ → From template"), the [S-7.5](09-Shared-Components.md#scr-7-5) Command Palette, and the [S-0.2](01-Authentication-and-Onboarding.md#scr-0-2) onboarding checklist
  - "Use" → [S-2.6](#scr-2-6) Course Detail (draft pre-filled from template)

---

<a id="scr-2-13"></a>

##### Screen Name: S-2.13 Bulk Module & Lesson Import

- **Purpose:** Upload a spreadsheet (CSV/XLSX) or structured document (Markdown/Docx) to create many modules and lessons at once, with column mapping, row-level validation, and a reversible run report.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Wizard: "Bulk Import Modules & Lessons"           [X] Close      │
  ├──────────────────────────────────────────────────────────────────┤
  │ Step 1 — Upload:                                                 │
  │ [📤 Drop .csv / .xlsx / .md / .docx here, or click to browse]    │
  │ (a sample CSV template is downloadable)                          │
  ├──────────────────────────────────────────────────────────────────┤
  │ Step 2 — Map columns:                                            │
  │ | Source column   | Maps to (field)  | Sample (row 1)        |   │
  │ |─────────────────|──────────────────|───────────────────────|   │
  │ │ Module Name     │ Module           │ Reading Skills        │   │
  │ │ Lesson Title    │ Lesson title *   │ Skimming Basics       │   │
  │ │ Video URL       │ Video URL        │ https://youtu.be/…    │   │
  │ │ Body            │ Lesson content   │ Skimming is reading…  │   │
  │ │ Duration (min)  │ Duration         │ 25                    │   │
  ├──────────────────────────────────────────────────────────────────┤
  │ Step 3 — Validate & preview:                                     │
  │ 112 rows → 8 modules · 104 lessons · ⚠️ 3 rows skipped           │
  │ (missing lesson title) [Show skipped rows]                       │
  │ [Import 104 Lessons]        [Download template]                  │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Upload a file and let auto-mapping propose column-to-field pairs; adjust any mapping via dropdowns.
  2. Run validation and review per-row errors/warnings before importing.
  3. Import into a target course ([S-2.6](#scr-2-6)) or a brand-new course shell.
  4. Download the run report and undo the whole import within 30 minutes.
- **Data Displayed/Modified:** Writes `import_jobs` (file, mapping, row stats, undo window); on success writes modules/lessons tagged `source: import`.
- **States:**
  - **Uploading:** Progress bar; file ≤ 20 MB.
  - **Mapping:** Auto-map applied; unmapped columns are listed as "Ignored".
  - **Validation Errors:** Rows with blocking issues are excluded and listed; the import proceeds with valid rows only after confirmation.
  - **Importing:** Progress with per-module counts; closing the wizard does not cancel the job (it continues server-side).
  - **Success:** Summary toast: "8 modules and 104 lessons created." → [S-2.6](#scr-2-6) with a 30-minute "Undo import" banner.
  - **Undo:** [S-7.1](09-Shared-Components.md#scr-7-1) Confirmation → removes only objects created by this import.
- **Validation & Feedback:**
  - Lesson title required per row; duplicate titles within the same module get " (2)" suffixes.
  - Video URLs must be valid YouTube/Vimeo links; invalid rows are flagged, not blocked.
  - Cell size caps: lesson content ≤ 50,000 characters per row.
- **Navigation:**
  - Opened from [S-2.1](#scr-2-1) ("Create Course ▾ → Bulk import") and the [S-2.6](#scr-2-6) toolbar
  - "Import" target → [S-2.6](#scr-2-6) Course Detail (chosen course or new draft)

---

<a id="scr-2-14"></a>

##### Screen Name: S-2.14 Review & Approval Queue

- **Purpose:** Multi-stage publication gate: lessons must be approved by a **Reviewer** before they can be published to students. Gives content teams a controlled Draft → In Review → Approved → Published lifecycle with clear feedback loops.
- **User Role(s):** Admin, Reviewer (Editors submit; Viewers read-only)
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Header: "Approval Queue"            [Filter ▾] [Workflow ⚙️]     │
  │ Tabs: [Pending (5)] [Changes Requested (2)] [Approved] [Rejected]│
  ├──────────────────────────────────────────────────────────────────┤
  │ | Lesson              | Course     | Author | Submitted | Action │
  │ |─────────────────────|────────────|────────|───────────|────────│
  │ │ Listening Drill 2   │ IELTS Adv. │ Jane   │ 2h ago    │[Review]│
  │ │ Skimming Basics     │ TOEFL      │ Alex   │ 1d ago    │[Review]│
  ├──────────────────────────────────────────────────────────────────┤
  │ Review Panel (opens on [Review]):                                │
  │ +─────────────────────────────────────────────────────────────+ │
  │ │ [Lesson preview exactly as students will see it]             │ │
  │ │ Checklist: ☑ Media plays ☑ Quiz answers keyed ☑ Links work   │ │
  │ │ Comment: [Explain what should change…]                       │ │
  │ │ [Approve]  [Request Changes]  [Reject]                       │ │
  │ +─────────────────────────────────────────────────────────────+ │
  │ Lifecycle: Draft → In Review → Changes Requested → Approved →    │
  │ Published   (approval gating is toggled per course in [S-2.6])   │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Review a submitted lesson in a student-accurate preview.
  2. Approve (author may publish), request changes (returns to author with comments), or reject (with reason).
  3. Configure which courses require approval (Admin).
  4. Track review turnaround per reviewer in the queue's filter summary.
- **Data Displayed/Modified:** Writes `review_requests` (state machine, comments, decisions); course publish checks read approved state before allowing publication.
- **States:**
  - **Empty (Pending):** "No lessons waiting for review. 🎉"
  - **Reviewer Decision:** Buttons disabled until the preview has been opened; Approve/Reject require confirmation when a comment box is empty via [S-7.1](09-Shared-Components.md#scr-7-1).
  - **Changes Requested:** Lesson returns to author's [S-2.7](#scr-2-7) Lesson Editor in read-only-comment state; author re-submits with one click.
  - **Approved:** Author sees an "Approved — ready to publish" state in the Lesson Editor; publishing follows [S-2.5](#scr-2-5).
  - **Notification:** Submission and decisions notify the counterpart (author ↔ reviewer) via [S-1.4](03-Dashboard.md#scr-1-4) and email.
- **Navigation:**
  - Reached from the Courses nav item badge (pending count) in [S-A.1](02-Global-Navigation.md#scr-a-1) and notifications in [S-1.4](03-Dashboard.md#scr-1-4)
  - [Review] → lesson preview panel (same screen)
  - "Workflow ⚙️" → per-course approval toggle (inline)
  - Lesson title → [S-2.7](#scr-2-7) Lesson Editor (read-only for Reviewer)

---

<a id="scr-2-15"></a>

##### Screen Name: S-2.15 Prerequisites & Unlock Rules

- **Purpose:** Slide-over from the curriculum builder that makes lessons sequential or conditionally locked: students must complete required lessons (viewed, or quiz-passed at a threshold) before later ones unlock.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Slide-over: "Unlock Rules — Lesson 2: Skimming Basics"    [X]    │
  ├──────────────────────────────────────────────────────────────────┤
  │ [☑] Require lessons before this one:                             │
  │   ☑ Lesson 1: Reading Overview          Must: [View ▾]           │
  │   ☑ Lesson 1 Quiz: Reading Check        Must: [Score ≥ 70% ▾]    │
  │ [+ Add requirement from any lesson in this course]               │
  │                                                                  │
  │ Lock behavior:  ● Hidden until met  ○ Visible but locked 🔒      │
  │                                                                  │
  │ 🔎 Student preview:                                              │
  │   "Complete Reading Overview and score 70%+ to unlock this       │
  │    lesson."        [1 of 2 requirements met]                     │
  │                                                                  │
  │ ⚠️ Circular dependency check: none detected                      │
  │ [Save Rules]                                                     │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Toggle prerequisite mode per lesson and add requirements from any lesson or quiz in the same course.
  2. Choose the completion condition per requirement: Viewed, Completed, or Quiz score ≥ threshold.
  3. Choose lock behavior (hidden vs. visible-but-locked) and preview the exact student-facing lock message.
  4. Apply a sequential default to an entire module ("complete in order") with one toggle.
- **Data Displayed/Modified:** Writes `lesson_unlock_rules`; student progress checks enforce rules at lesson-access time.
- **States:**
  - **No Rules:** Toggle off — lesson is freely accessible (default).
  - **Circular Dependency:** Saving a rule chain that loops back on itself is blocked with the offending cycle highlighted.
  - **Quiz Unavailable:** Requirements referencing a deleted quiz are flagged and must be re-pointed before save.
  - **Saved:** Toast: "Unlock rules saved." — curriculum rows show a 🔒 icon on lessons with rules.
- **Validation & Feedback:**
  - At least one requirement when the toggle is on; quiz thresholds between 1–100%.
  - Changing rules never re-locks lessons a student already unlocked.
  - The lock message is auto-generated but editable per lesson.
- **Navigation:**
  - Opened from [S-2.6](#scr-2-6) curriculum rows ("🔒 Rules") and the lesson row "⋯" menu
  - "X" Close / Save → returns to [S-2.6](#scr-2-6) Course Detail

---

<a id="scr-2-16"></a>

##### Screen Name: S-2.16 AI Quiz Generator

- **Purpose:** Create a quiz from a lesson's content with a single click: the AI drafts questions from the lesson body, and the author reviews, edits, and saves them into the [S-2.8](#scr-2-8) Quiz Builder. Nothing enters a live quiz unreviewed.
- **User Role(s):** Admin, Editor
- **Wireframe Layout (Text-Based):**
  ```
  ┌──────────────────────────────────────────────────────────────────┐
  │ Modal: "AI Quiz Generator ✨ — from lesson content"   [X] Close  │
  ├──────────────────────────────────────────────────────────────────┤
  │ Source lesson: [Lesson 2: Skimming Basics ▾]  (pre-filled)       │
  │ Questions: [5 ▾]   Types: ☑ Multiple choice ☑ True/False         │
  │                        ☐ Short answer                            │
  │ Difficulty: [Mixed ▾]            [✨ Generate Quiz]              │
  ├──────────────────────────────────────────────────────────────────┤
  │ Generated draft (fully editable before saving):                  │
  │ Q1. What is the main idea of skimming?         [↻] [✏️] [🗑️]     │
  │     ● A. Reading quickly for gist  ○ B. …  ○ C. …  ○ D. …        │
  │     Explanation: Skimming targets the general idea…              │
  │ Q2. True/False: Skimming means reading every word.   [↻] [✏️]    │
  │ ⚠️ AI can make mistakes — verify each answer key before saving.  │
  │ [↻ Regenerate question]         [Discard] [Open in Quiz Builder] │
  └──────────────────────────────────────────────────────────────────┘
  ```
- **Primary Actions:**
  1. Pick the source lesson (pre-filled when opened from a lesson), question count, types, and difficulty.
  2. Generate the draft quiz and review each question — edit inline, regenerate a single question, or delete it.
  3. Send the reviewed draft into the Quiz Builder for scoring settings and attachment.
- **Data Displayed/Modified:** Writes `ai_generation_jobs`; on accept, writes `quizzes`/`quiz_questions`/`quiz_options` via [S-2.8](#scr-2-8) in **draft** state.
- **States:**
  - **No Source Content:** "This lesson needs at least 200 words of content to generate a quiz." with a link to edit the lesson.
  - **Generating:** Shimmer placeholder for N questions; "Cancel" aborts cleanly.
  - **Generated:** Editable question cards; per-question Regenerate keeps the rest untouched.
  - **Partial Failure:** Regenerate failed questions individually; accepted questions persist.
  - **Accepted:** Hands off to [S-2.8](#scr-2-8) Quiz Builder with the draft loaded.
- **Validation & Feedback:**
  - Every generated question must keep exactly one marked correct answer before it can be saved (same rule as manual authoring).
  - Drafts are labeled "✨ AI-drafted, reviewed by {author}" for provenance in the audit trail ([S-6.8](08-Settings.md#scr-6-8)).
- **Navigation:**
  - Opened from [S-2.7](#scr-2-7) Lesson Editor ("✨ AI Quiz") and [S-2.8](#scr-2-8) Quiz Builder ("✨ AI Draft")
  - "Open in Quiz Builder" → [S-2.8](#scr-2-8) Quiz Builder (draft loaded, quiz not yet attached)
