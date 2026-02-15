import { NextRequest, NextResponse } from 'next/server'
import { destinations, DEFAULT_ORIGIN } from '@/data/destinations'
import { computeSunScore, detectInversion, preFilterByDistance, rankDestinations } from '@/lib/scoring'
import { getMockWeather, getMockOriginWeather, getMockTravelTime, getMockSunTimeline, getMockMaxSunHours, getMockSunset, getMockTomorrowSunHours, getMockOriginTimeline, getMockTomorrowSunHoursForDest, getMockDaylightWindow } from '@/lib/mock-weather'
import { getCurrentWeather, getHourlyForecast, getSunTimes } from '@/lib/open-meteo'
import { getSwissMeteoOriginSnapshot } from '@/lib/swissmeteo'
import { DaylightWindow, EscapeResult, SunnyEscapesResponse, SunTimeline, TravelMode } from '@/lib/types'

type LiveForecastBundle = Awaited<ReturnType<typeof getHourlyForecast>>

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
  'zurich',
  'bern',
  'lucerne',
  'thun',
  'interlaken',
  'freiburg-im-breisgau',
])

const LIVE_DEST_WEATHER_LIMIT = 8
const LIVE_RATE_WINDOW_MS = 60_000
const LIVE_RATE_MAX_PER_WINDOW = 24
const liveReqCounter = new Map<string, { reset_at: number; count: number }>()
const TARGET_POI_COUNT = 500

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function avg(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

function demoTrainFactor(id: string): number {
  const hash = id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
  return 0.66 + (hash % 8) * 0.02 // 0.66 - 0.80
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

  let conditionsText = ''
  if (sunshineMin >= 90 && lowCloud < 35) conditionsText = `Mostly sunny, ${temp}°C`
  else if (sunshineMin >= 45) conditionsText = `Partly sunny, ${temp}°C`
  else if (lowCloud > 80) conditionsText = `Fog/low cloud likely, ${temp}°C`
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

function hourCondition(h: LiveForecastBundle['hours'][number]) {
  if (h.sunshine_duration_min >= 35 && h.low_cloud_cover_pct < 40) return 'sun'
  if (h.sunshine_duration_min >= 15 || h.cloud_cover_pct < 65) return 'partial'
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

function originSunScoreFromCurrent(sunshineMin: number, lowCloud: number) {
  const s = clamp(sunshineMin / 60, 0, 1)
  const c = 1 - clamp(lowCloud / 100, 0, 1)
  return clamp(0.15 + 0.6 * s + 0.25 * c, 0.02, 0.95)
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const maxSupportedH = 4.5
  const lat = parseFloat(sp.get('lat') || String(DEFAULT_ORIGIN.lat))
  const lon = parseFloat(sp.get('lon') || String(DEFAULT_ORIGIN.lon))
  const maxTravelH = Math.min(maxSupportedH, Math.max(1, parseFloat(sp.get('max_travel_h') || '2.5')))
  const mode: TravelMode = (sp.get('mode') as TravelMode) || 'both'
  const hasGA = sp.get('ga') === 'true'
  const typesParam = sp.get('types')
  const types = typesParam ? typesParam.split(',') : []
  const limit = Math.min(10, Math.max(1, parseInt(sp.get('limit') || '6')))

  const requestedDemo = sp.get('demo') === 'true'
  const ip = clientIp(request)
  const liveRate = requestedDemo
    ? { limited: false, count: 0, remaining: LIVE_RATE_MAX_PER_WINDOW, reset_at: Date.now() + LIVE_RATE_WINDOW_MS }
    : consumeRateBudget(ip)
  const liveRateLimited = !requestedDemo && liveRate.limited
  const demoMode = requestedDemo || liveRateLimited
  const liveFallbackReason = liveRateLimited ? 'rate_limited' : ''

  if (isNaN(lat) || isNaN(lon) || lat < 44 || lat > 50 || lon < 4 || lon > 12) {
    return NextResponse.json({ error: 'Invalid coordinates.' }, { status: 400 })
  }

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
  let weatherFreshness = new Date().toISOString()
  let inversionLikely = true
  let usedSwissMeteo = false
  let originLabelOverride: string | null = null

  // Pre-filter by rough distance and user filters
  let candidates = preFilterByDistance(lat, lon, destinations, maxTravelH)
  if (types.length > 0) candidates = candidates.filter(d => d.types.some(t => types.includes(t)))
  const prefilterCandidateCount = candidates.length
  let livePoolCount = 0

  const candidatesWithTravel = candidates.map(dest => {
    const car = (mode === 'car' || mode === 'both') ? getMockTravelTime(lat, lon, dest.lat, dest.lon, 'car') : undefined
    let train = (mode === 'train' || mode === 'both') ? getMockTravelTime(lat, lon, dest.lat, dest.lon, 'train') : undefined

    if (demoMode && car && train && DEMO_TRAIN_FAST_IDS.has(dest.id)) {
      train = {
        ...train,
        duration_min: Math.max(28, Math.round(car.duration_min * demoTrainFactor(dest.id))),
        changes: Math.max(0, Math.min(2, (train.changes ?? 1) - 1)),
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

  let scored: ScoredWithTravel[] = []

  if (demoMode) {
    scored = candidatesWithTravel.map(c => {
      const w = getMockWeather(c.destination, true)
      return {
        destination: c.destination,
        sun_score: computeSunScore(c.destination, w),
        conditions: w.conditions_text,
        temp_c: w.temp_c,
        carTravel: c.carTravel,
        trainTravel: c.trainTravel,
        bestTravelMin: c.bestTravelMin,
      }
    })
  } else {
    // Live mode: guard upstream usage by evaluating only the closest/relevant pool.
    const liveWindowMax = maxTravelMin + 30
    const livePool = candidatesWithTravel
      .filter(c => c.bestTravelMin <= liveWindowMax)
      .sort((a, b) => {
        const da = Math.abs(a.bestTravelMin - maxTravelMin)
        const db = Math.abs(b.bestTravelMin - maxTravelMin)
        if (da !== db) return da - db
        return b.destination.altitude_m - a.destination.altitude_m
      })
      .slice(0, LIVE_DEST_WEATHER_LIMIT)
    livePoolCount = livePool.length

    const swissOrigin = await getSwissMeteoOriginSnapshot(lat, lon)
    if (swissOrigin) {
      usedSwissMeteo = true
      originDescription = swissOrigin.description
      originSunScore = swissOrigin.sun_score
      originSunMin = swissOrigin.sunshine_min
      originLabelOverride = swissOrigin.station_name
      weatherFreshness = swissOrigin.observed_at || weatherFreshness
      inversionLikely = detectInversion({
        temp_c: swissOrigin.temp_c,
        humidity_pct: swissOrigin.humidity_pct,
        wind_speed_kmh: swissOrigin.wind_kmh,
      })
    } else {
      try {
        const originCurrent = await getCurrentWeather(lat, lon)
        originDescription = originCurrent.conditions_text
        originSunMin = originCurrent.sunshine_duration_min
        originSunScore = originSunScoreFromCurrent(originSunMin, originCurrent.low_cloud_cover_pct)
        inversionLikely = detectInversion({
          visibility_m: originCurrent.visibility_m,
          temp_c: originCurrent.temperature_c,
          wind_speed_kmh: originCurrent.wind_speed_kmh,
        })
      } catch {
        // keep mock origin fallback
      }
    }

    try {
      const [originHourly, sunTimes] = await Promise.all([
        getHourlyForecast(lat, lon),
        getSunTimes(lat, lon),
      ])
      sunWindow = {
        today: sunTimes.daylight_window_today,
        tomorrow: sunTimes.daylight_window_tomorrow,
      }
      originTimeline = timelineFromLive(originHourly.hours, sunWindow)
      originTomorrowHours = Math.round((originHourly.total_sunshine_tomorrow_min / 60) * 10) / 10
      sunsetInfo = {
        time: sunTimes.sunset,
        minutes_until: sunTimes.sunset_minutes_until,
        is_past: sunTimes.sunset_minutes_until <= 0,
      }
    } catch {
      // keep mock timeline/sunset fallback
    }

    scored = await Promise.all(
      livePool.map(async c => {
        try {
          const forecast = await getHourlyForecast(c.destination.lat, c.destination.lon)
          const liveWindow = computeLiveWeatherWindow(forecast.hours, inversionLikely)
          return {
            destination: c.destination,
            sun_score: computeSunScore(c.destination, liveWindow.weatherInput),
            conditions: liveWindow.conditionsText,
            temp_c: liveWindow.tempC,
            carTravel: c.carTravel,
            trainTravel: c.trainTravel,
            bestTravelMin: c.bestTravelMin,
            liveForecast: forecast,
          }
        } catch {
          const w = getMockWeather(c.destination, false)
          return {
            destination: c.destination,
            sun_score: computeSunScore(c.destination, w),
            conditions: w.conditions_text,
            temp_c: w.temp_c,
            carTravel: c.carTravel,
            trainTravel: c.trainTravel,
            bestTravelMin: c.bestTravelMin,
          }
        }
      })
    )
  }

  // Keep a much broader candidate set in demo so slider materially changes outcomes.
  const topLimit = demoMode ? 48 : LIVE_DEST_WEATHER_LIMIT
  const withTravel = scored.sort((a, b) => b.sun_score.score - a.sun_score.score).slice(0, topLimit)

  // Default ranking path
  let pickedRanked = rankDestinations(
    withTravel
      .filter(r => r.bestTravelMin <= maxTravelMin)
      .map(r => ({ destination: r.destination, sun_score: r.sun_score, travel_time_min: r.bestTravelMin })),
    maxTravelMin
  )

  // Demo mode uses slider-centered window sorting for material list changes.
  if (demoMode) {
    const windowMin = Math.max(30, maxTravelMin - 30)
    const windowMax = maxTravelMin + 30

    const inWindow = withTravel.filter(r => r.bestTravelMin >= windowMin && r.bestTravelMin <= windowMax)
    const fallbackWindow = withTravel.filter(r => r.bestTravelMin <= windowMax)
    const demoPool = (inWindow.length >= Math.max(4, limit)) ? inWindow : fallbackWindow

    const sortedByScore = demoPool
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
  let bestOptH = 1.5
  let bestNetSun = 0
  for (let testH = 1; testH <= maxSupportedH; testH += 0.25) {
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

  function formatComparison(destMin: number, originMin: number): string {
    if (originMin <= 0 || destMin <= originMin) return ''
    const ratio = destMin / originMin
    if (ratio >= 2) return ` | ${ratio.toFixed(0)}x more sun than here`
    const pctMore = Math.round((ratio - 1) * 100)
    if (pctMore >= 10) return ` | +${pctMore}% more sun than here`
    return ''
  }

  const escapes: EscapeResult[] = pickedRanked.slice(0, limit).map((r, i) => {
    const full = withTravel.find(w => w.destination.id === r.destination.id)!
    const destSunMin = r.sun_score.sunshine_forecast_min
    const roundTrip = full.bestTravelMin * 2
    const netSun = Math.max(0, Math.min(destSunMin, remainingDayMin - roundTrip))
    const cmp = formatComparison(destSunMin, originSunMin)

    const liveTimeline = !demoMode && full.liveForecast ? timelineFromLive(full.liveForecast.hours, sunWindow) : null
    const liveTomorrowSun = !demoMode && full.liveForecast
      ? Math.round((full.liveForecast.total_sunshine_tomorrow_min / 60) * 10) / 10
      : null

    return {
      rank: i + 1,
      destination: r.destination,
      sun_score: r.sun_score,
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
      plan: r.destination.plan_template.split(' | '),
      links: { google_maps: r.destination.maps_url, sbb: r.destination.sbb_url, webcam: r.destination.webcam_url },
      sun_timeline: liveTimeline ?? getMockSunTimeline(r.destination, demoMode),
      tomorrow_sun_hours: liveTomorrowSun ?? getMockTomorrowSunHoursForDest(r.destination, demoMode),
    }
  })

  const originName = originLabelOverride
    || ((Math.abs(lat - DEFAULT_ORIGIN.lat) < 0.1 && Math.abs(lon - DEFAULT_ORIGIN.lon) < 0.1) ? 'Basel' : `${lat.toFixed(2)}, ${lon.toFixed(2)}`)

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
        'Weather: MeteoSwiss (CC BY 4.0)',
        'Weather fallback: Open-Meteo',
        'Routing: Open Journey Planner',
        'FOMO Sun - fomosun.com',
      ],
      demo_mode: demoMode,
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
    escapes,
  }

  const headers: Record<string, string> = {
    'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    'X-FOMO-Sun-Version': '0.4.1',
    'X-FOMO-Live-Source': demoMode ? 'mock' : (usedSwissMeteo ? 'meteoswiss+open-meteo' : 'open-meteo'),
    'X-FOMO-Live-Rate-Limit': `${LIVE_RATE_MAX_PER_WINDOW};w=${Math.round(LIVE_RATE_WINDOW_MS / 1000)}`,
    'X-FOMO-Live-Rate-Remaining': String(liveRate.remaining),
    'X-FOMO-Live-Rate-Count': String(liveRate.count),
    'X-FOMO-Live-Rate-Reset-S': String(Math.max(0, Math.round((liveRate.reset_at - Date.now()) / 1000))),
    'X-FOMO-POI-Count': String(destinations.length),
    'X-FOMO-POI-Target': String(TARGET_POI_COUNT),
    'X-FOMO-Candidate-Count': String(prefilterCandidateCount),
    'X-FOMO-Live-Pool-Count': String(livePoolCount),
  }
  if (liveFallbackReason) headers['X-FOMO-Live-Fallback'] = liveFallbackReason

  return NextResponse.json(response, { headers })
}
