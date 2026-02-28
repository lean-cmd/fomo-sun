# Open API Audit

Last updated: 2026-02-28

## External APIs in use

| API | Base URL | Where used | Purpose | Caching / Rate posture | Env vars | Improvement notes |
|---|---|---|---|---|---|---|
| Open-Meteo Forecast + Current | `https://api.open-meteo.com/v1` | `src/lib/open-meteo.ts`, `src/app/api/v1/sunny-escapes/route.ts` | Live current + hourly forecast, sunshine minutes, sunrise/sunset for origin and destinations | In-memory TTL (`5m` current/hourly, `60m` sun times) + Next fetch revalidate + batch fetch (`batchGetWeather`) | none | Keep batching first. Persist hot responses in KV for cold-start resilience. Monitor fallback frequency from MeteoSwiss model to default model for CH border points. |
| Open-Meteo Reverse Geocoding | `https://geocoding-api.open-meteo.com/v1/reverse` | `src/app/page.tsx` | Resolve GPS coordinates to nearest city label | Client-side call only on location selection; no server fanout | none | Add lightweight client debounce/cache by rounded coords to avoid repeated lookups while toggling location. |
| MeteoSwiss OGD CSV (stations + observations) | `https://data.geo.admin.ch/ch.meteoschweiz.*` | `src/lib/swissmeteo.ts`, consumed via `src/app/api/v1/sunny-escapes/route.ts` | Swiss origin-now snapshot from official station observations | In-memory TTL (`24h` station metadata, `5m` observations) + fetch revalidate (`86400s` / `300s`) | none | Add parser drift alert if required CSV headers disappear. Consider rolling checksum or sentinel station checks in CI. |
| geo.admin SearchServer | `https://api3.geo.admin.ch/rest/services/api/SearchServer` | `src/lib/tourism/enrichDestination.ts`, optional in `scripts/audit-routing.mjs` (`--geocode-ch`) | Tourism fallback enrichment + CH geocode consistency checks | Tourism flow uses cache (`24h` memory + optional KV); audit caches responses under `artifacts/cache/` | none | Add deterministic query formatting and tighter ranking rules for multilingual place names to reduce far-match noise. |
| Transport Open Data Connections | `https://transport.opendata.ch/v1/connections` | `src/lib/sbb-connections.ts`, `src/app/api/v1/sbb-connections/route.ts`, `scripts/generate-train-times.mjs` | Train connection previews (expanded cards) + offline generation of typical train durations for bucket logic | `sbb-connections` in-memory TTL `5m`; API route response cache-control `s-maxage=300`; train-time generator uses batch+progress and throttling | `OJP_API_TOKEN` or `OPENTRANSPORTDATA_API_TOKEN` (optional bearer) | Keep per-request fanout disabled in main ranking path. Store source metadata (`transport.opendata.ch` vs `heuristic_fallback`) and apply guardrails before bucket filtering when fallback data is used. |
| Notion API | `https://api.notion.com/v1` | `src/lib/notion-cms.ts`, `scripts/add-notion-post.js`, release-doc update scripts | Blog CMS + operational documentation publishing | Next revalidate (`300s`) for blog/about reads; writes are manual/scripted | `NOTION_TOKEN`, `NOTION_BLOG_DB_ID`, `NOTION_ABOUT_PAGE_ID` | Add one script for page-append updates to remove ad-hoc temp scripts and reduce operational variance. |
| Discover Swiss (optional) | configurable URL templates | `src/lib/tourism/enrichDestination.ts` | Optional tourism enrichment patch (descriptions/tags/highlights) | Cached via in-memory + optional KV. Network calls timeout quickly (`2600ms`) and fall back gracefully. | `SWISS_TOURISM_DISCOVER_SUBSCRIPTION_KEY` or `SWISS_TOURISM_API_KEY`, `SWISS_TOURISM_DISCOVER_SEARCH_URL`, `SWISS_TOURISM_DISCOVER_DETAIL_URL` | Add structured health check for configured templates so failures are visible in admin diagnostics. |

## Current routing accuracy strategy

1. Keep ranking API deterministic and low-fanout at request time.
2. Use precomputed train durations (`src/data/train-times.ts`) keyed by normalized origin + destination id, with source tags.
3. When a precomputed row is fallback/heuristic or missing, apply a conservative train-time guardrail before bucket filtering.
4. Validate buckets and links using `scripts/audit-routing.mjs` before release.

## Train-time quality telemetry

- API response now includes `_meta.train_time_quality` with dataset stats and per-response usage:
  - API-backed train rows
  - estimated/fallback rows
  - guardrail applications
- Response headers also expose train-time quality signals:
  - `X-FOMO-Train-Data-Service-Date`
  - `X-FOMO-Train-Data-API-Rows`
  - `X-FOMO-Train-Data-Fallback-Rows`
  - `X-FOMO-Train-Estimate-Used`
  - `X-FOMO-Train-Guardrail-Applied`

## Recommended maintenance cadence

1. Regenerate train-time dataset weekly or after destination list changes.
2. Run `npm run audit:routing` in demo mode each release branch.
3. Run one live spot audit (`--demo false`) for Basel and Zürich before production deploy.
