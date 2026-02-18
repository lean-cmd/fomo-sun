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
 * Rate limit: 10,000 requests/day (target to minimize by batching + cache)
 */

export interface LiveWeatherResult {
  temperature_c: number
  cloud_cover_pct: number
  low_cloud_cover_pct: number
  relative_humidity_pct: number
  visibility_m: number
  sunshine_duration_min: number // sunshine in the past hour
  precipitation_mm: number
  snowfall_cm: number
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
  relative_humidity_pct: number
  wind_speed_kmh: number
  precipitation_mm: number
  snowfall_cm: number
}

export interface LiveSunTimes {
  sunrise: string
  sunset: string
  sunset_minutes_until: number
  daylight_window_today: { start_hour: number; end_hour: number }
  daylight_window_tomorrow: { start_hour: number; end_hour: number }
}

export interface LiveHourlyForecastResult {
  hours: LiveForecastHour[]
  total_sunshine_today_min: number
  total_sunshine_tomorrow_min: number
}

export interface LiveBatchWeatherResult extends LiveHourlyForecastResult {
  lat: number
  lon: number
  current: LiveWeatherResult
}

export type WeatherSourcePolicy = 'auto' | 'meteoswiss' | 'openmeteo'

const BASE = 'https://api.open-meteo.com/v1'
const SWISS_MODEL = 'meteoswiss_seamless'
const CURRENT_FIELDS = 'temperature_2m,cloud_cover,cloud_cover_low,relative_humidity_2m,visibility,sunshine_duration,wind_speed_10m,precipitation,snowfall'
const HOURLY_FIELDS = 'temperature_2m,cloud_cover,cloud_cover_low,relative_humidity_2m,wind_speed_10m,sunshine_duration,precipitation,snowfall'
const BATCH_CHUNK_SIZE = 30
const BATCH_PARALLELISM = 3
const OPEN_METEO_TIMEOUT_MS = 9_000
const ZURICH_TZ = 'Europe/Zurich'

const CURRENT_TTL_MS = 5 * 60 * 1000
const HOURLY_TTL_MS = 5 * 60 * 1000
const SUN_TTL_MS = 60 * 60 * 1000

let currentCache = new Map<string, { expires_at: number; data: LiveWeatherResult }>()
let hourlyCache = new Map<string, { expires_at: number; data: LiveHourlyForecastResult }>()
let sunCache = new Map<string, { expires_at: number; data: LiveSunTimes }>()

function normalizeWeatherSourcePolicy(policy?: string | null): WeatherSourcePolicy {
  const raw = String(policy || 'auto').toLowerCase()
  if (raw === 'openmeteo' || raw === 'open-meteo') return 'openmeteo'
  if (raw === 'meteoswiss') return 'meteoswiss'
  return 'auto'
}

function cacheKey(lat: number, lon: number, policy: WeatherSourcePolicy) {
  return `${lat.toFixed(3)},${lon.toFixed(3)}|${policy}`
}

function inSwissModelBounds(lat: number, lon: number) {
  return lat >= 45.6 && lat <= 47.95 && lon >= 5.6 && lon <= 10.7
}

function modelForPoint(lat: number, lon: number, policy: WeatherSourcePolicy) {
  if (policy === 'openmeteo') return null
  if (policy === 'meteoswiss') return inSwissModelBounds(lat, lon) ? SWISS_MODEL : null
  // auto: MeteoSwiss for CH points, Open-Meteo default elsewhere
  return inSwissModelBounds(lat, lon) ? SWISS_MODEL : null
}

