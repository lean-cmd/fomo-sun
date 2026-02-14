/**
 * Open-Meteo Live Weather Integration
 *
 * Free API, no key required. Provides:
 * - Current conditions for origin (is it foggy?)
 * - Hourly forecast for destinations (sunshine duration, cloud cover)
 * - Sunrise/sunset times
 *
 * Docs: https://open-meteo.com/en/docs
 *
 * Rate limit: 10,000 requests/day (generous for MVP)
 */

export interface LiveWeatherResult {
  temperature_c: number
  cloud_cover_pct: number
  low_cloud_cover_pct: number
  visibility_m: number
  sunshine_duration_min: number // sunshine in the past hour
  is_foggy: boolean
  conditions_text: string
  wind_speed_kmh: number
}

export interface LiveForecastHour {
  time: string // ISO
  sunshine_duration_min: number
  cloud_cover_pct: number
  low_cloud_cover_pct: number
  temperature_c: number
}

export interface LiveSunTimes {
  sunrise: string
  sunset: string
  sunset_minutes_until: number
}

const BASE = 'https://api.open-meteo.com/v1'

/**
 * Get current conditions for a location
 */
export async function getCurrentWeather(lat: number, lon: number): Promise<LiveWeatherResult> {
  const url = `${BASE}/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,cloud_cover,cloud_cover_low,visibility,sunshine_duration,wind_speed_10m&timezone=auto`

  const res = await fetch(url, { next: { revalidate: 300 } }) // Cache 5 min
  const data = await res.json()
  const c = data.current

  const visibility = c.visibility ?? 10000
  const cloudLow = c.cloud_cover_low ?? 0
  const isFoggy = visibility < 1000 || cloudLow > 80

  let conditions = ''
  if (isFoggy) conditions = `Fog, ${Math.round(c.temperature_2m)}°C, low visibility`
  else if (c.cloud_cover > 80) conditions = `Overcast, ${Math.round(c.temperature_2m)}°C`
  else if (c.cloud_cover > 50) conditions = `Partly cloudy, ${Math.round(c.temperature_2m)}°C`
  else conditions = `Mostly clear, ${Math.round(c.temperature_2m)}°C`

  return {
    temperature_c: c.temperature_2m,
    cloud_cover_pct: c.cloud_cover,
    low_cloud_cover_pct: cloudLow,
    visibility_m: visibility,
    sunshine_duration_min: Math.round((c.sunshine_duration ?? 0) / 60),
    is_foggy: isFoggy,
    conditions_text: conditions,
    wind_speed_kmh: c.wind_speed_10m ?? 0,
  }
}

/**
 * Get hourly forecast for a destination (next 48h)
 */
export async function getHourlyForecast(lat: number, lon: number): Promise<{
  hours: LiveForecastHour[]
  total_sunshine_today_min: number
  total_sunshine_tomorrow_min: number
}> {
  const url = `${BASE}/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,cloud_cover,cloud_cover_low,sunshine_duration&forecast_days=2&timezone=auto`

  const res = await fetch(url, { next: { revalidate: 300 } })
  const data = await res.json()
  const h = data.hourly

  const hours: LiveForecastHour[] = h.time.map((t: string, i: number) => ({
    time: t,
    sunshine_duration_min: Math.round((h.sunshine_duration?.[i] ?? 0) / 60),
    cloud_cover_pct: h.cloud_cover?.[i] ?? 0,
    low_cloud_cover_pct: h.cloud_cover_low?.[i] ?? 0,
    temperature_c: h.temperature_2m?.[i] ?? 0,
  }))

  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().slice(0, 10)

  const todaySun = hours.filter(h => h.time.startsWith(todayStr)).reduce((s, h) => s + h.sunshine_duration_min, 0)
  const tomorrowSun = hours.filter(h => h.time.startsWith(tomorrowStr)).reduce((s, h) => s + h.sunshine_duration_min, 0)

  return { hours, total_sunshine_today_min: todaySun, total_sunshine_tomorrow_min: tomorrowSun }
}

/**
 * Get sunrise/sunset times
 */
export async function getSunTimes(lat: number, lon: number): Promise<LiveSunTimes> {
  const url = `${BASE}/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset&forecast_days=1&timezone=auto`

  const res = await fetch(url, { next: { revalidate: 3600 } })
  const data = await res.json()

  const sunrise = data.daily.sunrise[0]
  const sunset = data.daily.sunset[0]
  const sunsetDate = new Date(sunset)
  const minutesUntil = Math.max(0, Math.round((sunsetDate.getTime() - Date.now()) / 60000))

  return {
    sunrise: new Date(sunrise).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }),
    sunset: new Date(sunset).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }),
    sunset_minutes_until: minutesUntil,
  }
}

/**
 * Batch get weather for multiple destinations
 * Open-Meteo supports up to 10 locations per request via the multi-location endpoint
 */
export async function batchGetWeather(locations: { lat: number; lon: number }[]): Promise<LiveWeatherResult[]> {
  // Open-Meteo doesn't have a native batch endpoint, so we fan out requests
  // In production, we'd add a Redis/Vercel KV cache layer
  const results = await Promise.all(
    locations.map(loc => getCurrentWeather(loc.lat, loc.lon))
  )
  return results
}
