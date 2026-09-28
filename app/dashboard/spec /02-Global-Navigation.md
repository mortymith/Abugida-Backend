# A. Global Navigation Shell

> **Abugida Academy — UX Design Specification** · Part 02 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Authentication & Onboarding](01-Authentication-and-Onboarding.md) · [Dashboard →](03-Dashboard.md)

## What changed in Part 02 (Revision 2)

- Breadcrumbs are **workspace-aware**: `Courses / <course> / <tab>`, and inside the Curriculum tab they extend to the selected item.
- The Courses nav badge counts pending review work across **curriculum items and whole courses**, and clicking it lands on the queue filtered to the current user.
- The header "Create Course" split button drops one entry (the wizard) and gains **Resume authoring**, which returns to the course the user last had open.
- The Reviewer role sees a **Review** nav item; Support sees **Students** without course access.

<a id="scr-a-1"></a>

##### Screen Name: S-A.1 Main App Shell 🔄 CHANGED

- **Purpose:** The persistent container providing global navigation via a fixed left sidebar and a top header with search, breadcrumbs, and quick actions. Visible to every authenticated user; individual menu items and page actions are shown or hidden according to the signed-in [role](11-Global-Standards.md#roles--permissions-matrix).
- **User Role(s):** Admin, Editor, Reviewer, Viewer, Support (one role at a time)
- **Wireframe Layout (Text-Based):**
  ```
  +------------------+--------------------------------------------------+
  | Fixed Sidebar     | Top Header (Fixed, 64px height)                   |
  | (Dark Theme,      | +------+  +--------------------------+  +-----+  |
  | 240px width)      | | Menu |  | Breadcrumb:               | 🔍 | 👤  |  |
  |                   | +------+  | Courses / TOEFL / Curriculum| +-----+  |
  | Logo + "Abugida"  |           |                           |          |
  |-------------------|           | Search Bar (Global)       | Avatar   |
  | 🏠 Dashboard      +-----------+---------------------------+----------+
  | 📚 Courses    (3)  | Main Content Area                          |
  | 📁 Content Library| (Scrollable; workspace header stays pinned) |
  | 👨‍🎓 Students        |                                           |
  | ✅ Review     (2)  |                                           |
  | 📣 Marketing      |                                           |
  | ⚙️ Settings       |                                           |
  |-------------------|                                           |
  | [Username]        |                                           |
  | Logout            |                                           |
  +------------------+----------------------------------------------+
  ```
- **Primary Actions:**
  1. Navigate between modules (Dashboard, Courses, Content Library, Students, Review, Analytics, Marketing, Settings).
  2. Global search for courses, curriculum items, students, and assets.
  3. Quick-create via the header "New Course" split button; **Resume authoring** returns to the last-opened course workspace.
  4. Access user profile and logout.
- **Data Displayed/Modified:** None directly. The active module displays its own data. The Review badge reads the pending review count.
- **States:**
  - **Sidebar Collapsed:** Toggle to 64px width (icons only) with tooltips on hover; the choice persists per user.
  - **Active Module:** Highlighted sidebar item with primary purple (`#8b5cf6`) background, per the [Status Colour Mapping](11-Global-Standards.md#status-colour-mapping) reservation that purple is never a status.
  - **Courses Badge (new):** A count of open review submissions — items **and** courses — for the signed-in user. Zero renders no badge; "assigned to someone else" is distinguished on hover ("2 of 5 assigned to you").
  - **Review Nav Item (new):** Visible to Admin and Reviewer only. Hidden entirely for other roles rather than disabled, per the permission-aware UI rule.
  - **Workspace Breadcrumb (new):** Outside a workspace the breadcrumb is `Courses` / `Content Library` / etc. Inside a workspace it is `Courses / <course title> / <tab>`, and inside the Curriculum tab with an item selected, `Courses / <course> / Curriculum / <item title>`. The course segment truncates in the middle with the full title in a tooltip. The tab segment is **not** a link to the last-visited tab; it is a dropdown of the five workspace destinations, which makes switching tabs reachable without scrolling back to the nav row.
  - **Resume Authoring (new):** Shown when the user has a course open in another tab or was last editing within the last 7 days: "Continue in TOEFL Complete Course" → [S-2.6](04-Courses.md#scr-2-6) at the tab and item they left. Never shown for a Viewer.
  - **Responsive (Mobile):** Sidebar becomes a slide-out drawer; the workspace nav becomes a horizontally scrollable tab strip.
  - **Search Expanded:** The search bar expands with a dropdown of recent results, now including curriculum items with their section path.
- **Navigation:**
  - Sidebar item → module root
  - Search → [S-1.3](03-Dashboard.md#scr-1-3) Global Search Results
  - "New Course ▾" → New: [S-2.2](04-Courses.md#scr-2-2) · Template: [S-2.12](04-Courses.md#scr-2-12) · AI: [S-2.11](04-Courses.md#scr-2-11) · Bulk import: [S-2.13](04-Courses.md#scr-2-13)
  - Courses badge / **Review** nav item → [S-2.14](04-Courses.md#scr-2-14) Approval Queue, filtered to the signed-in reviewer
  - Workspace breadcrumb → [S-2.1](04-Courses.md#scr-2-1) / the five workspace tabs
  - Avatar → [S-6.5](08-Settings.md#scr-6-5) My Profile, [S-6.1](08-Settings.md#scr-6-1) Settings, Logout
  - `⌘K` → [S-7.5](09-Shared-Components.md#scr-7-5) Command Palette, from anywhere including the item editor