function batchPointKey(lat: number, lon: number) {
  // Open-Meteo may round coordinates in multi-point responses.
  return `${lat.toFixed(3)},${lon.toFixed(3)}`
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function dayStringInZurich(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZURICH_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function hourFromIso(iso: string): number {
  const m = iso.match(/T(\d{2}):(\d{2})/)
  if (m) {
    const hh = Number(m[1])
    const mm = Number(m[2])
    if (Number.isFinite(hh) && Number.isFinite(mm)) return hh + mm / 60
  }
  const d = new Date(iso)
  return d.getHours() + d.getMinutes() / 60
}

function windowFromSunriseSunset(sunriseIso: string, sunsetIso: string) {
  const start_hour = clamp(Math.floor(hourFromIso(sunriseIso) - 1), 0, 23)
  const end_hour = clamp(Math.ceil(hourFromIso(sunsetIso) + 1), start_hour + 1, 24)
  return { start_hour, end_hour }
}

function computeSunTotals(hours: LiveForecastHour[]) {
  const nowDate = new Date()
  const todayStr = dayStringInZurich(nowDate)
  const tomorrow = new Date(nowDate.getTime() + 24 * 60 * 60 * 1000)
  const tomorrowStr = dayStringInZurich(tomorrow)

  const total_sunshine_today_min = hours
    .filter(h => h.time.startsWith(todayStr))
    .reduce((sum, h) => sum + h.sunshine_duration_min, 0)

  const total_sunshine_tomorrow_min = hours
    .filter(h => h.time.startsWith(tomorrowStr))
    .reduce((sum, h) => sum + h.sunshine_duration_min, 0)

  return { total_sunshine_today_min, total_sunshine_tomorrow_min }
}

function parseHourly(payload: any): LiveForecastHour[] {
  const h = payload?.hourly
  const times: string[] = Array.isArray(h?.time) ? h.time : []

  return times.map((t, i) => ({
    time: t,
    sunshine_duration_min: Math.round((h?.sunshine_duration?.[i] ?? 0) / 60),
    cloud_cover_pct: h?.cloud_cover?.[i] ?? 0,
    low_cloud_cover_pct: h?.cloud_cover_low?.[i] ?? 0,
    temperature_c: h?.temperature_2m?.[i] ?? 0,
    relative_humidity_pct: h?.relative_humidity_2m?.[i] ?? 0,
    wind_speed_kmh: h?.wind_speed_10m?.[i] ?? 0,
    precipitation_mm: h?.precipitation?.[i] ?? 0,
    snowfall_cm: h?.snowfall?.[i] ?? 0,
  }))
}

function parseCurrent(payload: any): LiveWeatherResult {
  const c = payload?.current ?? {}
  const visibility = c.visibility ?? 10000
  const cloudTotal = c.cloud_cover ?? 0
  const cloudLow = c.cloud_cover_low ?? 0
  const humidity = c.relative_humidity_2m ?? 0
  const wind = c.wind_speed_10m ?? 0
  const precipitation = c.precipitation ?? 0
  const snowfall = c.snowfall ?? 0
  const isFoggy =
    visibility < 2500 ||
    cloudLow > 72 ||
    (humidity > 88 && wind < 14 && cloudTotal > 60)

  let conditions = ''
  if (snowfall > 0.05 || (precipitation > 0.2 && (c.temperature_2m ?? 0) <= 1)) {
    conditions = `Snow likely, ${Math.round(c.temperature_2m ?? 0)}°C`
  } else if (isFoggy) conditions = `Low cloud/fog likely, ${Math.round(c.temperature_2m ?? 0)}°C`
  else if (cloudTotal > 82 || cloudLow > 68) conditions = `Cloudy, ${Math.round(c.temperature_2m ?? 0)}°C`
  else if (cloudTotal > 45) conditions = `Partly sunny, ${Math.round(c.temperature_2m ?? 0)}°C`
  else conditions = `Mostly sunny, ${Math.round(c.temperature_2m ?? 0)}°C`

  return {
    temperature_c: c.temperature_2m ?? 0,
    cloud_cover_pct: cloudTotal,
    low_cloud_cover_pct: cloudLow,
    relative_humidity_pct: humidity,
    visibility_m: visibility,
    sunshine_duration_min: Math.round((c.sunshine_duration ?? 0) / 60),
    precipitation_mm: precipitation,
    snowfall_cm: snowfall,
    is_foggy: isFoggy,
    conditions_text: conditions,
    wind_speed_kmh: wind,
  }
}

function normalizeBatchPayload(payload: any): any[] {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.responses)) {
    return payload.responses.map((item: any) => item?.data ?? item)
  }
  return [payload]
}

