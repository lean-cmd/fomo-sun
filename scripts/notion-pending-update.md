# Pending Notion Updates — To be applied by Codex

After every successful `git push`, update the three "(current)" pages in the
**🏗️ FOMO Sun -- MVP Build Hub** Notion workspace:

1. V88 Release Changelog (current) → https://www.notion.so/V88-Release-Changelog-Current-30bd1a98835a81548aa1e531d759b980
2. V1 Build Log (current)          → https://www.notion.so/V1-Build-Log-Current-30bd1a98835a81e68f4ef5487eaa68de
3. PM Journal (current)            → https://www.notion.so/PM-Journal-Current-30bd1a98835a81db9073cc755d498e01

---

## UI Tweaks Build — commit `ui-tweaks` — 2026-02-25

**Theme:** Tabs/Joystick/Header/Footer UI Polish (local-reviewed production draft)

### 1. V88 Release Changelog — append after latest entry

```
### UI Tweaks Build (ui-tweaks)
Theme: Tabs/Joystick/Header/Footer UI Polish (local-reviewed production draft)

Changes:
- Refined Sunny Escapes tabs into a folder-style control connected to the results container; fixed 1px tab/body seam alignment.
- Removed top radius from results box for cleaner tab integration.
- Updated joystick presentation: restored heading/hint, moved max-travel label under control, and removed vertical stick visual.
- Simplified origin city selector (lighter select with chevron) and removed "Missing city? Open a PR" helper text.
- Footer cleanup: line 1 now shows `fomosun.com © 2026 · 1.0.4` on the left with `Blog` + `About` on the right; attribution moved to line 2.
- Debug panel cleanup: removed duplicate About link, made Admin panel entry prominent, and improved control grouping/visual hierarchy.
- Header logo tagline spacing increased by a few pixels for better readability.

Files: src/app/page.tsx, src/app/layout.tsx, src/app/globals.css
Validation: npm run build passed; local production preview validated at :4022
Rollback: git revert ui-tweaks
Agent: Codex (GPT-5)
```

---

### 2. V1 Build Log — append new entry to the bottom

```
UI Tweaks Build | 2026-02-25 | Codex session
- Folder-style travel tabs integrated with results container; seam alignment corrected
- Joystick and city selector visual simplification
- Footer and debug panel cleanup with stronger Admin access
- Header tagline spacing refinement
- Commit: ui-tweaks
```

---

### 3. PM Journal — append new entry

```
## 2026-02-25 — UI Polish Sprint (Codex session)

**Deployed:** UI Tweaks Build (ui-tweaks)
**Status:** Shipped after local production review

**What was done:**
- Tightened tabs-to-results visual connection so the travel buckets read like real folder tabs.
- Simplified key control surfaces (origin select, joystick visuals, debug panel).
- Restructured footer information hierarchy for better legibility and cleaner navigation.
- Promoted Admin access while reducing debug clutter.

**Next:**
- Optional: align filter chips styling to the same folder-tab language for full visual consistency.
```

---

## V104 — commit `57e1fe2` — 2026-02-22

**Theme:** Bucket Integrity + Helpful Long-Drive Warning

### 1. V88 Release Changelog — append after V103 entry

```
### V104 (57e1fe2)
Theme: Bucket Integrity + Helpful Long-Drive Warning

Changes:
- Fixed bucket integrity for explicit travel windows (`travel_min_h`/`travel_max_h`): API no longer falls back to out-of-window rows for ranking.
- Bucket diagnostics metadata now reports correct zero values when a bucket has no matching destinations.
- Updated UI messaging for long-range today case: instead of generic overcast wording, users now get actionable guidance ("Driving this far is not worth it today. Plan for tomorrow.").

Files: src/app/api/v1/sunny-escapes/route.ts, src/app/page.tsx
Validation: npm run build passed; local bucket data checks confirmed long bucket returns 0 rows with count/destination_count=0 when no matches.
Rollback: git revert 57e1fe2
Agent: Codex (GPT-5)
```

---

### 2. V1 Build Log — append new entry to the bottom

```
V104 | 2026-02-22 | Codex session
- Removed out-of-window fallback for explicit travel buckets in API selection
- Fixed bucket meta counts for empty explicit buckets
- Replaced misleading long-range warning with actionable "plan for tomorrow" copy
- Commit: 57e1fe2
```

