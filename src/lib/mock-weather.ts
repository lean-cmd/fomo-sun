import { Destination, SunTimeline, TimelineSegment } from './types'

export interface MockWeatherResult {
  sunshine_forecast_min: number; low_cloud_cover_pct: number; total_cloud_cover_pct: number
  is_inversion_likely: boolean; ground_truth_available: boolean; ground_truth_sunny?: boolean
  temp_c: number; conditions_text: string
}

// Weather zone overrides for non-altitude-based destinations
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

// Simple seeded random for deterministic per-destination results within a session
let seed = 42
function srand() { seed = (seed * 16807 + 0) % 2147483647; return (seed - 1) / 2147483646 }
function resetSeed() { seed = 42 }

export function getMockWeather(destination: Destination): MockWeatherResult {
  // Reset seed per destination for consistency
  seed = destination.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 137

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
  const fogCeiling = 800 // fixed for demo consistency

  if (alt > fogCeiling + 200) {
    const sunMin = 130 + Math.round(srand() * 50) // 130-180: wide variance
    return {
      sunshine_forecast_min: sunMin, low_cloud_cover_pct: Math.round(srand() * 15),
      total_cloud_cover_pct: Math.round(srand() * 25), is_inversion_likely: true,
      ground_truth_available: true, ground_truth_sunny: true,
      temp_c: -2 + Math.round(srand() * 8),
      conditions_text: `Clear above fog, ${sunMin} min sunshine`,
    }
  } else if (alt > fogCeiling - 150) {
    const sunMin = 40 + Math.round(srand() * 100) // 40-140: big spread
    return {
      sunshine_forecast_min: sunMin, low_cloud_cover_pct: 25 + Math.round(srand() * 50),
      total_cloud_cover_pct: 35 + Math.round(srand() * 35), is_inversion_likely: true,
      ground_truth_available: srand() > 0.5, ground_truth_sunny: srand() > 0.4,
      temp_c: Math.round(srand() * 6),
      conditions_text: `Near fog boundary, ${sunMin} min sunshine`,
    }
  } else {
    const sunMin = Math.round(srand() * 25) // 0-25: mostly grey
    return {
      sunshine_forecast_min: sunMin, low_cloud_cover_pct: 80 + Math.round(srand() * 20),
      total_cloud_cover_pct: 85 + Math.round(srand() * 15), is_inversion_likely: true,
      ground_truth_available: true, ground_truth_sunny: false,
      temp_c: 1 + Math.round(srand() * 4),
      conditions_text: `Fog, ${sunMin} min sunshine`,
    }
  }
}

/** Basel: mostly fog but 40 min sun window around 10-11 AM */
export function getMockOriginWeather() {
  return {
    description: 'Fog, 3°C, brief sun 10-11 AM',
    sun_score: 0.08,
    sunshine_min: 40,
    temp_c: 3, visibility_m: 200, humidity_pct: 95,
  }
}

/** Origin (Basel) timeline: fog with a 10-11 AM sun break */
export function getMockOriginTimeline(): SunTimeline {
  return {
    today: [
      { condition: 'cloud', pct: 17 },  // 8-10: fog
      { condition: 'partial', pct: 5 },  // 10:00-10:20
      { condition: 'sun', pct: 7 },      // 10:20-11:00
      { condition: 'cloud', pct: 56 },   // 11-18: fog returns
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
  // Seed for consistent changes count
  seed = Math.round(dLat * 1000 + dLon * 100)
  return { duration_min: Math.round(km/55*60*1.4), changes: 1 + Math.round(srand()) }
}

export function getMockSunTimeline(destination: Destination): SunTimeline {
  const alt = destination.altitude_m
  const zone = ZONE[destination.id]
  seed = destination.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 73

  function genDay(bias: number): TimelineSegment[] {
    const sc = zone ? zone.sun_bias + bias : alt > 1000 ? 0.72 + bias : alt > 600 ? 0.38 + bias : 0.12 + bias
    const segs: TimelineSegment[] = []
    let rem = 85
    const n = 4 + Math.round(srand() * 2) // 4-6 segments for more variance
    for (let i = 0; i < n && rem > 5; i++) {
      const pct = Math.min(rem, 8 + Math.round(srand() * 22))
      rem -= pct; const r = srand()
      segs.push({ condition: r < sc ? 'sun' : r < sc + 0.18 ? 'partial' : 'cloud', pct })
    }
    if (rem > 0) segs.push({ condition: srand() < sc ? 'sun' : 'partial', pct: rem })
    segs.push({ condition: 'night', pct: 15 })
    return segs
  }
  return { today: genDay(0), tomorrow: genDay(0.05) }
}

/** Per-destination tomorrow sun hours */
export function getMockTomorrowSunHoursForDest(destination: Destination): number {
  const zone = ZONE[destination.id]
  const base = zone ? zone.sun_bias * 7 : destination.altitude_m > 1000 ? 5.5 : destination.altitude_m > 600 ? 3.5 : 1.5
  seed = destination.id.length * 97
  return parseFloat((base + srand() * 1.5).toFixed(1))
}

export function getMockMaxSunHours(): number { return parseFloat((5.5 + (seed = 314, srand()) * 2).toFixed(1)) }

export function getMockSunset(demoMode: boolean): { time: string; minutes_until: number; is_past: boolean } {
  if (demoMode) return { time: '17:34', minutes_until: 444, is_past: false }
  const now = new Date(), ss = new Date(); ss.setHours(17, 34, 0, 0)
  const d = Math.round((ss.getTime() - now.getTime()) / 60000)
  return { time: '17:34', minutes_until: Math.max(0, d), is_past: d <= 0 }
}

export function getMockTomorrowSunHours(): number { return 4.8 } // fixed for demo
