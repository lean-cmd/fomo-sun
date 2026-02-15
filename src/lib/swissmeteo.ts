import { haversineDistance } from './scoring'

type CsvRow = Record<string, string>

interface StationMeta {
  code: string
  name: string
  lat: number
  lon: number
}

interface StationObs {
  code: string
  observed_at: string
  temp_c: number
  sunshine_min_last_10m: number
  humidity_pct: number
  wind_kmh: number
}

export interface SwissMeteoOriginSnapshot {
  source: 'meteoswiss'
  station_code: string
  station_name: string
  station_distance_km: number
  observed_at: string
  description: string
  sun_score: number
  sunshine_min: number
  temp_c: number
  humidity_pct: number
  wind_kmh: number
}

const STATION_META_URL = 'https://data.geo.admin.ch/ch.meteoschweiz.ogd-smn/ogd-smn_meta_stations.csv'
const OBS_URL = 'https://data.geo.admin.ch/ch.meteoschweiz.messwerte-aktuell/VQHA80.csv'

const META_TTL_MS = 24 * 60 * 60 * 1000
const OBS_TTL_MS = 5 * 60 * 1000
const MAX_STATION_DISTANCE_KM = 90

let metaCache: { expires_at: number; data: StationMeta[] } | null = null
let obsCache: { expires_at: number; data: Map<string, StationObs> } | null = null

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function parseNum(v: string | undefined): number {
  if (!v) return NaN
  const n = parseFloat(v.replace(',', '.'))
  return Number.isFinite(n) ? n : NaN
}

function firstDefined(row: CsvRow, keys: string[]): string {
  for (const k of keys) {
    if (row[k] && row[k].trim().length > 0) return row[k].trim()
  }
  return ''
}

function parseCsv(raw: string): CsvRow[] {
  const lines = raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'))

  if (lines.length < 2) return []

  const delimiter = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(delimiter).map(h => h.trim())

  return lines.slice(1).map(line => {
    const cols = line.split(delimiter)
    const row: CsvRow = {}
    headers.forEach((h, i) => { row[h] = (cols[i] ?? '').trim() })
    return row
  })
}

function inSwissBounds(lat: number, lon: number) {
  return lat >= 45.6 && lat <= 47.95 && lon >= 5.6 && lon <= 10.7
}

async function loadStationMeta(): Promise<StationMeta[]> {
  const now = Date.now()
  if (metaCache && metaCache.expires_at > now) return metaCache.data

  const res = await fetch(STATION_META_URL, { next: { revalidate: 86_400 } })
  if (!res.ok) throw new Error(`MeteoSwiss station meta failed: ${res.status}`)

  const rows = parseCsv(await res.text())
  const stations: StationMeta[] = []

  for (const row of rows) {
    const code = firstDefined(row, ['station_abbr', 'station', 'stn', 'Station'])
    const name = firstDefined(row, ['station_fullname', 'station_name', 'name', 'StationName']) || code
    const lat = parseNum(firstDefined(row, ['lat', 'latitude', 'lat_wgs84', 'station_latitude']))
    const lon = parseNum(firstDefined(row, ['lon', 'longitude', 'lon_wgs84', 'station_longitude']))
    if (!code || !Number.isFinite(lat) || !Number.isFinite(lon)) continue
    stations.push({ code, name, lat, lon })
  }

  metaCache = { expires_at: now + META_TTL_MS, data: stations }
  return stations
}

async function loadObservations(): Promise<Map<string, StationObs>> {
  const now = Date.now()
  if (obsCache && obsCache.expires_at > now) return obsCache.data

  const res = await fetch(OBS_URL, { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`MeteoSwiss observations failed: ${res.status}`)

  const rows = parseCsv(await res.text())
  const map = new Map<string, StationObs>()

  for (const row of rows) {
    const code = firstDefined(row, ['stn', 'station', 'station_abbr', 'Station'])
    if (!code) continue

    const observedAt = firstDefined(row, ['reference_timestamp', 'time', 'timestamp', 'Date'])
    const temp = parseNum(firstDefined(row, ['tre200s0', 'tre200h0', 'temperature_2m']))
    const sunshine10m = parseNum(firstDefined(row, ['sre000z0', 'sre000h0', 'sunshine_duration']))
    const humidity = parseNum(firstDefined(row, ['ure200s0', 'humidity']))
    const wind = parseNum(firstDefined(row, ['fkl010z0', 'fkl010h0', 'wind_speed_10m']))

    map.set(code, {
      code,
      observed_at: observedAt,
      temp_c: Number.isFinite(temp) ? temp : 0,
      sunshine_min_last_10m: Number.isFinite(sunshine10m) ? sunshine10m : 0,
      humidity_pct: Number.isFinite(humidity) ? humidity : 80,
      wind_kmh: Number.isFinite(wind) ? wind : 5,
    })
  }

  obsCache = { expires_at: now + OBS_TTL_MS, data: map }
  return map
}

function describe(tempC: number, sunshine10m: number, humidity: number): string {
  const t = Math.round(tempC)
  if (sunshine10m <= 0.2 && humidity >= 87) return `Fog, ${t}°C, low visibility likely`
  if (sunshine10m <= 1.0) return `Overcast, ${t}°C`
  if (sunshine10m < 5.0) return `Partly cloudy, ${t}°C`
  return `Mostly clear, ${t}°C`
}

function estimateSunScore(sunshine10m: number, humidity: number): number {
  const sunshineHour = clamp(sunshine10m * 6, 0, 60)
  const humidityPenalty = Math.max(0, (humidity - 65) / 100)
  return clamp(0.18 + sunshineHour / 100 - humidityPenalty * 0.35, 0.02, 0.95)
}

export async function getSwissMeteoOriginSnapshot(lat: number, lon: number): Promise<SwissMeteoOriginSnapshot | null> {
  if (!inSwissBounds(lat, lon)) return null

  try {
    const [stations, observations] = await Promise.all([loadStationMeta(), loadObservations()])
    if (stations.length === 0 || observations.size === 0) return null

    let bestStation: StationMeta | null = null
    let bestObs: StationObs | null = null
    let bestDistance = Infinity

    for (const station of stations) {
      const obs = observations.get(station.code)
      if (!obs) continue
      const distance = haversineDistance(lat, lon, station.lat, station.lon)
      if (distance < bestDistance) {
        bestDistance = distance
        bestStation = station
        bestObs = obs
      }
    }

    if (!bestStation || !bestObs || bestDistance > MAX_STATION_DISTANCE_KM) return null

    const sunshineHour = clamp(bestObs.sunshine_min_last_10m * 6, 0, 60)
    const sunScore = estimateSunScore(bestObs.sunshine_min_last_10m, bestObs.humidity_pct)

    return {
      source: 'meteoswiss',
      station_code: bestStation.code,
      station_name: bestStation.name,
      station_distance_km: Math.round(bestDistance * 10) / 10,
      observed_at: bestObs.observed_at,
      description: describe(bestObs.temp_c, bestObs.sunshine_min_last_10m, bestObs.humidity_pct),
      sun_score: sunScore,
      sunshine_min: Math.round(sunshineHour),
      temp_c: bestObs.temp_c,
      humidity_pct: bestObs.humidity_pct,
      wind_kmh: bestObs.wind_kmh,
    }
  } catch {
    return null
  }
}
