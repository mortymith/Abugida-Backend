# DESIGN.md — Abugida Academy Admin Platform

> Implementation-facing design system for the course-operations workspace.
> Companion to the UX Design Specification (`00`–`11`). Screen behavior lives in those files; **visual and interaction rules live here**. Where this file and the spec disagree, the "Decisions to confirm" section (§15) lists the conflict and the proposed resolution.
> Version 2.0 · Targets: React 19, CSS custom properties, WCAG 2.2 AA

---

## 1. Product Context

An **admin-facing** workspace for running courses: authoring, review/approval, content library, students and cohorts, analytics, marketing, settings. It is not the learner player.

| Role     | Primary jobs                                 | Design implication                                    |
| -------- | -------------------------------------------- | ----------------------------------------------------- |
| Admin    | Configure workspace, team, billing, security | Safe defaults, confirmations, audit visibility        |
| Editor   | Build courses, manage students and campaigns | Dense, fast, keyboard-friendly authoring              |
| Reviewer | Approve / reject lessons, no editing         | Focused queue, clear diff of what changed             |
| Viewer   | Read-only monitoring                         | Disabled controls explain themselves                  |
| Support  | Look up students, message them; no revenue   | Financial data must be absent, not just hidden by CSS |

**Context that shapes design decisions**