---

### 3. PM Journal — append new entry

```
## 2026-02-22 — Late Night (Codex session)

**Deployed:** V104 (57e1fe2)
**Status:** Shipped and validated

**What was done:**
- Ran bucket-by-bucket diagnostics and identified that explicit buckets could inherit fallback rows from other ranges.
- Enforced strict explicit bucket behavior so each bucket reflects real travel-time matches.
- Updated long-bucket UX copy to explain that far travel is not worth it today and suggest tomorrow.

**Next:**
- Optional: add per-bucket "matched destinations in range" badge in UI for transparency.
```

---

## V103 — commit `b39556f` — 2026-02-22

**Theme:** Today Timeline Truth + 10% Net-Sun Escape Gate

### 1. V88 Release Changelog — append after V102 entry

```
### V103 (b39556f)
Theme: Today Timeline Truth + 10% Net-Sun Escape Gate

Changes:
- Timeline (today mode): moved travel overlay to the origin bar so travel is visualized where the user starts.
- Timeline (today mode): added a green arrival marker on the destination bar at travel end.
- Net-sun clarity: destination condition text now shows both raw sunshine and net sunshine after travel.
- Eligibility gate: sunny escapes now require at least 10% more net sun than origin (non-admin response path).
- UI consistency: card gain indicators and stay-home fallback checks now compare against net-sun semantics.

Files: src/app/page.tsx, src/app/api/v1/sunny-escapes/route.ts, src/app/globals.css
Validation: npm run build passed; local multi-bucket API checks confirmed all returned rows meet 10% net-sun rule.
Rollback: git revert b39556f
Agent: Codex (GPT-5)
```

---

### 2. V1 Build Log — append new entry to the bottom

```
V103 | 2026-02-22 | Codex session
- Fixed today-mode timeline semantics (travel on origin bar, green arrival marker on destination bar)
- Switched sunny-escape qualification to 10% net-sun advantage vs origin
- Updated API condition strings to include raw + net sunshine after travel
- Commit: b39556f
```

---

### 3. PM Journal — append new entry

```
## 2026-02-22 — Night (Codex session)

**Deployed:** V103 (b39556f)
**Status:** Shipped and validated

**What was done:**
- Reworked today timeline to match user mental model: travel starts at origin and arrives at destination.
- Added destination arrival marker so net-sun window is visually anchored.
- Enforced 10% better-net-sun threshold for true sunny escapes to reduce trust issues.
- Aligned hero/card gain messaging and filtering with net-sun calculation.

**Next:**
- Optional follow-up: add a compact legend (“red = now, green = arrival”) under timeline cards for first-time users.
```

---

## V102 — commit `a5aaaa8` — 2026-02-21

**Theme:** Public Semver Display (1.0.1)

### 1. V88 Release Changelog — append after V101 entry

```
### V102 (a5aaaa8)
Theme: Public Semver Display (1.0.1)

Changes:
- Footer: switched user-facing release label from internal `v101` to semantic version `1.0.1` per Notion roadmap strategy.
- Internal release tracking remains commit-style in engineering logs; public surfaces now follow semver.

Files: src/lib/release.ts
Validation: npm run build passed; local smoke check confirmed footer shows `1.0.1`.
Rollback: git revert a5aaaa8
Agent: Codex (GPT-5)
```

---

### 2. V1 Build Log — append new entry to the bottom

```
V102 | 2026-02-21 | Codex session
- Updated public footer release display to semantic version `1.0.1`
- Aligned with Notion “Versioning after v100” strategy
- Commit: a5aaaa8
```

---

### 3. PM Journal — append new entry

```
## 2026-02-21 — Night (Codex session)

**Deployed:** V102 (a5aaaa8)
**Status:** Shipped and validated

**What was done:**
- Applied Notion versioning strategy in production by switching user-facing version display to `1.0.1`.
- Kept internal v-style release sequencing for agent/dev coordination.
- Confirmed footer output after build/start smoke check.

**Next:**
- Continue publishing public release notes using semver language while retaining internal V-number traceability.
```

---

## V101 — commit `d530c34` — 2026-02-21

**Theme:** Stamp Redesign 2.0 + Footer Versioning

### 1. V88 Release Changelog — append after V100 entry

