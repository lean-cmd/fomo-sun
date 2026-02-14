import { NextRequest, NextResponse } from 'next/server'
import { destinations, DEFAULT_ORIGIN } from '@/data/destinations'
import { computeSunScore, preFilterByDistance, rankDestinations } from '@/lib/scoring'
import { getMockWeather, getMockOriginWeather, getMockTravelTime, getMockSunTimeline, getMockMaxSunHours, getMockSunset, getMockTomorrowSunHours, getMockOriginTimeline, getMockTomorrowSunHoursForDest } from '@/lib/mock-weather'
import { EscapeResult, SunnyEscapesResponse, TravelMode } from '@/lib/types'

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
  const demoMode = sp.get('demo') === 'true'

  if (isNaN(lat) || isNaN(lon) || lat < 44 || lat > 50 || lon < 4 || lon > 12) {
    return NextResponse.json({ error: 'Invalid coordinates.' }, { status: 400 })
  }

  const maxTravelMin = maxTravelH * 60
  const reqId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const originWeather = getMockOriginWeather()
  const originSunMin = originWeather.sunshine_min

  // Pre-filter & score
  let candidates = preFilterByDistance(lat, lon, destinations, maxSupportedH)
  if (types.length > 0) candidates = candidates.filter(d => d.types.some(t => types.includes(t)))

  const scored = candidates.map(dest => {
    const w = getMockWeather(dest, demoMode)
    return { destination: dest, sun_score: computeSunScore(dest, w), conditions: w.conditions_text, temp_c: w.temp_c }
  })

  const top = scored.sort((a, b) => b.sun_score.score - a.sun_score.score).slice(0, 20)

  // Add travel
  const withTravel = top.map(c => {
    const car = (mode === 'car' || mode === 'both') ? getMockTravelTime(lat, lon, c.destination.lat, c.destination.lon, 'car') : undefined
    const train = (mode === 'train' || mode === 'both') ? getMockTravelTime(lat, lon, c.destination.lat, c.destination.lon, 'train') : undefined
    const best = Math.min(car?.duration_min ?? Infinity, train?.duration_min ?? Infinity)
    return { ...c, carTravel: car, trainTravel: train ? { ...train, ga_included: hasGA } : undefined, bestTravelMin: best }
  })

  // Filter & rank
  const ranked = rankDestinations(
    withTravel.filter(r => r.bestTravelMin <= maxTravelMin).map(r => ({
      destination: r.destination, sun_score: r.sun_score, travel_time_min: r.bestTravelMin,
    })),
    maxTravelMin
  )

  // Demo mode curation:
  // - keep results mostly Swiss for MeteoSwiss-first narrative
  // - include St. Moritz on longer travel settings when feasible
  let pickedRanked = ranked
  if (demoMode) {
    const swiss = ranked.filter(r => r.destination.country === 'CH')
    const intl = ranked.filter(r => r.destination.country !== 'CH')
    const swissTarget = Math.max(1, Math.min(limit, Math.round(limit * 0.9)))

    const basePick = [...swiss.slice(0, swissTarget), ...intl.slice(0, Math.max(0, limit - swissTarget))]
    const pickedIds = new Set(basePick.map(r => r.destination.id))

    if (maxTravelH >= 4) {
      const stMoritz = ranked.find(r => r.destination.id === 'st-moritz')
      if (stMoritz && !pickedIds.has('st-moritz')) {
        if (basePick.length < limit) {
          basePick.push(stMoritz)
        } else {
          basePick[basePick.length - 1] = stMoritz
        }
        pickedIds.add('st-moritz')
      }
    }

    // Keep original ranking order for stable card positions.
    pickedRanked = ranked.filter(r => pickedIds.has(r.destination.id)).slice(0, limit)
  }

  // Compute optimal travel radius: maximize net sun (sunshine - round trip travel)
  // Test all travel buckets and find the one with highest average net sun
  const sunsetInfo = getMockSunset(demoMode)
  const remainingDayMin = sunsetInfo.minutes_until

  let bestOptH = 1.5
  let bestNetSun = 0
  for (let testH = 1; testH <= maxSupportedH; testH += 0.25) {
    const testMin = testH * 60
    const bucket = withTravel.filter(r => r.bestTravelMin <= testMin && r.bestTravelMin > (testH - 0.5) * 60)
    if (bucket.length === 0) continue
    // Net sun = sunshine minutes - round trip travel, capped by remaining daylight
    const avgNet = bucket.reduce((sum, r) => {
      const sunMin = r.sun_score.sunshine_forecast_min
      const travelRound = r.bestTravelMin * 2
      const usableSun = Math.max(0, Math.min(sunMin, remainingDayMin - travelRound))
      return sum + usableSun
    }, 0) / bucket.length
    if (avgNet > bestNetSun) { bestNetSun = avgNet; bestOptH = testH }
  }

  // Format comparison text: use 2x/3x for large multiples, % for 10-100%
  function formatComparison(destMin: number, originMin: number): string {
    if (originMin <= 0 || destMin <= originMin) return ''
    const ratio = destMin / originMin
    if (ratio >= 2) return ` | ${ratio.toFixed(0)}x more sun than here`
    const pctMore = Math.round((ratio - 1) * 100)
    if (pctMore >= 10) return ` | +${pctMore}% more sun than here`
    return ''
  }

  // Build escapes
  const escapes: EscapeResult[] = pickedRanked.slice(0, limit).map((r, i) => {
    const full = withTravel.find(w => w.destination.id === r.destination.id)!
    const destSunMin = r.sun_score.sunshine_forecast_min
    const roundTrip = full.bestTravelMin * 2
    const netSun = Math.max(0, Math.min(destSunMin, remainingDayMin - roundTrip))
    const cmp = formatComparison(destSunMin, originSunMin)

    return {
      rank: i + 1,
      destination: r.destination,
      sun_score: r.sun_score,
      conditions: `${destSunMin} min sunshine${cmp}`,
      net_sun_min: netSun,
      travel: {
        car: full.carTravel ? { mode: 'car' as const, duration_min: full.carTravel.duration_min, distance_km: full.carTravel.distance_km } : undefined,
        train: full.trainTravel ? { mode: 'train' as const, duration_min: full.trainTravel.duration_min, changes: full.trainTravel.changes, ga_included: hasGA } : undefined,
      },
      plan: r.destination.plan_template.split(' | '),
      links: { google_maps: r.destination.maps_url, sbb: r.destination.sbb_url, webcam: r.destination.webcam_url },
      sun_timeline: getMockSunTimeline(r.destination, demoMode),
      tomorrow_sun_hours: getMockTomorrowSunHoursForDest(r.destination, demoMode),
    }
  })

  const originName = (Math.abs(lat - DEFAULT_ORIGIN.lat) < 0.1 && Math.abs(lon - DEFAULT_ORIGIN.lon) < 0.1) ? 'Basel' : `${lat.toFixed(2)}, ${lon.toFixed(2)}`

  const response: SunnyEscapesResponse = {
    _meta: {
      request_id: reqId,
      origin: { name: originName, lat, lon },
      generated_at: new Date().toISOString(),
      weather_data_freshness: new Date().toISOString(),
      attribution: [
        'Weather: MeteoSwiss (CC BY 4.0)',
        'Routing: Open Journey Planner',
        'FOMO Sun - fomosun.com',
      ],
      demo_mode: demoMode,
    },
    origin_conditions: {
      description: demoMode ? 'Fog, 3°C, brief sun 10-11 AM' : originWeather.description,
      sun_score: originWeather.sun_score,
      sunshine_min: originWeather.sunshine_min,
    },
    origin_timeline: getMockOriginTimeline(),
    max_sun_hours_today: getMockMaxSunHours(),
    sunset: sunsetInfo,
    tomorrow_sun_hours: getMockTomorrowSunHours(),
    optimal_travel_h: bestOptH,
    escapes,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600', 'X-FOMO-Sun-Version': '0.2.0' },
  })
}
