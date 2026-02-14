import { Destination, SunTimeline, TimelineSegment } from './types'

/**
 * Mock Weather Service (v0)
 * 
 * Simulates weather for destinations. Production will use:
 * - Open-Meteo API for all destinations (free, no key needed)
 * - MeteoSwiss local forecast for CH (backup)
 */

export interface MockWeatherResult {
  sunshine_forecast_min: number
  low_cloud_cover_pct: number
  total_cloud_cover_pct: number
  is_inversion_likely: boolean
  ground_truth_available: boolean
  ground_truth_sunny?: boolean
  temp_c: number
  conditions_text: string
}

// Some destinations are in different weather zones and escape the Rhine Valley fog
const DIFFERENT_WEATHER_ZONE: Record<string, { sun_bias: number; conditions: string }> = {
  'strasbourg': { sun_bias: 0.55, conditions: 'Partly sunny, 5°C, Alsace plain often clearer than Rhine Valley' },
  'colmar': { sun_bias: 0.6, conditions: 'Partly sunny, 6°C, driest city in France (rain shadow)' },
  'freiburg-im-breisgau': { sun_bias: 0.5, conditions: 'Partly cloudy, 5°C, sunniest city in Germany' },
  'lucerne': { sun_bias: 0.45, conditions: 'Breaking cloud, 5°C, lake reflecting sun, clearing by midday' },
  'bern': { sun_bias: 0.3, conditions: 'Overcast, 3°C, similar fog pattern to Basel' },
  'zurich': { sun_bias: 0.25, conditions: 'Overcast, 3°C, Mittelland fog zone' },
  'interlaken': { sun_bias: 0.45, conditions: 'Variable, 4°C, sheltered between lakes, often brighter' },
  'st-moritz': { sun_bias: 0.9, conditions: 'Clear sky, -3°C, 1822m, above all fog, Engadin sun' },
  'konstanz': { sun_bias: 0.4, conditions: 'Partly cloudy, 4°C, lake moderates fog' },
  'gruyeres': { sun_bias: 0.5, conditions: 'Variable, 3°C, pre-Alps altitude helps' },
  'mulhouse': { sun_bias: 0.2, conditions: 'Fog, 3°C, similar Rhine Valley conditions' },
}

/**
 * Simulate weather for a destination
 * Uses altitude-based inversion model + weather zone overrides
 */
export function getMockWeather(destination: Destination): MockWeatherResult {
  // Check if this destination has a weather zone override
  const zoneOverride = DIFFERENT_WEATHER_ZONE[destination.id]

  if (zoneOverride) {
    const sunBias = zoneOverride.sun_bias
    const sunMin = Math.round(sunBias * 180)
    const cloudPct = Math.round((1 - sunBias) * 100)
    return {
      sunshine_forecast_min: Math.max(0, sunMin + Math.floor(Math.random() * 30 - 15)),
      low_cloud_cover_pct: Math.max(0, cloudPct + Math.floor(Math.random() * 20 - 10)),
      total_cloud_cover_pct: Math.max(0, cloudPct + Math.floor(Math.random() * 15)),
      is_inversion_likely: true,
      ground_truth_available: Math.random() > 0.4,
      ground_truth_sunny: sunBias > 0.4,
      temp_c: destination.altitude_m > 1500 ? -3 + Math.floor(Math.random() * 4) : 2 + Math.floor(Math.random() * 5),
      conditions_text: zoneOverride.conditions,
    }
  }

  // Standard altitude-based model
  const alt = destination.altitude_m
  const fogCeiling = 750 + Math.random() * 200

  if (alt > fogCeiling + 200) {
    return {
      sunshine_forecast_min: 140 + Math.floor(Math.random() * 40),
      low_cloud_cover_pct: Math.floor(Math.random() * 15),
      total_cloud_cover_pct: Math.floor(Math.random() * 25),
      is_inversion_likely: true,
      ground_truth_available: Math.random() > 0.5,
      ground_truth_sunny: true,
      temp_c: -2 + Math.floor(Math.random() * 8),
      conditions_text: `Clear sky above fog, ${140 + Math.floor(Math.random() * 40)} min of sunshine expected`,
    }
  } else if (alt > fogCeiling - 100) {
    const sunMin = 60 + Math.floor(Math.random() * 80)
    return {
      sunshine_forecast_min: sunMin,
      low_cloud_cover_pct: 30 + Math.floor(Math.random() * 40),
      total_cloud_cover_pct: 40 + Math.floor(Math.random() * 30),
      is_inversion_likely: true,
      ground_truth_available: Math.random() > 0.7,
      ground_truth_sunny: Math.random() > 0.5,
      temp_c: Math.floor(Math.random() * 6),
      conditions_text: `Near fog boundary, ${sunMin} min of sunshine expected`,
    }
  } else {
    const sunMin = Math.floor(Math.random() * 30)
    return {
      sunshine_forecast_min: sunMin,
      low_cloud_cover_pct: 80 + Math.floor(Math.random() * 20),
      total_cloud_cover_pct: 85 + Math.floor(Math.random() * 15),
      is_inversion_likely: true,
      ground_truth_available: Math.random() > 0.3,
      ground_truth_sunny: false,
      temp_c: 1 + Math.floor(Math.random() * 4),
      conditions_text: `Fog, ${sunMin} min of sunshine expected`,
    }
  }
}