```
### V101 (d530c34)
Theme: Stamp Redesign 2.0 + Footer Versioning

Changes:
- Stamps: Removed the top color banner and removed visible canton abbreviation badges from stamp artwork.
- Stamps: Rebuilt poster scene renderer to a more classic Swiss tourism-poster look with layered colorful landscapes (sky, ridges, meadows), soft curved forms, and textured print-style grain.
- Stamps: Added context-aware scenic elements (lakes, railways, towns, forest silhouettes, thermal steam, snowcaps) based on destination and tourism metadata, reducing geometric-icon look.
- Versioning: Added centralized release constant (`src/lib/release.ts`) and surfaced the live app version in global footer (`v101`).
- Gallery: Updated gallery copy to reflect scenic poster language.

Research references:
- Notion design language source: Day 4 blog entry (`day-4-vintage-stamps-joystick-soul`) for condensed typography + vintage Swiss poster intent.
- Visual direction checks: Museum für Gestaltung Zürich poster collection and heritage Swiss travel-poster references.

Files: src/components/DestinationStamp.tsx, src/lib/release.ts, src/app/layout.tsx, src/app/admin/stamps/page.tsx
Validation: npm run build passed; local smoke check confirmed footer version and stamp gallery rendering.
Rollback: git revert d530c34
Agent: Codex (GPT-5)
```

---

### 2. V1 Build Log — append new entry to the bottom

```
V101 | 2026-02-21 | Codex session
- Removed top stamp color bar and canton badge label
- Reworked stamps toward scenic Swiss vintage poster compositions (colorful layered landscapes)
- Added feature-driven scene elements: lake, railway, town, forest, thermal steam, snowcaps
- Added centralized release version and footer display (`v101`)
- Commit: d530c34
```

---

### 3. PM Journal — append new entry

```
## 2026-02-21 — Night (Codex session)

**Deployed:** V101 (d530c34)
**Status:** Shipped and validated

**What was done:**
- Read the Notion stamp language notes and aligned the redesign to vintage Swiss tourism poster cues.
- Removed the decorative top strip and canton badge to let the scene itself carry destination identity.
- Shifted stamp visuals away from geometric symbols to layered scenic mini-posters with richer color and travel-place context.
- Added explicit app versioning in the footer so each release is visible in production.

**Next:**
- Curate per-destination manual overrides for iconic outliers (e.g., Matterhorn/Zermatt profile, lake-town skyline signatures).
```

---

## V100 — commit `8bd4bb8` — 2026-02-21

**Theme:** Vintage Stamp Rework + Admin Stamp Gallery

### 1. V88 Release Changelog — append after V99 entry

```
### V100 (8bd4bb8)
Theme: Vintage Stamp Rework + Admin Stamp Gallery

Changes:
- Stamps: Rebuilt `DestinationStamp` into a richer Swiss-vintage poster system with country-specific palettes, deterministic per-destination variation, and canton-aware styling for Swiss destinations.
- Stamps: Added tourism-aware motif selection (lake, thermal, town/castle, rail, forest, alpine) using destination context plus tourism tags/highlights where available.
- Hero card: Passed destination/tourism context into the hero stamp so artwork better matches each place.
- Admin: Added a new `/admin/stamps` gallery route and linked it from Forecast Diagnostics.
- Gallery: Added searchable/paginated stamp browser for all destinations with tourism-source attribution (`discover.swiss` / `geo.admin.ch` / fallback) to inspect design consistency.

Files: src/components/DestinationStamp.tsx, src/app/page.tsx, src/app/admin/page.tsx, src/app/admin/stamps/page.tsx
Validation: npm run build passed; local smoke checks confirmed admin link and `/admin/stamps` rendering.
Rollback: git revert 8bd4bb8
Agent: Codex (GPT-5)
```

---

### 2. V1 Build Log — append new entry to the bottom

```
V100 | 2026-02-21 | Codex session
- Reworked stamps to Swiss-vintage poster style with country + canton-aware variation
- Added tourism-context motif logic so stamps better match destination character
- Added `/admin/stamps` gallery (search + pagination) and linked it from admin diagnostics
- Added tourism-source visibility in gallery cards for design QA
- Commit: 8bd4bb8
```

---

### 3. PM Journal — append new entry

