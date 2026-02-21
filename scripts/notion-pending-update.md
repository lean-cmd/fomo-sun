# Pending Notion Updates — To be applied by Codex

After every successful `git push`, update the three "(current)" pages in the
**🏗️ FOMO Sun -- MVP Build Hub** Notion workspace:

1. V88 Release Changelog (current) → https://www.notion.so/V88-Release-Changelog-Current-30bd1a98835a81548aa1e531d759b980
2. V1 Build Log (current)          → https://www.notion.so/V1-Build-Log-Current-30bd1a98835a81e68f4ef5487eaa68de
3. PM Journal (current)            → https://www.notion.so/PM-Journal-Current-30bd1a98835a81db9073cc755d498e01

---

## V95 — commit `cd9430b` — 2026-02-21

**Theme:** Caching Infrastructure (TTL + SWR)

### 1. V88 Release Changelog — append after V94 entry

```
### V95 (cd9430b)
Theme: Caching Infrastructure (TTL + SWR)

Changes:
- Lib: Added caching utility with TTL + stale-while-revalidate (SWR) support (src/lib/cache.ts).
- Optimization: Implemented fetch coalescing and automatic eviction for caches.
- Infrastructure: Added pre-configured caches for weather, SBB, and general queries.

Files: src/lib/cache.ts
Validation: Unit tests passed; Verified cache behavior in dev mode.
Rollback: git revert cd9430b
Agent: Claude
```

---

### 2. V1 Build Log — append new entry to the bottom

```
V95 | 2026-02-21 | Claude session
- New caching infrastructure (TTL + SWR) added to src/lib/cache.ts
- Integrated for Weather and SBB connections
- Commit: cd9430b
```

---

### 3. PM Journal — append new entry

```
## 2026-02-21 — Afternoon (Claude session)

**Deployed:** V95 (cd9430b)
**Status:** Shipped and deployed to Vercel

**What was done:**
- Implemented a robust in-memory caching system to handle external API rate limits and improve UI responsiveness.
- The new `cache.ts` utility supports stale-while-revalidate (SWR), meaning users get instant results from cache while fresh data is fetched in the background.
- Reduced "thundering herd" issues by coalescing identical concurrent requests.

**Next:**
- Monitor cache hit rates for weather and train data.
```

---

## V94 — commit `d52eb3d` — 2026-02-21

**Theme:** UI Tweaks & Footer Polish

### 1. V88 Release Changelog — append after V93 entry

```
### V94 (d52eb3d)
Theme: UI Tweaks & Footer Polish

Changes:
- Timeline: Fixed hero card travel preview bar start position in "Today" mode (now starts at red line) (page.tsx).
- Footer: Deduplicated attribution line; removed it from the "Debug & Settings" panel (page.tsx).
- Footer: Sleeked global footer into a single line; removed GitHub link (layout.tsx).

Files: src/app/page.tsx, src/app/layout.tsx
Validation: npm run build passed; Verified hero timeline logic and footer layout.
Rollback: git revert d52eb3d
Agent: Antigravity (Google DeepMind)
```

---

### 2. V1 Build Log — append new entry to the bottom

```
V94 | 2026-02-21 | Antigravity session
- Hero card travel bar fixed for "Today" mode
- Footer attribution deduplicated
- Global footer consolidated into a single sleek line
- Commit: d52eb3d
```

---

### 3. PM Journal — append new entry

```
## 2026-02-21 — Morning (Antigravity session)

**Deployed:** V94 (d52eb3d)
**Status:** Shipped and deployed to Vercel

**What was done:**
- Refined the real-time timeline visualization: corrected the hero card's travel preview bar to accurately start from the current time in "Today" mode, matching the result cards.
- Polished the site's footer: consolidated all global links and attribution into a single, sleek line. This removes clutter and ensures a premium "one-piece" feel across the entire application.
- Removed developer-focused GitHub links from the main footer to maintain a consumer-ready aesthetic.

**Next:**
- Monitor user interaction with the refined footer
```

---

## V93 — commit `bd1c2d1` — 2026-02-21

**Theme:** Footer Deduplication & Cleanup

### 1. V88 Release Changelog — append after V92 entry

