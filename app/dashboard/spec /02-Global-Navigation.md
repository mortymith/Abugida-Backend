# A. Global Navigation Shell

> **Abugida Academy — UX Design Specification** · Part 02 of 11 · [↑ Overview & Sitemap](00-Overview-and-Sitemap.md) · [← Authentication & Onboarding](01-Authentication-and-Onboarding.md) · [Dashboard →](03-Dashboard.md)

## What changed in Part 02 (Revision 3)

- **The role list and the matrix now agree.** The wireframe omitted **Analytics** while Primary Actions listed it; the sidebar list and the wireframe are identical. A nav-item → capability table makes "who sees what" checkable instead of implied.
- **Support is explicit:** Support sees **Students** and **no** course-authoring item at all, and revenue is redacted server-side per Part 11.
- **The shell now owns the keyboard baseline** for all 73 screens: skip-to-content is the first focusable element, `aria-current="page"` on the active item, an accessible name at **every** width including the 64px collapsed state, and a labelled search that is reachable without `⌘K`.
- **Resume authoring gained conflict rules** — it hides itself when the course is archived, deleted, or the user lost `course.manage_curriculum`; it never appears for a Viewer; it falls back to the course Overview when the last-edited item is gone.
- **Badge rules are deterministic:** cap `99+`, exclude archived submissions, drop decided or stale work on the next poll, and refresh **on focus**, not on a timer.
- **Breadcrumb truncation is Ge'ez-safe:** single-line `text-overflow` with `title` _and_ `aria-label` carrying the full value; the full title is the link's accessible name; nothing truncates below 40 characters of growth headroom.
- New **Resilience**, **Responsive**, **Keyboard & Focus**, and **Instrumentation & acceptance** blocks per [Part 11](11-Global-Standards.md#success-criteria--instrumentation).

## What changed in Part 02 (Revision 2)

- Breadcrumbs are **workspace-aware**: `Courses / <course> / <tab>`, and inside the Curriculum tab they extend to the selected item.
- The Courses nav badge counts pending review work across **curriculum items and whole courses**, and clicking it lands on the queue filtered to the current user.
- The header "Create Course" split button drops one entry (the wizard) and gains **Resume authoring**, which returns to the course the user last had open.
- The Reviewer role sees a **Review** nav item; Support sees **Students** without course access.

<a id="scr-a-1"></a>

##### Screen Name: S-A.1 Main App Shell 🔄 CHANGED

- **Purpose:** The persistent container providing global navigation via a fixed left sidebar and a top header with search, breadcrumbs, and quick actions. Visible to every authenticated user; individual menu items and page actions are shown or hidden according to the signed-in [role](11-Global-Standards.md#roles--permissions-matrix).
- **User Role(s):** Admin, Editor, Reviewer, Viewer, Support — per workspace, one role at a time; a user in several workspaces switches role context with them.
- **Wireframe Layout (Text-Based):**
  ```
  +------------------+--------------------------------------------------+
  | Fixed Sidebar     | Top Header (Fixed, 64px height)                   |
  | (Dark Theme,      | +------+  +--------------------------+  +--------+ |
  | 240px width)      | | Menu |  | Breadcrumb:              | |🔍  👤 | |
  |                   | +------+  | Courses / TOEFL / Course  | |Search | |
  | Logo + "Abugida"  |           |                          | |  ⌘K   | |
  |-------------------|           | Search Bar (Global)      | |Avatar | |
  | 🏠 Dashboard      +-----------+--------------------------+-----------+
  | 📚 Courses    (3)  | Main Content Area                              |
  | 📁 Media| (Scrollable; workspace header stays pinned)   |
  | 👨‍🎓 Students        |                                               |
  | ✅ Review     (2)  |                                               |
  | 📈 Analytics      |                                               |
  | 📣 Marketing      |                                               |
  | ⚙️ Settings       |                                               |
  |-------------------|                                               |
  | [Username]        |                                               |
  | Logout            |                                               |
  +------------------+-----------------------------------------------+
  ```
- **Nav Item → Capability Map.** This table is the contract: an item a role cannot use is **absent** from the sidebar, never disabled (Part 11 three-case rule).

  | Nav item           | Granted by                                                        | Admin | Editor                | Reviewer       | Viewer         | Support                    |
  | ------------------ | ----------------------------------------------------------------- | ----- | --------------------- | -------------- | -------------- | -------------------------- |
  | **Dashboard**      | any workspace member                                              | ✔     | ✔                     | ✔              | ✔              | ✔                          |
  | **Courses**        | `courses.read`                                                    | ✔     | ✔                     | ✔              | ✔              | ✖ absent                   |
  | **Media**          | `assets.read`                                                     | ✔     | ✔                     | ✔              | ✔              | ✔                          |
  | **Students**       | `students.read`                                                   | ✔     | ✔                     | ✔              | ✔              | ✔                          |
  | **Review** (badge) | `course.review`                                                   | ✔     | ✖ absent              | ✔              | ✖ absent       | ✖ absent                   |
  | **Analytics**      | any module with data + `finance.view_revenue` for the revenue tab | ✔     | ✔ (revenue view only) | ✔ (no revenue) | ✔ (no revenue) | ✖ absent                   |
  | **Marketing**      | `marketing.write`                                                 | ✔     | ✔                     | ✔              | ✔              | ✔ (no send, no financials) |
  | **Settings**       | `settings.write` (Admin only)                                     | ✔     | ✖ absent              | ✖ absent       | ✖ absent       | ✖ absent                   |
  | **New Course ▾**   | `course.create`                                                   | ✔     | ✔                     | ✖ absent       | ✖ absent       | ✖ absent                   |
  - **Support:** sees **Students** (plus Dashboard, Media, Marketing read-only) and **no course-authoring nav item at all** — not Courses, not New Course. Its grant is `students.read`, `students.message`, `courses.read_enrolled_context`, `assets.read`, `testimonials.moderate`, `audit.read_own_actions`. **Revenue is redacted server-side**, so the Analytics revenue tab renders an explanation, not a disabled chart.
  - **Reviewer** sees Courses, Media, Students, Review, Analytics, Marketing; **no New Course** and no Settings.
  - **Viewer** sees everything read-only; the whole New Course control is **absent** rather than disabled.
  - Roles are resolved **per workspace** by `_app/route.tsx` `beforeLoad`; the nav is rebuilt on workspace switch and never merges a second workspace's grants.

- **Primary Actions:**
  1. Navigate between modules (Dashboard, Courses, Media, Students, Review, Analytics, Marketing, Settings) — the sidebar list and the map above are the same set.
  2. Global search for courses, curriculum items, students, and assets.
  3. Quick-create via the header "New Course" split button; **Resume authoring** returns to the last-opened course workspace.
  4. Access user profile and logout.
- **Data Displayed/Modified:** None directly. The active module displays its own data. The Review badge reads the pending review count. Sidebar collapse state and last-opened course are user preferences.
- **States:**
  - **Sidebar Collapsed:** Toggle to 64px width (icons only); the choice persists per user. **Every item keeps an accessible name at this width** — tooltips are not announced, so each item carries a visually-hidden label plus `aria-label` at all widths.
  - **Active Module:** Highlighted sidebar item carrying `aria-current="page"`, on `--color-primary` `#7c3aed` per the [Status Colour Mapping](11-Global-Standards.md#status-colour-mapping) reservation that purple is never a status. Active state is never colour alone — the item also takes a left rail marker and a bolder weight.
  - **Courses Badge:** A count of open review submissions — items **and** courses — for the signed-in user. Deterministic rules:
    | Rule                 | Behaviour                                                                                                                                                     |
    | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
    | **Cap**              | Renders `99+`; the exact count is in the accessible name and on the queue screen                                                                              |
    | **Exclusions**       | Archived submissions are **excluded** — they are decisions already taken                                                                                      |
    | **Decay**            | A submission that becomes stale, or is decided in another tab or on mobile, **drops out on the next poll**                                                    |
    | **Refresh**          | On **focus** (window `focus`, and on returning to the tab), plus once at load — **not on a fixed interval**. A 15-minute timer never runs in a background tab |
    | **Zero**             | No badge is rendered at all; the item is still present                                                                                                        |
    | **Mixed assignment** | Hover and `title` read _"2 of 5 assigned to you"_                                                                                                             |
  - **Review Nav Item:** Visible to Admin and Reviewer only. Hidden entirely for other roles rather than disabled, per the permission-aware UI rule. Reviewers with authored-but-unapproved work see the **"Yours — awaiting another reviewer"** self-approval guard in the queue, not a blocked badge.
  - **Workspace Breadcrumb:** Outside a workspace the breadcrumb is `Courses` / `Media` / etc. Inside a workspace it is `Courses / <course title> / <tab>`, and inside the Curriculum tab with an item selected, `Courses / <course> / Curriculum / <item title>`. The tab segment is **not** a link to the last-visited tab; it is a dropdown of the five workspace destinations, which makes switching tabs reachable without scrolling back to the nav row.
    - **Ge'ez truncation:** the course and item segments truncate with CSS `text-overflow: ellipsis` on a **single line** — never a fixed-px line clamp and never a middle-ellipsis string. The full value is carried by **both** `title` and `aria-label`, and the link's **accessible name is the full title** so truncation is purely visual. No segment is constrained below **40 characters of growth headroom** for Amharic, per Part 11: Ge'ez is shorter in characters but wider in glyphs, and growth of 30–40% must not clip.
  - **Resume Authoring:** Shown when the user has a course open in another tab or was last editing within the last **7 days**: "Continue in {course}" → [S-2.6](04-Courses.md#scr-2-6) at the tab and item they left. Conflict rules:
    | Condition                                                            | Behaviour                                                                                          |
    | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
    | Course **archived**                                                  | **Hidden.** There is nothing to resume into.                                                       |
    | Course **deleted**                                                   | **Hidden**, and the stale preference is cleared.                                                   |
    | User lost `course.manage_curriculum` (role change)                   | **Hidden.** Resume is an authoring affordance, not a read affordance.                              |
    | User is a **Viewer**                                                 | **Never shown**, under any condition.                                                              |
    | Last-edited **item** was archived or deleted                         | Falls back to the course **Overview** and says so: _"That lesson was archived. Opening {course}."_ |
    | Last-edited **item** moved to another course, or the section changed | Falls back to the course Overview rather than a dangling `item=` param that would 404.             |
    | > 7 days since last edit                                             | Hidden; the preference is retained so re-entry is still one click.                                 |
  - **Active Workspace:** the workspace name is the **leftmost header element, before the breadcrumb**, because it scopes everything below it. A `button` with `aria-haspopup="menu"` and `aria-expanded`, opening [S-13.2](13-Identity-and-Workspaces.md#scr-13-2) via `⌘/Ctrl+Shift+O`. **Absent entirely** when the user belongs to exactly one workspace — there is nothing to switch to, so it is never a disabled control (Part 11 three-case rule, case 1). Switching reloads every screen against the new scope and announces the destination in a polite live region. On mobile the workspace name is the first row of the drawer, above the nav items.
  - **Role Badge:** the current user's **member role for the active workspace** appears beside the workspace name as a text pill — not colour-coded, per the [Status Colour Mapping](11-Global-Standards.md#status-colour-mapping). Roles are workspace-scoped, not a property of the user: the same person is an Admin in one workspace and a Reviewer in another, so the badge is context. It reflects the **member role only**; per-course roles are shown on the course, never in the shell. See [Part 13](13-Identity-and-Workspaces.md#the-two-role-systems).
  - **Search:** the input has a programmatically associated `<label>` (visually hidden is acceptable), `type="search"`, and a `⌘K` / `Ctrl+K` hint chip **plus a visible labelled Search button** — Android and keyboard-only users have no `⌘K`, and a shortcut is never the only route to an action. The chip is `aria-hidden`; the button carries the real name. Opening search expands a dropdown of recent results including curriculum items with their section path. Ge'ez queries tokenize as 2-syllable n-grams (Part 11), so `እንግሊዝ` matches `እንግሊዝኛ`. **Search is scoped to the active workspace** and the result header names it, because the same course title can exist in two workspaces.
  - **Avatar Menu:** A `button` with `aria-haspopup="menu"` and `aria-expanded`, opening a `role="menu"` of My Profile, Settings (Admin only), **Switch workspace** (only when the user belongs to more than one — absent otherwise, matching the header button), Sign out. The menu item **never appears for a single-workspace user**; the two entry points are governed by the same rule so they never disagree.
  - **Offline:** the shell renders fully from cache with a persistent banner; navigation works, writes queue.
  - **Session Expiry Warning:** the 2-minute modal is owned by the shell and lists the surfaces with unsaved work.
  - **Responsive (Mobile):** Sidebar becomes a slide-out drawer with a focus trap and `Esc` to close; the workspace nav becomes a horizontally scrollable tab strip.
- **Resilience:**
  - **403 on the current route:** renders the **Forbidden** state **inside the shell** — the sidebar, header, and breadcrumb stay mounted, so the user can navigate somewhere they are allowed to go. _"You don't have access to {resource}."_ plus a request ID and **Ask an Admin for access**. A 403 never logs the user out and never blanks the shell.
  - **404:** _"This course was deleted, or you followed an old link."_ with **Back to {module}** and a request ID, rendered in the same in-shell region.
  - **Offline:** the shell is cached and renders fully; a **persistent banner** (never a toast) reads _"You're offline. Showing saved content."_ Reads come from cache, **writes queue** per the autosave contract, and the queue depth is shown inline: _"3 changes waiting to sync."_ Mutations that cannot be queued (payments, role changes) render **disabled with a reason** rather than failing silently.
  - **Reconnected:** queued writes flush **in order**. A queued write whose `rowVersion` is stale resolves to **Conflict**, never a silent overwrite. The banner becomes _"Back online — syncing…"_ then clears.
  - **Session expired:** a 2-minute warning modal lists surfaces with unsaved work. On expiry the **buffer is preserved** and the user returns to the same screen after re-authentication, with the shell and its scroll position intact.
  - **Conflict / partial failure:** surfaced by the content region, not the shell; the shell never swallows a child surface's conflict.
  - **Server error:** a retry affordance with a request ID in the product's voice — _"We couldn't load your navigation — your work is safe."_ The sidebar keeps whatever roles it already knows, so a failed nav fetch does not empty the menu.
  - **No dirty buffer of its own:** the shell owns no form state, so it never needs a flush of its own — it does trigger the flush of any child surface before a route change.
- **Keyboard & Focus:** This shell is the **baseline every screen inherits**.
  - **Skip to content** is the **first focusable element in the DOM**, visible on focus, targeting the `#main` region's `tabindex="-1"`. It is the first stop on every page.
  - The sidebar is `role="navigation"` with `aria-label="Primary"`; the mobile drawer uses `aria-label="Primary"` too so the name never changes with layout.
  - The active item carries `aria-current="page"`. Items are `↑`/`↓` navigable within the nav; `Enter` activates; `Home`/`End` jump to the ends.
  - **The collapsed 64px state still exposes an accessible name.** Tooltips are not announced by screen readers, so every item carries a visually-hidden label plus `aria-label` **at all widths** — expansion is a visual change only.
  - Collapse toggle: a `button` with `aria-expanded` and `aria-controls`; `Esc` inside the mobile drawer closes it and returns focus to the Menu button.
  - **Avatar menu:** `button` with `aria-haspopup="menu"` and `aria-expanded`; `Esc` closes it and **returns focus to the trigger**; `↑`/`↓` move between items, `Enter` activates, and focus returns to the trigger on any close.
  - **Breadcrumb** is an `<ol>` (ordered list) with `aria-current="page"` on the last crumb; intermediate crumbs are links, the last is text. The tab dropdown is a `button` + `aria-expanded` disclosure, not a link.
  - **Search** has a programmatically associated label; `⌘K`/`Ctrl+K` opens the palette from anywhere including the item editor, and the visible **Search** button is the equivalent for everyone else.
  - Focus on arrival: a client-side navigation moves focus to the `<h1>` of the new screen and announces the route in a polite live region (Part 00 cross-screen contract). A 403 or 404 in the content region takes focus, and the shell chrome does not.
  - `Esc` closes the topmost dismissible layer only — drawer, menu, then search dropdown — and never exits the app.
- **Navigation:**
  - Sidebar item → module root
  - Search → [S-1.3](03-Dashboard.md#scr-1-3) Global Search Results
  - "New Course ▾" → New: [S-2.2](04-Courses.md#scr-2-2) · Template: [S-2.12](04-Courses.md#scr-2-12) · AI: [S-2.11](04-Courses.md#scr-2-11) · Bulk import: [S-2.13](04-Courses.md#scr-2-13)
  - Courses badge / **Review** nav item → [S-2.14](04-Courses.md#scr-2-14) Approval Queue, filtered to the signed-in reviewer
  - Resume authoring → [S-2.6](04-Courses.md#scr-2-6) at the last tab and item, or the Overview when that item is gone
  - Workspace breadcrumb → [S-2.1](04-Courses.md#scr-2-1) / the five workspace tabs
  - Avatar → [S-6.5](08-Settings.md#scr-6-5) My Profile, [S-6.1](08-Settings.md#scr-6-1) Settings, Logout
  - `⌘K` / `Ctrl+K`, or the visible Search button → [S-7.5](09-Shared-Components.md#scr-7-5) Command Palette, from anywhere including the item editor
  - "Ask an Admin for access" (403) → [S-7.4](09-Shared-Components.md#scr-7-4) Help & Support Panel
- **Instrumentation & acceptance:**
  - **Events:** `nav.item_activated{item}` · `nav.search_opened{surface}` · `nav.palette_opened{trigger}` · `nav.workspace_switched{from,to}` · `nav.resume_clicked{course, fallback}` · `nav.sidebar_toggled{state}` · `nav.offline_banner_shown{duration}` · `nav.session_expiry_warning_shown{surfaces_count}` · `nav.queue_depth_changed{depth}`.
  - **Criteria:** (1) The skip link is the first Tab stop on every authenticated route. (2) Every sidebar item has a non-empty accessible name at 240px **and** 64px. (3) The active item exposes `aria-current="page"`. (4) No item visible in the wireframe is missing from the capability map, and no mapped item is missing from the wireframe. (5) `Esc` closes the avatar menu and returns focus to its trigger. (6) A 403 on the active route leaves the sidebar and header mounted and interactive.
  - **Budgets:** shell first paint < 1.0 s (cached chrome < 200 ms); nav interaction INP < 200 ms; badge refresh on focus returns within 500 ms; the shell's own JS < 120 kB gzipped.
