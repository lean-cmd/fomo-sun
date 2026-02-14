import { Destination, SunTimeline, TimelineSegment } from './types'

/**
 * Mock Weather Service (v0)
 * 
 * Returns simulated weather data for destinations.
 * In production (M1), this will be replaced with:
 * - MeteoSwiss local forecast data for CH destinations
 * - Open-Meteo for FR/DE destinations
 * 
 * The mock simulates a typical inversion day:
 * - Low altitude (<600m) = foggy
 * - Mid altitude (600-1000m) = variable
 * - High altitude (>1000m) = sunny
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

/**
 * Simulate weather for a destination on a foggy day
 */
export function getMockWeather(destination: Destination): MockWeatherResult {
  const alt = destination.altitude_m

  // Simulate inversion: fog below ~700-900m
  const fogCeiling = 750 + Math.random() * 200 // 750-950m

  if (alt > fogCeiling + 200) {
    // Well above fog - sunny
    return {
      sunshine_forecast_min: 140 + Math.floor(Math.random() * 40), // 140-180 min of sun
      low_cloud_cover_pct: Math.floor(Math.random() * 15), // 0-15%
      total_cloud_cover_pct: Math.floor(Math.random() * 25), // 0-25%
      is_inversion_likely: true,
      ground_truth_available: Math.random() > 0.5,
      ground_truth_sunny: true,
      temp_c: -2 + Math.floor(Math.random() * 8), // -2 to 6°C
      conditions_text: 'Clear sky above fog, sunshine',
    }
  } else if (alt > fogCeiling - 100) {
    // Near fog boundary - variable
    return {
      sunshine_forecast_min: 60 + Math.floor(Math.random() * 80), // 60-140 min
      low_cloud_cover_pct: 30 + Math.floor(Math.random() * 40), // 30-70%
      total_cloud_cover_pct: 40 + Math.floor(Math.random() * 30),
      is_inversion_likely: true,
      ground_truth_available: Math.random() > 0.7,
      ground_truth_sunny: Math.random() > 0.5,
      temp_c: 0 + Math.floor(Math.random() * 6),
      conditions_text: 'Near fog boundary, variable clouds',
    }
  } else {
    // Below fog - grey
    return {
      sunshine_forecast_min: Math.floor(Math.random() * 30), // 0-30 min
      low_cloud_cover_pct: 80 + Math.floor(Math.random() * 20), // 80-100%
      total_cloud_cover_pct: 85 + Math.floor(Math.random() * 15),
      is_inversion_likely: true,
      ground_truth_available: Math.random() > 0.3,
      ground_truth_sunny: false,
      temp_c: 1 + Math.floor(Math.random() * 4),
      conditions_text: 'Fog, overcast, low visibility',
    }
  }
}

/**
 * Get mock weather for origin (Basel-like conditions on a foggy day)
 */
export function getMockOriginWeather(): {
  description: string
  sun_score: number
  temp_c: number
  visibility_m: number
  humidity_pct: number
} {
  return {
    description: 'Fog, 3°C, low visibility',
    sun_score: 0.05,
    temp_c: 3,
    visibility_m: 200,
    humidity_pct: 95,
  }
}

/**
 * Simulate mock travel times (will be replaced with OJP/ORS in M2)
 */
export function getMockTravelTime(
  originLat: number,
  originLon: number,
  destLat: number,
  destLon: number,
  mode: 'car' | 'train'
): { duration_min: number; distance_km?: number; changes?: number } {
  // Rough haversine
  const R = 6371
  const dLat = (destLat - originLat) * Math.PI / 180
  const dLon = (destLon - originLon) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(originLat * Math.PI / 180) * Math.cos(destLat * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  const straightLineKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  if (mode === 'car') {
    const roadKm = straightLineKm * 1.3 // roads are ~30% longer
    const avgSpeed = 60 // km/h average including mountains
    return {
      duration_min: Math.round(roadKm / avgSpeed * 60),
      distance_km: Math.round(roadKm),
    }
  } else {
    const ptMultiplier = 1.4 // PT is ~40% longer than car
    const roadKm = straightLineKm * 1.3
    const avgSpeed = 55
    return {
      duration_min: Math.round(roadKm / avgSpeed * 60 * ptMultiplier),
      changes: 1 + Math.floor(Math.random() * 2),
    }
  }
}

/**
 * Generate a mock sunshine timeline for a destination
 * Simulates hourly sun/cloud conditions from 8:00-18:00
 */
export function getMockSunTimeline(destination: Destination): SunTimeline {
  const alt = destination.altitude_m

  function generateDay(bias: number): TimelineSegment[] {
    // Higher altitude = more sun segments
    const sunChance = alt > 1000 ? 0.7 + bias : alt > 600 ? 0.4 + bias : 0.15 + bias
    const segments: TimelineSegment[] = []
    let remaining = 85 // 85% daylight, 15% night

    // Generate 3-5 segments for the day
    const numSegments = 3 + Math.floor(Math.random() * 3)
    for (let i = 0; i < numSegments && remaining > 5; i++) {
      const pct = Math.min(remaining, 10 + Math.floor(Math.random() * 25))
      remaining -= pct
      const roll = Math.random()
      const condition = roll < sunChance ? 'sun' : roll < sunChance + 0.2 ? 'partial' : 'cloud'
      segments.push({ condition, pct })
    }
    if (remaining > 0) {
      segments.push({ condition: Math.random() < sunChance ? 'sun' : 'partial', pct: remaining })
    }
    segments.push({ condition: 'night', pct: 15 })
    return segments
  }

  return {
    today: generateDay(0),
    tomorrow: generateDay(0.05),
  }
}

/**
 * Get the maximum sunshine hours available today above the fog
 * (used for the FOMO stat in the hero)
 */
export function getMockMaxSunHours(): number {
  // On a typical inversion day, summits above the fog get 5-7 hours
  return parseFloat((5 + Math.random() * 2.5).toFixed(1))
}