/** Basel origin conditions */
export function getMockOriginWeather() {
  return {
    description: 'Fog, 3°C, low visibility',
    sun_score: 0.05,
    sunshine_min: 10,
    temp_c: 3,
    visibility_m: 200,
    humidity_pct: 95,
  }
}

/** Mock travel times */
export function getMockTravelTime(
  originLat: number, originLon: number,
  destLat: number, destLon: number,
  mode: 'car' | 'train'
): { duration_min: number; distance_km?: number; changes?: number } {
  const R = 6371
  const dLat = (destLat - originLat) * Math.PI / 180
  const dLon = (destLon - originLon) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(originLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  const straightLineKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  if (mode === 'car') {
    const roadKm = straightLineKm * 1.3
    return { duration_min: Math.round(roadKm / 60 * 60), distance_km: Math.round(roadKm) }
  } else {
    const roadKm = straightLineKm * 1.3
    return { duration_min: Math.round(roadKm / 55 * 60 * 1.4), changes: 1 + Math.floor(Math.random() * 2) }
  }
}

/** Generate sunshine timeline with seeded randomness per destination */
export function getMockSunTimeline(destination: Destination): SunTimeline {
  const alt = destination.altitude_m
  const zone = DIFFERENT_WEATHER_ZONE[destination.id]

  function generateDay(bias: number): TimelineSegment[] {
    const sunChance = zone
      ? zone.sun_bias + bias
      : alt > 1000 ? 0.7 + bias : alt > 600 ? 0.4 + bias : 0.15 + bias

    const segments: TimelineSegment[] = []
    let remaining = 85

    const numSegments = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < numSegments && remaining > 5; i++) {
      const pct = Math.min(remaining, 10 + Math.floor(Math.random() * 25))
      remaining -= pct
      const roll = Math.random()
      segments.push({ condition: roll < sunChance ? 'sun' : roll < sunChance + 0.2 ? 'partial' : 'cloud', pct })
    }
    if (remaining > 0) segments.push({ condition: Math.random() < sunChance ? 'sun' : 'partial', pct: remaining })
    segments.push({ condition: 'night', pct: 15 })
    return segments
  }

  return { today: generateDay(0), tomorrow: generateDay(0.05) }
}

export function getMockMaxSunHours(): number {
  return parseFloat((5 + Math.random() * 2.5).toFixed(1))
}

export function getMockSunset(demoMode: boolean): { time: string; minutes_until: number; is_past: boolean } {
  const sunsetHour = 17, sunsetMin = 34

  if (demoMode) {
    // Demo is set at 10:10 AM, so 7h24m until sunset
    return { time: `${sunsetHour}:${sunsetMin}`, minutes_until: 444, is_past: false }
  }

  const now = new Date()
  const sunsetToday = new Date()
  sunsetToday.setHours(sunsetHour, sunsetMin, 0, 0)
  const diffMin = Math.round((sunsetToday.getTime() - now.getTime()) / 60000)

  return { time: `${sunsetHour}:${sunsetMin}`, minutes_until: Math.max(0, diffMin), is_past: diffMin <= 0 }
}

export function getMockTomorrowSunHours(): number {
  return parseFloat((4 + Math.random() * 3.5).toFixed(1))
}