function parseBatchRecord(payload: any): LiveBatchWeatherResult | null {
  const lat = Number(payload?.latitude)
  const lon = Number(payload?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  const hours = parseHourly(payload)
  const totals = computeSunTotals(hours)

  return {
    lat,
    lon,
    current: parseCurrent(payload),
    hours,
    ...totals,
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

async function fetchBatchChunk(
  locations: { lat: number; lon: number }[],
  model?: string | null
): Promise<LiveBatchWeatherResult[]> {
  if (locations.length === 0) return []

  const latCsv = locations.map(l => l.lat.toFixed(5)).join(',')
  const lonCsv = locations.map(l => l.lon.toFixed(5)).join(',')
  const url = `${BASE}/forecast?latitude=${latCsv}&longitude=${lonCsv}&current=${CURRENT_FIELDS}&hourly=${HOURLY_FIELDS}&forecast_days=2&timezone=Europe%2FZurich`
  const payload = await fetchOpenMeteoForecast(url, 300, model)
  const rows = normalizeBatchPayload(payload)
  const parsed = rows
    .map((row, idx) => {
      const parsedRow = parseBatchRecord(row)
      if (!parsedRow) return null
      const srcPoint = locations[idx]
      return srcPoint
        ? { ...parsedRow, lat: srcPoint.lat, lon: srcPoint.lon }
        : parsedRow
    })
    .filter((r): r is LiveBatchWeatherResult => Boolean(r))

  if (parsed.length === 0) throw new Error('Open-Meteo batch parse produced no rows')
  return parsed
}

async function fetchOpenMeteoJson(url: string, revalidate: number) {
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), OPEN_METEO_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      next: { revalidate },
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`open-meteo-http-${res.status}`)
    return await res.json()
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') {
      throw new Error('open-meteo-timeout')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

function shouldRetryWithoutModel(err: unknown) {
  const msg = String((err as { message?: string })?.message || err || '').toLowerCase()
  // Retry only for model/query-shape errors; keep transport/rate/timeouts as hard errors.
  return msg.includes('open-meteo-http-400') || msg.includes('open-meteo-http-404') || msg.includes('open-meteo-http-422')
}

async function fetchOpenMeteoForecast(
  baseUrl: string,
  revalidate: number,
  model?: string | null
) {
  if (!model) return fetchOpenMeteoJson(baseUrl, revalidate)

  const modeledUrl = `${baseUrl}&models=${encodeURIComponent(model)}`
  try {
    return await fetchOpenMeteoJson(modeledUrl, revalidate)
  } catch (err) {
    if (!shouldRetryWithoutModel(err)) throw err
    return fetchOpenMeteoJson(baseUrl, revalidate)
  }
}

/**
 * Get current conditions for a location
 */
export async function getCurrentWeather(
  lat: number,
  lon: number,
  options?: { weather_source?: WeatherSourcePolicy | string }
): Promise<LiveWeatherResult> {
  const policy = normalizeWeatherSourcePolicy(options?.weather_source)
  const key = cacheKey(lat, lon, policy)
  const now = Date.now()
  const cached = currentCache.get(key)
  if (cached && cached.expires_at > now) return cached.data

  const url = `${BASE}/forecast?latitude=${lat}&longitude=${lon}&current=${CURRENT_FIELDS}&timezone=Europe%2FZurich`

  const data = await fetchOpenMeteoForecast(url, 300, modelForPoint(lat, lon, policy))
  const result = parseCurrent(data)

  currentCache.set(key, { expires_at: now + CURRENT_TTL_MS, data: result })
  return result
}

/**
 * Get hourly forecast for a destination (next 48h)
 */
export async function getHourlyForecast(
  lat: number,
  lon: number,
  options?: { weather_source?: WeatherSourcePolicy | string }
): Promise<LiveHourlyForecastResult> {
  const policy = normalizeWeatherSourcePolicy(options?.weather_source)
  const key = cacheKey(lat, lon, policy)
  const now = Date.now()
  const cached = hourlyCache.get(key)
  if (cached && cached.expires_at > now) return cached.data

  const url = `${BASE}/forecast?latitude=${lat}&longitude=${lon}&hourly=${HOURLY_FIELDS}&forecast_days=2&timezone=Europe%2FZurich`

  const payload = await fetchOpenMeteoForecast(url, 300, modelForPoint(lat, lon, policy))

  const hours = parseHourly(payload)
  const result: LiveHourlyForecastResult = {
    hours,
    ...computeSunTotals(hours),
  }

  hourlyCache.set(key, { expires_at: now + HOURLY_TTL_MS, data: result })
  return result
}

/**
 * Get sunrise/sunset times
 */
export async function getSunTimes(
  lat: number,
  lon: number,
  options?: { weather_source?: WeatherSourcePolicy | string }
): Promise<LiveSunTimes> {
  const policy = normalizeWeatherSourcePolicy(options?.weather_source)
  const key = cacheKey(lat, lon, policy)
  const now = Date.now()
  const cached = sunCache.get(key)
  if (cached && cached.expires_at > now) return cached.data

  const url = `${BASE}/forecast?latitude=${lat}&longitude=${lon}&daily=sunrise,sunset&forecast_days=2&timezone=Europe%2FZurich`

  const data = await fetchOpenMeteoForecast(url, 3600, modelForPoint(lat, lon, policy))

  const sunrise = data.daily.sunrise[0]
  const sunset = data.daily.sunset[0]
  const tomorrowSunrise = data.daily.sunrise?.[1] ?? sunrise
  const tomorrowSunset = data.daily.sunset?.[1] ?? sunset
  const sunsetDate = new Date(sunset)
  const minutesUntil = Math.max(0, Math.round((sunsetDate.getTime() - Date.now()) / 60000))

  const result = {
    sunrise: new Date(sunrise).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }),
    sunset: new Date(sunset).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }),
    sunset_minutes_until: minutesUntil,
    daylight_window_today: windowFromSunriseSunset(sunrise, sunset),
    daylight_window_tomorrow: windowFromSunriseSunset(tomorrowSunrise, tomorrowSunset),
  }

  sunCache.set(key, { expires_at: now + SUN_TTL_MS, data: result })
  return result
}