- Sign-in is Google or Telegram only. There are no passwords and no password-reset UI.
- The workspace timezone is `Africa/Addis_Ababa`; payments include Telebirr alongside Stripe and PayPal; the product name and audience are built around the Ethiopic (Ge'ez) script. Localization is a **first-class requirement**, not a later add-on (see §10).
- Connectivity varies. Uploads (up to 500 MB) and dashboards must degrade gracefully (see §12).

---

## 2. Design Principles

1. **Clarity over density.** Every screen answers "what do I do next?" within five seconds; secondary metadata is visually muted.
2. **Progressive disclosure.** Advanced controls (unlock rules, workflow, API) sit behind explicit affordances.
3. **One meaning per color, one pattern per interaction.** Destructive = red + confirmation. AI = sparkle marker + editable draft. Money = right-aligned, tabular numerals. Purple means "interactive / brand" and nothing else.
4. **Human-in-the-loop by default.** AI output is labeled, editable, and never applied silently.
5. **Permission-aware, not permission-fragile.** Out-of-role modules are absent; read-only contexts are disabled with a reason.
6. **Never lose work.** Autosave, unsaved-change guards, undo, and recoverable deletes.

---

## 3. Design Tokens

Use **semantic tokens** in components. Palette tokens exist only to define semantic ones.

### 3.1 Brand and neutral palette

```css
:root {
  /* Brand (from spec: #8b5cf6 / #6d28d9) */
  --violet-50: #f5f3ff;
  --violet-100: #ede9fe;
  --violet-400: #a78bfa; /* brand on dark surfaces */
  --violet-500: #8b5cf6; /* brand fill, focus ring, chart, large UI (4.23:1 on white) */
  --violet-600: #7c3aed; /* DEFAULT for buttons + links (white text 5.7:1) */
  --violet-700: #6d28d9; /* hover / pressed (7.1:1) */

  /* AI accent (spec: #a855f7) — see §5.9 for how it is kept distinct from brand */
  --ai-500: #a855f7;
  --ai-100: #f3e8ff;
  --ai-700: #7e22ce; /* text on --ai-100 (5.9:1) */

  /* Slate neutrals */
  --slate-900: #0f172a; /* sidebar surface, primary text */
  --slate-700: #334155;
  --slate-600: #475569;
  --slate-500: #64748b; /* secondary text (4.76:1 on white, 4.55:1 on bg) */
  --slate-400: #94a3b8; /* disabled/archived FILLS only — never text */
  --slate-300: #cbd5e1;
  --slate-200: #e2e8f0; /* hairline borders */
  --slate-100: #f1f5f9;
  --slate-50: #f8fafc; /* app background */
  --white: #ffffff;
}
```

### 3.2 Status colors: fill vs text vs tint

The spec's status hues (`#22c55e`, `#f97316`, `#ef4444`, `#3b82f6`, `#f59e0b`) are **fills only**. On white they measure 2.3, 2.8, 3.8, 3.7 and 2.2:1 respectively, so they fail AA when used as text. Each status therefore has three roles.

| Status       | Fill (icons, dots, bars) | Text (on white)   | Tint bg   | Text on tint      |
| ------------ | ------------------------ | ----------------- | --------- | ----------------- |
| Success      | `#22c55e`                | `#15803d` (5.0:1) | `#dcfce7` | `#15803d` (4.6:1) |
| Warning      | `#f97316`                | `#c2410c` (5.2:1) | `#ffedd5` | `#c2410c` (4.5:1) |
| Danger       | `#ef4444`                | `#b91c1c` (6.5:1) | `#fee2e2` | `#b91c1c` (5.3:1) |
| Info         | `#3b82f6`                | `#1d4ed8` (6.7:1) | `#dbeafe` | `#1d4ed8` (5.5:1) |
| Neutral      | `#94a3b8`                | `#475569` (7.6:1) | `#f1f5f9` | `#475569` (6.9:1) |
| Gold (badge) | `#f59e0b`                | `#b45309`         | `#fef3c7` | `#b45309` (4.5:1) |

### 3.3 Semantic aliases

```css
:root {
  --bg-app: var(--slate-50);
  --bg-surface: var(--white);
  --bg-subtle: var(--slate-100);
  --bg-sidebar: var(--slate-900);

  --text-primary: var(--slate-900);
  --text-body: var(--slate-700);
  --text-muted: var(--slate-500);
  --text-on-brand: var(--white);
  --text-link: var(--violet-600);

  --border-hairline: var(--slate-200);
  --border-input: var(--slate-300);

  --action: var(--violet-600);
  --action-hover: var(--violet-700);
  --action-tint: var(--violet-50);
  --focus-ring: var(--violet-500); /* 3:1+ against adjacent colors */

  --nav-text: var(--slate-300); /* 12:1 on sidebar */
  --nav-active-bg: var(--violet-600); /* white text 5.7:1 (NOT #8b5cf6 = 4.23:1) */

  --danger-action: #dc2626;
}
```

### 3.4 Status → pill mapping (resolves spec conflict)

| State                      | Pill                  | Icon (never emoji)       |
| -------------------------- | --------------------- | ------------------------ |
| Draft                      | Neutral               | `file-pen`               |
| In Review                  | Info                  | `eye`                    |
| Changes Requested          | Warning               | `message-square-warning` |
| Approved                   | Success (tint)        | `check`                  |
| Published                  | Success (solid)       | `circle-check`           |
| Live (session in progress) | Success + pulsing dot | `radio`                  |
| Archived                   | Neutral (muted)       | `archive`                |
| At risk (student)          | Warning               | `triangle-alert`         |
| Failed / Rejected          | Danger                | `circle-x`               |

Pills are always **icon + label + color**. Emoji (🟣 🟠) are for wireframes only. They render differently per platform and are read inconsistently by screen readers.

### 3.5 Typography

| Style       | Size / LH | Weight | Use                                        |
| ----------- | --------- | ------ | ------------------------------------------ |
| Display     | 28 / 1.2  | 700    | Page titles                                |
| Heading     | 20 / 1.3  | 600    | Card, section, modal titles                |
| Body        | 14 / 1.5  | 400    | Tables, labels, copy                       |
| Body-strong | 14 / 1.5  | 600    | Table headers, emphasized values           |
| Caption     | 12 / 1.4  | 400    | Timestamps, helper text (never below 12px) |
| Mono        | 13 / 1.5  | 400    | IDs, API keys, webhook payloads            |

**Font stacks**

```css
--font-ui: 'Inter', 'Noto Sans Ethiopic', system-ui, -apple-system, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', ui-monospace, Menlo, Consolas, monospace;
```

- `font-variant-numeric: tabular-nums` on all metrics, money, and table numeric columns.
- **Ethiopic script:** Inter has no Ge'ez glyphs, so the fallback (Noto Sans Ethiopic) must be loaded and tested in every component. Use `line-height: 1.6` when the content language is `am`, `ti`, or `gez`, and never clamp heights to a single line with fixed `px`.
- Prose surfaces (lesson preview, email preview) cap at ~75 characters.

### 3.6 Spacing, radius, elevation, z-index

- **Space (4px base):** `4 · 8 · 12 · 16 · 24 · 32 · 48`. Component padding in 8/16/24/32. Between blocks 24; between related controls 8.
- **Radius:** 8px (cards, inputs, buttons) · 12px (modals) · full (pills, avatars).
- **Elevation:** Cards use surface + 1px hairline, **no shadow**. Overlays use three steps:

```css
--shadow-1: 0 1px 2px rgb(15 23 42 / 0.06), 0 1px 3px rgb(15 23 42 / 0.1); /* dropdowns, popovers */
--shadow-2: 0 4px 12px rgb(15 23 42 / 0.12); /* slide-overs */
--shadow-3: 0 16px 40px rgb(15 23 42 / 0.2); /* modals, command palette */
```

- **Z-index:** content 0 · sticky 10 · slide-overs 100 · modals 200 · toasts 300 · command palette 400.

### 3.7 Motion

- 120ms (hover/press), 200ms (dropdown/tooltip), 300ms (modal/slide-over). `ease-out` in, `ease-in` out. All interruptible.
- `prefers-reduced-motion`: replace movement with cross-fade; shimmer becomes a static placeholder; drag-lift becomes an outline.
- AI streaming text is exempt from motion rules but announced politely (§9).

### 3.8 Data-visualization palette (missing from spec)

Dashboards rely on line, bar, horizontal-bar, and pie charts, so a chart palette is required.

| Series | Color     | Notes   |
| ------ | --------- | ------- |
| 1      | `#7c3aed` | Brand   |
| 2      | `#0ea5e9` |         |
| 3      | `#14b8a6` |         |
| 4      | `#f59e0b` |         |
| 5      | `#ec4899` |         |
| 6      | `#64748b` | "Other" |

- Max 6 series; group the rest as "Other".
- Vary marker shape or dash pattern per series so the chart survives grayscale and color-vision differences.
- Use a **sequential single-hue ramp** (violet-100 → violet-700) for heatmaps and drop-off funnels.
- Comparisons ("+23% ↑") use icon + sign + text; never green/red alone. Refund and churn increases are "bad", so direction and sentiment must be separate.
- Every chart has a data-table alternative (spec §Accessibility) and a text summary.
- Pie charts only for ≤ 4 parts summing to 100%; otherwise horizontal bars.

---

## 4. Layout and Responsive Behavior

| Breakpoint | Width     | Behavior                                                      |
| ---------- | --------- | ------------------------------------------------------------- |
| Mobile     | < 640     | Sidebar → drawer; single-column cards; tables → stacked cards |
| Tablet     | 640–1024  | Sidebar icon-only (64px); 2-column grids; charts stack        |
| Desktop    | 1024–1440 | Full sidebar (240px); 3-column grids                          |
| Wide       | > 1440    | Content max-width 1440, centered                              |

- Header height 64px. Page padding 24px. Gutters 24 / 16 / 12.
- **Desktop-first surfaces.** The permission matrix (S-6.9), rule builder (S-4.8, S-6.10), curriculum builder (S-2.6), and quiz builder (S-2.8) are not usable as "stacked cards" on a phone. On mobile they show a read-only summary and a banner: "Open on a larger screen to edit."
- Table density toggle (comfortable 48px rows / compact 36px rows), persisted per user.

---

## 5. Components

Every interactive component defines default, hover, focus-visible, active, disabled, loading, and error states, and is fully keyboard operable.

### 5.1 App shell (S-A.1)

- Sidebar: `--bg-sidebar`, text `--nav-text`, active item `--nav-active-bg` with white text and a 3px leading indicator.
- Items appear only if the role can access the module. Order: Dashboard, Courses, Content Library, Students, Analytics, Marketing, Settings. _(The wireframe omits Analytics; see §15.)_
- Collapsed mode (64px): tooltips appear on **focus as well as hover**.
- Header: breadcrumb, global search (`/` focuses it), **notification bell with count**, "Create Course" split button, avatar menu.
- Sign-out lives in the avatar menu only.

### 5.2 Buttons

| Variant     | Style                                           | Use                           |
| ----------- | ----------------------------------------------- | ----------------------------- |
| Primary     | `--action` fill, white text                     | One per view                  |
| Secondary   | 1px `--border-input`, transparent               | Supporting                    |
| Ghost       | Text only                                       | Toolbars, row actions         |
| Destructive | `--danger-action` fill                          | Always via S-7.1 confirmation |
| AI          | Sparkle icon + `--ai-100` fill, `--ai-700` text | Generate actions              |

Heights: 32 (compact), 40 (default), 48 (touch). Labels are verb-first, sentence case. Loading keeps width and sets `aria-busy`. A disabled button must state why (tooltip and `aria-describedby`).

### 5.3 Forms

- Persistent label above the field; helper text below; error replaces helper with icon and "what's wrong + how to fix".
- Validate on blur and submit; preserve input on error.
- Inputs 40px, 8px radius, 1px `--border-input`; focus = 2px `--focus-ring` outline, 2px offset.
- Sensitive fields (API keys, webhook secrets): masked, copy button, "shown once" pattern, and an audit note.

### 5.4 Data table

- Sticky header, sortable columns (`aria-sort`), row hover, checkbox selection with a contextual bulk-action bar.
- Numeric and money columns right-aligned, tabular figures; currency code always visible.
- Filter chips above the table. Zero-result vs true-empty states follow the spec (§Empty vs Zero-Result).
- Pagination default 25 rows; server-side sort/filter beyond 100 rows.

### 5.5 Status pill and badge card

See §3.4. A pill is 24px tall, 12px text, icon 14px, radius full. Gamification badges (S-4.7) use gold/silver fills with text-safe variants and a visible tier label.

### 5.6 Curriculum builder / sortable list

- Drag handle plus **Move up / Move down** menu items and `Alt+↑/↓` for keyboard reorder. Announce new position via `aria-live`.
- Optimistic reorder; roll back with error toast on failure.
- Inline rename on double-click or `F2`. Each row shows the approval stepper state (§5.10).
- Touch: long-press to lift; still offer the menu alternative.

### 5.7 Dialogs, toasts, empty states, command palette

- **Confirmation (S-7.1):** name the object and consequence ("Delete 'TOEFL Complete' and 234 enrollments?"). Destructive confirmations for high-impact actions require typing the object name. Focus lands on the safe action.
- **Toasts (S-7.2):** `role="status"`, 5s auto-dismiss, pause on hover/focus, "Undo" where reversible. Errors do not auto-dismiss.
- **Empty (S-7.3):** illustration, one sentence, one CTA.
- **Command palette (S-7.5):** `⌘/Ctrl+K`, only shows actions the role permits; z-index 400.

### 5.8 Wizard (S-2.2 – S-2.5)

Stepper with step names (not just numbers), Back is always available, progress autosaves per step, and completed steps can be revisited without losing later data.

### 5.9 AI surfaces

The AI accent (`#a855f7`) is close to the brand violet (`#8b5cf6`), so **hue must not carry the meaning**. AI content is always marked with:

1. the ✨ sparkle icon component plus the text label "AI draft";
2. a 1px dashed `--ai-500` border on the container and an `--ai-100` tint;
3. inline controls: Edit, Regenerate (per item), Accept, Discard.

Streaming output is announced through `aria-live="polite"` once per paragraph (not per token). Nothing AI-generated reaches students until a human accepts it.

### 5.10 Approval stepper

Draft → In Review → Changes Requested → Approved → Published. Reviewers see a change summary (what changed since last approved version) and must add a comment when requesting changes or rejecting. Publication is blocked for non-Approved lessons when gating is enabled, and the blocked state names the lessons.

### 5.11 Rule builder

WHEN / AND / THEN rows, plain-language preview sentence at the bottom, **dry-run count** ("Would affect 142 students") before Save, and a plain-language summary in the audit log.

### 5.12 Drop zone / uploads

Per-file progress, cancel, retry, and **resume after interruption**. Validate type and size (500 MB cap) before upload starts and state the limit up front. Failed files stay in the list with a reason.

---

## 6. Screen-Level Patterns

| Pattern                  | Applied to                | Rule                                                                         |
| ------------------------ | ------------------------- | ---------------------------------------------------------------------------- |
| Overview + drill-down    | S-1.1 → S-5.x             | KPI card click opens the filtered detail; date range persists across screens |
| List + detail slide-over | Students, Assets, Coupons | Keep list context; deep-linkable URL                                         |
| Builder canvas           | S-2.6–S-2.8               | Autosave indicator ("Saved 12:04"), undo/redo, preview                       |
| Settings sections        | S-6.x                     | Left sub-nav, section-level Save, unsaved-change guard                       |
| Approval queue           | S-2.14                    | Sorted by oldest waiting; bulk approve only for low-risk items               |

Map screen IDs (`S-x.y`) to route files and component folders 1:1 so QA and design can cross-reference.

---

## 7. Roles and Permission-Aware UI

- **No access → absent** (nav item, route, command, search result, count). Direct URL access shows a 403 page with "Ask an Admin for access."
- **View only → disabled with tooltip**: "Only Editors and Admins can change this."
- **Support role and revenue:** revenue cards, columns, exports, and API fields are excluded server-side and not rendered. Layouts must reflow when the KPI card is absent.
- Role badge appears in the avatar menu so users know why something is missing.
- Multi-workspace users get a workspace switcher; the active role is displayed per workspace.

---

## 8. Content and Voice

Clear, calm, professional; sentence case; verb-first buttons; explain what happens next.

| Situation       | Do                                                                                  | Don't           |
| --------------- | ----------------------------------------------------------------------------------- | --------------- |
| Save failed     | "We couldn't save your changes. Check your connection; your draft is kept locally." | "Error 500"     |
| Unknown account | "This account isn't linked to any workspace. Ask your Admin to invite you."         | "Access denied" |
| AI output       | "AI draft. Review before publishing."                                               | "Done!"         |
| Destructive     | "Delete 3 lessons? Students lose access immediately."                               | "Are you sure?" |

---

## 9. Accessibility (WCAG 2.2 AA)

- **Contrast:** 4.5:1 text, 3:1 UI. Use the text-safe tokens in §3.2. Brand `#8b5cf6` is **never** used for body-size text or under white text; use `--violet-600` or darker.
- **Focus:** 2px ring, 2px offset, visible on light and dark surfaces; never removed.
- **Targets:** 40×40 minimum on touch (exceeds the 24px WCAG 2.2 floor); ≥ 8px between adjacent targets.
- **Keyboard:** all drag interactions have a non-drag equivalent; modals trap and return focus; skip-to-content link; roving focus in tables and menus.
- **Screen readers:** charts have a data-table alternative; icon-only controls have `aria-label`; async results (imports, campaigns, dry-runs, AI generation) use `aria-live`.
- **Forms:** programmatic labels, `aria-describedby` for help and error, errors announced.
- **Media:** captions on by default; transcript editor (S-3.6).
- **Session safety:** warn before session expiry and keep unsaved drafts (§12); MFA code fields support paste, `autocomplete="one-time-code"`, and screen-reader announcements.
- **Testing:** axe in CI, plus manual keyboard, NVDA/VoiceOver, 200% zoom, and 320px reflow passes per release.

---

## 10. Internationalization and Localization

The product is named for the Ethiopic abugida, so this is core scope.

- **UI language:** externalize all strings from day one. Currently the spec only offers a _course-content_ language selector; decide whether the _admin UI_ is localized (English + Amharic recommended) and add a UI-language preference to S-6.5.
- **Fonts:** Noto Sans Ethiopic loaded (subset, `font-display: swap`); test truncation, wrapping, and table cell heights with Ge'ez text. Avoid `letter-spacing` on Ethiopic text.
- **Currency:** all monetary values carry a currency code. Support **ETB and USD** (wireframes are USD-only today), per-course currency, and Telebirr/bank-transfer amounts. Use `Intl.NumberFormat` with the workspace locale; never hardcode `$`.
- **Dates and time:** workspace timezone `Africa/Addis_Ababa`. Consider an **Ethiopian calendar display option** for dates, schedules, and campaign send times, always with an unambiguous Gregorian fallback in exports and the audit log.
- **Expansion:** allow 30–40% growth; no fixed-width buttons or single-line clamps on labels.
- **Names:** student names may be one word, use Ge'ez script, or have long patronymic chains; do not require first/last split in forms or truncate at 20 characters.
- **Telegram:** users authenticated by Telegram may have no email address. Any UI that assumes an email (invites, receipts, notifications) needs an alternative channel (§12).

---

## 11. Tenant Branding (S-6.4)

Admins can set primary, secondary, and background colors. Guardrails:

- Validate brand colors live: **block or auto-adjust** any primary that gives < 4.5:1 with white text, and show the computed ratio.
- Branding applies to learner-facing surfaces, emails, and certificates. Admin-app status colors, focus ring, and danger colors are **not** tenant-themable.
- Provide a "reset to default" and a preview on real components.

---

## 12. Resilience, Performance, and Safety States

Add these states to each screen's state list; the spec does not currently cover them.

| Situation                | Behavior                                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------- |
| Slow / lost connection   | Non-blocking banner "Offline — changes saved on this device"; queue writes; resume when online |
| Large upload interrupted | Chunked, resumable upload with retry; never restart from 0%                                    |
| Session expiry           | 2-minute warning, re-auth in a modal, draft preserved                                          |
| Concurrent editing       | Show who else is editing; on conflict, offer "Keep mine / Take theirs / Compare"               |
| 403 / 404 / 500          | Dedicated pages with a next action and a request ID for support                                |
| Partial data failure     | Card-level error with retry; the rest of the page still renders                                |
| Autosave                 | Every 60s **and** on blur/step change; visible "Saving… / Saved" state                         |
| Undo                     | Reorders, deletes, bulk actions offer undo for 10s via toast                                   |

**Performance targets:** LCP < 2.5s on mid-tier mobile over 4G; INP < 200ms; route-level code splitting; virtualize lists > 100 rows; lazy-load charts; image and video thumbnails via responsive formats.

**Auth edge cases to design explicitly**

- Email-based invites cannot match Telegram identities. Provide an invite link or code the invitee claims after signing in.
- Provide an account-recovery path when the only Admin loses access (verified support process), plus an MFA reset path.
- Show provider/method used on the profile page and allow linking a second provider.

---

## 13. Implementation Guidance (React 19 / TanStack Start)

1. Define tokens in one CSS file (`tokens.css`); expose semantic tokens to the component layer. Support a future `[data-theme="dark"]` override (spec lists dark mode as future).
2. Route files map to screen IDs (e.g. `courses/$courseId/lessons/$lessonId` ↔ S-2.7) and carry the required roles in route metadata; the same metadata drives nav, command palette, and search visibility.
3. Build shared primitives first: Button, Input, Select, Table, Pill, Dialog, Toast, EmptyState, Skeleton, AIDraftPanel, ApprovalStepper. Use accessible headless primitives (dialog, menu, combobox, tabs) rather than custom widgets.
4. Server-side enforcement for permissions and revenue redaction; UI hiding is a convenience, not security.
5. Icons via a single outline set (20px grid, 1.5px stroke). No emoji in the shipped UI.
6. Loading uses skeletons that match the final layout to avoid layout shift.
7. **Definition of done:** matches tokens; all states (default, loading, empty, zero-result, error, 403, offline) handled; keyboard and screen-reader pass; role matrix verified; strings externalized; Ethiopic text tested; responsive 320–1440.

---

## 14. Governance

Design-system owners review changes via issue with rationale, before/after, and accessibility impact. Semantic versioning (major = breaking token or component change). Quarterly accessibility audit. Track: task completion time for course creation, review turnaround time, publish-blocked rate, support tickets tagged "confusing UI," Lighthouse and axe scores.

---

## 15. Spec Conflict Register

| #   | Issue found in spec                                                                                                                                                                                                                                      | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Status                   | Where it now lives                                        |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ | --------------------------------------------------------- |
| 1   | White text on `#8b5cf6` is 4.23:1 (fails AA) yet the spec targets 4.5:1 and uses it for buttons, links, active nav                                                                                                                                       | Keep `#8b5cf6` as `--color-brand-mark` (focus ring, large UI, chart marks, where 3:1 applies); use `#7c3aed` (5.70:1) for buttons, links, active nav                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | **Resolved**             | Part 11 § Color Palette                                   |
| 2   | Status hues used as text fail contrast (2.2–3.8:1)                                                                                                                                                                                                       | Every status is a **fill / text / tint** triple; all `-text` tokens measured and asserted (success 7.13, warning 7.31, danger 6.47, info 6.70, archived 7.58)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | **Resolved**             | Part 11 § Status Colour Mapping, § Color Palette          |
| 3   | "Published" is purple in the component list but green in the palette; "Live" is also green                                                                                                                                                               | Published = success green; purple reserved for interaction and brand                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | **Resolved**             | Part 11 § Status Colour Mapping                           |
| 4   | Purple is primary action, active nav, Published, and AI, contradicting "one meaning per color"                                                                                                                                                           | AI marked by sparkle + literal "AI draft" label + dashed border (never hue alone)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | **Resolved**             | Part 11 § Status Colour Mapping, Part 12 § AI draft block |
| 5   | S-1.1 lists Support and shows revenue; the matrix says Support has no revenue access. S-1.1 omits Reviewer                                                                                                                                               | Revenue **redacted server-side** for Support with a stated `Restricted` card; Reviewer added to S-1.1                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **Resolved**             | Part 11 § Roles, Part 03 S-1.1                            |
| 6   | S-A.1 lists roles without Reviewer and calls it "Single role," while the matrix says roles are per workspace                                                                                                                                             | Role list reconciled; roles are per-workspace. Support's grant is now explicit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | **Resolved**             | Part 11 § Roles, Part 02                                  |
| 7   | Wireframe sidebar omits Analytics; bell shown "in sidebar" (S-1.4) but "in header" (component list); Logout appears twice                                                                                                                                | Analytics in nav, bell in header, Logout in avatar menu                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | **Resolved**             | Part 02                                                   |
| 8   | Dashboard (S-1.1) is titled "Analytics Overview" while Analytics is a separate module                                                                                                                                                                    | Renamed **Dashboard**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **Resolved**             | Part 03                                                   |
| 9   | Invite mismatch state assumes email, but Telegram may provide none                                                                                                                                                                                       | Claimable invite link (single-use, 7-day) or 8-character code, captured after sign-in. Applies to invites, exports, receipts, warnings, and campaigns                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **Resolved**             | Part 11 § Notification Delivery, Parts 01/06/08/10        |
| 10  | No Ethiopic font, ETB, Ethiopian calendar, or UI localization guidance despite product context                                                                                                                                                           | Noto Sans Ethiopic in the stack, `line-height: 1.6` for `am`/`ti`/`gez`, no line clamps, per-block `lang`, ETB + USD via `Intl.NumberFormat`, Ethiopian-calendar toggle, Ge'ez n-gram search, script-aware read time                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | **Resolved**             | Part 11 § Localization & Formatting                       |
| 11  | 500 MB uploads with no resume behavior; no offline, session-expiry, concurrency, or 403 states                                                                                                                                                           | Resumable upload; a mandatory `- **Resilience:**` block on all 73 screens; three-way conflict resolution everywhere                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **Resolved**             | Part 11 § Resilience States, Part 09 S-7.12               |
| 12  | Dark sidebar exists but dark mode is "future"; focus ring claims dark support                                                                                                                                                                            | Dark **sidebar** tokens defined now; the full dark theme stays deferred and no component claims dark support it lacks                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **Resolved**             | Part 11 § Global Validation                               |
| 13  | Tenant-editable brand colors can break contrast                                                                                                                                                                                                          | Branding sets `--color-primary` and `--color-primary-tint` only, each live-validated to clear 4.5:1 against white text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | **Resolved**             | Part 08 S-6.4, Part 11 § Color Palette                    |
| 14  | Wireframes use emoji as icons and status markers                                                                                                                                                                                                         | **Resolved as originally proposed**: icon components in the build, emoji acceptable in wireframes — _except_ as status colour, where wireframes now use text labels (Part 03 taught the purple-`Published` error)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | **Resolved**             | Part 11 § Localization & Formatting                       |
| 15  | Breakpoints skip common 768 and 1280 tiers                                                                                                                                                                                                               | Accepted as-is; the four tiers cover the layouts the workspace actually needs. Revisit if a real 768px layout appears                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **Resolved (no change)** | Part 11 § Responsive Breakpoints                          |
| 16  | S-7.3 "one sentence, one CTA" contradicts DESIGN.md §5.7 "four equal starting actions"                                                                                                                                                                   | Single-CTA is the **default**; the multi-action variant is permitted only where more than one credible starting path exists, and is named as such                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | **Resolved**             | Part 09 S-7.3                                             |
| 17  | The course lifecycle had four states while the approval stepper had five, and S-2.22 required an "Approved, not yet published" state                                                                                                                     | **Five** states (`Draft → In Review → Approved → Published → Archived`) plus `Unlisted` for unpublish                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | **Resolved**             | Part 04 § Course Lifecycle                                |
| 18  | The settings IA was stated three ways: a 4-tab strip in four wireframes, ten flat routes, and `DESIGN.md` §6's left sub-nav                                                                                                                              | **Left sub-nav** on one `/settings` route, sections deep-linkable, per-section save. The Revision 2 tab strip is retired                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **Resolved**             | Part 08 § Settings IA                                     |
| 19  | Part 12 referenced `--font-ui` / `--font-mono`, which Part 11 never defined                                                                                                                                                                              | Font tokens added: `--font-ui`, `--font-mono`, `--font-measure`, `--leading-script`, `--leading-latin`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | **Resolved**             | Part 11 § Typography                                      |
| 20  | The curriculum tree was resizable at every width in Part 11's spacing rules but an overlay drawer only at tablet in its breakpoints table                                                                                                                | Two presentations: an **overlay drawer below 1024px** (mobile _and_ tablet), inline and resizable 240–480px at ≥ 1024px                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | **Resolved**             | Part 11 § Responsive Breakpoints                          |
| 21  | The spec used "Admin, Editor, Reviewer, Viewer, Support" as if one role system existed. The schema has two — `member.role` (workspace) and `course_roles` (per course) — and `member.role` is a bare text column that cannot express Reviewer or Support | Part 13 is the identity authority. Effective role = union of member role and non-revoked course roles, **capped by** the member role. Member role answers only "may this person change the workspace itself?"                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | **Resolved**             | Part 13 § The Two Role Systems                            |
| 22  | The spec specified claimable-link invites, Telegram delivery, and workspace switching with no storage or session model behind them                                                                                                                       | **GAP-2 — resolved.** The prescribed fix ("make `email` nullable", `spec /13` § Implementation Gaps) is **unsafe**: Better Auth owns `invitation` and dereferences `invitation.email.toLowerCase()` unguarded in `accept-invite`, `reject-invite` and `cancel-invite` (`better-auth/dist/plugins/organization/routes/crud-invites.mjs`). A null email is a `TypeError` — a 500 on a working feature, in prebuilt code our typecheck never sees. **Resolution:** `invitation` is left exactly as Better Auth defines it and a sibling `invite_link` table carries the claimable invite (`token_hash` / `code_hash` digests, `handle` for the no-email case, 7-day single use). GAP-3 (`organizationClient()`) and GAP-4 (`additionalFields.useCase`) remain **open** | **Partly resolved**      | Part 13 § Implementation Gaps; `auth.invite-claim.ts`     |
| 23  | S-0.4 draws the manual authenticator key as `XXXX-XXXX-XXXX` — three groups, and the sample reads `A3F2-B19C-77D4`, 12 characters. A TOTP secret is 32 base32 characters                                                                                 | `XXXX` is a **grouping**, not a length. Printing 12 characters hands the user a key that accepts nowhere and fails silently. The key renders the **full secret in 4-character groups** (`XXXX-XXXX-XXXX-…`); the round-trip `formatManualKey` → `stripKeySeparators` is asserted in `tests/auth.mfa-enrollment.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                                                             | **Resolved**             | Part 01 S-0.4, `auth.mfa-enrollment.ts`                   |

**Precedence.** Where the UX specification and a _resolved_ row above disagree, this table wins. Where this document and the specification disagree on anything not listed here, §1–§14 of this document governs visual and interaction rules, and the specification governs screen behavior — and the disagreement should be added to this table rather than silently resolved in either file.

## Changelog

| Version | Date       | Notes                                                                                                                                          |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 2.1     | 2026-09-29 | All 20 spec conflicts resolved; §15 is now a register with decisions, not a list of open questions. Pairs with UX Specification Revision 3.    |
| 2.0     | 2026-09-28 | Rebuilt around the Abugida Academy admin spec: palette aligned, contrast fixes, chart palette, i18n, resilience states, spec-conflict register |
| 1.0     | 2026-09-28 | Generic educational-platform draft (superseded)                                                                                                |
