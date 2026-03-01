import { DestinationType, TourismInfo, TourismPOI } from '@/lib/types'

export interface DestinationEnrichmentInput {
  id?: string
  name: string
  lat: number
  lon: number
  region: string
  country?: 'CH' | 'DE' | 'FR' | 'IT' | 'LI'
  types?: DestinationType[]
  description?: string
  plan_template?: string
  maps_name?: string
}

interface EnrichDestinationOptions {
  catalog?: DestinationEnrichmentInput[]
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const CACHE_PREFIX = 'tourism:v1:'
const CACHE_MAX_ITEMS = 2500
const REMOTE_TIMEOUT_MS = 2600
const FALLBACK_SITE_ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://fomosun.com'
const GENERIC_PLACEHOLDER_PLAN = 'Cable car or short hike | Panorama viewpoint stop | Mountain hut lunch'
const GENERIC_PLACEHOLDER_SEGMENTS = new Set([
  'cable car or short hike',
  'panorama viewpoint stop',
  'mountain hut lunch',
])

const memoryCache = new Map<string, { expires_at: number; data: TourismInfo }>()

type TourismPatch = Partial<Omit<TourismInfo, 'source'>> & { source?: TourismInfo['source'] }

function normalizeText(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
}

function stripHtml(value: string) {
  return normalizeText(value.replace(/<[^>]*>/g, ''))
}

function uniqueNonEmpty(values: Array<string | undefined | null>) {
  const out: string[] = []
  const seen = new Set<string>()
  for (const raw of values) {
    if (!raw) continue
    const value = normalizeText(raw)
    if (!value) continue
    const key = value.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(value)
  }
  return out
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function mapTypeToTag(type: DestinationType) {
  switch (type) {
    case 'lake': return 'lake'
    case 'mountain': return 'mountain'
    case 'thermal': return 'thermal'
    case 'town': return 'town'
    case 'family': return 'family'
    case 'food': return 'food'
    case 'viewpoint': return 'viewpoint'
    case 'nature':
    default:
      return 'nature'
  }
}

function mapsPlace(name: string, country?: string) {
  const raw = normalizeText(name)
  if (!raw) return ''
  const hasCountry = /\b(switzerland|germany|france|italy|liechtenstein)\b/i.test(raw)
  if (hasCountry || raw.includes(',')) return raw
  if (!country) return raw
  if (country === 'CH') return `${raw}, Switzerland`
  if (country === 'DE') return `${raw}, Germany`
  if (country === 'FR') return `${raw}, France`
  if (country === 'IT') return `${raw}, Italy`
  if (country === 'LI') return `${raw}, Liechtenstein`
  return raw
}

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const toRad = (v: number) => (v * Math.PI) / 180
  const R = 6371
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return R * (2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa)))
}

function buildNearbyPois(input: DestinationEnrichmentInput, catalog: DestinationEnrichmentInput[]): TourismPOI[] {
  if (!Array.isArray(catalog) || catalog.length === 0) return []

  return catalog
    .filter(c => c.name !== input.name)
    .map(c => ({
      row: c,
      distance: haversineKm(input.lat, input.lon, c.lat, c.lon),
    }))
    .filter(item => Number.isFinite(item.distance))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)
    .map(item => {
      const primaryType = item.row.types?.[0] || 'place'
      const encoded = encodeURIComponent(mapsPlace(item.row.maps_name || item.row.name, item.row.country))
      return {
        name: item.row.name,
        distance_km: Math.round(item.distance * 10) / 10,
        type: primaryType,
        url: encoded ? `https://www.google.com/maps/search/?api=1&query=${encoded}` : undefined,
      }
    })
}

function fallbackDescriptionLong(input: DestinationEnrichmentInput) {
  if (input.description) return normalizeText(input.description)
  if (input.plan_template) {
    const parts = input.plan_template
      .split('|')
      .map(part => normalizeText(part))
      .filter(Boolean)
    if (parts.length > 0) {
      return `${input.name} in ${input.region}: ${parts.join('. ')}.`
    }
  }
  return `${input.name} is a curated sunny-escape destination in ${input.region}.`
}

