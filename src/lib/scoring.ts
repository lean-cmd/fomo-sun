import { Confidence, Destination, SunScore } from './types'

/**
 * FOMO Sun Scoring Algorithm v0
 * 
 * Computes a 0-1 "sun score" for a destination based on:
 * - Predicted sunshine duration (next 3 hours)
 * - Low cloud cover forecast
 * - Altitude bonus during inversion conditions
 * 
 * Confidence is derived from score + ground truth availability
 */

interface WeatherData {
  sunshine_forecast_min: number   // predicted sunshine minutes in next 3h (0-180)
  sunshine_norm_cap_min?: number  // normalization cap for extended horizons (default 180)
  low_cloud_cover_pct: number     // predicted low cloud cover % (0-100)
  total_cloud_cover_pct: number   // predicted total cloud cover % (0-100)
  is_inversion_likely: boolean    // derived from temperature profile or manual flag
  ground_truth_available: boolean // do we have a nearby station observation?
  ground_truth_sunny?: boolean    // if available, is the station showing sun?
}

/**
 * Compute sun score for a destination
 */
export function computeSunScore(
  destination: Destination,
  weather: WeatherData
): SunScore {
  // Normalize sunshine forecast (0-1)
  const sunshineCap = Math.max(60, weather.sunshine_norm_cap_min ?? 180)
  const sunshine_norm = Math.min(weather.sunshine_forecast_min / sunshineCap, 1)

  // Invert low cloud cover (high cloud cover = bad)
  const low_cloud_norm = 1 - (weather.low_cloud_cover_pct / 100)

  // Altitude bonus (only during inversion conditions)
  let altitude_bonus = 0
  if (weather.is_inversion_likely) {
    if (destination.altitude_m > 1200) altitude_bonus = 1.0
    else if (destination.altitude_m > 800) altitude_bonus = 0.7
    else if (destination.altitude_m > 600) altitude_bonus = 0.4
    else altitude_bonus = 0.0
  }

  // Weighted score
  const score = Math.min(1, Math.max(0,
    0.6 * sunshine_norm +
    0.3 * low_cloud_norm +
    0.1 * altitude_bonus
  ))

  // Determine confidence
  const confidence = determineConfidence(score, weather)

  return {
    score: Math.round(score * 100) / 100,
    confidence,
    sunshine_forecast_min: weather.sunshine_forecast_min,
    low_cloud_cover_pct: weather.low_cloud_cover_pct,
    altitude_bonus,
    data_freshness: new Date().toISOString(),
  }
}

/**
 * Determine confidence level
 */
function determineConfidence(score: number, weather: WeatherData): Confidence {
  // Highest confidence: high score + ground truth confirms
  if (score > 0.75 && weather.ground_truth_available && weather.ground_truth_sunny) {
    return 'high'
  }

  // High confidence: high score even without ground truth
  if (score > 0.75) {
    return 'high'
  }

  // Medium confidence
  if (score > 0.5) {
    return 'medium'
  }

  // Low confidence
  if (score > 0.3) {
    return 'low'
  }

  return 'uncertain'
}

/**
 * Rank destinations by combined score (sun score weighted by travel time)
 * Closer + sunnier = better rank
 */
export function rankDestinations(
  results: Array<{
    destination: Destination
    sun_score: SunScore
    travel_time_min: number
  }>,
  max_travel_min: number
): Array<{
  destination: Destination
  sun_score: SunScore
  travel_time_min: number
  combined_score: number
}> {
  return results
    .filter(r => r.travel_time_min <= max_travel_min)
    .map(r => ({
      ...r,
      // Combined score: sun quality * travel convenience
      // Travel factor: 1.0 for 0 min, decreasing to 0.5 at max_travel_min
      combined_score: r.sun_score.score * (1 - 0.5 * (r.travel_time_min / max_travel_min))
    }))
    .sort((a, b) => b.combined_score - a.combined_score)
}

/**
 * Detect likely inversion conditions based on origin weather
 * Simple heuristic: if origin has high humidity + low visibility + low temp + calm wind
 * then inversion is likely
 */
export function detectInversion(originWeather: {
  visibility_m?: number
  humidity_pct?: number
  temp_c?: number
  wind_speed_kmh?: number
}): boolean {
  const { visibility_m, humidity_pct, temp_c, wind_speed_kmh } = originWeather

  // If visibility is low and humidity is high, likely fog/inversion
  if (visibility_m !== undefined && visibility_m < 1000 && 
      humidity_pct !== undefined && humidity_pct > 85) {
    return true
  }

  // If low temperature + high humidity + low wind = fog conditions
  if (temp_c !== undefined && temp_c < 5 &&
      humidity_pct !== undefined && humidity_pct > 80 &&
      wind_speed_kmh !== undefined && wind_speed_kmh < 10) {
    return true
  }

  return false
}

/**
 * Haversine distance between two points in km
 * Used for cheap pre-filtering before routing API calls
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371 // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

/**
 * Pre-filter destinations by straight-line distance
 * Uses 1.5x multiplier (roads are longer than straight-line)
 * At 80km/h average, max_travel_h hours = max_travel_h * 80 * 1.5 km straight-line
 */
export function preFilterByDistance(
  originLat: number,
  originLon: number,
  allDestinations: Destination[],
  maxTravelHours: number
): Destination[] {
  const maxStraightLineKm = maxTravelHours * 80 // conservative estimate
  
  return allDestinations.filter(dest => {
    const dist = haversineDistance(originLat, originLon, dest.lat, dest.lon)
    return dist <= maxStraightLineKm
  })
}