/**
 * Batch get weather for multiple destinations.
 *
 * Uses Open-Meteo multi-point calls with chunking. If a batch parse/fetch fails,
 * falls back to per-point cached helpers for reliability.
 */
export async function batchGetWeather(
  locations: { lat: number; lon: number }[],
  options?: { weather_source?: WeatherSourcePolicy | string }
): Promise<LiveBatchWeatherResult[]> {
  const policy = normalizeWeatherSourcePolicy(options?.weather_source)
  const deduped: { lat: number; lon: number }[] = []
  const seen = new Set<string>()

  for (const loc of locations) {
    const key = batchPointKey(loc.lat, loc.lon)
    if (seen.has(key)) continue
    seen.add(key)
    deduped.push(loc)
  }

  if (deduped.length === 0) return []

  const outByKey = new Map<string, LiveBatchWeatherResult>()
  const swiss = policy === 'openmeteo' ? [] : deduped.filter(p => inSwissModelBounds(p.lat, p.lon))
  const crossBorder = policy === 'openmeteo'
    ? deduped
    : deduped.filter(p => !inSwissModelBounds(p.lat, p.lon))

  const processGroup = async (
    group: { lat: number; lon: number }[],
    model?: string | null
  ) => {
    try {
      const batched = await fetchBatchChunk(group, model)
      for (const row of batched) {
        outByKey.set(batchPointKey(row.lat, row.lon), row)
      }

      // Fill any missing coordinates from the chunk with single-point fallbacks.
      for (const point of group) {
        const key = batchPointKey(point.lat, point.lon)
        if (outByKey.has(key)) continue
        const [current, hourly] = await Promise.all([
          getCurrentWeather(point.lat, point.lon, { weather_source: policy }),
          getHourlyForecast(point.lat, point.lon, { weather_source: policy }),
        ])
        outByKey.set(key, {
          lat: point.lat,
          lon: point.lon,
          current,
          ...hourly,
        })
      }
    } catch {
      const fallbackRows = await Promise.all(
        group.map(async point => {
          const [current, hourly] = await Promise.all([
            getCurrentWeather(point.lat, point.lon, { weather_source: policy }),
            getHourlyForecast(point.lat, point.lon, { weather_source: policy }),
          ])
          return {
            lat: point.lat,
            lon: point.lon,
            current,
            ...hourly,
          }
        })
      )
      for (const row of fallbackRows) outByKey.set(batchPointKey(row.lat, row.lon), row)
    }
  }

  const swissModel = modelForPoint(46.8, 8.2, policy)
  const swissGroups = chunk(swiss, BATCH_CHUNK_SIZE).map(group => ({ group, model: swissModel as string | null }))
  const crossBorderGroups = chunk(crossBorder, BATCH_CHUNK_SIZE).map(group => ({ group, model: null as string | null }))
  const groups = [...swissGroups, ...crossBorderGroups]

  for (let i = 0; i < groups.length; i += BATCH_PARALLELISM) {
    await Promise.all(groups.slice(i, i + BATCH_PARALLELISM).map(({ group, model }) => processGroup(group, model)))
  }

  return Array.from(outByKey.values())
}
