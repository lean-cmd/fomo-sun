import { NextRequest, NextResponse } from 'next/server'
import { destinations, DEFAULT_ORIGIN } from '@/data/destinations'
import { computeSunScore, detectInversion, haversineDistance, preFilterByDistance } from '@/lib/scoring'
import { getMockWeather, getMockOriginWeather, getMockTravelTime, getMockSunTimeline, getMockMaxSunHours, getMockSunset, getMockTomorrowSunHours, getMockOriginTimeline, getMockTomorrowSunHoursForDest, getMockDaylightWindow } from '@/lib/mock-weather'
import { batchGetWeather, getCurrentWeather, getHourlyForecast, getSunTimes, WeatherSourcePolicy } from '@/lib/open-meteo'
import { getSwissMeteoOriginSnapshot } from '@/lib/swissmeteo'
import { DaylightWindow, EscapeResult, SunnyEscapesResponse, SunTimeline, TourismInfo, TravelMode } from '@/lib/types'
import { addRequestLog } from '@/lib/request-log'
import { enrichDestination } from '@/lib/tourism/enrichDestination'

type LiveForecastBundle = {
  hours: Awaited<ReturnType<typeof getHourlyForecast>>['hours']
  total_sunshine_today_min: number
  total_sunshine_tomorrow_min: number
  sunrise_today_iso?: string
  sunrise_tomorrow_iso?: string
  sunset_today_iso?: string
  sunset_tomorrow_iso?: string
  daylight_window_today?: DaylightWindow
  daylight_window_tomorrow?: DaylightWindow
}
type TripSpan = 'daytrip' | 'plus1day'

type ScoredWithTravel = {
  destination: typeof destinations[number]
  sun_score: ReturnType<typeof computeSunScore>
  conditions: string
  temp_c: number
  netSunAfterArrivalMin: number
  netGainVsOriginMin: number
  tomorrowSunMin: number
  tomorrowNetAfterArrivalMin: number
  optimalDeparture?: string
  carTravel?: ReturnType<typeof getMockTravelTime>
  trainTravel?: ReturnType<typeof getMockTravelTime> & { ga_included?: boolean }
  bestTravelMin: number
  liveForecast?: LiveForecastBundle
}

type RankedEscapeRow = {
  destination: typeof destinations[number]
  sun_score: ReturnType<typeof computeSunScore>
  travel_time_min: number
  net_gain_min: number
  combined_score: number
  sunshine_min: number
  temperature_c: number
  in_window: boolean
  window_overflow_min: number
}

type ResultTier = 'strict' | 'relaxed' | 'any_sun' | 'best_available'

const DEMO_TRAIN_FAST_IDS = new Set([
  'solothurn',
  'olten',
  'grenchen',
  'biel-bienne',
  'aarau',
  'baden-limmat-thermal',
  'brugg-aargau',
  'zofingen',
  'sursee',
  'lucerne',
  'spiez',
  'thun',
  'interlaken',
  'zurich',
  'bern',
  'rapperswil-lakeside',
  'walenstadt',
  'chur-city',
  'st-moritz',
])

const DEMO_TRAIN_SLOW_IDS = new Set([
  'chasseral',
  'weissenstein',
  'pilatus',
  'rigi',
  'napf',
  'grand-ballon',
  'hohneck',
  'feldberg-schwarzwald',
])