```
## 2026-02-21 — Night (Codex session)

**Deployed:** V100 (8bd4bb8)
**Status:** Shipped and validated

**What was done:**
- Read the stamp-design intent from Notion docs and aligned the implementation to the vintage Swiss poster language: condensed destination title, limited lithograph palette, destination silhouette, and perforated stamp framing.
- Reworked stamp rendering so each destination has deterministic visual uniqueness with stronger country and canton identity.
- Added tourism-aware stamp cues and surfaced a dedicated stamp gallery in admin to review all designs and tourism-data source quality.

**Next:**
- Curate canton-specific motif overrides for known outliers where automated cues still feel generic.
```

---

## V99 — commit `820c778` — 2026-02-21

**Theme:** Weather API Policy Split + Admin Source Controls

### 1. V88 Release Changelog — append after V98 entry

```
### V99 (820c778)
Theme: Weather API Policy Split + Admin Source Controls

Changes:
- API: Split weather control into `forecast_policy` (forecast model) and `origin_snapshot_source` (origin now-condition source), while preserving legacy `weather_source` compatibility.
- API: Added explicit response headers `x-fomo-forecast-policy` and `x-fomo-origin-snapshot-source`; retained `x-fomo-weather-source` as legacy compatibility output.
- Admin: Replaced single weather-source selector with two independent controls (Forecast policy + Origin snapshot) and surfaced both values in diagnostics metadata.
- Diagnostics: Updated scripts/weather-api-diff.mjs to test all source combinations via the new query parameters.

Files: src/app/api/v1/sunny-escapes/route.ts, src/app/admin/page.tsx, scripts/weather-api-diff.mjs
Validation: npm run build passed; local smoke checks confirmed new params and legacy `weather_source` paths.
Rollback: git revert 820c778
Agent: Codex (GPT-5)
```

---

### 2. V1 Build Log — append new entry to the bottom

```
V99 | 2026-02-21 | Codex session
- Split weather policy into forecast_policy + origin_snapshot_source
- Preserved legacy weather_source compatibility path
- Admin diagnostics now has separate Forecast policy and Origin snapshot controls
- Updated weather-api-diff script to use new source matrix params
- Commit: 820c778
```

---

### 3. PM Journal — append new entry

```
## 2026-02-21 — Night (Codex session)

**Deployed:** V99 (820c778)
**Status:** Shipped and validated

**What was done:**
- Removed duplicated weather-source semantics by separating forecast model policy from origin snapshot source.
- Kept backward compatibility for existing consumers still sending `weather_source`.
- Improved admin tuning clarity with independent selectors for forecast and origin source paths.
- Updated the weather comparison script so source-difference checks run against the same split-policy model used in production.

**Next:**
- Monitor `x-fomo-forecast-policy` and `x-fomo-origin-snapshot-source` distributions in admin diagnostics.
```

---

## V98 — commit `1674738` — 2026-02-21

**Theme:** Weather Source Validation + Origin Data Reliability

### 1. V88 Release Changelog — append after V97 entry

```
### V98 (1674738)
Theme: Weather Source Validation + Origin Data Reliability

Changes:
- API: Result pool now excludes destinations with 0 forecast sun minutes for non-admin responses (sunny-escapes route).
- Open-Meteo: Added guardrail in hourly forecast fetch to retry without Swiss model pinning when Swiss-model payload returns all-zero sunshine for both today and tomorrow.
- MeteoSwiss OGD: Fixed station metadata and observation parsing keys to match current CSV schema, enabling meteoswiss_api origin snapshots again.
- Diagnostics: Added scripts/weather-api-diff.mjs to compare openmeteo vs meteoswiss vs meteoswiss_api and run upstream model checks for CH/DE/FR/IT sample sets.

Files: src/app/api/v1/sunny-escapes/route.ts, src/lib/open-meteo.ts, src/lib/swissmeteo.ts, scripts/weather-api-diff.mjs
Validation: npm run build passed; weather-api-diff confirms CH20/DE5/FR5/IT5 consistency checks and source-policy deltas.
Rollback: git revert 1674738
Agent: Codex (GPT-5)
```

---

### 2. V1 Build Log — append new entry to the bottom

