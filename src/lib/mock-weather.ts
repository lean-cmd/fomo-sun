import { Destination } from './types'

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
