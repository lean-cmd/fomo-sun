import { NextRequest, NextResponse } from 'next/server'
import { destinations, DEFAULT_ORIGIN } from '@/data/destinations'
import { computeSunScore, detectInversion, preFilterByDistance, rankDestinations } from '@/lib/scoring'
import { getMockWeather, getMockOriginWeather, getMockTravelTime, getMockSunTimeline, getMockMaxSunHours, getMockSunset, getMockTomorrowSunHours, getMockOriginTimeline, getMockTomorrowSunHoursForDest, getMockDaylightWindow } from '@/lib/mock-weather'
import { batchGetWeather, getCurrentWeather, getHourlyForecast, getSunTimes } from '@/lib/open-meteo'
import { DaylightWindow, EscapeResult, SunnyEscapesResponse, SunTimeline, TravelMode } from '@/lib/types'
import { addRequestLog } from '@/lib/request-log'

type LiveForecastBundle = Awaited<ReturnType<typeof getHourlyForecast>>
type TripSpan = 'daytrip' | 'plus1day'

type ScoredWithTravel = {
  destination: typeof destinations[number]
  sun_score: ReturnType<typeof computeSunScore>
  conditions: string
  temp_c: number
  carTravel?: ReturnType<typeof getMockTravelTime>
  trainTravel?: ReturnType<typeof getMockTravelTime> & { ga_included?: boolean }
  bestTravelMin: number
  liveForecast?: LiveForecastBundle
}

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
const LIVE_WEATHER_POOL_MIN = 60
const LIVE_WEATHER_POOL_MAX = 140
const queryResponseCache = new Map<string, { expires_at: number; response: SunnyEscapesResponse; headers: Record<string, string> }>()

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function avg(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function demoTrainFactor(id: string): number {
  const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return 0.62 + (hash % 7) * 0.025 // 0.62 - 0.77
}

function mapsPlaceLabel(name: string) {
  const value = name.trim()
  if (!value) return value
  const lower = value.toLowerCase()
  if (lower.includes('switzerland') || lower.includes('germany') || lower.includes('france') || value.includes(',')) {
    return value
  }
  return `${value}, Switzerland`
}

function buildGoogleMapsDirectionsUrl(mapsName: string, originName?: string) {
  const p = new URLSearchParams({
    api: '1',
    destination: mapsPlaceLabel(mapsName),
    travelmode: 'driving',
  })
  if (originName?.trim()) p.set('origin', mapsPlaceLabel(originName))
  return `https://www.google.com/maps/dir/?${p.toString()}`
}

function buildSbbTimetableUrl(sbbName?: string | null, originName = 'Basel') {
  if (!sbbName) return undefined
  const p = new URLSearchParams({ from: originName, to: sbbName })
  return `https://www.sbb.ch/en/timetable.html?${p.toString()}`
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

function remainingTodaySunshineMin(hours: LiveForecastBundle['hours']) {
  const now = Date.now()
  const today = new Date().toISOString().slice(0, 10)
  return Math.round(
    hours
      .filter(h => h.time.startsWith(today))
      .filter(h => new Date(h.time).getTime() >= now)
      .reduce((sum, h) => sum + h.sunshine_duration_min, 0)
  )
}

function normalizeQueryCacheKey(input: {
  lat: number
  lon: number
  maxTravelH: number
  mode: TravelMode
  hasGA: boolean
  types: string[]
  limit: number
  requestedDemo: boolean
  tripSpan: TripSpan
  originName: string
  originKind: 'manual' | 'gps' | 'default'
}) {
  const latKey = input.lat.toFixed(3)
  const lonKey = input.lon.toFixed(3)
  const hKey = (Math.round(input.maxTravelH * 4) / 4).toFixed(2)
  const typeKey = [...input.types].sort().join(',')
  return [
    `lat=${latKey}`,
    `lon=${lonKey}`,
    `h=${hKey}`,
    `mode=${input.mode}`,
    `ga=${input.hasGA ? 1 : 0}`,
    `types=${typeKey || '-'}`,
    `limit=${input.limit}`,
    `demo=${input.requestedDemo ? 1 : 0}`,
    `span=${input.tripSpan}`,
    `origin=${input.originName.toLowerCase() || '-'}`,
    `origin_kind=${input.originKind}`,
  ].join('&')
}

function selectLiveWeatherPool(candidates: Array<{
  destination: typeof destinations[number]
  bestTravelMin: number
  carTravel?: ReturnType<typeof getMockTravelTime>
  trainTravel?: ReturnType<typeof getMockTravelTime> & { ga_included?: boolean }
}>, maxTravelMin: number) {
  if (candidates.length <= LIVE_WEATHER_POOL_MAX) return candidates

  const target = clamp(
    Math.round((maxTravelMin / 60) * 28),
    LIVE_WEATHER_POOL_MIN,
    LIVE_WEATHER_POOL_MAX
  )

  const nearQuota = Math.max(24, Math.round(target * 0.6))
  const altitudeQuota = Math.max(16, Math.round(target * 0.25))
  const farQuota = Math.max(8, target - nearQuota - altitudeQuota)

  const byNear = [...candidates]
    .sort((a, b) => a.bestTravelMin - b.bestTravelMin)
    .slice(0, nearQuota)

  const byAltitude = [...candidates]
    .sort((a, b) => b.destination.altitude_m - a.destination.altitude_m)
    .slice(0, altitudeQuota)

  const byFar = [...candidates]
    .sort((a, b) => b.bestTravelMin - a.bestTravelMin)
    .slice(0, farQuota)

  const merged = [...byNear, ...byAltitude, ...byFar]
  const deduped = new Map<string, typeof candidates[number]>()
  for (const row of merged) deduped.set(row.destination.id, row)

  if (deduped.size < target) {
    for (const row of [...candidates].sort((a, b) => b.destination.altitude_m - a.destination.altitude_m)) {
      if (deduped.has(row.destination.id)) continue
      deduped.set(row.destination.id, row)
      if (deduped.size >= target) break
    }
  }

  return Array.from(deduped.values())
}

function computeLiveWeatherWindow(hours: LiveForecastBundle['hours'], inversionLikely: boolean) {
  const now = Date.now()
  const next3 = hours.filter(h => {
    const t = new Date(h.time).getTime()
    return t >= now && t <= now + 3 * 60 * 60 * 1000
  })
  const window = next3.length >= 2 ? next3 : hours.slice(0, 3)

  const sunshineMin = Math.round(window.reduce((s, h) => s + h.sunshine_duration_min, 0))
  const lowCloud = Math.round(avg(window.map(h => h.low_cloud_cover_pct)))
  const totalCloud = Math.round(avg(window.map(h => h.cloud_cover_pct)))
  const temp = Math.round(avg(window.map(h => h.temperature_c)))
  const humidity = Math.round(avg(window.map(h => h.relative_humidity_pct)))
  const wind = Math.round(avg(window.map(h => h.wind_speed_kmh)))

  let conditionsText = ''
  if (sunshineMin >= 90 && lowCloud < 35) conditionsText = `Mostly sunny, ${temp}°C`
  else if (sunshineMin >= 45) conditionsText = `Partly sunny, ${temp}°C`
  else if (lowCloud > 80 || (humidity > 88 && wind < 10)) conditionsText = `Fog/low cloud likely, ${temp}°C`
  else conditionsText = `Cloudy, ${temp}°C`

  return {
    weatherInput: {
      sunshine_forecast_min: clamp(sunshineMin, 0, 180),
      low_cloud_cover_pct: clamp(lowCloud, 0, 100),
      total_cloud_cover_pct: clamp(totalCloud, 0, 100),
      is_inversion_likely: inversionLikely,
      ground_truth_available: true,
      ground_truth_sunny: sunshineMin >= 60,
    },
    conditionsText,
    tempC: temp,
  }
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
  return destination.plan_template.split(' | ')
}

function hourCondition(h: LiveForecastBundle['hours'][number]) {
  if (h.sunshine_duration_min >= 45) return 'sun'
  if (h.sunshine_duration_min >= 15) return 'partial'
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
  const todayStr = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  const toSegments = (day: string, window: DaylightWindow) => {
    const daytime = hours
      .filter(h => h.time.startsWith(day))
      .filter(h => {
        const t = new Date(h.time)
        const hh = t.getHours() + t.getMinutes() / 60
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
  const maxSupportedH = 4.5
  const lat = parseFloat(sp.get('lat') || String(DEFAULT_ORIGIN.lat))
  const lon = parseFloat(sp.get('lon') || String(DEFAULT_ORIGIN.lon))
  const maxTravelH = Math.min(maxSupportedH, Math.max(0.5, parseFloat(sp.get('max_travel_h') || '2.5')))
  const mode: TravelMode = (sp.get('mode') as TravelMode) || 'both'
  const hasGA = sp.get('ga') === 'true'
  const typesParam = sp.get('types')
  const types = typesParam ? typesParam.split(',') : []
  const adminView = sp.get('admin') === 'true'
  const rawLimit = parseInt(sp.get('limit') || '6')
  const limit = adminView
    ? Math.min(500, Math.max(1, rawLimit))
    : Math.min(10, Math.max(1, rawLimit))
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
    lat, lon, maxTravelH, mode, hasGA, types, limit, requestedDemo, tripSpan, originName: originNameParam, originKind,
  })
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

  const ip = clientIp(request)
  const liveRate = requestedDemo
    ? { limited: false, count: 0, remaining: LIVE_RATE_MAX_PER_WINDOW, reset_at: Date.now() + LIVE_RATE_WINDOW_MS }
    : consumeRateBudget(ip)
  const liveRateLimited = !requestedDemo && liveRate.limited
  let demoMode = requestedDemo || liveRateLimited
  let liveFallbackReason = liveRateLimited ? 'rate_limited' : ''
  let fallbackNotice = ''
  if (liveRateLimited) liveDebugPath = 'rate-limited'

  const maxTravelMin = maxTravelH * 60
  const reqId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  const mockOrigin = getMockOriginWeather()
  let originDescription = mockOrigin.description
  let originSunScore = mockOrigin.sun_score
  let originSunMin = mockOrigin.sunshine_min
  let originTimeline: SunTimeline = getMockOriginTimeline()
  let sunWindow = { today: getMockDaylightWindow(0), tomorrow: getMockDaylightWindow(1) }
  let sunsetInfo = getMockSunset(demoMode)
  let originTomorrowHours = getMockTomorrowSunHours()
  if (tripSpan === 'plus1day') {
    originSunMin = Math.round(originSunMin + originTomorrowHours * 60)
  }
  let weatherFreshness = new Date().toISOString()
  let inversionLikely = true

  // Pre-filter by rough distance and user filters
  let candidates = preFilterByDistance(lat, lon, destinations, maxSupportedH)
  if (types.length > 0) candidates = candidates.filter(d => d.types.some(t => types.includes(t)))
  const prefilterCandidateCount = candidates.length
  let livePoolCount = 0

  const candidatesWithTravel = candidates.map(dest => {
    const car = (mode === 'car' || mode === 'both') ? getMockTravelTime(lat, lon, dest.lat, dest.lon, 'car') : undefined
    let train = (mode === 'train' || mode === 'both') ? getMockTravelTime(lat, lon, dest.lat, dest.lon, 'train') : undefined

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
    : selectLiveWeatherPool(candidatesWithTravel, maxTravelMin)

  let scored: ScoredWithTravel[] = []
  const buildDemoScored = () => {
    return candidatesWithTravel.map(c => {
      const w = getMockWeather(c.destination, true)
      const tomorrowMin = Math.round(getMockTomorrowSunHoursForDest(c.destination, true) * 60)
      const effectiveSunMin = tripSpan === 'plus1day'
        ? clamp(w.sunshine_forecast_min + tomorrowMin, 0, 600)
        : w.sunshine_forecast_min
      const gainVsOrigin = Math.max(0, effectiveSunMin - originSunMin)
      return {
        destination: c.destination,
        sun_score: computeSunScore(c.destination, {
          ...w,
          sunshine_forecast_min: effectiveSunMin,
          sunshine_norm_cap_min: tripSpan === 'plus1day' ? 600 : 180,
          gain_vs_origin_min: gainVsOrigin,
          gain_norm_cap_min: tripSpan === 'plus1day' ? 600 : 180,
        }),
        conditions: w.conditions_text,
        temp_c: w.temp_c,
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
      const [originCurrent, originHourly, sunTimes, destinationWeather] = await Promise.all([
        getCurrentWeather(lat, lon),
        getHourlyForecast(lat, lon),
        getSunTimes(lat, lon),
        batchGetWeather(liveCandidatesWithTravel.map(c => ({ lat: c.destination.lat, lon: c.destination.lon }))),
      ])
      weatherFreshness = new Date().toISOString()

      originDescription = originCurrent.conditions_text
      originSunMin = originCurrent.sunshine_duration_min
      originSunScore = originSunScoreFromCurrent(originCurrent)
      inversionLikely = detectInversion({
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
      originTomorrowHours = Math.round((originHourly.total_sunshine_tomorrow_min / 60) * 10) / 10
      if (tripSpan === 'plus1day') {
        const remainingOriginMin = remainingTodaySunshineMin(originHourly.hours)
        originSunMin = Math.round(remainingOriginMin + originHourly.total_sunshine_tomorrow_min)
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

        const liveWindow = computeLiveWeatherWindow(live.hours, inversionLikely)
        const remainingTodayMin = remainingTodaySunshineMin(live.hours)
        const effectiveSunMin = tripSpan === 'plus1day'
          ? clamp(remainingTodayMin + live.total_sunshine_tomorrow_min, 0, 600)
          : liveWindow.weatherInput.sunshine_forecast_min
        const gainVsOrigin = Math.max(0, effectiveSunMin - originSunMin)

        return {
          destination: c.destination,
          sun_score: computeSunScore(c.destination, {
            ...liveWindow.weatherInput,
            sunshine_forecast_min: effectiveSunMin,
            sunshine_norm_cap_min: tripSpan === 'plus1day' ? 600 : 180,
            gain_vs_origin_min: gainVsOrigin,
            gain_norm_cap_min: tripSpan === 'plus1day' ? 600 : 180,
          }),
          conditions: liveWindow.conditionsText,
          temp_c: Math.round(live.current.temperature_c),
          carTravel: c.carTravel,
          trainTravel: c.trainTravel,
          bestTravelMin: c.bestTravelMin,
          liveForecast: {
            hours: live.hours,
            total_sunshine_today_min: live.total_sunshine_today_min,
            total_sunshine_tomorrow_min: live.total_sunshine_tomorrow_min,
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
      originDescription = `${fallbackNotice} · ${mockOrigin.description}`
      originSunScore = mockOrigin.sun_score
      originSunMin = mockOrigin.sunshine_min
      originTimeline = getMockOriginTimeline()
      sunWindow = { today: getMockDaylightWindow(0), tomorrow: getMockDaylightWindow(1) }
      sunsetInfo = getMockSunset(true)
      originTomorrowHours = getMockTomorrowSunHours()
      if (tripSpan === 'plus1day') {
        originSunMin = Math.round(originSunMin + originTomorrowHours * 60)
      }
      scored = buildDemoScored()
    }
  }

  // Keep a much broader candidate set in demo so slider materially changes outcomes.
  const topLimit = demoMode ? 48 : Math.max(limit, candidatesWithTravel.length)
  const withTravel = scored.sort((a, b) => b.sun_score.score - a.sun_score.score).slice(0, topLimit)
  const windowMin = Math.max(30, maxTravelMin - 30)
  const windowMax = maxTravelMin + 30
  const inTravelWindow = withTravel.filter(r => r.bestTravelMin >= windowMin && r.bestTravelMin <= windowMax)

  // Default ranking path
  let pickedRanked = rankDestinations(
    inTravelWindow
      .map(r => ({ destination: r.destination, sun_score: r.sun_score, travel_time_min: r.bestTravelMin })),
    maxTravelMin
  )

  // Live mode: rank primarily by sun quality, with a lighter travel-time tie-breaker.
  if (!demoMode) {
    const rankedLive = inTravelWindow
      .map(r => {
        const travelConvenience = 1 - clamp(r.bestTravelMin / maxTravelMin, 0, 1)
        const combined = r.sun_score.score * 0.88 + travelConvenience * 0.12
        return {
          destination: r.destination,
          sun_score: r.sun_score,
          travel_time_min: r.bestTravelMin,
          combined_score: combined,
        }
      })
      .sort((a, b) => {
        const scoreDelta = b.sun_score.score - a.sun_score.score
        if (Math.abs(scoreDelta) >= 0.08) return scoreDelta
        return b.combined_score - a.combined_score
      })
    pickedRanked = rankedLive
  }

  // Demo mode uses slider-centered window sorting for material list changes.
  if (demoMode) {
    const sortedByScore = inTravelWindow
      .map(r => ({
        destination: r.destination,
        sun_score: r.sun_score,
        travel_time_min: r.bestTravelMin,
        combined_score: r.sun_score.score,
      }))
      .sort((a, b) => {
        if (b.sun_score.score !== a.sun_score.score) return b.sun_score.score - a.sun_score.score
        const da = Math.abs(a.travel_time_min - maxTravelMin)
        const db = Math.abs(b.travel_time_min - maxTravelMin)
        return da - db
      })

    let selected = sortedByScore.slice(0, limit)
    const hasNonHigh = selected.some(r => r.sun_score.confidence !== 'high')
    if (!hasNonHigh) {
      const nonHighCandidate = sortedByScore.find(r => r.sun_score.confidence !== 'high' && !selected.some(s => s.destination.id === r.destination.id))
      if (nonHighCandidate && selected.length > 0) selected[selected.length - 1] = nonHighCandidate
    }

    selected = selected.sort((a, b) => {
      if (b.sun_score.score !== a.sun_score.score) return b.sun_score.score - a.sun_score.score
      const da = Math.abs(a.travel_time_min - maxTravelMin)
      const db = Math.abs(b.travel_time_min - maxTravelMin)
      return da - db
    })
    pickedRanked = selected
  }

  // Compute optimal travel radius: maximize net sun (sunshine - round trip travel)
  const remainingDayMin = sunsetInfo.minutes_until
  let bestOptH = 2
  let bestNetSun = 0
  for (let testH = 0.5; testH <= maxSupportedH; testH += 0.25) {
    const testMin = testH * 60
    const bucket = withTravel.filter(r => r.bestTravelMin <= testMin && r.bestTravelMin > (testH - 0.5) * 60)
    if (bucket.length === 0) continue
    const avgNet = bucket.reduce((sum, r) => {
      const sunMin = r.sun_score.sunshine_forecast_min
      const travelRound = r.bestTravelMin * 2
      const usableSun = Math.max(0, Math.min(sunMin, remainingDayMin - travelRound))
      return sum + usableSun
    }, 0) / bucket.length
    if (avgNet > bestNetSun) {
      bestNetSun = avgNet
      bestOptH = testH
    }
  }
  if (demoMode) {
    const demoMidPool = withTravel
      .filter(r => r.bestTravelMin >= 90 && r.bestTravelMin <= 240)
      .sort((a, b) => b.sun_score.score - a.sun_score.score)
    if (demoMidPool.length > 0) {
      const target = demoMidPool[0]
      const targetH = Math.round((target.bestTravelMin / 60) * 4) / 4
      bestOptH = clamp(targetH, 2, 3.5)
    } else {
      bestOptH = clamp(bestOptH, 2, 3.5)
    }
  }

  const comparisonOriginLabel = originNameParam || 'selected location'

  function formatComparison(destMin: number, originMin: number): string {
    if (originMin <= 0 || destMin <= originMin) return ''
    const ratio = destMin / originMin
    if (ratio >= 2) return ` | ${ratio.toFixed(0)}x more sun than ${comparisonOriginLabel}`
    const pctMore = Math.round((ratio - 1) * 100)
    if (pctMore >= 10) return ` | +${pctMore}% more sun than ${comparisonOriginLabel}`
    return ''
  }

  const toEscapeResult = (
    full: ScoredWithTravel,
    rank: number
  ): EscapeResult => {
    const destSunMin = full.sun_score.sunshine_forecast_min
    const roundTrip = full.bestTravelMin * 2
    const netSun = Math.max(0, Math.min(destSunMin, remainingDayMin - roundTrip))
    const cmp = formatComparison(destSunMin, originSunMin)

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
      weather_now: {
        summary: full.conditions,
        temp_c: full.temp_c,
      },
      travel: {
        car: full.carTravel ? { mode: 'car' as const, duration_min: full.carTravel.duration_min, distance_km: full.carTravel.distance_km } : undefined,
        train: full.trainTravel ? { mode: 'train' as const, duration_min: full.trainTravel.duration_min, changes: full.trainTravel.changes, ga_included: hasGA } : undefined,
      },
      plan: buildTripPlan(full.destination),
      links: {
        google_maps: buildGoogleMapsDirectionsUrl(full.destination.maps_name, mapsOriginName),
        sbb: buildSbbTimetableUrl(full.destination.sbb_name, sbbOriginName),
        webcam: full.destination.webcam_url,
      },
      sun_timeline: liveTimeline ?? getMockSunTimeline(full.destination, demoMode),
      tomorrow_sun_hours: liveTomorrowSun ?? getMockTomorrowSunHoursForDest(full.destination, demoMode),
      admin_hourly: adminHourly,
    }
  }

  const escapes: EscapeResult[] = pickedRanked.slice(0, limit).map((r, i) => {
    const full = withTravel.find(w => w.destination.id === r.destination.id)!
    return toEscapeResult(full, i + 1)
  })

  const fastestCandidate = withTravel
    .filter(r => Number.isFinite(r.bestTravelMin))
    .filter(r => r.bestTravelMin <= 75)
    .filter(r => r.sun_score.sunshine_forecast_min - originSunMin >= 60)
    .sort((a, b) => {
      if (b.sun_score.score !== a.sun_score.score) return b.sun_score.score - a.sun_score.score
      if (a.bestTravelMin !== b.bestTravelMin) return a.bestTravelMin - b.bestTravelMin
      return b.destination.altitude_m - a.destination.altitude_m
    })[0]

  const fastestEscape = fastestCandidate ? toEscapeResult(fastestCandidate, 0) : undefined

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

  const response: SunnyEscapesResponse = {
    _meta: {
      request_id: reqId,
      origin: { name: originName, lat, lon },
      generated_at: new Date().toISOString(),
      weather_data_freshness: weatherFreshness,
      attribution: [
        'Weather: Open-Meteo',
        'Routing: Open Journey Planner',
        'FOMO Sun - fomosun.com',
      ],
      demo_mode: demoMode,
      trip_span: tripSpan,
      fallback_notice: fallbackNotice || undefined,
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
    escapes,
  }

  const headers: Record<string, string> = {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    'X-FOMO-Sun-Version': '0.6.1',
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
    'X-FOMO-Request-Ms': String(Date.now() - startedAt),
  }
  if (liveFallbackReason) headers['X-FOMO-Live-Fallback'] = liveFallbackReason
  if (fallbackNotice) headers['X-FOMO-Fallback-Notice'] = fallbackNotice

  if (!liveFallbackReason) {
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