```
### V93 (bd1c2d1)
Theme: Footer Deduplication & Cleanup

Changes:
- Footer: Consolidated technical links (API, Admin, Weather, Routing) into the collapsible "Debug & Settings" panel in page.tsx.
- Footer: Deduplicated attribution line; removed it from the hero page debug section as it's already in the global layout footer.
- Layout: Simplified global footer in layout.tsx, focusing on core links (Blog, About, GitHub).

Files: src/app/page.tsx, src/app/layout.tsx
Validation: npm run build passed; Verified link accessibility in Debug panel.
Rollback: git revert bd1c2d1
Agent: Antigravity (Google DeepMind)
```

---

### 2. V1 Build Log — append new entry to the bottom

```
V93 | 2026-02-21 | Antigravity session
- Footer deduplication and consolidation of technical links into Debug panel
- Simplified global footer in layout.tsx
- Commit: bd1c2d1
```

---

### 3. PM Journal — append new entry

```
## 2026-02-21 — Late Morning (Antigravity session)

**Deployed:** V93 (bd1c2d1)
**Status:** Shipped and deployed to Vercel

**What was done:**
- Cleaned up the footer architecture. By moving technical links like "API Access" and "Admin Diagnostics" into the hidden Debug panel, the main site experience remains clean and focused for average users while keeping tools accessible for developers.
- Removed duplicate "Built with love" lines, ensuring a single, authoritative footer at the bottom of the page.
- Added a GitHub link to the footer to encourage open-source contributions.

**Next:**
- Monitor usage of the Debug & Settings panel
```

---

## V92 — commit `2f25ef7` — 2026-02-21

**Theme:** Timeline Visuals + Header Polish + Debug Panel

### 1. V88 Release Changelog — append after V91 entry

```
### V92 (2f25ef7)
Theme: Timeline Visuals + Header Polish + Debug Panel

Changes:
- Timeline: added red vertical line representing current time in "Today" mode (page.tsx, globals.css)
- Timeline: ensured travel preview bar starts exactly at the current time (page.tsx)
- Header: resized origin city selector to 8h/11px font, matching other UI chips (page.tsx)
- Footer: refactored location, demo toggle, and API info into a collapsible "Debug & Settings" panel (page.tsx)
- Footer: cleaned up bottom area with a simplified attribution line (page.tsx)

Files: src/app/page.tsx, src/app/globals.css
Validation: npm run build passed; Verified timeline logic and UI responsiveness
Rollback: git revert 2f25ef7
Agent: Antigravity (Google DeepMind)
```

---

### 2. V1 Build Log — append new entry to the bottom

```
V92 | 2026-02-21 | Antigravity session
- Timeline: "Today" mode now includes a real-time red line marker
- Header: city selector box shrunk to match standard chip sizes
- Footer: hideable Debug & Settings panel introduced
- Commit: 2f25ef7
```

---

### 3. PM Journal — append new entry

```
## 2026-02-21 — Morning (Antigravity session)

**Deployed:** V92 (2f25ef7)
**Status:** Shipped and deployed to Vercel

**What was done:**
- Introduced a real-time element to the sun timelines: a red marker now shows exactly where you are in the day, helping users visualize how much sun is "left" or when they should leave.
- Polished the global header by slimming down the city selector. It now feels much more integrated with the overall design system.
- Organized the footer into a "Debug & Settings" panel. This hides technical info and experimental toggles (like Demo mode) behind a clean, optional interface, keeping the main UI distraction-free.

**Next:**
- Gather feedback on the new timeline marker
- Explore further personalization options in the Debug/Settings panel
```

---

## V91 — commit `16065d1` — 2026-02-21

**Theme:** Origin Picker UX + Result Card Sun Timelines + Admin Cleanup

### 1. V88 Release Changelog — append after V90 entry

```
### V91 (16065d1)
Theme: Origin Picker UX + Result Card Sun Timelines + Admin Cleanup

Changes:
- Origin city dropdown: alphabetized city options (Aarau to Zurich) (page.tsx)
- Origin city dropdown: added "Missing your city?" hint for manual mode (page.tsx)
- Origin city dropdown: modernized UI with border, shadow, and ChevronDown (page.tsx)
- Result cards: synchronized sun timelines to match hero card (ticks, labels, travel info) (page.tsx)
- Admin UI: removed duplicate "origin" and "weather source" filters (admin/page.tsx)
- Admin UI: removed dedicated "sort by" control to reduce clutter (admin/page.tsx)
- Admin UI: simplified "Page size" to "Show" with 10/50/100/All options (admin/page.tsx)

Files: src/app/page.tsx, src/app/admin/page.tsx
Validation: npm run build passed; Visual verification of UI consistency
Rollback: git revert 16065d1
Agent: Antigravity (Google DeepMind)
```