const LIVE_RATE_WINDOW_MS = 60_000
const LIVE_RATE_MAX_PER_WINDOW = 90
const liveReqCounter = new Map<string, { reset_at: number; count: number }>()
const TARGET_POI_COUNT = 500
const QUERY_CACHE_TTL_MS = 12_000
const LIVE_WEATHER_POOL_TARGET = 36
const LIVE_WEATHER_POOL_EXPLICIT_MAX = 140
const DIVERSITY_RADIUS_KM = 25
const DIVERSITY_MAX_NEARBY_IN_TOP = 2
const DIVERSITY_TOP_ROWS = 5
const UI_TRAVEL_BUCKETS = [
  { id: 'quick', min_h: 0, max_h: 1 },
  { id: 'short-a', min_h: 1, max_h: 1.5 },
  { id: 'short-b', min_h: 1.5, max_h: 2 },
  { id: 'mid', min_h: 2, max_h: 3 },
  { id: 'long', min_h: 3, max_h: 6.5 },
] as const
const queryResponseCache = new Map<string, { expires_at: number; response: SunnyEscapesResponse; headers: Record<string, string> }>()
const ZURICH_TZ = 'Europe/Zurich'

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function avg(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function dayStringInZurich(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZURICH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function zurichDateTimeParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZURICH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const year = parts.find(p => p.type === 'year')?.value || '1970'
  const month = parts.find(p => p.type === 'month')?.value || '01'
  const day = parts.find(p => p.type === 'day')?.value || '01'
  const hour = parts.find(p => p.type === 'hour')?.value || '00'
  const minute = parts.find(p => p.type === 'minute')?.value || '00'
  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` }
}

function hourInZurich(date: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZURICH_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const hour = Number(parts.find(p => p.type === 'hour')?.value || '0')
  const minute = Number(parts.find(p => p.type === 'minute')?.value || '0')
  return hour + minute / 60
}

function isNearMidnightZurich(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: ZURICH_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)
  const hour = Number(parts.find(p => p.type === 'hour')?.value || '0')
  const minute = Number(parts.find(p => p.type === 'minute')?.value || '0')
  if (hour === 23 && minute >= 55) return true
  if (hour === 0 && minute <= 5) return true
  return false
}

function demoTrainFactor(id: string): number {
  const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return 0.62 + (hash % 7) * 0.025 // 0.62 - 0.77
}

function mapsPlaceLabel(name?: string | null) {
  const value = String(name || '').trim()
  if (!value) return value
  const lower = value.toLowerCase()
  if (lower.includes('switzerland') || lower.includes('germany') || lower.includes('france') || value.includes(',')) {
    return value
  }
  return `${value}, Switzerland`
}

function buildGoogleMapsDirectionsUrl(mapsName: string | null | undefined, originName?: string, fallbackName?: string, country?: string) {
  const destinationLabel = mapsPlaceLabel(mapsName) || mapsPlaceLabel(
    fallbackName
      ? `${fallbackName}${country === 'DE' ? ', Germany' : country === 'FR' ? ', France' : country === 'IT' ? ', Italy' : ', Switzerland'}`
      : 'Switzerland'
  )
  const p = new URLSearchParams({
    api: '1',
    destination: destinationLabel,
    travelmode: 'driving',
  })
  if (originName?.trim()) p.set('origin', mapsPlaceLabel(originName))
  return `https://www.google.com/maps/dir/?${p.toString()}`
}

function normalizeSbbOrigin(originName: string) {
  const raw = originName.trim()
  const key = raw.toLowerCase()
  if (!raw) return 'Basel SBB'
  if (key === 'basel' || key === 'basel sbb') return 'Basel SBB'
  if (key === 'zurich' || key === 'zürich' || key === 'zurich hb' || key === 'zürich hb') return 'Zürich HB'
  if (key === 'bern') return 'Bern'
  if (key === 'luzern' || key === 'lucerne') return 'Luzern'
  return raw
}

function buildSbbDateTime(tripSpan: TripSpan) {
  const now = new Date()
  if (tripSpan === 'plus1day') {
    const next = new Date(now)
    next.setDate(next.getDate() + 1)
    const tomorrowDate = dayStringInZurich(next)
    return { date: tomorrowDate, time: '08:00' }
  }
  return zurichDateTimeParts(now)
}

function buildSbbTimetableUrl(sbbName?: string | null, originName = 'Basel', tripSpan: TripSpan = 'daytrip') {
  if (!sbbName) return undefined
  const { date, time } = buildSbbDateTime(tripSpan)
  const p = new URLSearchParams({
    von: normalizeSbbOrigin(originName),
    nach: sbbName,
    date: `"${date}"`,
    time: `"${time}"`,
    moment: 'DEPARTURE',
  })
  return `https://www.sbb.ch/en?${p.toString()}`
}

function locationKey(lat: number, lon: number) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}`
}

function liveWeatherLookup(
  lat: number,
  lon: number,
  byKey: Map<string, Awaited<ReturnType<typeof batchGetWeather>>[number]>,
  rows: Awaited<ReturnType<typeof batchGetWeather>>
) {
  const exact = byKey.get(locationKey(lat, lon))
  if (exact) return exact
  let best: Awaited<ReturnType<typeof batchGetWeather>>[number] | null = null
  let bestDist = Infinity
  for (const row of rows) {
    const dLat = row.lat - lat
    const dLon = row.lon - lon
    const dist2 = dLat * dLat + dLon * dLon
    if (dist2 < bestDist) {
      bestDist = dist2
      best = row
    }
  }
  // ~2.2km at CH latitudes, tolerant to provider coordinate rounding.
  return best && bestDist <= 0.0004 ? best : null
}

function clientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for')
  return xff?.split(',')[0]?.trim() || 'unknown'
}

type LiveRateState = { limited: boolean; count: number; remaining: number; reset_at: number }

function consumeRateBudget(ip: string): LiveRateState {
  const now = Date.now()
  if (liveReqCounter.size > 500) {
    for (const [k, rec] of Array.from(liveReqCounter.entries())) {
      if (rec.reset_at <= now) liveReqCounter.delete(k)
    }
  }
  let rec = liveReqCounter.get(ip)
  if (!rec || rec.reset_at <= now) {
    rec = { reset_at: now + LIVE_RATE_WINDOW_MS, count: 0 }
    liveReqCounter.set(ip, rec)
  }
  rec.count += 1
  const remaining = Math.max(0, LIVE_RATE_MAX_PER_WINDOW - rec.count)
  return {
    limited: rec.count > LIVE_RATE_MAX_PER_WINDOW,
    count: rec.count,
    remaining,
    reset_at: rec.reset_at,
  }
}

function normalizeTripSpan(raw: string | null): TripSpan {
  return raw === 'plus1day' ? 'plus1day' : 'daytrip'
}

function isBaselLikeOrigin(originName: string, lat: number, lon: number) {
  const lower = originName.trim().toLowerCase()
  if (lower.includes('basel')) return true
  return Math.abs(lat - DEFAULT_ORIGIN.lat) <= 0.18 && Math.abs(lon - DEFAULT_ORIGIN.lon) <= 0.22
}

function weatherModelForDestination(
  destination: typeof destinations[number],
  weatherSource: 'openmeteo' | 'meteoswiss' | 'meteoswiss_api'
): 'meteoswiss_seamless' | 'best_match' {
  if (weatherSource === 'openmeteo') return 'best_match'
  return destination.country === 'CH' ? 'meteoswiss_seamless' : 'best_match'
}

function tomorrowStringInZurich() {
  return dayStringInZurich(new Date(Date.now() + 24 * 60 * 60 * 1000))
}

function dayAverages(hours: LiveForecastBundle['hours'], dayStr: string) {
  const bucket = hours.filter(h => h.time.startsWith(dayStr))
  if (bucket.length === 0) {
    return {
      lowCloudPct: 0,
      cloudPct: 0,
      precipitationMm: 0,
      snowfallCm: 0,
      humidityPct: 0,
      windKmh: 0,
    }
  }
  return {
    lowCloudPct: avg(bucket.map(h => h.low_cloud_cover_pct)),
    cloudPct: avg(bucket.map(h => h.cloud_cover_pct)),
    precipitationMm: avg(bucket.map(h => h.precipitation_mm)),
    snowfallCm: avg(bucket.map(h => h.snowfall_cm)),
    humidityPct: avg(bucket.map(h => h.relative_humidity_pct)),
    windKmh: avg(bucket.map(h => h.wind_speed_kmh)),
  }
}

function hourFromIso(iso: string) {
  const hh = Number(iso.slice(11, 13))
  const mm = Number(iso.slice(14, 16))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return 0
  return hh + mm / 60
}

function hourToHHMM(hour: number) {
  const clamped = clamp(hour, 0, 23.99)
  const whole = Math.floor(clamped)
  const minute = Math.round((clamped - whole) * 60)
  const hh = String(whole + Math.floor(minute / 60)).padStart(2, '0')
  const mm = String(minute % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

function roundHourToQuarter(hour: number) {
  return Math.round(hour * 4) / 4
}

function firstSignificantSunHour(input: {
  hours: LiveForecastBundle['hours']
  dayStr: string
  daylight: DaylightWindow
  thresholdMin?: number
}) {
  const thresholdMin = input.thresholdMin ?? 15
  const rows = input.hours
    .filter(h => h.time.startsWith(input.dayStr))
    .map(h => ({ ...h, hour: hourFromIso(h.time) }))
    .filter(h => h.hour >= input.daylight.start_hour && h.hour < input.daylight.end_hour)
    .sort((a, b) => a.hour - b.hour)

  const significant = rows.find(h => h.sunshine_duration_min >= thresholdMin)
  if (significant) return significant.hour
  const anySun = rows.find(h => h.sunshine_duration_min > 0)
  if (anySun) return anySun.hour
  return Math.max(0, input.daylight.start_hour)
}

function sunnyMinutesLostDuringTravel(input: {
  hours: LiveForecastBundle['hours']
  dayStr: string
  departureHour: number
  travelMin: number
  daylight?: DaylightWindow
}) {
  if (!Number.isFinite(input.travelMin) || input.travelMin <= 0) return 0
  const travelHours = input.travelMin / 60
  if (travelHours <= 0) return 0
  const start = Math.max(0, input.departureHour)
  const end = Math.min(24, start + travelHours)
  if (end <= start) return 0

  const daylightStart = input.daylight?.start_hour ?? 0
  const daylightEnd = input.daylight?.end_hour ?? 24
  const intervalStart = Math.max(start, daylightStart)
  const intervalEnd = Math.min(end, daylightEnd)
  if (intervalEnd <= intervalStart) return 0

  let lost = 0
  for (const h of input.hours) {
    if (!h.time.startsWith(input.dayStr)) continue
    const hourStart = hourFromIso(h.time)
    const hourEnd = Math.min(24, hourStart + 1)
    const overlap = Math.max(0, Math.min(intervalEnd, hourEnd) - Math.max(intervalStart, hourStart))
    if (overlap <= 0) continue
    lost += h.sunshine_duration_min * overlap
  }

  return Math.max(0, Math.round(lost))
}

function extractTempCFromText(text: string) {
  const m = text.match(/(-?\d+)\s*°\s*c/i)
  if (!m) return null
  const parsed = Number(m[1])
  return Number.isFinite(parsed) ? parsed : null
}

function detectOriginFogRisk(input: {
  isFoggy: boolean
  visibilityM: number
  lowCloudPct: number
  cloudPct: number
  humidityPct: number
  windKmh: number
  precipitationMm: number
}) {
  if (input.isFoggy) return true
  if (input.visibilityM < 2600) return true
  if (input.lowCloudPct >= 78) return true
  if (input.precipitationMm >= 0.35 && input.cloudPct >= 70) return true
  if (input.humidityPct >= 90 && input.windKmh <= 12 && input.cloudPct >= 60) return true
  return false
}

function applyOriginFogPenalty(input: {
  sunshineMin: number
  fogRisk: boolean
  lowCloudPct: number
  cloudPct: number
  precipitationMm: number
}) {
  if (!input.fogRisk) return input.sunshineMin

  let factor = 0.82
  if (input.lowCloudPct >= 75 || input.cloudPct >= 75) factor = 0.68
  if (input.precipitationMm >= 0.35) factor = 0.52
  return Math.max(0, Math.round(input.sunshineMin * factor))
}

function applyFogAltitudeAdjustment(input: {
  baseSunMin: number
  destinationAltitudeM: number
  fogRisk: boolean
  lowCloudPct: number
  cloudPct: number
  precipitationMm: number
  snowfallCm: number
  capMin: number
}) {
  if (!input.fogRisk) return { sunMin: clamp(Math.round(input.baseSunMin), 0, input.capMin), applied: false }

  let adjusted = input.baseSunMin
  if (
    input.destinationAltitudeM >= 1100 &&
    input.lowCloudPct <= 78 &&
    input.precipitationMm <= 0.35 &&
    input.snowfallCm <= 0.25
  ) {
    adjusted = input.baseSunMin * 1.16 + 18
  } else if (
    input.destinationAltitudeM <= 700 &&
    (input.lowCloudPct >= 72 || input.cloudPct >= 74 || input.precipitationMm >= 0.3)
  ) {
    adjusted = input.baseSunMin * 0.62
  } else if (input.destinationAltitudeM <= 900 && input.lowCloudPct >= 82) {
    adjusted = input.baseSunMin * 0.78
  }

  return {
    sunMin: clamp(Math.round(adjusted), 0, input.capMin),
    applied: Math.round(adjusted) !== Math.round(input.baseSunMin),
  }
}

function normalizeQueryCacheKey(input: {
  lat: number
  lon: number
  maxTravelH: number
  travelWindowH: number
  travelMinH: number | null
  travelMaxH: number | null
  mode: TravelMode
  hasGA: boolean
  types: string[]
  limit: number
  requestedDemo: boolean
  tripSpan: TripSpan
  originName: string
  originKind: 'manual' | 'gps' | 'default'
  weatherSource: WeatherSourcePolicy | 'meteoswiss_api'
  agentPrefsKey: string
}) {
  const latKey = input.lat.toFixed(3)
  const lonKey = input.lon.toFixed(3)
  const hKey = (Math.round(input.maxTravelH * 4) / 4).toFixed(2)
  const whKey = (Math.round(input.travelWindowH * 4) / 4).toFixed(2)
  const minKey = input.travelMinH === null ? '-' : (Math.round(input.travelMinH * 4) / 4).toFixed(2)
  const maxKey = input.travelMaxH === null ? '-' : (Math.round(input.travelMaxH * 4) / 4).toFixed(2)
  const typeKey = [...input.types].sort().join(',')
  return [
    `lat=${latKey}`,
    `lon=${lonKey}`,
    `h=${hKey}`,
    `wh=${whKey}`,
    `minh=${minKey}`,
    `maxh=${maxKey}`,
    `mode=${input.mode}`,
    `ga=${input.hasGA ? 1 : 0}`,
    `types=${typeKey || '-'}`,
    `limit=${input.limit}`,
    `demo=${input.requestedDemo ? 1 : 0}`,
    `span=${input.tripSpan}`,
    `origin=${input.originName.toLowerCase() || '-'}`,
    `origin_kind=${input.originKind}`,
    `weather_source=${input.weatherSource}`,
    `agent=${input.agentPrefsKey || '-'}`,
  ].join('&')
}

function selectLiveWeatherPool(candidates: Array<{
  destination: typeof destinations[number]
  bestTravelMin: number
  carTravel?: ReturnType<typeof getMockTravelTime>
  trainTravel?: ReturnType<typeof getMockTravelTime> & { ga_included?: boolean }
}>, maxTravelMin: number, windowMinMin?: number | null, windowMaxMin?: number | null) {
  if (candidates.length <= LIVE_WEATHER_POOL_TARGET) return candidates

  const hasExplicitWindow = Number.isFinite(windowMinMin ?? NaN) || Number.isFinite(windowMaxMin ?? NaN)
  const resolvedWindowMin = Number.isFinite(windowMinMin ?? NaN)
    ? Math.max(0, windowMinMin as number)
    : Math.max(0, maxTravelMin - 45)
  const resolvedWindowMax = Number.isFinite(windowMaxMin ?? NaN)
    ? Math.max(resolvedWindowMin, windowMaxMin as number)
    : maxTravelMin + 45
  const windowCenter = (resolvedWindowMin + resolvedWindowMax) / 2

  if (hasExplicitWindow) {
    const widenedMin = Math.max(0, resolvedWindowMin - 15)
    const widenedMax = resolvedWindowMax + 15
    const explicitPool = candidates
      .filter(c => c.bestTravelMin >= widenedMin && c.bestTravelMin <= widenedMax)
      .sort((a, b) => {
        const da = Math.abs(a.bestTravelMin - windowCenter)
        const db = Math.abs(b.bestTravelMin - windowCenter)
        if (da !== db) return da - db
        if (a.destination.country !== b.destination.country) {
          // Keep a healthier CH/non-CH mix in long-range windows.
          if (a.destination.country === 'CH') return 1
          if (b.destination.country === 'CH') return -1
        }
        return b.destination.altitude_m - a.destination.altitude_m
      })
    const explicitTarget = Math.min(
      LIVE_WEATHER_POOL_EXPLICIT_MAX,
      Math.max(24, LIVE_WEATHER_POOL_TARGET)
    )
    const deduped = new Map<string, typeof candidates[number]>()
    const addRows = (rows: typeof candidates) => {
      for (const row of rows) {
        if (deduped.has(row.destination.id)) continue
        deduped.set(row.destination.id, row)
        if (deduped.size >= explicitTarget) break
      }
    }

    addRows(explicitPool)
    if (deduped.size < explicitTarget) {
      addRows(
        [...candidates]
          .sort((a, b) => {
            const da = Math.abs(a.bestTravelMin - windowCenter)
            const db = Math.abs(b.bestTravelMin - windowCenter)
            if (da !== db) return da - db
            return b.destination.altitude_m - a.destination.altitude_m
          })
      )
    }
    if (deduped.size < explicitTarget) {
      // Long-window requests should still keep some true long-range candidates in the live pool.
      const preferLong = windowCenter >= 170
      addRows(
        [...candidates]
          .sort((a, b) => preferLong
            ? b.bestTravelMin - a.bestTravelMin
            : a.bestTravelMin - b.bestTravelMin)
      )
    }
    return Array.from(deduped.values()).slice(0, explicitTarget)
  }

  const target = LIVE_WEATHER_POOL_TARGET
  const inWindowCandidates = candidates
    .filter(c => c.bestTravelMin >= resolvedWindowMin && c.bestTravelMin <= resolvedWindowMax)
    .sort((a, b) => {
      const da = Math.abs(a.bestTravelMin - windowCenter)
      const db = Math.abs(b.bestTravelMin - windowCenter)
      if (da !== db) return da - db
      return b.destination.altitude_m - a.destination.altitude_m
    })

  const deduped = new Map<string, typeof candidates[number]>()
  const addRows = (rows: typeof candidates) => {
    for (const row of rows) {
      if (deduped.has(row.destination.id)) continue
      deduped.set(row.destination.id, row)
      if (deduped.size >= target) break
    }
  }

  if (hasExplicitWindow) {
    const inWindowQuota = Math.min(target, Math.max(12, Math.round(target * 0.7)))
    addRows(inWindowCandidates.slice(0, inWindowQuota))
  } else {
    const broadQuota = Math.min(target, Math.max(8, Math.round(target * 0.45)))
    addRows(inWindowCandidates.slice(0, broadQuota))
  }

  if (deduped.size < target) {
    addRows(
      [...candidates]
        .sort((a, b) => b.destination.altitude_m - a.destination.altitude_m)
        .slice(0, target)
    )
  }

  if (deduped.size < target) {
    addRows(
      [...candidates]
        .sort((a, b) => a.bestTravelMin - b.bestTravelMin)
        .slice(0, target)
    )
  }

  if (deduped.size < target) {
    addRows(
      [...candidates]
        .filter(c => c.bestTravelMin <= maxTravelMin + 45)
        .sort((a, b) => b.bestTravelMin - a.bestTravelMin)
        .slice(0, target)
    )
  }

  return Array.from(deduped.values()).slice(0, target)
}

function diversifyTopRows(rows: RankedEscapeRow[]) {
  const uniqueRows: RankedEscapeRow[] = []
  const seen = new Set<string>()
  for (const row of rows) {
    if (seen.has(row.destination.id)) continue
    seen.add(row.destination.id)
    uniqueRows.push(row)
  }

  if (uniqueRows.length <= DIVERSITY_TOP_ROWS) return uniqueRows

  const selected: RankedEscapeRow[] = []
  const deferred: RankedEscapeRow[] = []
  for (const row of uniqueRows) {
    let nearbyCount = 0
    for (const picked of selected) {
      const d = haversineDistance(
        row.destination.lat,
        row.destination.lon,
        picked.destination.lat,
        picked.destination.lon
      )
      if (d <= DIVERSITY_RADIUS_KM) nearbyCount += 1
    }

    if (nearbyCount >= DIVERSITY_MAX_NEARBY_IN_TOP && selected.length < DIVERSITY_TOP_ROWS) {
      deferred.push(row)
      continue
    }

    selected.push(row)
    if (selected.length >= DIVERSITY_TOP_ROWS) break
  }

  if (selected.length < DIVERSITY_TOP_ROWS) {
    for (const row of uniqueRows) {
      if (selected.some(s => s.destination.id === row.destination.id)) continue
      selected.push(row)
      if (selected.length >= DIVERSITY_TOP_ROWS) break
    }
  }

  for (const row of uniqueRows) {
    if (selected.some(s => s.destination.id === row.destination.id)) continue
    if (deferred.some(d => d.destination.id === row.destination.id)) continue
    deferred.push(row)
  }

  return [...selected, ...deferred]
}

function computeLiveWeatherWindow(
  hours: LiveForecastBundle['hours'],
  inversionLikely: boolean,
  daylightToday: DaylightWindow
) {
  const now = new Date()
  const todayStr = dayStringInZurich(now)
  const nowHour = hourInZurich(now)

  const dayRows = hours.filter(h => h.time.startsWith(todayStr))
  const next3Rows = dayRows.filter(h => {
    const hh = Number(h.time.slice(11, 13)) + Number(h.time.slice(14, 16)) / 60
    return hh >= nowHour && hh < nowHour + 3
  })

  const dayStart = Math.max(0, daylightToday.start_hour)
  const dayEnd = Math.min(24, daylightToday.end_hour)
  const fullDaylightRows = dayRows.filter(h => {
    const hh = Number(h.time.slice(11, 13)) + Number(h.time.slice(14, 16)) / 60
    return hh >= dayStart && hh < dayEnd
  })

  const remainingDaylightRows = dayRows.filter(h => {
    const hh = Number(h.time.slice(11, 13)) + Number(h.time.slice(14, 16)) / 60
    return hh >= Math.max(nowHour, dayStart) && hh < dayEnd
  })

  const isPreSunrise = nowHour < dayStart
  const window = isPreSunrise
    ? (fullDaylightRows.length >= 2 ? fullDaylightRows : (next3Rows.length >= 2 ? next3Rows : dayRows.slice(0, 3)))
    : (remainingDaylightRows.length >= 2 ? remainingDaylightRows : (next3Rows.length >= 2 ? next3Rows : dayRows.slice(0, 3)))

  const sunshineMin = Math.round(window.reduce((s, h) => s + h.sunshine_duration_min, 0))
  const lowCloud = Math.round(avg(window.map(h => h.low_cloud_cover_pct)))
  const totalCloud = Math.round(avg(window.map(h => h.cloud_cover_pct)))
  const temp = Math.round(avg(window.map(h => h.temperature_c)))
  const humidity = Math.round(avg(window.map(h => h.relative_humidity_pct)))
  const wind = Math.round(avg(window.map(h => h.wind_speed_kmh)))
  const snowfall = avg(window.map(h => h.snowfall_cm))
  const precipitation = avg(window.map(h => h.precipitation_mm))

  let conditionsText = ''
  if (snowfall > 0.05 || (precipitation > 0.2 && temp <= 1)) conditionsText = `Snow likely, ${temp}°C`
  else if (sunshineMin >= 90 && lowCloud < 35) conditionsText = `Mostly sunny, ${temp}°C`
  else if (sunshineMin >= 45) conditionsText = `Partly sunny, ${temp}°C`
  else if (lowCloud > 80 || (humidity > 88 && wind < 10)) conditionsText = `Fog/low cloud likely, ${temp}°C`
  else conditionsText = `Cloudy, ${temp}°C`

  return {
    weatherInput: {
      sunshine_forecast_min: clamp(sunshineMin, 0, 600),
      low_cloud_cover_pct: clamp(lowCloud, 0, 100),
      total_cloud_cover_pct: clamp(totalCloud, 0, 100),
      is_inversion_likely: inversionLikely,
      ground_truth_available: true,
      ground_truth_sunny: sunshineMin >= 60,
    },
    conditionsText,
    tempC: temp,
    stats: {
      lowCloudPct: clamp(lowCloud, 0, 100),
      cloudPct: clamp(totalCloud, 0, 100),
      precipitationMm: Math.max(0, precipitation),
      snowfallCm: Math.max(0, snowfall),
      humidityPct: clamp(humidity, 0, 100),
      windKmh: Math.max(0, wind),
    },
  }
}

function resolveDaylightWindow(
  live: Awaited<ReturnType<typeof batchGetWeather>>[number],
  day: 'today' | 'tomorrow',
  fallback: DaylightWindow
) {
  if (day === 'today' && live.daylight_window_today) return live.daylight_window_today
  if (day === 'tomorrow' && live.daylight_window_tomorrow) return live.daylight_window_tomorrow
  return fallback
}

function buildTripPlan(destination: typeof destinations[number]) {
  if (destination.trip_plan) {
    const steps = [
      `📍 ${destination.trip_plan.arrival}`,
      `🥾 ${destination.trip_plan.do}`,
      `🍽️ ${destination.trip_plan.eat}`,
    ]
    if (destination.trip_plan.pro_tip) steps.push(`💡 ${destination.trip_plan.pro_tip}`)
    return steps
  }
  return String(destination.plan_template || '')
    .split(' | ')
    .map(part => part.trim())
    .filter(Boolean)
}

function hourCondition(h: LiveForecastBundle['hours'][number]) {
  if (h.sunshine_duration_min >= 24) return 'sun'
  if (h.sunshine_duration_min >= 5) return 'partial'
  if (h.cloud_cover_pct <= 30 && h.low_cloud_cover_pct <= 45) return 'sun'
  if (h.cloud_cover_pct <= 60) return 'partial'
  return 'cloud'
}

function mergeSegments(items: Array<{ condition: 'sun' | 'partial' | 'cloud'; pct: number }>) {
  const merged: Array<{ condition: 'sun' | 'partial' | 'cloud'; pct: number }> = []
  for (const it of items) {
    const prev = merged[merged.length - 1]
    if (prev && prev.condition === it.condition) prev.pct += it.pct
    else merged.push({ ...it })
  }
  return merged
}

function timelineFromLive(
  hours: LiveForecastBundle['hours'],
  sunWindow: { today: DaylightWindow; tomorrow: DaylightWindow }
): SunTimeline {
  const now = new Date()
  const todayStr = dayStringInZurich(now)
  const tomorrowStr = dayStringInZurich(new Date(now.getTime() + 24 * 60 * 60 * 1000))

  const toSegments = (day: string, window: DaylightWindow) => {
    const daytime = hours
      .filter(h => h.time.startsWith(day))
      .filter(h => {
        const hh = Number(h.time.slice(11, 13)) + Number(h.time.slice(14, 16)) / 60
        return hh >= window.start_hour && hh < window.end_hour
      })

    if (daytime.length === 0) {
      return [
        { condition: 'cloud' as const, pct: 65 },
        { condition: 'partial' as const, pct: 35 },
      ]
    }

    const bucketPct = 100 / daytime.length
    return mergeSegments(daytime.map(h => ({ condition: hourCondition(h), pct: bucketPct })))
  }

  return {
    today: toSegments(todayStr, sunWindow.today),
    tomorrow: toSegments(tomorrowStr, sunWindow.tomorrow),
  }
}

function originSunScoreFromCurrent(input: {
  sunshine_duration_min: number
  low_cloud_cover_pct: number
  cloud_cover_pct: number
  relative_humidity_pct: number
  visibility_m: number
  wind_speed_kmh: number
}) {
  const sunshine = clamp(input.sunshine_duration_min / 60, 0, 1)
  const lowCloudClear = 1 - clamp(input.low_cloud_cover_pct / 100, 0, 1)
  const totalCloudClear = 1 - clamp(input.cloud_cover_pct / 100, 0, 1)

  let score = 0.1 + 0.56 * sunshine + 0.2 * lowCloudClear + 0.14 * totalCloudClear

  // Conservative trust posture for origin card: degrade score when fog risk is present.
  if (input.visibility_m < 3000) score -= 0.12
  if (input.visibility_m < 1200) score -= 0.12
  if (input.low_cloud_cover_pct > 75) score -= 0.1
  if (input.relative_humidity_pct > 90 && input.wind_speed_kmh < 14) score -= 0.08

  return clamp(score, 0.03, 0.92)
}

export async function GET(request: NextRequest) {
  const startedAt = Date.now()
  const sp = request.nextUrl.searchParams
  const maxSupportedH = 6.5
  const lat = parseFloat(sp.get('lat') || String(DEFAULT_ORIGIN.lat))
  const lon = parseFloat(sp.get('lon') || String(DEFAULT_ORIGIN.lon))
  let maxTravelH = Math.min(maxSupportedH, Math.max(0.5, parseFloat(sp.get('max_travel_h') || '2.5')))
  const travelWindowH = Math.min(2, Math.max(0.5, parseFloat(sp.get('travel_window_h') || '0.5')))
  const travelMinParam = sp.get('travel_min_h')
  const travelMaxParam = sp.get('travel_max_h')
  const parsedTravelMin = travelMinParam === null ? NaN : parseFloat(travelMinParam)
  const parsedTravelMax = travelMaxParam === null ? NaN : parseFloat(travelMaxParam)
  const hasExplicitTravelWindow = Number.isFinite(parsedTravelMin) || Number.isFinite(parsedTravelMax)
  let travelMinH = hasExplicitTravelWindow
    ? clamp(Number.isFinite(parsedTravelMin) ? parsedTravelMin : Math.max(0, maxTravelH - travelWindowH), 0, maxSupportedH)
    : null
  let travelMaxH = hasExplicitTravelWindow
    ? clamp(Number.isFinite(parsedTravelMax) ? parsedTravelMax : Math.min(maxSupportedH, maxTravelH + travelWindowH), 0, maxSupportedH)
    : null
  if (travelMinH !== null && travelMaxH !== null && travelMinH > travelMaxH) {
    const tmp = travelMinH
    travelMinH = travelMaxH
    travelMaxH = tmp
  }
  let mode: TravelMode = (sp.get('mode') as TravelMode) || 'both'
  const hasGA = sp.get('ga') === 'true'
  const typesParam = sp.get('types')
  let types = typesParam ? typesParam.split(',') : []
  const forceRefresh = sp.get('force') === 'true'
  const weatherSourceRaw = (sp.get('weather_source') || '').toLowerCase()
  const weatherSource = (
    weatherSourceRaw === 'openmeteo' || weatherSourceRaw === 'open-meteo'
      ? 'openmeteo'
      : weatherSourceRaw === 'meteoswiss'
        ? 'meteoswiss'
        : weatherSourceRaw === 'meteoswiss_api' || weatherSourceRaw === 'meteoswiss-ogd'
          ? 'meteoswiss_api'
          : 'meteoswiss'
  ) as 'openmeteo' | 'meteoswiss' | 'meteoswiss_api'
  const forecastWeatherSource: WeatherSourcePolicy = weatherSource === 'openmeteo' ? 'openmeteo' : 'meteoswiss'
  const agentPrefsRaw = request.headers.get('X-FOMO-Agent-Preferences')
  let agentPrefs: Record<string, unknown> = {}
  if (agentPrefsRaw) {
    try {
      const parsed = JSON.parse(agentPrefsRaw)
      if (parsed && typeof parsed === 'object') {
        agentPrefs = parsed as Record<string, unknown>
      }
    } catch {
      // Ignore malformed preference headers.
    }
  }
  const prefTravelMode = typeof agentPrefs.travel_mode === 'string' ? agentPrefs.travel_mode.toLowerCase() : ''
  if (prefTravelMode === 'car' || prefTravelMode === 'train' || prefTravelMode === 'both') {
    mode = prefTravelMode as TravelMode
  }
  const prefDestinationTypes = Array.isArray(agentPrefs.destination_types)
    ? agentPrefs.destination_types.map(v => String(v).trim().toLowerCase()).filter(Boolean)
    : []
  if (prefDestinationTypes.length > 0) {
    types = prefDestinationTypes
  }
  const prefAvoidTypes = Array.isArray(agentPrefs.avoid_types)
    ? agentPrefs.avoid_types.map(v => String(v).trim().toLowerCase()).filter(Boolean)
    : []
  const prefMaxTravelRaw = Number(agentPrefs.max_travel_h)
  if (Number.isFinite(prefMaxTravelRaw) && prefMaxTravelRaw > 0) {
    maxTravelH = Math.min(maxSupportedH, Math.max(0.5, prefMaxTravelRaw))
    if (travelMinH !== null) travelMinH = Math.min(travelMinH, maxTravelH)
    if (travelMaxH !== null) travelMaxH = Math.min(travelMaxH, maxTravelH)
  }
  const preferWarm = String(agentPrefs.temperature_preference || '').toLowerCase() === 'warm'
  const agentPrefsKey = JSON.stringify({
    travel_mode: mode,
    destination_types: prefDestinationTypes,
    avoid_types: prefAvoidTypes,
    max_travel_h: Number.isFinite(prefMaxTravelRaw) ? Math.round(maxTravelH * 100) / 100 : null,
    temperature_preference: preferWarm ? 'warm' : '',
  })
  const adminView = sp.get('admin') === 'true'
  const adminAll = adminView && sp.get('admin_all') === 'true'
  const useMeteoSwissOriginApi = adminView && weatherSource === 'meteoswiss_api'
  const rawLimit = parseInt(sp.get('limit') || '6')
  const limit = adminView
    ? Math.min(adminAll ? 5000 : 500, Math.max(1, rawLimit))
    : Math.min(20, Math.max(1, rawLimit))
  const tripSpan = normalizeTripSpan(sp.get('trip_span'))
  const originNameParam = (sp.get('origin_name') || '').trim().slice(0, 80)
  const originKind = sp.get('origin_kind') === 'manual'
    ? 'manual'
    : sp.get('origin_kind') === 'gps'
      ? 'gps'
      : 'default'
  const mapsOriginName = originKind === 'manual' ? originNameParam : ''
  const sbbOriginName = originNameParam || 'Basel'

  const requestedDemo = sp.get('demo') === 'true'
  let liveDebugPath = requestedDemo ? 'demo-requested' : 'live-requested'

  const logRequest = (input: {
    status: number
    liveSource: 'open-meteo' | 'mock'
    livePath: string
    fallback?: string
    cacheHit: boolean
  }) => {
    addRequestLog({
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      path: request.nextUrl.pathname,
      query: request.nextUrl.search,
      duration_ms: Date.now() - startedAt,
      status: input.status,
      live_source: input.liveSource,
      live_path: input.livePath,
      fallback: input.fallback,
      cache_hit: input.cacheHit,
    })
  }

  if (isNaN(lat) || isNaN(lon) || lat < 44 || lat > 50 || lon < 4 || lon > 12) {
    logRequest({
      status: 400,
      liveSource: requestedDemo ? 'mock' : 'open-meteo',
      livePath: 'invalid-coordinates',
      cacheHit: false,
    })
    return NextResponse.json({ error: 'Invalid coordinates.' }, { status: 400 })
  }

  const cacheKey = normalizeQueryCacheKey({
    lat, lon, maxTravelH, travelWindowH, travelMinH, travelMaxH, mode, hasGA, types, limit, requestedDemo, tripSpan, originName: originNameParam, originKind, weatherSource, agentPrefsKey,
  })
  if (!forceRefresh) {
    const cached = queryResponseCache.get(cacheKey)
    if (cached && cached.expires_at > Date.now()) {
      const cachedSource = cached.headers['X-FOMO-Live-Source'] === 'open-meteo' ? 'open-meteo' : 'mock'
      const cachedPath = cached.headers['X-FOMO-Debug-Live-Path'] || `${liveDebugPath}-cache-hit`
      const cachedFallback = cached.headers['X-FOMO-Live-Fallback']
      logRequest({
        status: 200,
        liveSource: cachedSource,
        livePath: `${cachedPath}-cache-hit`,
        fallback: cachedFallback || undefined,
        cacheHit: true,
      })
      return NextResponse.json(cached.response, {
        headers: {
          ...cached.headers,
          'X-FOMO-Response-Cache': 'HIT',
          'X-FOMO-Request-Ms': String(Date.now() - startedAt),
        },
      })
    }
    if (cached) queryResponseCache.delete(cacheKey)
  }

  const ip = clientIp(request)
  const liveRate = (requestedDemo || adminView)
    ? { limited: false, count: 0, remaining: LIVE_RATE_MAX_PER_WINDOW, reset_at: Date.now() + LIVE_RATE_WINDOW_MS }
    : consumeRateBudget(ip)
  const liveRateLimited = !requestedDemo && liveRate.limited
  let demoMode = requestedDemo || liveRateLimited
  let liveFallbackReason = liveRateLimited ? 'rate_limited' : ''
  let fallbackNotice = ''
  if (liveRateLimited) liveDebugPath = 'rate-limited'

  const maxTravelMin = maxTravelH * 60
  const reqId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const baselLikeOrigin = isBaselLikeOrigin(originNameParam, lat, lon)

  const mockOrigin = getMockOriginWeather()
  let originDescription = mockOrigin.description
  let originSunScore = mockOrigin.sun_score
  let originSunMin = mockOrigin.sunshine_min
  let originTempC = extractTempCFromText(mockOrigin.description) ?? 0
  let originTimeline: SunTimeline = getMockOriginTimeline()
  let sunWindow = { today: getMockDaylightWindow(0), tomorrow: getMockDaylightWindow(1) }
  let sunsetInfo = getMockSunset(demoMode)
  let originTomorrowHours = getMockTomorrowSunHours()
  if (tripSpan === 'plus1day') {
    originSunMin = Math.round(originTomorrowHours * 60)
  }
  let weatherFreshness = new Date().toISOString()
  let inversionLikely = true
  let originDataSource: 'open-meteo' | 'meteoswiss' | 'mock' = demoMode ? 'mock' : 'open-meteo'
  let fogHeuristicApplied = false
  const liveModelPolicy = weatherSource === 'openmeteo'
    ? 'all:open-meteo-default(best_match)'
    : weatherSource === 'meteoswiss'
      ? 'forecast:CH:meteoswiss_seamless|DE/FR/IT:best_match'
      : 'origin:meteoswiss-ogd|forecast:CH:meteoswiss_seamless|DE/FR/IT:best_match'

  // Pre-filter by rough distance and user filters
  let candidates = adminAll
    ? [...destinations]
    : preFilterByDistance(lat, lon, destinations, maxSupportedH)
  if (types.length > 0) candidates = candidates.filter(d => d.types.some(t => types.includes(t)))
  if (prefAvoidTypes.length > 0) candidates = candidates.filter(d => !d.types.some(t => prefAvoidTypes.includes(t)))
  const prefilterCandidateCount = candidates.length
  let livePoolCount = 0

  const candidatesWithTravel = candidates.map(dest => {
    const travelProfile = {
      country: dest.country,
      altitude_m: dest.altitude_m,
      has_sbb: Boolean(dest.sbb_name),
    }
    const car = (mode === 'car' || mode === 'both')
      ? getMockTravelTime(lat, lon, dest.lat, dest.lon, 'car', travelProfile)
      : undefined
    let train = (mode === 'train' || mode === 'both')
      ? getMockTravelTime(lat, lon, dest.lat, dest.lon, 'train', travelProfile)
      : undefined

    if (demoMode && car && train) {
      if (DEMO_TRAIN_FAST_IDS.has(dest.id)) {
        train = {
          ...train,
          duration_min: Math.max(22, Math.round(car.duration_min * demoTrainFactor(dest.id))),
          changes: Math.max(0, Math.min(1, (train.changes ?? 1) - 1)),
        }
      } else if (DEMO_TRAIN_SLOW_IDS.has(dest.id)) {
        train = {
          ...train,
          duration_min: Math.max(car.duration_min + 18, Math.round(car.duration_min * 1.35)),
          changes: Math.max(1, Math.min(3, (train.changes ?? 1) + 1)),
        }
      }
    }

    if (baselLikeOrigin) {
      if (car && typeof dest.travel_car_min === 'number') {
        car.duration_min = dest.travel_car_min
      }
      if (train && typeof dest.travel_train_min === 'number') {
        train.duration_min = dest.travel_train_min
      }
    }

    const bestTravelMin = Math.min(car?.duration_min ?? Infinity, train?.duration_min ?? Infinity)
    return {
      destination: dest,
      carTravel: car,
      trainTravel: train ? { ...train, ga_included: hasGA } : undefined,
      bestTravelMin,
    }
  })
  const liveCandidatesWithTravel = (demoMode || adminView)
    ? candidatesWithTravel
    : selectLiveWeatherPool(
      candidatesWithTravel,
      maxTravelMin,
      travelMinH === null ? null : Math.round(travelMinH * 60),
      travelMaxH === null ? null : Math.round(travelMaxH * 60)
    )

  let scored: ScoredWithTravel[] = []
  const buildDemoScored = () => {
    const originForGainMin = tripSpan === 'plus1day'
      ? Math.round(originTomorrowHours * 60)
      : originSunMin
    const demoTomorrowDaylight = getMockDaylightWindow(1)
    const firstSignificantTomorrowHour = Math.max(7, demoTomorrowDaylight.start_hour + 1)
    const earliestDepartureHour = 5.5
    return candidatesWithTravel.map(c => {
      const w = getMockWeather(c.destination, true)
      const tomorrowMin = Math.round(getMockTomorrowSunHoursForDest(c.destination, true) * 60)
      const effectiveSunMin = tripSpan === 'plus1day'
        ? clamp(tomorrowMin, 0, 600)
        : w.sunshine_forecast_min
      const netSunAfterArrivalMin = Math.max(0, Math.round(effectiveSunMin - c.bestTravelMin))
      const travelHours = c.bestTravelMin / 60
      const idealDepartureHour = roundHourToQuarter(firstSignificantTomorrowHour - travelHours)
      const cappedDepartureHour = roundHourToQuarter(Math.max(earliestDepartureHour, idealDepartureHour))
      const arrivalHour = cappedDepartureHour + travelHours
      const missedEarlyHours = Math.max(0, arrivalHour - firstSignificantTomorrowHour)
      const daylightHours = Math.max(1, demoTomorrowDaylight.end_hour - demoTomorrowDaylight.start_hour)
      const missedEarlySunMin = Math.round((missedEarlyHours / daylightHours) * tomorrowMin)
      const tomorrowNetAfterArrivalMin = Math.max(0, Math.round(tomorrowMin - missedEarlySunMin))
      const netGainVsOrigin = Math.max(0, netSunAfterArrivalMin - originForGainMin)
      return {
        destination: c.destination,
        sun_score: computeSunScore(c.destination, {
          ...w,
          sunshine_forecast_min: effectiveSunMin,
          sunshine_norm_cap_min: 600,
          gain_vs_origin_min: netGainVsOrigin,
          gain_norm_cap_min: 600,
          net_sun_after_arrival_min: netSunAfterArrivalMin,
          net_sun_norm_cap_min: 600,
        }),
        conditions: w.conditions_text,
        temp_c: w.temp_c,
        netSunAfterArrivalMin,
        netGainVsOriginMin: netGainVsOrigin,
        tomorrowSunMin: tomorrowMin,
        tomorrowNetAfterArrivalMin,
        optimalDeparture: hourToHHMM(cappedDepartureHour),
        carTravel: c.carTravel,
        trainTravel: c.trainTravel,
        bestTravelMin: c.bestTravelMin,
      }
    })
  }

  if (demoMode) {
    scored = buildDemoScored()
  } else {
    try {
      livePoolCount = liveCandidatesWithTravel.length
      const [originCurrent, originHourly, sunTimes, destinationWeather, swissOriginSnapshot] = await Promise.all([
        getCurrentWeather(lat, lon, { weather_source: forecastWeatherSource }),
        getHourlyForecast(lat, lon, { weather_source: forecastWeatherSource }),
        getSunTimes(lat, lon, { weather_source: forecastWeatherSource }),
        batchGetWeather(
          liveCandidatesWithTravel.map(c => ({ lat: c.destination.lat, lon: c.destination.lon, country: c.destination.country })),
          { weather_source: forecastWeatherSource }
        ),
        useMeteoSwissOriginApi ? getSwissMeteoOriginSnapshot(lat, lon) : Promise.resolve(null),
      ])
      weatherFreshness = new Date().toISOString()
      originDataSource = 'open-meteo'

      originDescription = originCurrent.conditions_text
      originSunMin = originCurrent.sunshine_duration_min
      originSunScore = originSunScoreFromCurrent(originCurrent)
      originTempC = Math.round(originCurrent.temperature_c)
      if (useMeteoSwissOriginApi && swissOriginSnapshot) {
        originDataSource = 'meteoswiss'
        originDescription = `${swissOriginSnapshot.description} · ${swissOriginSnapshot.station_name}`
        originSunMin = Math.max(0, Math.round(swissOriginSnapshot.sunshine_min))
        originSunScore = clamp(swissOriginSnapshot.sun_score, 0, 1)
        originTempC = Math.round(swissOriginSnapshot.temp_c)
      }
      const originFogRiskOpenMeteo = detectOriginFogRisk({
        isFoggy: originCurrent.is_foggy,
        visibilityM: originCurrent.visibility_m,
        lowCloudPct: originCurrent.low_cloud_cover_pct,
        cloudPct: originCurrent.cloud_cover_pct,
        humidityPct: originCurrent.relative_humidity_pct,
        windKmh: originCurrent.wind_speed_kmh,
        precipitationMm: originCurrent.precipitation_mm,
      })
      const originFogRiskSwiss = Boolean(
        useMeteoSwissOriginApi
        && swissOriginSnapshot
        && swissOriginSnapshot.humidity_pct >= 88
        && swissOriginSnapshot.sunshine_min <= 6
      )
      const originFogRisk = originFogRiskOpenMeteo || originFogRiskSwiss
      inversionLikely = originFogRisk || detectInversion({
        visibility_m: originCurrent.visibility_m,
        humidity_pct: originCurrent.relative_humidity_pct,
        temp_c: originCurrent.temperature_c,
        wind_speed_kmh: originCurrent.wind_speed_kmh,
      })

      sunWindow = {
        today: sunTimes.daylight_window_today,
        tomorrow: sunTimes.daylight_window_tomorrow,
      }
      originTimeline = timelineFromLive(originHourly.hours, sunWindow)
      const nowZurichHour = hourInZurich(new Date())
      const todayDay = dayStringInZurich(new Date())
      const tomorrowDay = tomorrowStringInZurich()
      const originTodayRemainingRawMin = sunnyMinutesLostDuringTravel({
        hours: originHourly.hours,
        dayStr: todayDay,
        departureHour: nowZurichHour,
        travelMin: Math.max(0, (sunWindow.today.end_hour - nowZurichHour) * 60),
        daylight: sunWindow.today,
      })
      const originTodayStats = dayAverages(originHourly.hours, todayDay)
      const originTodayAdjustedMin = applyOriginFogPenalty({
        sunshineMin: originTodayRemainingRawMin,
        fogRisk: originFogRisk,
        lowCloudPct: originTodayStats.lowCloudPct,
        cloudPct: originTodayStats.cloudPct,
        precipitationMm: originTodayStats.precipitationMm,
      })
      if (originTodayAdjustedMin !== originTodayRemainingRawMin) fogHeuristicApplied = true
      originSunMin = originTodayAdjustedMin
      const originTomorrowRawMin = Math.round(originHourly.total_sunshine_tomorrow_min)
      const originTomorrowStats = dayAverages(originHourly.hours, tomorrowDay)
      const originTomorrowAdjustedMin = applyOriginFogPenalty({
        sunshineMin: originTomorrowRawMin,
        fogRisk: originFogRisk,
        lowCloudPct: originTomorrowStats.lowCloudPct,
        cloudPct: originTomorrowStats.cloudPct,
        precipitationMm: originTomorrowStats.precipitationMm,
      })
      if (originTomorrowAdjustedMin !== originTomorrowRawMin) fogHeuristicApplied = true
      originTomorrowHours = Math.round((originTomorrowAdjustedMin / 60) * 10) / 10
      if (tripSpan === 'plus1day') {
        originSunMin = originTomorrowAdjustedMin
      }
      sunsetInfo = {
        time: sunTimes.sunset,
        minutes_until: sunTimes.sunset_minutes_until,
        is_past: sunTimes.sunset_minutes_until <= 0,
      }
      const weatherByKey = new Map(destinationWeather.map(w => [locationKey(w.lat, w.lon), w]))
      scored = liveCandidatesWithTravel.map(c => {
        const live = liveWeatherLookup(c.destination.lat, c.destination.lon, weatherByKey, destinationWeather)
        if (!live) {
          throw new Error(`Missing live weather for ${c.destination.id}`)
        }

        const liveWindow = computeLiveWeatherWindow(live.hours, inversionLikely, sunWindow.today)
        const destinationDaylightToday = resolveDaylightWindow(live, 'today', sunWindow.today)
        const destinationDaylightTomorrow = resolveDaylightWindow(live, 'tomorrow', sunWindow.tomorrow)
        const todayRemainingRawMin = sunnyMinutesLostDuringTravel({
          hours: live.hours,
          dayStr: todayDay,
          departureHour: nowZurichHour,
          travelMin: Math.max(0, (destinationDaylightToday.end_hour - nowZurichHour) * 60),
          daylight: destinationDaylightToday,
        })
        const tomorrowSunMinRaw = Math.round(live.total_sunshine_tomorrow_min)
        const tomorrowStats = dayAverages(live.hours, tomorrowDay)
        const tomorrowFogAdjusted = applyFogAltitudeAdjustment({
          baseSunMin: tomorrowSunMinRaw,
          destinationAltitudeM: c.destination.altitude_m,
          fogRisk: originFogRisk,
          lowCloudPct: tomorrowStats.lowCloudPct,
          cloudPct: tomorrowStats.cloudPct,
          precipitationMm: tomorrowStats.precipitationMm,
          snowfallCm: tomorrowStats.snowfallCm,
          capMin: 600,
        })
        const daytripFogAdjusted = applyFogAltitudeAdjustment({
          baseSunMin: todayRemainingRawMin,
          destinationAltitudeM: c.destination.altitude_m,
          fogRisk: originFogRisk,
          lowCloudPct: liveWindow.stats.lowCloudPct,
          cloudPct: liveWindow.stats.cloudPct,
          precipitationMm: liveWindow.stats.precipitationMm,
          snowfallCm: liveWindow.stats.snowfallCm,
          capMin: 600,
        })
        if (tomorrowFogAdjusted.applied || daytripFogAdjusted.applied) fogHeuristicApplied = true
        const tomorrowSunMin = tomorrowFogAdjusted.sunMin
        const lostTodaySunRawMin = sunnyMinutesLostDuringTravel({
          hours: live.hours,
          dayStr: todayDay,
          departureHour: nowZurichHour,
          travelMin: c.bestTravelMin,
          daylight: destinationDaylightToday,
        })
        const todayAdjustmentRatio = todayRemainingRawMin > 0
          ? daytripFogAdjusted.sunMin / todayRemainingRawMin
          : 1
        const lostTodaySunAdjustedMin = Math.max(0, Math.round(lostTodaySunRawMin * todayAdjustmentRatio))
        const firstSignificantTomorrowHour = Math.max(
          7,
          firstSignificantSunHour({
            hours: live.hours,
            dayStr: tomorrowDay,
            daylight: destinationDaylightTomorrow,
            thresholdMin: 15,
          })
        )
        const travelHours = c.bestTravelMin / 60
        const idealDepartureTomorrowHour = roundHourToQuarter(firstSignificantTomorrowHour - travelHours)
        const cappedDepartureTomorrowHour = roundHourToQuarter(Math.max(5.5, idealDepartureTomorrowHour))
        const arrivalTomorrowHour = cappedDepartureTomorrowHour + travelHours
        const missedEarlySunTomorrowMin = idealDepartureTomorrowHour < 5.5 && arrivalTomorrowHour > firstSignificantTomorrowHour
          ? sunnyMinutesLostDuringTravel({
            hours: live.hours,
            dayStr: tomorrowDay,
            departureHour: firstSignificantTomorrowHour,
            travelMin: Math.max(0, (arrivalTomorrowHour - firstSignificantTomorrowHour) * 60),
            daylight: destinationDaylightTomorrow,
          })
          : 0
        const todayNetSunAfterTravelMin = Math.max(0, Math.round(daytripFogAdjusted.sunMin - lostTodaySunAdjustedMin))
        const tomorrowNetSunAfterArrivalMin = Math.max(0, Math.round(tomorrowSunMin - missedEarlySunTomorrowMin))
        const effectiveSunMin = tripSpan === 'plus1day' ? tomorrowSunMin : daytripFogAdjusted.sunMin
        const effectiveNetSunMin = tripSpan === 'plus1day' ? tomorrowNetSunAfterArrivalMin : todayNetSunAfterTravelMin
        const originGainBaselineMin = tripSpan === 'plus1day'
          ? originTomorrowAdjustedMin
          : originSunMin
        const netSunAfterArrivalMin = effectiveNetSunMin
        const netGainVsOrigin = Math.max(0, netSunAfterArrivalMin - originGainBaselineMin)

        return {
          destination: c.destination,
          sun_score: computeSunScore(c.destination, {
            ...liveWindow.weatherInput,
            sunshine_forecast_min: effectiveSunMin,
            sunshine_norm_cap_min: 600,
            gain_vs_origin_min: netGainVsOrigin,
            gain_norm_cap_min: 600,
            net_sun_after_arrival_min: netSunAfterArrivalMin,
            net_sun_norm_cap_min: 600,
          }),
          conditions: liveWindow.conditionsText,
          temp_c: Math.round(live.current.temperature_c),
          netSunAfterArrivalMin,
          netGainVsOriginMin: netGainVsOrigin,
          tomorrowSunMin,
          tomorrowNetAfterArrivalMin: tomorrowNetSunAfterArrivalMin,
          optimalDeparture: hourToHHMM(cappedDepartureTomorrowHour),
          carTravel: c.carTravel,
          trainTravel: c.trainTravel,
          bestTravelMin: c.bestTravelMin,
          liveForecast: {
            hours: live.hours,
            total_sunshine_today_min: live.total_sunshine_today_min,
            total_sunshine_tomorrow_min: live.total_sunshine_tomorrow_min,
            sunrise_today_iso: live.sunrise_today_iso,
            sunrise_tomorrow_iso: live.sunrise_tomorrow_iso,
            sunset_today_iso: live.sunset_today_iso,
            sunset_tomorrow_iso: live.sunset_tomorrow_iso,
            daylight_window_today: live.daylight_window_today,
            daylight_window_tomorrow: live.daylight_window_tomorrow,
          },
        }
      })
      liveDebugPath = 'open-meteo-success'
    } catch (err) {
      const errMsg = String((err as { message?: string })?.message || err || '')
      const msg = String((errMsg || '')).toLowerCase()
      if (msg.includes('timeout') || msg.includes('abort')) liveDebugPath = 'open-meteo-timeout'
      else if (msg.includes('429') || msg.includes('rate')) liveDebugPath = 'open-meteo-rate-limit'
      else liveDebugPath = 'error-fallback'
      demoMode = true
      liveFallbackReason = 'cached_forecast'
      fallbackNotice = 'Using cached forecast'
      originDataSource = 'mock'
      originDescription = `${fallbackNotice} · ${mockOrigin.description}`
      originSunScore = mockOrigin.sun_score
      originSunMin = mockOrigin.sunshine_min
      originTempC = extractTempCFromText(mockOrigin.description) ?? 0
      originTimeline = getMockOriginTimeline()
      sunWindow = { today: getMockDaylightWindow(0), tomorrow: getMockDaylightWindow(1) }
      sunsetInfo = getMockSunset(true)
      originTomorrowHours = getMockTomorrowSunHours()
      if (tripSpan === 'plus1day') {
        originSunMin = Math.round(originTomorrowHours * 60)
      }
      scored = buildDemoScored()
    }
  }

  // Keep a much broader candidate set in demo so slider materially changes outcomes.
  const topLimit = demoMode ? 48 : Math.max(limit, candidatesWithTravel.length)
  const originTomorrowMin = Math.max(0, Math.round(originTomorrowHours * 60))
  const comparisonOriginMin = tripSpan === 'plus1day' ? originTomorrowMin : originSunMin
  const comparisonMetric = (row: ScoredWithTravel) => (
    tripSpan === 'plus1day' ? row.tomorrowNetAfterArrivalMin : row.netSunAfterArrivalMin
  )
  const sunshineForSurfaceMin = (row: ScoredWithTravel) => (
    tripSpan === 'plus1day' ? row.tomorrowSunMin : row.sun_score.sunshine_forecast_min
  )
  const isStrictBetterThanOrigin = (row: ScoredWithTravel) => {
    return sunshineForSurfaceMin(row) > comparisonOriginMin
  }
  const isAtLeastAsGoodAsOrigin = (row: ScoredWithTravel) => {
    return sunshineForSurfaceMin(row) >= comparisonOriginMin
  }
  const withTravel = scored
    .sort((a, b) => {
      const bMetric = comparisonMetric(b)
      const aMetric = comparisonMetric(a)
      if (bMetric !== aMetric) return bMetric - aMetric
      if (b.sun_score.score !== a.sun_score.score) return b.sun_score.score - a.sun_score.score
      return a.bestTravelMin - b.bestTravelMin
    })
    .slice(0, topLimit)
  const eligibleRows = withTravel
  const windowHalfMin = Math.round(travelWindowH * 60)
  const strictWindowMin = travelMinH !== null ? Math.round(travelMinH * 60) : Math.max(0, maxTravelMin - windowHalfMin)
  const strictWindowMax = travelMaxH !== null ? Math.round(travelMaxH * 60) : maxTravelMin + windowHalfMin
  let appliedWindowMin = strictWindowMin
  let appliedWindowMax = strictWindowMax
  const targetResultCount = adminView ? Math.min(5, limit) : Math.min(5, limit)

  const rankRowsByNet = (rows: ScoredWithTravel[], windowMin = strictWindowMin, windowMax = strictWindowMax): RankedEscapeRow[] => rows
    .map(r => {
      const netGainMin = Math.max(0, comparisonMetric(r) - comparisonOriginMin)
      const travelConvenience = 1 - clamp(r.bestTravelMin / maxTravelMin, 0, 1)
      const tempBoost = preferWarm ? clamp((r.temp_c - 6) * 1.6, 0, 16) : 0
      const combined = netGainMin * 0.72 + (r.sun_score.score * 100) * 0.2 + travelConvenience * 8 + tempBoost
      const inWindow = r.bestTravelMin >= windowMin && r.bestTravelMin <= windowMax
      const overflowMin = inWindow
        ? 0
        : (r.bestTravelMin < windowMin ? windowMin - r.bestTravelMin : r.bestTravelMin - windowMax)
      return {
        destination: r.destination,
        sun_score: r.sun_score,
        travel_time_min: r.bestTravelMin,
        net_gain_min: netGainMin,
        combined_score: combined,
        sunshine_min: sunshineForSurfaceMin(r),
        temperature_c: r.temp_c,
        in_window: inWindow,
        window_overflow_min: overflowMin,
      }
    })
    .sort((a, b) => {
      if (a.in_window !== b.in_window) return a.in_window ? -1 : 1
      if (a.window_overflow_min !== b.window_overflow_min) return a.window_overflow_min - b.window_overflow_min
      if (b.net_gain_min !== a.net_gain_min) return b.net_gain_min - a.net_gain_min
      if (preferWarm && b.temperature_c !== a.temperature_c) return b.temperature_c - a.temperature_c
      if (b.sun_score.score !== a.sun_score.score) return b.sun_score.score - a.sun_score.score
      return a.travel_time_min - b.travel_time_min
    })
  const rankRowsBySun = (rows: ScoredWithTravel[], windowMin = strictWindowMin, windowMax = strictWindowMax): RankedEscapeRow[] => rows
    .map(r => {
      const sunshineMin = sunshineForSurfaceMin(r)
      const netGainMin = Math.max(0, comparisonMetric(r) - comparisonOriginMin)
      const inWindow = r.bestTravelMin >= windowMin && r.bestTravelMin <= windowMax
      const overflowMin = inWindow
        ? 0
        : (r.bestTravelMin < windowMin ? windowMin - r.bestTravelMin : r.bestTravelMin - windowMax)
      return {
        destination: r.destination,
        sun_score: r.sun_score,
        travel_time_min: r.bestTravelMin,
        net_gain_min: netGainMin,
        combined_score: sunshineMin,
        sunshine_min: sunshineMin,
        temperature_c: r.temp_c,
        in_window: inWindow,
        window_overflow_min: overflowMin,
      }
    })
    .sort((a, b) => {
      if (b.sunshine_min !== a.sunshine_min) return b.sunshine_min - a.sunshine_min
      if (preferWarm && b.temperature_c !== a.temperature_c) return b.temperature_c - a.temperature_c
      if (b.sun_score.score !== a.sun_score.score) return b.sun_score.score - a.sun_score.score
      return a.travel_time_min - b.travel_time_min
    })

  const tierPredicates = {
    strict: (row: ScoredWithTravel) => isStrictBetterThanOrigin(row) && sunshineForSurfaceMin(row) >= 60,
    relaxed: (row: ScoredWithTravel) => isAtLeastAsGoodAsOrigin(row) && sunshineForSurfaceMin(row) >= 30,
    any_sun: (row: ScoredWithTravel) => sunshineForSurfaceMin(row) > 0,
  } as const

  const chooseTier = (rowsInWindow: ScoredWithTravel[], target: number): { tier: ResultTier; rows: ScoredWithTravel[] } => {
    const strictRows = rowsInWindow.filter(tierPredicates.strict)
    if (strictRows.length >= target) return { tier: 'strict', rows: strictRows }

    const relaxedRows = rowsInWindow.filter(tierPredicates.relaxed)
    if (relaxedRows.length >= target) return { tier: 'relaxed', rows: relaxedRows }

    const anySunRows = rowsInWindow.filter(tierPredicates.any_sun)
    if (anySunRows.length >= target) return { tier: 'any_sun', rows: anySunRows }

    return { tier: 'best_available', rows: rowsInWindow }
  }

  const rowsForWindow = (windowMin: number, windowMax: number) => (
    eligibleRows.filter(r => r.bestTravelMin >= windowMin && r.bestTravelMin <= windowMax)
  )

  const chooseTieredPool = (
    windowMin: number,
    windowMax: number,
    target: number
  ): { tier: ResultTier; rows: ScoredWithTravel[]; appliedMin: number; appliedMax: number } => {
    const widenSteps = [0, 30, 60]
    let fallback: { tier: ResultTier; rows: ScoredWithTravel[]; appliedMin: number; appliedMax: number } = {
      tier: 'best_available',
      rows: [],
      appliedMin: windowMin,
      appliedMax: windowMax,
    }

    for (const step of widenSteps) {
      const min = Math.max(0, windowMin - step)
      const max = windowMax + step
      const rows = rowsForWindow(min, max)
      if (rows.length === 0) continue
      const pick = chooseTier(rows, target)
      const selected = {
        tier: pick.tier,
        rows: pick.rows,
        appliedMin: min,
        appliedMax: max,
      }
      fallback = selected
      if (pick.rows.length >= target) return selected
      if (pick.tier !== 'best_available') return selected
      if (rows.length >= 3) return selected
    }

    if (eligibleRows.length > 0) {
      return {
        tier: 'best_available',
        rows: eligibleRows,
        appliedMin: windowMin,
        appliedMax: windowMax,
      }
    }

    return fallback
  }

  let resultTier: ResultTier = 'strict'
  let rankingPool: ScoredWithTravel[] = []
  const strictWindowRows = rowsForWindow(strictWindowMin, strictWindowMax)

  if (adminAll) {
    const tierProbe = chooseTier(strictWindowRows, targetResultCount)
    resultTier = tierProbe.tier
    rankingPool = eligibleRows.length > 0 ? eligibleRows : tierProbe.rows
  } else {
    const selectedPool = chooseTieredPool(strictWindowMin, strictWindowMax, targetResultCount)
    resultTier = selectedPool.tier
    rankingPool = selectedPool.rows
    appliedWindowMin = selectedPool.appliedMin
    appliedWindowMax = selectedPool.appliedMax
    if (rankingPool.length === 0 && eligibleRows.length > 0) {
      rankingPool = eligibleRows
      resultTier = 'best_available'
    }
  }

  const rankedByNet = resultTier === 'best_available'
    ? rankRowsBySun(rankingPool, appliedWindowMin, appliedWindowMax)
    : rankRowsByNet(rankingPool, appliedWindowMin, appliedWindowMax)

  const bucketCounts = UI_TRAVEL_BUCKETS.map(bucket => {
    const minMin = Math.round(bucket.min_h * 60)
    const maxMin = Math.round(bucket.max_h * 60)
    const rowsInBucket = rowsForWindow(minMin, maxMin)
    const selected = chooseTieredPool(minMin, maxMin, targetResultCount)
    const tierRows = selected.rows
    const strictCount = tierRows.filter(tierPredicates.strict).length
    const atLeastCount = tierRows.filter(tierPredicates.relaxed).length
    const anySunCount = tierRows.filter(tierPredicates.any_sun).length
    const rawCount = tierRows.length
    const count = Math.min(
      targetResultCount,
      selected.tier === 'strict'
        ? strictCount
        : selected.tier === 'relaxed'
          ? atLeastCount
          : selected.tier === 'any_sun'
            ? anySunCount
            : Math.max(rawCount, Math.min(targetResultCount, eligibleRows.length))
    )
    const nearRows = rowsInBucket.length > 0
      ? rowsInBucket
      : rowsForWindow(Math.max(0, minMin - 60), maxMin + 60)
    const destinationCount = nearRows.length > 0
      ? nearRows.length
      : (eligibleRows.length > 0 ? 1 : 0)
    return {
      ...bucket,
      count,
      strict_count: strictCount,
      at_least_count: atLeastCount,
      raw_count: rawCount,
      destination_count: destinationCount,
      result_tier: rawCount > 0 ? selected.tier : 'best_available',
    }
  })

  let pickedRanked = rankedByNet
  if (demoMode) {
    pickedRanked = [...rankedByNet]
      .sort((a, b) => {
        if (b.net_gain_min !== a.net_gain_min) return b.net_gain_min - a.net_gain_min
        const da = Math.abs(a.travel_time_min - maxTravelMin)
        const db = Math.abs(b.travel_time_min - maxTravelMin)
        if (da !== db) return da - db
        return b.sun_score.score - a.sun_score.score
      })
      .slice(0, Math.max(limit, 8))
  }
  if (!adminAll) {
    pickedRanked = diversifyTopRows(pickedRanked)
  }
  const dedupedPicked: RankedEscapeRow[] = []
  const seenPicked = new Set<string>()
  for (const row of pickedRanked) {
    if (seenPicked.has(row.destination.id)) continue
    seenPicked.add(row.destination.id)
    dedupedPicked.push(row)
  }
  pickedRanked = dedupedPicked

  // Compute optimal travel radius: maximize net sun (sunshine - round trip travel)
  let bestOptH = 2
  let bestNetSun = 0
  for (let testH = 0.5; testH <= maxSupportedH; testH += 0.25) {
    const testMin = testH * 60
    const bucket = withTravel.filter(r => r.bestTravelMin <= testMin && r.bestTravelMin > (testH - 0.5) * 60)
    if (bucket.length === 0) continue
    const avgNet = bucket.reduce((sum, r) => {
      return sum + comparisonMetric(r)
    }, 0) / bucket.length
    if (avgNet > bestNetSun) {
      bestNetSun = avgNet
      bestOptH = testH
    }
  }
  if (demoMode) {
    const demoMidPool = withTravel
      .filter(r => r.bestTravelMin >= 90 && r.bestTravelMin <= 240)
      .sort((a, b) => b.netSunAfterArrivalMin - a.netSunAfterArrivalMin)
    if (demoMidPool.length > 0) {
      const target = demoMidPool[0]
      const targetH = Math.round((target.bestTravelMin / 60) * 4) / 4
      bestOptH = clamp(targetH, 2, 3.5)
    } else {
      bestOptH = clamp(bestOptH, 2, 3.5)
    }
  }

  const comparisonOriginLabel = originNameParam || 'selected location'
  const tierEligibilityForRow = (row: ScoredWithTravel): ResultTier => {
    if (tierPredicates.strict(row)) return 'strict'
    if (tierPredicates.relaxed(row)) return 'relaxed'
    if (tierPredicates.any_sun(row)) return 'any_sun'
    return 'best_available'
  }

  function formatComparison(destMin: number, originMin: number): string {
    if (originMin <= 0 || destMin <= originMin) return ''
    const ratio = destMin / originMin
    if (ratio >= 2) return ` | ${ratio.toFixed(0)}x more sun than ${comparisonOriginLabel}`
    const pctMore = Math.round((ratio - 1) * 100)
    if (pctMore >= 10) return ` | +${pctMore}% more sun than ${comparisonOriginLabel}`
    return ''
  }

  const tourismMemo = new Map<string, Promise<TourismInfo>>()
  const getDestinationTourism = (destination: typeof destinations[number]) => {
    const existing = tourismMemo.get(destination.id)
    if (existing) return existing

    const fallback: TourismInfo = {
      description_short: `${destination.name} · ${destination.region}`,
      description_long: destination.description || `${destination.name} is a curated sunny destination in ${destination.region}.`,
      highlights: destination.plan_template.split(' | ').slice(0, 3),
      tags: destination.types || [],
      hero_image: `https://fomosun.com/api/og/${encodeURIComponent(destination.id)}`,
      official_url: `https://www.myswitzerland.com/en-ch/search/?q=${encodeURIComponent(destination.name)}`,
      pois_nearby: [],
      source: 'fallback',
    }

    if (adminView) {
      const immediate = Promise.resolve(fallback)
      tourismMemo.set(destination.id, immediate)
      return immediate
    }

    const pending = enrichDestination({
      id: destination.id,
      name: destination.name,
      lat: destination.lat,
      lon: destination.lon,
      region: destination.region,
      country: destination.country,
      types: destination.types,
      description: destination.description,
      plan_template: destination.plan_template,
      maps_name: destination.maps_name,
    }, {
      catalog: destinations,
    }).catch(() => fallback)
    tourismMemo.set(destination.id, pending)
    return pending
  }

  const toEscapeResultUnsafe = async (
    full: ScoredWithTravel,
    rank: number
  ): Promise<EscapeResult> => {
    const destSunMin = full.sun_score.sunshine_forecast_min
    const netSun = tripSpan === 'plus1day' ? full.tomorrowNetAfterArrivalMin : full.netSunAfterArrivalMin
    const cmp = formatComparison(destSunMin, originSunMin)
    const tourism = await getDestinationTourism(full.destination)

    const liveTimeline = !demoMode && full.liveForecast ? timelineFromLive(full.liveForecast.hours, sunWindow) : null
    const liveTomorrowSun = !demoMode && full.liveForecast
      ? Math.round((full.liveForecast.total_sunshine_tomorrow_min / 60) * 10) / 10
      : null
    const adminHourly = adminView && full.liveForecast
      ? full.liveForecast.hours.map(h => ({
        time: h.time,
        sunshine_min: h.sunshine_duration_min,
        cloud_cover_pct: h.cloud_cover_pct,
        low_cloud_cover_pct: h.low_cloud_cover_pct,
        temperature_c: h.temperature_c,
        relative_humidity_pct: h.relative_humidity_pct,
        wind_speed_kmh: h.wind_speed_kmh,
      }))
      : undefined

    return {
      rank,
      destination: full.destination,
      sun_score: full.sun_score,
      conditions: `${destSunMin} min sunshine${cmp}`,
      net_sun_min: netSun,
      optimal_departure: full.optimalDeparture,
      tier_eligibility: tierEligibilityForRow(full),
      weather_model: weatherModelForDestination(full.destination, weatherSource),
      weather_now: {
        summary: full.conditions,
        temp_c: full.temp_c,
      },
      tourism,
      travel: {
        car: full.carTravel ? { mode: 'car' as const, duration_min: full.carTravel.duration_min, distance_km: full.carTravel.distance_km } : undefined,
        train: full.trainTravel ? { mode: 'train' as const, duration_min: full.trainTravel.duration_min, changes: full.trainTravel.changes, ga_included: hasGA } : undefined,
      },
      plan: buildTripPlan(full.destination),
      links: {
        google_maps: buildGoogleMapsDirectionsUrl(
          full.destination.maps_name,
          mapsOriginName,
          full.destination.name,
          full.destination.country
        ),
        sbb: buildSbbTimetableUrl(full.destination.sbb_name, sbbOriginName, tripSpan),
        webcam: full.destination.webcam_url,
      },
      sun_timeline: liveTimeline ?? getMockSunTimeline(full.destination, demoMode),
      tomorrow_sun_hours: liveTomorrowSun ?? getMockTomorrowSunHoursForDest(full.destination, demoMode),
      admin_hourly: adminHourly,
    }
  }

  const toEscapeResult = async (
    full: ScoredWithTravel,
    rank: number
  ): Promise<EscapeResult | null> => {
    try {
      return await toEscapeResultUnsafe(full, rank)
    } catch (err) {
      console.error('[fomo] escape-row-failed', full.destination?.id, err)
      return null
    }
  }

  const fastestCandidate = eligibleRows
    .filter(r => Number.isFinite(r.bestTravelMin))
    .filter(r => r.bestTravelMin <= 75)
    .sort((a, b) => {
      const aNetGain = Math.max(0, comparisonMetric(a) - comparisonOriginMin)
      const bNetGain = Math.max(0, comparisonMetric(b) - comparisonOriginMin)
      if (bNetGain !== aNetGain) return bNetGain - aNetGain
      if (b.sun_score.score !== a.sun_score.score) return b.sun_score.score - a.sun_score.score
      if (a.bestTravelMin !== b.bestTravelMin) return a.bestTravelMin - b.bestTravelMin
      return b.destination.altitude_m - a.destination.altitude_m
    })[0]

  const warmestCandidate = eligibleRows
    .filter(r => Number.isFinite(r.temp_c))
    .sort((a, b) => {
      if (b.temp_c !== a.temp_c) return b.temp_c - a.temp_c
      const bMetric = comparisonMetric(b)
      const aMetric = comparisonMetric(a)
      if (bMetric !== aMetric) return bMetric - aMetric
      if (b.sun_score.score !== a.sun_score.score) return b.sun_score.score - a.sun_score.score
      return a.bestTravelMin - b.bestTravelMin
    })
    .find(r => r.temp_c > originTempC + 3)

  const topRows = pickedRanked
    .slice(0, limit)
    .map(r => withTravel.find(w => w.destination.id === r.destination.id))
    .filter((row): row is ScoredWithTravel => Boolean(row))
  const tourismTargets = new Map<string, typeof destinations[number]>()
  for (const row of topRows) tourismTargets.set(row.destination.id, row.destination)
  if (fastestCandidate) tourismTargets.set(fastestCandidate.destination.id, fastestCandidate.destination)
  if (warmestCandidate) tourismTargets.set(warmestCandidate.destination.id, warmestCandidate.destination)

  const tourismSourceSet = new Set<TourismInfo['source']>()
  await Promise.all(Array.from(tourismTargets.values()).map(async (destination) => {
    const tourism = await getDestinationTourism(destination)
    tourismSourceSet.add(tourism.source)
  }))

  const escapes: EscapeResult[] = (await Promise.all(topRows.map((row, i) => toEscapeResult(row, i + 1))))
    .filter((row): row is EscapeResult => Boolean(row))
  const fastestEscape = fastestCandidate ? (await toEscapeResult(fastestCandidate, 0) ?? undefined) : undefined
  const warmestEscape = warmestCandidate ? (await toEscapeResult(warmestCandidate, 0) ?? undefined) : undefined

  const originName = originNameParam || (
    (Math.abs(lat - DEFAULT_ORIGIN.lat) < 0.1 && Math.abs(lon - DEFAULT_ORIGIN.lon) < 0.1)
      ? 'Basel'
      : `${lat.toFixed(2)}, ${lon.toFixed(2)}`
  )

  const liveMaxSunHoursToday = !demoMode
    ? Math.max(
      originSunMin / 60,
      ...withTravel.map(w => (w.liveForecast?.total_sunshine_today_min ?? 0) / 60)
    )
    : getMockMaxSunHours()

  const tourismAttribution: string[] = []
  if (tourismSourceSet.has('discover.swiss')) tourismAttribution.push('Tourism: discover.swiss API')
  if (tourismSourceSet.has('geo.admin.ch')) tourismAttribution.push('Tourism context: geo.admin.ch Search API')
  if (tourismSourceSet.has('fallback')) tourismAttribution.push('Tourism fallback: FOMO curated destination catalog')

  const response: SunnyEscapesResponse = {
    _meta: {
      request_id: reqId,
      origin: { name: originName, lat, lon },
      generated_at: new Date().toISOString(),
      weather_data_freshness: weatherFreshness,
      attribution: [
        'Weather: Open-Meteo',
        'Routing: Open Journey Planner',
        ...tourismAttribution,
        'FOMO Sun - fomosun.com',
      ],
      demo_mode: demoMode,
      trip_span: tripSpan,
      result_tier: resultTier,
      fallback_notice: fallbackNotice || undefined,
      bucket_counts: bucketCounts,
    },
    origin_conditions: {
      description: originDescription,
      sun_score: originSunScore,
      sunshine_min: originSunMin,
    },
    origin_timeline: originTimeline,
    sun_window: sunWindow,
    max_sun_hours_today: Math.round(liveMaxSunHoursToday * 10) / 10,
    sunset: sunsetInfo,
    tomorrow_sun_hours: originTomorrowHours,
    optimal_travel_h: bestOptH,
    fastest_escape: fastestEscape,
    warmest_escape: warmestEscape,
    escapes,
  }

  const cacheControl = isNearMidnightZurich()
    ? 'public, s-maxage=60, stale-while-revalidate=3600'
    : 'public, s-maxage=300, stale-while-revalidate=3600'
  const headers: Record<string, string> = {
    'Cache-Control': cacheControl,
    'X-FOMO-Sun-Version': '0.6.2',
    'X-FOMO-Live-Source': demoMode ? 'mock' : 'open-meteo',
    'X-FOMO-Trip-Span': tripSpan,
    'X-FOMO-Response-Cache': 'MISS',
    'X-FOMO-Live-Rate-Limit': `${LIVE_RATE_MAX_PER_WINDOW};w=${Math.round(LIVE_RATE_WINDOW_MS / 1000)}`,
    'X-FOMO-Live-Rate-Remaining': String(liveRate.remaining),
    'X-FOMO-Live-Rate-Count': String(liveRate.count),
    'X-FOMO-Live-Rate-Reset-S': String(Math.max(0, Math.round((liveRate.reset_at - Date.now()) / 1000))),
    'X-FOMO-POI-Count': String(destinations.length),
    'X-FOMO-POI-Target': String(TARGET_POI_COUNT),
    'X-FOMO-Candidate-Count': String(prefilterCandidateCount),
    'X-FOMO-Live-Pool-Count': String(livePoolCount),
    'X-FOMO-Debug-Live-Path': liveDebugPath,
    'X-FOMO-Origin-Source': originDataSource,
    'X-FOMO-Weather-Source': weatherSource,
    'X-FOMO-Weather-Model-Policy': liveModelPolicy,
    'X-FOMO-Fog-Heuristic': fogHeuristicApplied ? 'applied' : 'off',
    'X-FOMO-Trip-Horizon': tripSpan === 'plus1day' ? 'tomorrow-only' : 'today-remaining-daylight',
    'X-FOMO-Result-Tier': resultTier,
    'X-FOMO-Travel-Window-Min': String(appliedWindowMin),
    'X-FOMO-Travel-Window-Max': String(appliedWindowMax),
    'X-FOMO-Agent-Prefs-Applied': Object.keys(agentPrefs).length > 0 ? '1' : '0',
    'X-FOMO-Force-Refresh': forceRefresh ? '1' : '0',
    'X-FOMO-Tourism-Sources': Array.from(tourismSourceSet).sort().join(',') || 'fallback',
    'X-FOMO-Request-Ms': String(Date.now() - startedAt),
  }
  if (liveFallbackReason) headers['X-FOMO-Live-Fallback'] = liveFallbackReason
  if (fallbackNotice) headers['X-FOMO-Fallback-Notice'] = fallbackNotice

  if (!liveFallbackReason && !forceRefresh) {
    if (queryResponseCache.size > 600) {
      const now = Date.now()
      for (const [k, v] of Array.from(queryResponseCache.entries())) {
        if (v.expires_at <= now) queryResponseCache.delete(k)
      }
    }
    queryResponseCache.set(cacheKey, {
      expires_at: Date.now() + QUERY_CACHE_TTL_MS,
      response,
      headers,
    })
  }

  logRequest({
    status: 200,
    liveSource: demoMode ? 'mock' : 'open-meteo',
    livePath: liveDebugPath,
    fallback: liveFallbackReason || undefined,
    cacheHit: false,
  })

  return NextResponse.json(response, { headers })
}