```
V98 | 2026-02-21 | Codex session
- Added non-admin 0-sun result exclusion in API ranking pool
- Repaired MeteoSwiss OGD origin parsing (station metadata + observations)
- Added Swiss-model zero-sun fallback guardrail in Open-Meteo hourly fetch
- Added weather source diagnostics script (scripts/weather-api-diff.mjs)
- Commit: 1674738
```

---

### 3. PM Journal — append new entry

```
## 2026-02-21 — Evening (Codex session)

**Deployed:** V98 (1674738)
**Status:** Shipped and validated

**What was done:**
- Ran a structured weather-source validation for tomorrow forecasts on a 35-row sample (CH20, DE5, FR5, IT5).
- Confirmed internal consistency between `tomorrow_sun_hours` and summed `admin_hourly` sunshine minutes (all sampled rows within small rounding deltas).
- Identified and fixed two reliability issues: MeteoSwiss OGD origin parser drift (CSV header mismatch) and Swiss-model all-zero sunshine payloads for origin hourly calculations.
- Added a permanent diagnostics script to reproduce source comparisons and upstream checks.

**Next:**
- Monitor `x-fomo-origin-source` distribution for `meteoswiss_api` requests and keep fallback rates under review.
```

---

## V97 — commit `aa21509` — 2026-02-21

**Theme:** Hero Card Today-Copy Hotfix

### 1. V88 Release Changelog — append after V96 entry

```
### V97 (aa21509)
Theme: Hero Card Today-Copy Hotfix

Changes:
- Hero card headline now reflects selected day focus: "Best escape today" in Today mode and "Best escape tomorrow" in Tomorrow mode.
- Hero supporting text templates now reference the active day focus instead of hardcoded "tomorrow" phrasing.

Files: src/app/page.tsx
Validation: npm run build passed; verified hero copy in both Today and Tomorrow modes.
Rollback: git revert aa21509
Agent: Codex (GPT-5)
```

---

### 2. V1 Build Log — append new entry to the bottom

```
V97 | 2026-02-21 | Codex session
- Hero card copy now follows active day focus (Today/Tomorrow)
- Removed hardcoded "tomorrow" language from hero info text templates
- Commit: aa21509
```

---

### 3. PM Journal — append new entry

```
## 2026-02-21 — Evening (Codex session)

**Deployed:** V97 (aa21509)
**Status:** Hotfix shipped

**What was done:**
- Updated hero card microcopy so Today mode explicitly says "Best escape today".
- Updated hero narrative sentences to stay aligned with the active day focus.
- Preserved existing ranking logic; this release is a wording and clarity hotfix.

**Next:**
- Continue V98 weather-source validation and reliability pass.
```

---

## V96 — commit `e93f7a9` — 2026-02-21

**Theme:** Hero Timeline & Data Consistency

### 1. V88 Release Changelog — append after V95 entry

```
### V96 (e93f7a9)
Theme: Hero Timeline & Data Consistency

Changes:
- Hero Card: Unified heroDayFocus, sunshine metrics, and travel start logic with the global dayFocus (page.tsx).
- Fix: Corrected hero travel preview bar to accurately follow the "now" marker in Today mode.

Files: src/app/page.tsx
Validation: npm run build passed; Verified hero card consistency in both Today and Tomorrow modes.
Rollback: git revert e93f7a9
Agent: Antigravity (Google DeepMind)
```

---

### 2. V1 Build Log — append new entry to the bottom

```
V96 | 2026-02-21 | Antigravity session
- Hero card unified with global dayFocus (Today/Tomorrow)
- Fixed hero travel preview bar positioning in Today mode
- Commit: e93f7a9
```

---

### 3. PM Journal — append new entry

```
## 2026-02-21 — Afternoon (Antigravity session)

**Deployed:** V96 (e93f7a9)
**Status:** Shipped and deployed to Vercel

**What was done:**
- Fixed a subtle bug where the hero "best escape" card was hardcoded to show tomorrow's data even when currently viewing today's results.
- Unified the hero card's data pipeline with the global "Today/Tomorrow" selector. This ensures that when you switch to Today mode, the hero card's travel bar now correctly starts from your current position in the timeline, just like the result cards.
- Polished the sunshine hours and gain metrics to be context-aware, providing a more reliable "best" recommendation.

**Next:**
- Monitor usage of the Today/Tomorrow toggle
```

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
