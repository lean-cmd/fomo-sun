import { Destination, SunTimeline, TimelineSegment } from './types'

export interface MockWeatherResult {
  sunshine_forecast_min: number; low_cloud_cover_pct: number; total_cloud_cover_pct: number
  is_inversion_likely: boolean; ground_truth_available: boolean; ground_truth_sunny?: boolean
  temp_c: number; conditions_text: string
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function dayOfYear(d: Date) {
  const start = new Date(d.getFullYear(), 0, 0)
  const diff = d.getTime() - start.getTime()
  return Math.floor(diff / 86_400_000)
}

function seasonalSunHours(date: Date) {
  // Basel-like daylight curve: shorter winter days, longer summer days.
  const doy = dayOfYear(date)
  const daylightHours = 12 + 4.4 * Math.sin((2 * Math.PI * (doy - 80)) / 365)
  const solarNoon = 12.5
  const sunriseHour = solarNoon - daylightHours / 2
  const sunsetHour = solarNoon + daylightHours / 2
  return { sunriseHour, sunsetHour }
}

function hourToClock(h: number) {
  const whole = Math.floor(h)
  const min = Math.round((h - whole) * 60)
  const hh = String(clamp(whole + Math.floor(min / 60), 0, 23)).padStart(2, '0')
  const mm = String(min % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

const DEMO_BUCKET_MIN = 15
const DEMO_SWISS_ELITE = new Set([
  'lucerne',
  'pilatus',
  'st-moritz',
  'rigi',
  'fronalpstock',
  'stoos',
  'niederhorn',
  'muottas-muragl',
  'grindelwald',
  'adelboden',
  'chasseral',
  'rochers-de-naye',
  'la-dole',
  'gruyeres',
  'interlaken',
  'thun',
])
const DEMO_SWISS_MEDIUM = new Set([
  'weissenstein',
  'uetliberg',
  'bachtel',
  'pfannenstiel',
  'bern',
  'zurich',
  'napf',
  'moléson',
  'brienz',
  'hasliberg',
  'braunwald',
  'gurten',
  'bantiger',
  'leysin',
])

const ZONE: Record<string, { sun_bias: number; cond: string }> = {
  'strasbourg':          { sun_bias: 0.55, cond: 'Partly sunny, 5°C, Alsace plain clearer than Rhine Valley' },
  'colmar':              { sun_bias: 0.65, cond: 'Mostly sunny, 6°C, driest city in France (rain shadow)' },
  'freiburg-im-breisgau':{ sun_bias: 0.50, cond: 'Partly cloudy, 5°C, sunniest city in Germany' },
  'lucerne':             { sun_bias: 0.45, cond: 'Breaking cloud, 5°C, clearing by midday' },
  'bern':                { sun_bias: 0.25, cond: 'Overcast, 3°C, Mittelland fog' },
  'zurich':              { sun_bias: 0.20, cond: 'Overcast, 3°C, Mittelland fog' },
  'interlaken':          { sun_bias: 0.50, cond: 'Variable, 4°C, sheltered between lakes' },
  'st-moritz':           { sun_bias: 0.92, cond: 'Clear sky, -3°C, Engadin sunshine, above all fog' },
  'konstanz':            { sun_bias: 0.38, cond: 'Partly cloudy, 4°C, lake moderates fog' },
  'gruyeres':            { sun_bias: 0.48, cond: 'Variable, 3°C, pre-Alps' },
  'mulhouse':            { sun_bias: 0.15, cond: 'Fog, 3°C, Rhine Valley' },
}

let seed = 42
function srand() { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646 }
function hashSeed(key: string, bucket = 0) {
  let h = 0
  const s = `${key}:${bucket}`
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 2147483647
  return Math.max(1, h)
}
function demoBucket() { return Math.floor(Date.now() / (DEMO_BUCKET_MIN * 60 * 1000)) }

export function getMockWeather(destination: Destination, demoMode = false): MockWeatherResult {
  seed = hashSeed(destination.id, demoMode ? demoBucket() : 0)

  if (demoMode) {
    if (destination.id === 'st-moritz') {
      const sunMin = 179 + Math.round(srand())
      const lowCloud = Math.round(srand() * 2)
      return {
        sunshine_forecast_min: sunMin,
        low_cloud_cover_pct: lowCloud,
        total_cloud_cover_pct: lowCloud + Math.round(srand() * 4),
        is_inversion_likely: true,
        ground_truth_available: true,
        ground_truth_sunny: true,
        temp_c: -6 + Math.round(srand() * 4),
        conditions_text: `Engadin bluebird, ${sunMin} min sunshine`,
      }
    }

    if (destination.country === 'CH' && DEMO_SWISS_ELITE.has(destination.id)) {
      const sunMin = 160 + Math.round(srand() * 18)
      const lowCloud = 2 + Math.round(srand() * 12)
      return {
        sunshine_forecast_min: sunMin,
        low_cloud_cover_pct: lowCloud,
        total_cloud_cover_pct: lowCloud + Math.round(srand() * 5),
        is_inversion_likely: true,
        ground_truth_available: true,
        ground_truth_sunny: true,
        temp_c: destination.altitude_m > 1500 ? -4 + Math.round(srand() * 6) : 2 + Math.round(srand() * 5),
        conditions_text: `Mostly sunny alpine window, ${sunMin} min sunshine`,
      }
    }

    if (destination.country === 'CH' && DEMO_SWISS_MEDIUM.has(destination.id)) {
      const sunMin = 75 + Math.round(srand() * 60)
      const lowCloud = 25 + Math.round(srand() * 45)
      return {
        sunshine_forecast_min: sunMin,
        low_cloud_cover_pct: Math.min(100, lowCloud),
        total_cloud_cover_pct: Math.min(100, lowCloud + 8 + Math.round(srand() * 12)),
        is_inversion_likely: true,
        ground_truth_available: srand() > 0.45,
        ground_truth_sunny: sunMin > 95,
        temp_c: destination.altitude_m > 1000 ? -1 + Math.round(srand() * 6) : 1 + Math.round(srand() * 7),
        conditions_text: `Patchy cloud breaks, ${sunMin} min sunshine`,
      }
    }

    if (destination.country !== 'CH') {
      const sunMin = 8 + Math.round(srand() * 70)
      const lowCloud = 55 + Math.round(srand() * 40)
      return {
        sunshine_forecast_min: sunMin,
        low_cloud_cover_pct: Math.min(100, lowCloud),
        total_cloud_cover_pct: Math.min(100, lowCloud + 5 + Math.round(srand() * 15)),
        is_inversion_likely: true,
        ground_truth_available: srand() > 0.4,
        ground_truth_sunny: sunMin > 45,
        temp_c: 1 + Math.round(srand() * 6),
        conditions_text: `Cloudy edge zone, ${sunMin} min sunshine`,
      }
    }

    const sunMin = 45 + Math.round(srand() * 75)
    const lowCloud = 35 + Math.round(srand() * 45)
    return {
      sunshine_forecast_min: sunMin,
      low_cloud_cover_pct: Math.min(100, lowCloud),
      total_cloud_cover_pct: Math.min(100, lowCloud + Math.round(srand() * 12)),
      is_inversion_likely: true,
      ground_truth_available: srand() > 0.5,
      ground_truth_sunny: sunMin > 80,
      temp_c: destination.altitude_m > 1200 ? -2 + Math.round(srand() * 7) : 1 + Math.round(srand() * 7),
      conditions_text: `Variable cloud deck, ${sunMin} min sunshine`,
    }
  }

  const zone = ZONE[destination.id]
  if (zone) {
    const sunMin = Math.round(zone.sun_bias * 180 + (srand() * 40 - 20))
    const cloudPct = Math.round((1 - zone.sun_bias) * 100 + (srand() * 20 - 10))
    return {
      sunshine_forecast_min: Math.max(10, Math.min(180, sunMin)),
      low_cloud_cover_pct: Math.max(0, Math.min(100, cloudPct)),
      total_cloud_cover_pct: Math.max(0, Math.min(100, cloudPct + Math.round(srand() * 10))),
      is_inversion_likely: true, ground_truth_available: srand() > 0.4,
      ground_truth_sunny: zone.sun_bias > 0.4,
      temp_c: destination.altitude_m > 1500 ? -3 + Math.round(srand() * 4) : 2 + Math.round(srand() * 5),
      conditions_text: zone.cond,
    }
  }

  const alt = destination.altitude_m
  const fogCeiling = 800

  if (alt > fogCeiling + 200) {
    const sunMin = 130 + Math.round(srand() * 50)
    return {
      sunshine_forecast_min: sunMin, low_cloud_cover_pct: Math.round(srand() * 15),
      total_cloud_cover_pct: Math.round(srand() * 25), is_inversion_likely: true,
      ground_truth_available: true, ground_truth_sunny: true,
      temp_c: -2 + Math.round(srand() * 8),
      conditions_text: `Clear above fog, ${sunMin} min sunshine`,
    }
  } else if (alt > fogCeiling - 150) {
    const sunMin = 40 + Math.round(srand() * 100)
    return {
      sunshine_forecast_min: sunMin, low_cloud_cover_pct: 25 + Math.round(srand() * 50),
      total_cloud_cover_pct: 35 + Math.round(srand() * 35), is_inversion_likely: true,
      ground_truth_available: srand() > 0.5, ground_truth_sunny: srand() > 0.4,
      temp_c: Math.round(srand() * 6),
      conditions_text: `Near fog boundary, ${sunMin} min sunshine`,
    }
  } else {
    const sunMin = Math.round(srand() * 25)
    return {
      sunshine_forecast_min: sunMin, low_cloud_cover_pct: 80 + Math.round(srand() * 20),
      total_cloud_cover_pct: 85 + Math.round(srand() * 15), is_inversion_likely: true,
      ground_truth_available: true, ground_truth_sunny: false,
      temp_c: 1 + Math.round(srand() * 4),
      conditions_text: `Fog, ${sunMin} min sunshine`,
    }
  }
}

export function getMockOriginWeather() {
  return {
    description: 'Fog, 3°C, brief sun 10-11 AM',
    sun_score: 0.06,
    sunshine_min: 40,
    temp_c: 3, visibility_m: 200, humidity_pct: 95,
  }
}

export function getMockOriginTimeline(): SunTimeline {
  return {
    today: [
      { condition: 'cloud', pct: 17 },
      { condition: 'partial', pct: 5 },
      { condition: 'sun', pct: 7 },
      { condition: 'cloud', pct: 56 },
      { condition: 'night', pct: 15 },
    ],
    tomorrow: [
      { condition: 'cloud', pct: 25 },
      { condition: 'partial', pct: 10 },
      { condition: 'cloud', pct: 30 },
      { condition: 'partial', pct: 8 },
      { condition: 'cloud', pct: 12 },
      { condition: 'night', pct: 15 },
    ],
  }
}

export function getMockTravelTime(
  oLat: number, oLon: number, dLat: number, dLon: number, mode: 'car' | 'train'
): { duration_min: number; distance_km?: number; changes?: number } {
  const R = 6371
  const dLa = (dLat - oLat) * Math.PI / 180, dLo = (dLon - oLon) * Math.PI / 180
  const a = Math.sin(dLa/2)**2 + Math.cos(oLat*Math.PI/180)*Math.cos(dLat*Math.PI/180)*Math.sin(dLo/2)**2
  const km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)) * 1.3
  if (mode === 'car') return { duration_min: Math.round(km/60*60), distance_km: Math.round(km) }
  seed = Math.round(dLat * 1000 + dLon * 100)
  return { duration_min: Math.round(km/55*60*1.4), changes: 1 + Math.round(srand()) }
}

// v15: More diverse timeline bars with varied cloud burst patterns
// Each destination gets a unique "weather personality" affecting bar shape
export function getMockSunTimeline(destination: Destination, demoMode = false): SunTimeline {
  const alt = destination.altitude_m
  const zone = ZONE[destination.id]
  seed = hashSeed(`${destination.id}:timeline`, demoMode ? demoBucket() : 0)

  function genDay(bias: number, dayOffset: number): TimelineSegment[] {
    // Compute sun chance based on destination type
    let sc = zone ? zone.sun_bias + bias : alt > 1000 ? 0.72 + bias : alt > 600 ? 0.38 + bias : 0.12 + bias
    if (demoMode) {
      if (destination.id === 'st-moritz') sc = 0.92 + bias
      else if (DEMO_SWISS_ELITE.has(destination.id)) sc = 0.72 + bias
      else if (DEMO_SWISS_MEDIUM.has(destination.id)) sc = 0.43 + bias
      else if (destination.country === 'CH') sc = 0.36 + bias
      else sc = 0.24 + bias
    }

    const segs: TimelineSegment[] = []
    let rem = 85

    // v15: Use destination name hash to vary number of segments (6-9)
    // and cloud burst positioning for more visual diversity
    const nameHash = destination.id.length + (destination.id.charCodeAt(0) || 0)
    const nSegs = 6 + Math.round(srand() * 3) // 6-9 segments
    const burstCount = 1 + Math.round(srand() * (demoMode ? 1 : 0)) // 1-2 cloud bursts in demo
    const burstPositions = new Set<number>()
    for (let b = 0; b < burstCount; b++) {
      // Spread bursts across the day for visual variety
      const pos = dayOffset === 0
        ? Math.round(srand() * (nSegs - 2)) + 1 // mid-day burst for today
        : Math.round(srand() * (nSegs - 1))       // anywhere for tomorrow
      burstPositions.add(pos)
    }

    // v15: Vary segment widths more -- some short, some long
    for (let i = 0; i < nSegs && rem > 3; i++) {
      // Alternate between shorter and longer segments for visual rhythm
      const isLong = (i + nameHash) % 3 === 0
      const minPct = isLong ? 12 : 5
      const maxPct = isLong ? 24 : 14
      const pct = Math.min(rem, minPct + Math.round(srand() * (maxPct - minPct)))
      rem -= pct

      let r = srand()
      // Force cloud at burst positions
      if (burstPositions.has(i)) r = 0.92 + srand() * 0.08
      // Force sun at start for high-altitude destinations (morning clearing)
      if (i === 0 && sc > 0.6 && demoMode) r = srand() * 0.3

      segs.push({
        condition: r < sc ? 'sun' : r < sc + 0.18 ? 'partial' : 'cloud',
        pct,
      })
    }
    if (rem > 0) segs.push({ condition: srand() < sc ? 'sun' : 'partial', pct: rem })
    segs.push({ condition: 'night', pct: 15 })
    return segs
  }
  return { today: genDay(0, 0), tomorrow: genDay(0.05, 1) }
}

export function getMockTomorrowSunHoursForDest(destination: Destination, demoMode = false): number {
  if (demoMode && destination.id === 'st-moritz') {
    seed = hashSeed(`${destination.id}:tomorrow`, demoBucket())
    return parseFloat((8.6 + srand() * 1.2).toFixed(1))
  }
  if (demoMode && destination.country === 'CH' && DEMO_SWISS_ELITE.has(destination.id)) {
    seed = hashSeed(`${destination.id}:tomorrow`, demoBucket())
    return parseFloat((6.8 + srand() * 2.0).toFixed(1))
  }
  if (demoMode && destination.country === 'CH' && DEMO_SWISS_MEDIUM.has(destination.id)) {
    seed = hashSeed(`${destination.id}:tomorrow`, demoBucket())
    return parseFloat((3.2 + srand() * 2.4).toFixed(1))
  }
  const zone = ZONE[destination.id]
  const base = zone ? zone.sun_bias * 7 : destination.altitude_m > 1000 ? 5.5 : destination.altitude_m > 600 ? 3.5 : 1.5
  seed = destination.id.length * 97
  return parseFloat((base + srand() * 1.5).toFixed(1))
}

export function getMockMaxSunHours(): number { return parseFloat((5.5 + (seed = 314, srand()) * 2).toFixed(1)) }

export function getMockDaylightWindow(dayOffset = 0): { start_hour: number; end_hour: number } {
  const d = new Date()
  d.setDate(d.getDate() + dayOffset)
  const { sunriseHour, sunsetHour } = seasonalSunHours(d)
  const start_hour = clamp(Math.floor(sunriseHour - 1), 0, 23)
  const end_hour = clamp(Math.ceil(sunsetHour + 1), start_hour + 1, 24)
  return { start_hour, end_hour }
}

export function getMockSunset(demoMode: boolean): { time: string; minutes_until: number; is_past: boolean } {
  const now = new Date()
  const { sunsetHour } = seasonalSunHours(now)
  const ss = new Date(now)
  ss.setHours(Math.floor(sunsetHour), Math.round((sunsetHour % 1) * 60), 0, 0)
  const d = Math.round((ss.getTime() - now.getTime()) / 60000)
  if (demoMode) {
    return { time: hourToClock(sunsetHour), minutes_until: Math.max(0, d), is_past: d <= 0 }
  }
  return { time: hourToClock(sunsetHour), minutes_until: Math.max(0, d), is_past: d <= 0 }
}

export function getMockTomorrowSunHours(): number { return 4.8 }
