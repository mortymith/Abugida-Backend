# A. Global Navigation Shell

> **Abugida Academy — UX Design Specification** · Part 02 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Authentication & Onboarding](01-Authentication-and-Onboarding.md) · [Dashboard →](03-Dashboard.md)

<a id="scr-a-1"></a>

##### Screen Name: S-A.1 Main App Shell

- **Purpose:** The persistent container providing global navigation via a fixed left sidebar and top header with search, breadcrumbs, and quick actions. Visible to every authenticated user; individual menu items and page actions are shown or hidden according to the signed-in [role](11-Global-Standards.md#roles--permissions-matrix).
- **User Role(s):** Admin, Editor, Viewer, Support (Single role)
- **Wireframe Layout (Text-Based):**
  ```
  +------------------+--------------------------------------------------+
  | Fixed Sidebar     | Top Header (Fixed, 64px height)                   |
  | (Dark Theme,      | +------+  +-----------------------------------+  +--+
  | 240px width)      | | Menu |  | Breadcrumb: Home / Courses |  |🔍|  |👤|
  |                   | +------+  +-----------------------------------+  +--+
  | Logo + "Abugida"  |       Search Bar (Global)                  | Avatar|
  |───────────────────|──────────────────────────────────────────────┤
  | 🏠 Dashboard      | Main Content Area                           |
  | 📚 Courses        | (Scrollable, light grey/white background)    |
  | 📁 Content Library|                                               |
  | 👨‍🎓 Students      |                                               |
  | 📣 Marketing      |                                               |
  | ⚙️ Settings       |                                               |
  |───────────────────|                                               |
  | [Username]        |                                               |
  | Logout            |                                               |
  +------------------+----------------------------------------------+
  ```
- **Primary Actions:**
  1. Navigate between modules (Dashboard, Courses, Content Library, Students, Analytics, Marketing, Settings).
  2. Global search for courses, students, and assets.
  3. Quick-create via "Create Course" button in header.
  4. Access user profile and logout.
- **Data Displayed/Modified:** None directly. Active module displays its own data.
- **States:**
  - **Sidebar Collapsed:** Toggle to 64px width (icons only) with tooltips on hover.
  - **Active Module:** Highlighted sidebar item with primary purple (#8b5cf6) background.
  - **Responsive (Mobile):** Sidebar transforms to slide-out drawer.
  - **Search Expanded:** Search bar expands with dropdown showing recent results.
- **Navigation:**
  - Sidebar Item Click → Navigate to corresponding module root screen
  - Search → [S-1.3](03-Dashboard.md#scr-1-3) Global Search Results
  - "Create Course" split button → Blank: [S-2.2](04-Courses.md#scr-2-2) · Template: [S-2.12](04-Courses.md#scr-2-12) · AI: [S-2.11](04-Courses.md#scr-2-11) · Bulk import: [S-2.13](04-Courses.md#scr-2-13)
  - Courses nav badge (pending reviews) → [S-2.14](04-Courses.md#scr-2-14) Approval Queue
  - Avatar → User dropdown: [S-6.5](08-Settings.md#scr-6-5) My Profile & Account, [S-6.1](08-Settings.md#scr-6-1) Settings, Logout