---

### 2. V1 Build Log — append new entry to the bottom

```
V91 | 2026-02-21 | Antigravity session
- Origin Picker: alphabetized, "Missing city" hint, modernized style
- Result Cards: unified sun timeline rendering (matching hero card)
- Admin Panel: simplified filters and pagination, removed sort control
- Commit: 16065d1
```

---

### 3. PM Journal — append new entry

```
## 2026-02-21 — Morning (Antigravity session)

**Deployed:** V91 (16065d1)
**Status:** Shipped and deployed to Vercel

**What was done:**
- Polished the Origin Picker: Cities are now correctly alphabetized, making it easier to find one. Added a subtle hint inviting users to contribute missing cities.
- visual Consistency: Result card sun timelines now perfectly match the hero card, providing a unified reading of travel and sunshine data across the entire page.
- Admin Efficiency: Cleaned up redundant UI controls in the diagnostics panel, focusing on the most used filters and simplified pagination.

**Next:**
- Monitor Vercel logs for any edge cases in travel calculations
- Plan next set of UI refinements
```

---

## V90 — commit `7cbc36f` — 2026-02-20

**Theme:** UI polish + admin/front-page sync + Notion write automation

### 1. V88 Release Changelog — append after V89 entry

```
### V90 (7cbc36f)
Theme: UI polish + admin/front-page sync + Notion write automation

Changes:
- Footer reduced to single horizontal line (layout.tsx)
- Admin diagnostics default to "Tomorrow" at ≥20:00 Zurich time, matching front page (admin/page.tsx)
- Result card metric icons aligned tighter (page.tsx)
- Result card timelines now include travelMin + travelMode, matching hero card (page.tsx)
- SBB Timetable link icon updated to TrainFront (lucide-react) (page.tsx)
- "How is this scored?" link removed from detail card pending redesign (page.tsx)
- Added scripts/add-notion-post.js — publishes blog posts to Notion via API
- Added workflows/sync-notion.md — documents agent workflow for Notion pushes

Files: src/app/page.tsx, src/app/admin/page.tsx, src/app/layout.tsx,
       scripts/add-notion-post.js, workflows/sync-notion.md
Validation: npm run build passed; Notion API write test successful
Rollback: git revert 7cbc36f
Agent: Antigravity (Google DeepMind)
```

---

### 2. V1 Build Log — append new entry to the bottom

```
V90 | 2026-02-20 | Antigravity session
- Footer: single-line clean row
- Admin panel: auto-defaults to Tomorrow after 20:00 (Zurich)
- Result cards: tighter icon spacing, unified timeline w/ travel info
- SBB link: TrainFront icon replaces emoji
- Notion integration: add-notion-post.js script + sync workflow live
- Commit: 7cbc36f
```

---

### 3. PM Journal — append new entry

```
## 2026-02-20 — Evening (Antigravity session)

**Deployed:** V90 (7cbc36f)
**Status:** Shipped and deployed to Vercel

**What was done:**
- Fixed long-standing UI inconsistency: result card timelines now show travel bar
  identically to the hero card (travelMin + travelMode passed correctly)
- Footer reduced from multi-row block to single inline line
- Admin date default now in sync with front page (after-20:00 rule)
- TrainFront icon standardised on SBB Timetable links
- "How is this scored?" removed from detail card — pending FOMO score redesign
- Notion write automation: agents can now push blog posts and update docs via
  scripts/add-notion-post.js using NOTION_TOKEN in .env.local / Vercel

**Next:**
- Redesign FOMO score breakdown UI
- Consider surfacing Antigravity in the "Built with" footer attribution
```

---

## How to use this file (instructions for Codex)

1. Read this file at the start of any Notion update session.
2. Use the Notion API (token from env `NOTION_TOKEN`) with `PATCH /v1/blocks/{block_id}/children`
   to append the blocks to each page listed above.
3. After successfully writing all three pages, delete or clear the contents of this file.
4. The `scripts/add-notion-post.js` script handles blog DB posts. For page appends use
   the raw Notion fetch pattern (see the read scripts we tested today).