function fallbackHighlights(input: DestinationEnrichmentInput) {
  const template = normalizeText(input.plan_template || '')
  const isGenericPlaceholder = template === GENERIC_PLACEHOLDER_PLAN
  const typeHints = Array.isArray(input.types) ? input.types : []
  if (isGenericPlaceholder) {
    if (typeHints.includes('town')) {
      return uniqueNonEmpty([
        'Old town stroll',
        'Sunny terrace stop',
        'Easy scenic loop',
      ]).slice(0, 4)
    }
    if (typeHints.includes('lake')) {
      return uniqueNonEmpty([
        'Lakeside walk',
        'Terrace coffee',
        'Short scenic loop',
      ]).slice(0, 4)
    }
    if (typeHints.includes('thermal')) {
      return uniqueNonEmpty([
        'Thermal soak',
        'Sauna/rest',
        'Easy sunset walk',
      ]).slice(0, 4)
    }
    return uniqueNonEmpty([
      'Short ridge/viewpoint loop (30–60 min)',
      'Panorama stop above fog',
      'Hut/terrace break (check opening hours)',
    ]).slice(0, 4)
  }

  const base = input.plan_template
    ? input.plan_template
      .split('|')
      .map(part => normalizeText(part))
      .filter(part => !GENERIC_PLACEHOLDER_SEGMENTS.has(part.toLowerCase()))
    : []
  const defaults = [
    `${input.region} microclimate`,
    `Great for a ${input.types?.includes('town') ? 'day in town' : 'day escape'}`,
  ]
  return uniqueNonEmpty([...base, ...defaults]).slice(0, 4)
}

function fallbackOfficialUrl(input: DestinationEnrichmentInput) {
  const query = encodeURIComponent(input.name)
  return `https://www.myswitzerland.com/en-ch/search/?q=${query}`
}

function fallbackHeroImage(input: DestinationEnrichmentInput) {
  const slug = toSlug(input.id || input.name || 'destination')
  return `${FALLBACK_SITE_ORIGIN}/api/og/${encodeURIComponent(slug)}`
}

function buildFallbackTourism(input: DestinationEnrichmentInput, catalog: DestinationEnrichmentInput[]) {
  const tags = uniqueNonEmpty((input.types || []).map(mapTypeToTag))
  return {
    description_short: `${input.name} · ${input.region}`,
    description_long: fallbackDescriptionLong(input),
    highlights: fallbackHighlights(input),
    tags,
    hero_image: fallbackHeroImage(input),
    official_url: fallbackOfficialUrl(input),
    pois_nearby: buildNearbyPois(input, catalog),
    source: 'fallback' as const,
  }
}

function mergeTourism(base: TourismInfo, patch: TourismPatch | null | undefined): TourismInfo {
  if (!patch) return base
  return {
    description_short: normalizeText(patch.description_short || base.description_short),
    description_long: normalizeText(patch.description_long || base.description_long || ''),
    highlights: uniqueNonEmpty([...(patch.highlights || []), ...base.highlights]).slice(0, 6),
    tags: uniqueNonEmpty([...(patch.tags || []), ...base.tags]).slice(0, 8),
    hero_image: normalizeText(patch.hero_image || base.hero_image),
    official_url: normalizeText(patch.official_url || base.official_url),
    pois_nearby: Array.isArray(patch.pois_nearby) && patch.pois_nearby.length > 0
      ? patch.pois_nearby
      : base.pois_nearby,
    source: patch.source || base.source,
  }
}

function cacheKey(input: DestinationEnrichmentInput) {
  const region = normalizeText(input.region).toLowerCase()
  const name = normalizeText(input.name).toLowerCase()
  return `${CACHE_PREFIX}${name}|${region}|${input.lat.toFixed(3)}|${input.lon.toFixed(3)}`
}

function pruneMemoryCache(now: number) {
  if (memoryCache.size <= CACHE_MAX_ITEMS) return
  for (const [key, value] of Array.from(memoryCache.entries())) {
    if (value.expires_at <= now) memoryCache.delete(key)
  }
  if (memoryCache.size <= CACHE_MAX_ITEMS) return
  const overflow = memoryCache.size - CACHE_MAX_ITEMS
  for (const key of Array.from(memoryCache.keys()).slice(0, overflow)) {
    memoryCache.delete(key)
  }
}

function hasKvRestConfig() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)
}

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), REMOTE_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timeout)
  }
}

