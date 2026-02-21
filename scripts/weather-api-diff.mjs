#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || 'http://localhost:4011'
const ORIGIN = {
  lat: Number(process.env.ORIGIN_LAT || 47.3769),
  lon: Number(process.env.ORIGIN_LON || 8.5417),
  name: process.env.ORIGIN_NAME || 'Zurich',
}

const SAMPLE_TARGETS = {
  CH: Number(process.env.SAMPLE_CH || 20),
  DE: Number(process.env.SAMPLE_DE || 5),
  FR: Number(process.env.SAMPLE_FR || 5),
  IT: Number(process.env.SAMPLE_IT || 5),
}

const SOURCES = ['openmeteo', 'meteoswiss', 'meteoswiss_api']

function dayStringZurich(offsetDays = 0) {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

function toMinFromHours(hours) {
  return Math.max(0, Math.round((Number(hours) || 0) * 60))
}

function tomorrowSunMin(row) {
  return toMinFromHours(row?.tomorrow_sun_hours)
}

function summarizeCounts(rows) {
  const out = { CH: 0, DE: 0, FR: 0, IT: 0 }
  for (const row of rows || []) {
    const cc = row?.destination?.country
    if (cc && out[cc] !== undefined) out[cc] += 1
  }
  return out
}

function avg(arr) {
  if (!arr.length) return 0
  return arr.reduce((s, n) => s + n, 0) / arr.length
}

function fmt(num, digits = 1) {
  if (!Number.isFinite(num)) return '-'
  return Number(num.toFixed(digits))
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchJsonWithHeaders(url, retries = 2) {
  let lastErr = null
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url)
      const text = await res.text()
      if (!res.ok) {
        if (res.status === 429 && attempt < retries) {
          await new Promise(r => setTimeout(r, 2_000 * (attempt + 1)))
          continue
        }
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`)
      }
      const json = JSON.parse(text)
      return { json, headers: res.headers }
    } catch (err) {
      lastErr = err
      if (attempt < retries) await new Promise(r => setTimeout(r, 400 * (attempt + 1)))
    }
  }
  throw lastErr || new Error('unknown fetch error')
}

function buildLocalUrl(source) {
  const sp = new URLSearchParams({
    lat: String(ORIGIN.lat),
    lon: String(ORIGIN.lon),
    origin_name: ORIGIN.name,
    origin_kind: 'manual',
    demo: 'false',
    mode: 'both',
    trip_span: 'plus1day',
    max_travel_h: '6.5',
    travel_min_h: '0',
    travel_max_h: '6.5',
    limit: '500',
    admin: 'true',
    admin_all: 'true',
    weather_source: source,
  })
  return `${BASE_URL}/api/v1/sunny-escapes?${sp.toString()}`
}

function pickSampleIds(rows) {
  const out = []
  for (const cc of Object.keys(SAMPLE_TARGETS)) {
    const take = SAMPLE_TARGETS[cc]
    out.push(...rows.filter(r => r?.destination?.country === cc).slice(0, take).map(r => r.destination.id))
  }
  return out
}

function rowById(rows) {
  return new Map((rows || []).map(r => [r.destination.id, r]))
}

function hourlyTomorrowSum(row, tomorrowPrefix) {
  const hours = (row?.admin_hourly || []).filter(h => String(h?.time || '').startsWith(tomorrowPrefix))
  return hours.reduce((s, h) => s + (Number(h?.sunshine_min) || 0), 0)
}

function normalizeBatchPayload(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.responses)) {
    return payload.responses.map((item) => item?.data ?? item)
  }
  return [payload]
}

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

function pointKey(lat, lon) {
  return `${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`
}

function sumTomorrowFromHourlyPayload(payload, tomorrowPrefix) {
  const times = Array.isArray(payload?.hourly?.time) ? payload.hourly.time : []
  const secs = Array.isArray(payload?.hourly?.sunshine_duration) ? payload.hourly.sunshine_duration : []
  let sum = 0
  for (let i = 0; i < times.length; i += 1) {
    if (String(times[i]).startsWith(tomorrowPrefix)) sum += Math.round((Number(secs[i]) || 0) / 60)
  }
  return sum
}

async function fetchBatchUpstreamTomorrow(points, useSwissModel, tomorrowPrefix) {
  const out = new Map()
  let fellBack = false
  const modelPart = useSwissModel ? '&models=meteoswiss_seamless' : ''
  for (const batch of chunk(points, 30)) {
    const latCsv = batch.map(p => p.lat.toFixed(5)).join(',')
    const lonCsv = batch.map(p => p.lon.toFixed(5)).join(',')
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latCsv}&longitude=${lonCsv}&hourly=sunshine_duration&forecast_days=2&timezone=Europe%2FZurich${modelPart}`
    let json
    try {
      ;({ json } = await fetchJsonWithHeaders(url, 4))
    } catch (err) {
      const msg = String(err?.message || err || '')
      const shouldFallback = useSwissModel && (
        msg.includes('HTTP 400')
        || msg.includes('HTTP 404')
        || msg.includes('HTTP 422')
      )
      if (!shouldFallback) throw err
      fellBack = true
      const fallbackUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latCsv}&longitude=${lonCsv}&hourly=sunshine_duration&forecast_days=2&timezone=Europe%2FZurich`
      ;({ json } = await fetchJsonWithHeaders(fallbackUrl, 4))
    }
    const rows = normalizeBatchPayload(json)
    rows.forEach((payload, idx) => {
      const point = batch[idx]
      if (!point) return
      out.set(pointKey(point.lat, point.lon), sumTomorrowFromHourlyPayload(payload, tomorrowPrefix))
    })
  }
  return { map: out, fellBack }
}

async function fetchSingleUpstreamTomorrow(lat, lon, useSwissModel, tomorrowPrefix) {
  const modelPart = useSwissModel ? '&models=meteoswiss_seamless' : ''
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(5)}&longitude=${lon.toFixed(5)}&hourly=sunshine_duration&forecast_days=2&timezone=Europe%2FZurich${modelPart}`
  try {
    const { json } = await fetchJsonWithHeaders(url, 4)
    return sumTomorrowFromHourlyPayload(json, tomorrowPrefix)
  } catch (err) {
    const msg = String(err?.message || err || '')
    if (msg.includes('HTTP 400') || msg.includes('HTTP 404') || msg.includes('HTTP 422')) return null
    throw err
  }
}

function printTable(title, headers, rows) {
  console.log(`\n${title}`)
  console.log(headers.join(' | '))
  console.log(headers.map(() => '---').join(' | '))
  for (const row of rows) {
    console.log(row.join(' | '))
  }
}

async function main() {
  const tomorrowPrefix = dayStringZurich(1)

  const local = {}
  for (const source of SOURCES) {
    const { json, headers } = await fetchJsonWithHeaders(buildLocalUrl(source))
    const rows = json.escapes || []
    local[source] = {
      json,
      rows,
      map: rowById(rows),
      counts: summarizeCounts(rows),
      top: rows[0] || null,
      header: {
        weather_source: headers.get('x-fomo-weather-source') || '',
        model_policy: headers.get('x-fomo-weather-model-policy') || '',
        origin_source: headers.get('x-fomo-origin-source') || '',
        live_source: headers.get('x-fomo-live-source') || '',
        result_tier: headers.get('x-fomo-result-tier') || '',
        fallback: headers.get('x-fomo-live-fallback') || '',
      },
    }
  }

  const baseline = local.meteoswiss
  const sampleIds = pickSampleIds(baseline.rows)

  const sourceSummaryRows = SOURCES.map(source => {
    const s = local[source]
    const top = s.top
    const topLabel = top ? `${top.destination.name} (${top.destination.country})` : '-'
    return [
      source,
      s.header.origin_source || '-',
      s.header.weather_source || '-',
      s.header.model_policy || '-',
      s.header.result_tier || '-',
      String(s.rows.length),
      String(s.counts.CH),
      String(s.counts.DE),
      String(s.counts.FR),
      String(s.counts.IT),
      String(s.json.tomorrow_sun_hours ?? '-'),
      topLabel,
      top ? String(top.tomorrow_sun_hours ?? '-') : '-',
    ]
  })

  const consistencyRows = SOURCES.map(source => {
    const s = local[source]
    let compared = 0
    let missing = 0
    let zeroSun = 0
    const diffs = []
    for (const id of sampleIds) {
      const row = s.map.get(id)
      if (!row) {
        missing += 1
        continue
      }
      compared += 1
      const apiMin = tomorrowSunMin(row)
      const hourlyMin = hourlyTomorrowSum(row, tomorrowPrefix)
      if (apiMin <= 0) zeroSun += 1
      diffs.push(Math.abs(apiMin - hourlyMin))
    }
    return [
      source,
      String(compared),
      String(missing),
      String(zeroSun),
      String(fmt(avg(diffs), 2)),
      String(fmt(Math.max(0, ...diffs), 0)),
    ]
  })

  const upstreamCountryStats = {
    CH: { rows: 0, defaultDiffs: [], swissDirectDiffs: [], defaultCloser: 0, swissDirectCloser: 0, ties: 0, swissDirectZeroRows: 0, swissSingleUnavailableRows: 0 },
    DE: { rows: 0, defaultDiffs: [], swissDirectDiffs: [], defaultCloser: 0, swissDirectCloser: 0, ties: 0, swissDirectZeroRows: 0, swissSingleUnavailableRows: 0 },
    FR: { rows: 0, defaultDiffs: [], swissDirectDiffs: [], defaultCloser: 0, swissDirectCloser: 0, ties: 0, swissDirectZeroRows: 0, swissSingleUnavailableRows: 0 },
    IT: { rows: 0, defaultDiffs: [], swissDirectDiffs: [], defaultCloser: 0, swissDirectCloser: 0, ties: 0, swissDirectZeroRows: 0, swissSingleUnavailableRows: 0 },
  }
  const upstreamDetails = []

  const baselineSampleRows = sampleIds
    .map(id => baseline.map.get(id))
    .filter(Boolean)

  const allPoints = baselineSampleRows.map(r => ({ lat: r.destination.lat, lon: r.destination.lon }))
  const swissPoints = baselineSampleRows
    .filter(r => r.destination.country === 'CH')
    .map(r => ({ lat: r.destination.lat, lon: r.destination.lon }))

  const upstreamDefaultResult = await fetchBatchUpstreamTomorrow(allPoints, false, tomorrowPrefix)
  const upstreamSwissBatchResult = await fetchBatchUpstreamTomorrow(swissPoints, true, tomorrowPrefix)
  const upstreamDefault = upstreamDefaultResult.map
  const upstreamSwissBatch = upstreamSwissBatchResult.map
  const swissBatchFallback = upstreamSwissBatchResult.fellBack
  const upstreamSwissDirect = new Map()
  for (const point of swissPoints) {
    const min = await fetchSingleUpstreamTomorrow(point.lat, point.lon, true, tomorrowPrefix)
    upstreamSwissDirect.set(pointKey(point.lat, point.lon), min)
    await sleep(120)
  }

  for (const row of baselineSampleRows) {
    const cc = row.destination.country
    const apiMin = tomorrowSunMin(row)
    const key = pointKey(row.destination.lat, row.destination.lon)

    const defaultMin = upstreamDefault.get(key)
    const swissBatchMin = cc === 'CH'
      ? upstreamSwissBatch.get(key)
      : defaultMin
    const swissDirectMinRaw = cc === 'CH'
      ? upstreamSwissDirect.get(key)
      : defaultMin
    const swissDirectMin = Number.isFinite(swissDirectMinRaw) ? swissDirectMinRaw : defaultMin

    if (!Number.isFinite(defaultMin) || !Number.isFinite(swissBatchMin) || !Number.isFinite(swissDirectMin)) continue

    const diffDefault = apiMin - defaultMin
    const diffSwissBatch = apiMin - swissBatchMin
    const diffSwissDirect = apiMin - swissDirectMin

    const stat = upstreamCountryStats[cc]
    stat.rows += 1
    stat.defaultDiffs.push(Math.abs(diffDefault))
    stat.swissDirectDiffs.push(Math.abs(diffSwissDirect))
    if (cc === 'CH' && swissDirectMin <= 0) stat.swissDirectZeroRows += 1
    if (cc === 'CH' && !Number.isFinite(swissDirectMinRaw)) stat.swissSingleUnavailableRows += 1

    if (Math.abs(diffDefault) < Math.abs(diffSwissDirect)) stat.defaultCloser += 1
    else if (Math.abs(diffSwissDirect) < Math.abs(diffDefault)) stat.swissDirectCloser += 1
    else stat.ties += 1

    upstreamDetails.push({
      country: cc,
      name: row.destination.name,
      apiMin,
      defaultMin,
      swissBatchMin,
      swissDirectMin,
      diffDefault,
      diffSwissBatch,
      diffSwissDirect,
    })
  }

  const upstreamSummaryRows = Object.entries(upstreamCountryStats).map(([cc, stat]) => [
    cc,
    String(stat.rows),
    String(fmt(avg(stat.defaultDiffs), 2)),
    String(fmt(avg(stat.swissDirectDiffs), 2)),
    String(fmt(Math.max(0, ...stat.defaultDiffs), 0)),
    String(fmt(Math.max(0, ...stat.swissDirectDiffs), 0)),
    String(stat.defaultCloser),
    String(stat.swissDirectCloser),
    String(stat.ties),
    String(stat.swissDirectZeroRows),
    String(stat.swissSingleUnavailableRows),
  ])

  const detailRows = upstreamDetails
    .sort((a, b) => {
      if (a.country !== b.country) return a.country.localeCompare(b.country)
      return a.name.localeCompare(b.name)
    })
    .map(r => [
      r.country,
      r.name,
      String(r.apiMin),
      String(r.defaultMin),
      String(r.swissBatchMin),
      String(r.swissDirectMin),
      String(r.diffDefault),
      String(r.diffSwissBatch),
      String(r.diffSwissDirect),
    ])

  printTable(
    'Source Summary (Tomorrow, Zurich origin, admin_all=true)',
    ['source', 'origin_source', 'weather_source_hdr', 'model_policy', 'result_tier', 'rows', 'CH', 'DE', 'FR', 'IT', 'origin_tomorrow_h', 'top_destination', 'top_tomorrow_h'],
    sourceSummaryRows,
  )

  printTable(
    `Internal Consistency on requested sample (${sampleIds.length} rows: CH${SAMPLE_TARGETS.CH}/DE${SAMPLE_TARGETS.DE}/FR${SAMPLE_TARGETS.FR}/IT${SAMPLE_TARGETS.IT})`,
    ['source', 'compared', 'missing', 'zero_sun', 'avg_abs_diff(api_vs_hourly_min)', 'max_abs_diff'],
    consistencyRows,
  )

  printTable(
    `Upstream Check vs Open-Meteo Endpoints (baseline = meteoswiss response; CH batch_model_fallback=${swissBatchFallback ? 'yes' : 'no'})`,
    ['country', 'rows', 'avg_abs_diff_vs_default', 'avg_abs_diff_vs_meteoswiss_single', 'max_abs_default', 'max_abs_meteoswiss_single', 'default_closer', 'meteoswiss_single_closer', 'ties', 'meteoswiss_single_zero_rows', 'meteoswiss_single_unavailable_rows'],
    upstreamSummaryRows,
  )

  printTable(
    'Upstream Detail Rows (api vs default/model minutes)',
    ['country', 'destination', 'api_min', 'default_min', 'meteoswiss_batch_min', 'meteoswiss_single_min', 'api-default', 'api-meteoswiss_batch', 'api-meteoswiss_single'],
    detailRows,
  )
}

main().catch(err => {
  console.error('weather-api-diff failed:', err)
  process.exit(1)
})
