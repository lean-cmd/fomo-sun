import { NextRequest, NextResponse } from 'next/server'
import { destinations, DEFAULT_ORIGIN } from '@/data/destinations'
import { computeSunScore, preFilterByDistance, rankDestinations } from '@/lib/scoring'
import { getMockWeather, getMockOriginWeather, getMockTravelTime, getMockSunTimeline, getMockMaxSunHours } from '@/lib/mock-weather'
import { EscapeResult, SunnyEscapesResponse, TravelMode } from '@/lib/types'

/**
 * GET /api/v1/sunny-escapes
 * 
 * Returns ranked sunny escape destinations based on user preferences.
 * 
 * Query params:
 *   lat       - origin latitude (default: Basel)
 *   lon       - origin longitude (default: Basel)
 *   max_travel_h - max travel time in hours (default: 2, range: 1-4)
 *   mode      - travel mode: car | train | both (default: both)
 *   ga        - has GA rail pass: true | false (default: false)
 *   types     - comma-separated destination types (default: all)
 *   limit     - max results (default: 5, max: 10)
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams

  // Parse parameters with defaults
  const lat = parseFloat(searchParams.get('lat') || String(DEFAULT_ORIGIN.lat))
  const lon = parseFloat(searchParams.get('lon') || String(DEFAULT_ORIGIN.lon))
  const maxTravelH = Math.min(4, Math.max(1, parseFloat(searchParams.get('max_travel_h') || '2')))
  const mode: TravelMode = (searchParams.get('mode') as TravelMode) || 'both'
  const hasGA = searchParams.get('ga') === 'true'
  const typesParam = searchParams.get('types')
  const types = typesParam ? typesParam.split(',') : []
  const limit = Math.min(10, Math.max(1, parseInt(searchParams.get('limit') || '5')))

  // Validate coordinates
  if (isNaN(lat) || isNaN(lon) || lat < 44 || lat > 50 || lon < 4 || lon > 12) {
    return NextResponse.json(
      { error: 'Invalid coordinates. Must be in Central Europe range.' },
      { status: 400 }
    )
  }

  const maxTravelMin = maxTravelH * 60
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  // Step 1: Pre-filter destinations by distance
  let candidates = preFilterByDistance(lat, lon, destinations, maxTravelH)

  // Step 2: Filter by types if specified
  if (types.length > 0) {
    candidates = candidates.filter(d =>
      d.types.some(t => types.includes(t))
    )
  }

  // Step 3: Score all candidates by weather
  const scoredCandidates = candidates.map(dest => {
    const weather = getMockWeather(dest)
    const sunScore = computeSunScore(dest, weather)
    return {
      destination: dest,
      sun_score: sunScore,
      conditions: weather.conditions_text,
      temp_c: weather.temp_c,
    }
  })

  // Step 4: Sort by sun score, take top 15 for routing
  const topCandidates = scoredCandidates
    .sort((a, b) => b.sun_score.score - a.sun_score.score)
    .slice(0, 15)

  // Step 5: Compute travel times for top candidates
  const withTravel = topCandidates.map(candidate => {
    const carTravel = (mode === 'car' || mode === 'both')
      ? getMockTravelTime(lat, lon, candidate.destination.lat, candidate.destination.lon, 'car')
      : undefined
    const trainTravel = (mode === 'train' || mode === 'both')
      ? getMockTravelTime(lat, lon, candidate.destination.lat, candidate.destination.lon, 'train')
      : undefined

    // Best travel time for ranking
    const bestTravelMin = Math.min(
      carTravel?.duration_min ?? Infinity,
      trainTravel?.duration_min ?? Infinity
    )

    return {
      ...candidate,
      carTravel,
      trainTravel: trainTravel ? { ...trainTravel, ga_included: hasGA } : undefined,
      bestTravelMin,
    }
  })

  // Step 6: Filter by actual travel time and rank
  const ranked = withTravel
    .filter(r => r.bestTravelMin <= maxTravelMin)
    .map(r => ({
      destination: r.destination,
      sun_score: r.sun_score,
      travel_time_min: r.bestTravelMin,
    }))

  const finalRanked = rankDestinations(ranked, maxTravelMin)

  // Step 7: Build response
  const escapes: EscapeResult[] = finalRanked
    .slice(0, limit)
    .map((r, i) => {
      const full = withTravel.find(w => w.destination.id === r.destination.id)!
      return {
        rank: i + 1,
        destination: r.destination,
        sun_score: r.sun_score,
        conditions: full.conditions,
        travel: {
          car: full.carTravel ? {
            mode: 'car' as const,
            duration_min: full.carTravel.duration_min,
            distance_km: full.carTravel.distance_km,
          } : undefined,
          train: full.trainTravel ? {
            mode: 'train' as const,
            duration_min: full.trainTravel.duration_min,
            changes: full.trainTravel.changes,
            ga_included: hasGA,
          } : undefined,
        },
        plan: r.destination.plan_template.split(' | '),
        links: {
          google_maps: r.destination.maps_url,
          sbb: r.destination.sbb_url,
          webcam: r.destination.webcam_url,
        },
        sun_timeline: getMockSunTimeline(r.destination),
      }
    })

  // Origin conditions
  const originWeather = getMockOriginWeather()

  // Resolve origin name
  const originName = (Math.abs(lat - DEFAULT_ORIGIN.lat) < 0.1 && Math.abs(lon - DEFAULT_ORIGIN.lon) < 0.1)
    ? 'Basel'
    : `${lat.toFixed(2)}, ${lon.toFixed(2)}`

  const response: SunnyEscapesResponse = {
    _meta: {
      request_id: requestId,
      origin: { name: originName, lat, lon },
      generated_at: new Date().toISOString(),
      weather_data_freshness: new Date().toISOString(), // Mock: always fresh
      attribution: [
        'Weather data: MeteoSwiss, Swiss Federal Office of Meteorology and Climatology (CC BY 4.0)',
        'Routing: Open Journey Planner, opentransportdata.swiss',
        'FOMO Sun - Find sun fast. https://fomosun.com',
      ],
    },
    origin_conditions: {
      description: originWeather.description,
      sun_score: originWeather.sun_score,
    },
    max_sun_hours_today: getMockMaxSunHours(),
    escapes,
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      'X-FOMO-Sun-Version': '0.1.0',
    },
  })
}