async function kvGet<T>(key: string): Promise<T | null> {
  if (!hasKvRestConfig()) return null
  try {
    const base = process.env.KV_REST_API_URL as string
    const token = process.env.KV_REST_API_TOKEN as string
    const res = await fetchWithTimeout(`${base}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    const payload = await res.json() as { result?: string }
    if (typeof payload?.result !== 'string' || !payload.result) return null
    return JSON.parse(payload.result) as T
  } catch {
    return null
  }
}

async function kvSet<T>(key: string, value: T, ttlSec: number) {
  if (!hasKvRestConfig()) return
  try {
    const base = process.env.KV_REST_API_URL as string
    const token = process.env.KV_REST_API_TOKEN as string
    const encodedValue = encodeURIComponent(JSON.stringify(value))
    const url = `${base}/set/${encodeURIComponent(key)}/${encodedValue}/EX/${ttlSec}`
    await fetchWithTimeout(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
  } catch {
    // Best-effort cache write only.
  }
}

async function getCached(input: DestinationEnrichmentInput): Promise<TourismInfo | null> {
  const now = Date.now()
  const key = cacheKey(input)
  const local = memoryCache.get(key)
  if (local && local.expires_at > now) return local.data
  if (local) memoryCache.delete(key)

  const remote = await kvGet<{ expires_at: number; data: TourismInfo }>(key)
  if (!remote || !remote.data || remote.expires_at <= now) return null

  memoryCache.set(key, {
    expires_at: remote.expires_at,
    data: remote.data,
  })
  return remote.data
}

async function setCached(input: DestinationEnrichmentInput, data: TourismInfo) {
  const now = Date.now()
  const key = cacheKey(input)
  const value = {
    expires_at: now + CACHE_TTL_MS,
    data,
  }
  memoryCache.set(key, value)
  pruneMemoryCache(now)
  await kvSet(key, value, Math.round(CACHE_TTL_MS / 1000))
}

function expandTemplate(template: string, input: DestinationEnrichmentInput, detailId?: string) {
  const withQuery = template
    .replaceAll('{query}', encodeURIComponent(input.name))
    .replaceAll('{name}', encodeURIComponent(input.name))
    .replaceAll('{lat}', String(input.lat))
    .replaceAll('{lon}', String(input.lon))
    .replaceAll('{region}', encodeURIComponent(input.region))
    .replaceAll('{detail_id}', encodeURIComponent(detailId || ''))
  return withQuery
}

function asRecord(value: unknown): Record<string, unknown> {
  return (value && typeof value === 'object') ? (value as Record<string, unknown>) : {}
}

function readPath(value: unknown, path: string) {
  const parts = path.split('.')
  let curr: unknown = value
  for (const part of parts) {
    const rec = asRecord(curr)
    curr = rec[part]
    if (curr === undefined) return undefined
  }
  return curr
}

function pickFirstString(value: unknown, candidates: string[]) {
  for (const path of candidates) {
    const raw = readPath(value, path)
    if (typeof raw === 'string' && normalizeText(raw)) return normalizeText(raw)
  }
  return ''
}

function pickStringArray(value: unknown, candidates: string[]) {
  for (const path of candidates) {
    const raw = readPath(value, path)
    if (!Array.isArray(raw)) continue
    const values = raw
      .map(item => {
        if (typeof item === 'string') return normalizeText(item)
        const rec = asRecord(item)
        const viaName = typeof rec.name === 'string' ? rec.name : ''
        const viaLabel = typeof rec.label === 'string' ? rec.label : ''
        const viaTitle = typeof rec.title === 'string' ? rec.title : ''
        return normalizeText(viaName || viaLabel || viaTitle)
      })
      .filter(Boolean)
    if (values.length > 0) return uniqueNonEmpty(values)
  }
  return []
}

async function fetchDiscoverSwissPatch(input: DestinationEnrichmentInput): Promise<TourismPatch | null> {
  const key = process.env.SWISS_TOURISM_DISCOVER_SUBSCRIPTION_KEY || process.env.SWISS_TOURISM_API_KEY || ''
  const searchTemplate = process.env.SWISS_TOURISM_DISCOVER_SEARCH_URL || ''
  if (!key || !searchTemplate) return null

  try {
    const searchUrl = expandTemplate(searchTemplate, input)
    const searchRes = await fetchWithTimeout(searchUrl, {
      headers: { 'Ocp-Apim-Subscription-Key': key },
      cache: 'no-store',
    })
    if (!searchRes.ok) return null
    const searchPayload = await searchRes.json() as unknown

    const searchRows = readPath(searchPayload, 'results')
    const firstRow = Array.isArray(searchRows) && searchRows.length > 0 ? searchRows[0] : searchPayload
    const detailId = pickFirstString(firstRow, ['id', 'uuid', 'slug', 'uid'])

    let finalPayload: unknown = firstRow
    const detailTemplate = process.env.SWISS_TOURISM_DISCOVER_DETAIL_URL || ''
    if (detailTemplate && detailId) {
      const detailUrl = expandTemplate(detailTemplate, input, detailId)
      const detailRes = await fetchWithTimeout(detailUrl, {
        headers: { 'Ocp-Apim-Subscription-Key': key },
        cache: 'no-store',
      })
      if (detailRes.ok) {
        finalPayload = await detailRes.json()
      }
    }

    const short = pickFirstString(finalPayload, [
      'description_short',
      'short_description',
      'summary',
      'teaser',
      'description.short',
      'content.summary',
    ])
    const long = pickFirstString(finalPayload, [
      'description_long',
      'long_description',
      'description.long',
      'content.description',
      'description',
    ])
    const image = pickFirstString(finalPayload, [
      'hero_image',
      'image.url',
      'images.0.url',
      'media.0.url',
      'cover.url',
    ])
    const official = pickFirstString(finalPayload, [
      'official_url',
      'url',
      'website',
      'links.official',
      'links.website',
    ])
    const highlights = pickStringArray(finalPayload, ['highlights', 'main_highlights', 'usp', 'points_of_interest'])
    const tags = pickStringArray(finalPayload, ['tags', 'categories', 'themes'])

    if (!short && !long && highlights.length === 0 && tags.length === 0 && !official) {
      return null
    }

    return {
      description_short: short,
      description_long: long,
      highlights,
      tags,
      hero_image: image,
      official_url: official,
      source: 'discover.swiss',
    }
  } catch {
    return null
  }
}

function geoAdminObjectClassTag(value: string) {
  const lower = value.toLowerCase()
  if (lower.includes('aussichtspunkt') || lower.includes('viewpoint')) return 'viewpoint'
  if (lower.includes('haltestelle') || lower.includes('station')) return 'transport'
  if (lower.includes('see') || lower.includes('lake')) return 'lake'
  if (lower.includes('thermal')) return 'thermal'
  if (lower.includes('ort') || lower.includes('city') || lower.includes('town')) return 'town'
  return ''
}

async function fetchGeoAdminPatch(input: DestinationEnrichmentInput): Promise<TourismPatch | null> {
  try {
    const searchText = encodeURIComponent(input.name)
    const url = `https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${searchText}&type=locations&limit=6`
    const res = await fetchWithTimeout(url, { cache: 'force-cache' })
    if (!res.ok) return null

    const payload = await res.json() as {
      results?: Array<{
        attrs?: {
          label?: string
          detail?: string
          objectclass?: string
          origin?: string
        }
      }>
    }

    const rows = Array.isArray(payload?.results) ? payload.results : []
    if (rows.length === 0) return null

    const labels = uniqueNonEmpty(rows.map(r => stripHtml(String(r.attrs?.label || '')))).slice(0, 4)
    const detail = normalizeText(String(rows[0]?.attrs?.detail || ''))
    const extraTags = uniqueNonEmpty(rows.map(r => geoAdminObjectClassTag(String(r.attrs?.objectclass || ''))))

    return {
      description_short: detail ? `${input.name} · ${detail}` : `${input.name} · ${input.region}`,
      highlights: labels,
      tags: extraTags,
      source: 'geo.admin.ch',
    }
  } catch {
    return null
  }
}

function finalizeTourism(data: TourismInfo): TourismInfo {
  const sanitizedHighlights = uniqueNonEmpty(data.highlights)
    .filter(item => !GENERIC_PLACEHOLDER_SEGMENTS.has(normalizeText(item).toLowerCase()))
    .slice(0, 6)
  return {
    description_short: normalizeText(data.description_short || 'Sunny destination insight'),
    description_long: normalizeText(data.description_long || data.description_short),
    highlights: sanitizedHighlights.length > 0
      ? sanitizedHighlights
      : [
        'Sunny-escape destination',
        'Short daytrip potential',
      ],
    tags: uniqueNonEmpty(data.tags).slice(0, 8),
    hero_image: normalizeText(data.hero_image || `${FALLBACK_SITE_ORIGIN}/api/og/default`),
    official_url: normalizeText(data.official_url || 'https://www.myswitzerland.com/en-ch/'),
    pois_nearby: (data.pois_nearby || []).slice(0, 6).map(p => ({
      ...p,
      name: normalizeText(p.name),
      distance_km: typeof p.distance_km === 'number' ? clamp(Math.round(p.distance_km * 10) / 10, 0, 999) : undefined,
    })),
    source: data.source,
  }
}

export async function enrichDestination(
  input: DestinationEnrichmentInput,
  options: EnrichDestinationOptions = {}
): Promise<TourismInfo> {
  const catalog = options.catalog || []

  const cached = await getCached(input)
  if (cached) return cached

  const base = buildFallbackTourism(input, catalog)

  const discoverPatch = await fetchDiscoverSwissPatch(input)
  let merged = mergeTourism(base, discoverPatch)

  if (!discoverPatch) {
    const geoPatch = await fetchGeoAdminPatch(input)
    merged = mergeTourism(merged, geoPatch)
  }

  const finalized = finalizeTourism(merged)
  await setCached(input, finalized)
  return finalized
}
