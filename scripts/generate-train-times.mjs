#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DESTINATIONS_PATH = path.resolve(ROOT, 'src/data/destinations.ts')
const PAGE_PATH = path.resolve(ROOT, 'src/app/page.tsx')
const OUTPUT_PATH = path.resolve(ROOT, 'src/data/train-times.ts')
const DEFAULT_PROGRESS_PATH = path.resolve(ROOT, 'artifacts/train-times-progress.json')
const BASE_URL = 'https://transport.opendata.ch/v1/connections'

const API_TOKEN = String(process.env.OJP_API_TOKEN || process.env.OPENTRANSPORTDATA_API_TOKEN || '').trim()
const DESTINATION_QUERY_ALIASES = {
  'stresa-town': ['Stresa, Bahnhof'],
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[key] = next
      i += 1
    } else {
      out[key] = true
    }
  }
  return out
}

function parseBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback
  const normalized = String(value).trim().toLowerCase()
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') return true
  if (normalized === 'false' || normalized === '0' || normalized === 'no') return false
  throw new Error(`Invalid boolean value: ${value}`)
}

function parseIntSafe(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseList(value) {
  if (!value) return []
  return String(value).split(',').map(v => v.trim()).filter(Boolean)
}

function parseBatch(value) {
  if (!value) return { index: 1, total: 1 }
  const m = String(value).trim().match(/^(\d+)\/(\d+)$/)
  if (!m) throw new Error(`Invalid --batch value "${value}", expected i/n`)
  const index = Number(m[1])
  const total = Number(m[2])
  if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 1 || index > total) {
    throw new Error(`Invalid --batch value "${value}", index must be between 1 and n`)
  }
  return { index, total }
}

function fnv1a32(input) {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0
  }
  return hash >>> 0
}

function normalizeSbbOrigin(originName) {
  const raw = String(originName || '').trim()
  const key = raw.toLowerCase()
  if (!raw) return 'Basel SBB'
  if (key === 'basel' || key === 'basel sbb') return 'Basel SBB'
  if (key === 'zurich' || key === 'zürich' || key === 'zurich hb' || key === 'zürich hb') return 'Zürich HB'
  if (key === 'bern') return 'Bern'
  if (key === 'luzern' || key === 'lucerne') return 'Luzern'
  return raw
}

function extractArrayByMarker(source, marker) {
  const markerIdx = source.indexOf(marker)
  if (markerIdx < 0) throw new Error(`Marker not found: ${marker}`)
  const equalsIdx = source.indexOf('=', markerIdx)
  if (equalsIdx < 0) throw new Error(`Assignment not found after marker: ${marker}`)
  const start = source.indexOf('[', equalsIdx)
  if (start < 0) throw new Error(`Array start not found after marker: ${marker}`)

  let depth = 0
  let inSingle = false
  let inDouble = false
  let escaped = false

  for (let i = start; i < source.length; i += 1) {
    const ch = source[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (inSingle) {
      if (ch === '\'') inSingle = false
      continue
    }
    if (inDouble) {
      if (ch === '"') inDouble = false
      continue
    }
    if (ch === '\'') {
      inSingle = true
      continue
    }
    if (ch === '"') {
      inDouble = true
      continue
    }
    if (ch === '[') depth += 1
    if (ch === ']') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error(`Array close not found for marker: ${marker}`)
}

function loadManualOrigins() {
  const source = fs.readFileSync(PAGE_PATH, 'utf8')
  const block = source.match(/const\s+MANUAL_ORIGIN_CITIES:[\s\S]*?=\s*\[([\s\S]*?)\]\.sort/)
  if (!block) throw new Error('Could not parse MANUAL_ORIGIN_CITIES from src/app/page.tsx')
  const rows = []
  const re = /\{\s*name:\s*'([^']+)'\s*,\s*lat:\s*([-+]?\d+(?:\.\d+)?)\s*,\s*lon:\s*([-+]?\d+(?:\.\d+)?)\s*\}/g
  let m = re.exec(block[1])
  while (m) {
    rows.push({
      name: m[1],
      lat: Number(m[2]),
      lon: Number(m[3]),
      origin_key: normalizeSbbOrigin(m[1]),
    })
    m = re.exec(block[1])
  }
  if (!rows.length) throw new Error('No manual origins found')
  return rows
}

function loadDestinationsWithSbb() {
  const source = fs.readFileSync(DESTINATIONS_PATH, 'utf8')
  const arrayText = extractArrayByMarker(source, 'const destinationCatalog: Destination[] =')
  const rows = Function(`return (${arrayText});`)()
  if (!Array.isArray(rows)) throw new Error('Could not parse destination catalog array')
  return rows
    .filter(row => typeof row?.id === 'string' && typeof row?.name === 'string' && typeof row?.sbb_name === 'string' && row.sbb_name.trim())
    .map(row => ({
      id: row.id,
      name: row.name,
      sbb_name: row.sbb_name.trim(),
      country: row.country || 'CH',
      lat: Number(row.lat),
      lon: Number(row.lon),
      altitude_m: Number(row.altitude_m || 0),
    }))
}

function todayPlusOneISO() {
  const now = new Date()
  const next = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  return next.toISOString().slice(0, 10)
}

function durationToMin(connection) {
  const raw = String(connection?.duration || '')
  const match = raw.match(/^(?:(\d{1,2})d)?(\d{1,2}):(\d{2}):(\d{2})$/)
  if (match) {
    const dd = Number(match[1] || '0')
    const hh = Number(match[2] || '0')
    const mm = Number(match[3] || '0')
    return dd * 24 * 60 + hh * 60 + mm
  }

  const depIso = connection?.from?.departure || connection?.from?.prognosis?.departure
  const arrIso = connection?.to?.arrival || connection?.to?.prognosis?.arrival
  if (!depIso || !arrIso) return null
  const depMs = new Date(depIso).getTime()
  const arrMs = new Date(arrIso).getTime()
  if (!Number.isFinite(depMs) || !Number.isFinite(arrMs) || arrMs <= depMs) return null
  return Math.round((arrMs - depMs) / 60000)
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function loadProgress(progressPath) {
  if (!fs.existsSync(progressPath)) {
    return {
      schema_version: 1,
      updated_at: null,
      runs: {},
    }
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(progressPath, 'utf8'))
    if (!parsed || typeof parsed !== 'object') throw new Error('progress is not an object')
    if (!parsed.runs || typeof parsed.runs !== 'object') parsed.runs = {}
    return parsed
  } catch (error) {
    throw new Error(`Failed to read progress file ${progressPath}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

function saveProgress(progressPath, progress) {
  ensureDir(progressPath)
  progress.updated_at = new Date().toISOString()
  fs.writeFileSync(progressPath, `${JSON.stringify(progress, null, 2)}\n`, 'utf8')
}

function q(value) {
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function normalizeTrainSource(source) {
  return source === 'transport.opendata.ch' ? 'transport.opendata.ch' : 'heuristic_fallback'
}

function buildTrainTimesFromRecords(records) {
  const durations = {}
  const sources = {}
  let rowsTotal = 0
  let rowsApi = 0
  let rowsFallback = 0
  for (const row of Object.values(records)) {
    if (!row || typeof row !== 'object') continue
    const originKey = String(row.origin_key || '')
    const destId = String(row.destination_id || '')
    const duration = Number(row.duration_min)
    if (!originKey || !destId || !Number.isFinite(duration)) continue
    const source = normalizeTrainSource(row.source)
    if (!durations[originKey]) durations[originKey] = {}
    if (!sources[originKey]) sources[originKey] = {}
    durations[originKey][destId] = Math.max(0, Math.round(duration))
    sources[originKey][destId] = source
    rowsTotal += 1
    if (source === 'transport.opendata.ch') rowsApi += 1
    else rowsFallback += 1
  }
  return {
    durations,
    sources,
    stats: {
      rows_total: rowsTotal,
      rows_api: rowsApi,
      rows_fallback: rowsFallback,
    },
  }
}

function writeTrainTimesFile(filePath, payload, meta) {
  const durationMap = payload.durations || {}
  const sourceMap = payload.sources || {}
  const originKeys = Object.keys(durationMap).sort((a, b) => a.localeCompare(b))
  const lines = []
  lines.push('/**')
  lines.push(' * Typical train durations (minutes) by normalized origin and destination id.')
  lines.push(' *')
  lines.push(' * Auto-generated by scripts/generate-train-times.mjs.')
  lines.push(` * Service date: ${meta.serviceDate}`)
  lines.push(` * Generated at: ${meta.generatedAt}`)
  lines.push(' */')
  lines.push("export type TrainTimeSource = 'transport.opendata.ch' | 'heuristic_fallback'")
  lines.push('')
  lines.push('export const TRAIN_TIME_MIN_BY_ORIGIN: Record<string, Record<string, number>> = {')
  for (const originKey of originKeys) {
    lines.push(`  ${q(originKey)}: {`)
    const destinationRows = durationMap[originKey]
    for (const destId of Object.keys(destinationRows).sort((a, b) => a.localeCompare(b))) {
      lines.push(`    ${q(destId)}: ${Math.round(destinationRows[destId])},`)
    }
    lines.push('  },')
  }
  lines.push('}')
  lines.push('')
  lines.push('export const TRAIN_TIME_SOURCE_BY_ORIGIN: Record<string, Record<string, TrainTimeSource>> = {')
  for (const originKey of originKeys) {
    lines.push(`  ${q(originKey)}: {`)
    const destinationRows = sourceMap[originKey] || {}
    for (const destId of Object.keys(destinationRows).sort((a, b) => a.localeCompare(b))) {
      lines.push(`    ${q(destId)}: ${q(destinationRows[destId])},`)
    }
    lines.push('  },')
  }
  lines.push('}')
  lines.push('')
  lines.push('export const TRAIN_TIME_DATASET_META = {')
  lines.push(`  service_date: ${q(meta.serviceDate)},`)
  lines.push(`  generated_at: ${q(meta.generatedAt)},`)
  lines.push(`  rows_total: ${Math.round(payload.stats?.rows_total || 0)},`)
  lines.push(`  rows_api: ${Math.round(payload.stats?.rows_api || 0)},`)
  lines.push(`  rows_fallback: ${Math.round(payload.stats?.rows_fallback || 0)},`)
  lines.push('} as const')
  lines.push('')

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
}

function heuristicTrainMin(originLat, originLon, destination) {
  const R = 6371
  const dLa = (destination.lat - originLat) * Math.PI / 180
  const dLo = (destination.lon - originLon) * Math.PI / 180
  const a = Math.sin(dLa / 2) ** 2
    + Math.cos(originLat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) * Math.sin(dLo / 2) ** 2
  const airKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const altitude = destination.altitude_m ?? 500
  const isCrossBorder = destination.country && destination.country !== 'CH'
  const roadFactorBase = airKm > 190 ? 1.38 : airKm > 110 ? 1.33 : 1.28
  const roadFactor = roadFactorBase
    + (isCrossBorder ? 0.03 : 0)
    + (altitude > 1200 ? 0.04 : 0)
    + (altitude > 1700 ? 0.04 : 0)
  const roadKm = airKm * roadFactor
  const isSamePlace = roadKm < 0.5
  if (isSamePlace) return 0
  const carSpeedKmh = roadKm < 35 ? 45 : roadKm < 95 ? 56 : roadKm < 230 ? 66 : 72
  const carPenaltyMin = (isCrossBorder ? 8 : 0) + (altitude > 1400 ? 10 : 0) + (altitude > 1800 ? 8 : 0)
  const carMin = Math.max(8, Math.round((roadKm / carSpeedKmh) * 60 + carPenaltyMin))
  const trainBase = isCrossBorder ? carMin * 1.22 : carMin * 1.02
  const trainPenalty = isCrossBorder ? 18 : 8
  return Math.max(12, Math.round(trainBase + trainPenalty))
}

async function runLimited(items, concurrency, worker) {
  const out = new Array(items.length)
  let cursor = 0
  async function runWorker() {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      out[index] = await worker(items[index], index)
    }
  }
  const jobs = []
  const width = Math.max(1, Math.min(concurrency, items.length))
  for (let i = 0; i < width; i += 1) jobs.push(runWorker())
  await Promise.all(jobs)
  return out
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const progressPath = path.resolve(ROOT, String(args.progress || DEFAULT_PROGRESS_PATH))
  const finalizeOnly = parseBool(args.finalize, false)

  const progress = loadProgress(progressPath)
  if (finalizeOnly) {
    const date = String(args.date || todayPlusOneISO())
    const run = progress.runs?.[date]
    if (!run || typeof run !== 'object') {
      throw new Error(`No progress run found for service date ${date} in ${progressPath}`)
    }
    const payload = buildTrainTimesFromRecords(run.records || {})
    writeTrainTimesFile(OUTPUT_PATH, payload, { serviceDate: date, generatedAt: new Date().toISOString() })
    console.log(`[train-times] finalized ${Object.keys(payload.durations).length} origins into ${path.relative(ROOT, OUTPUT_PATH)} (api rows ${payload.stats.rows_api}, fallback rows ${payload.stats.rows_fallback})`)
    return
  }

  const batch = parseBatch(args.batch)
  const concurrency = Math.max(1, parseIntSafe(args.concurrency, 2))
  const delayMs = Math.max(0, parseIntSafe(args['delay-ms'], 150))
  const serviceDate = String(args.date || todayPlusOneISO())
  const selectedOriginNames = parseList(args.origins).map(v => v.toLowerCase())
  const selectedDestinationIds = parseList(args.destinations).map(v => v.toLowerCase())
  const force = parseBool(args.force, false)
  const heuristicFallback = parseBool(args['fallback-heuristic'], true)

  const manualOrigins = loadManualOrigins()
  const originRowsRaw = selectedOriginNames.length
    ? manualOrigins.filter(o => selectedOriginNames.includes(o.name.toLowerCase()))
    : manualOrigins
  if (selectedOriginNames.length > 0 && originRowsRaw.length === 0) {
    throw new Error(`No matching origins for --origins=${selectedOriginNames.join(',')}`)
  }

  const uniqueOrigins = []
  const seenOriginKeys = new Set()
  for (const row of originRowsRaw) {
    if (seenOriginKeys.has(row.origin_key)) continue
    seenOriginKeys.add(row.origin_key)
    uniqueOrigins.push({ origin_key: row.origin_key, source_city: row.name, lat: row.lat, lon: row.lon })
  }

  const destinations = loadDestinationsWithSbb()
    .filter(destination => selectedDestinationIds.length === 0 || selectedDestinationIds.includes(destination.id.toLowerCase()))
  if (selectedDestinationIds.length > 0 && destinations.length === 0) {
    throw new Error(`No matching destinations for --destinations=${selectedDestinationIds.join(',')}`)
  }
  const allPairs = []
  for (const origin of uniqueOrigins) {
    for (const destination of destinations) {
      const key = `${origin.origin_key}|${destination.id}`
      allPairs.push({
        key,
        origin_key: origin.origin_key,
        origin_city: origin.source_city,
        lat: origin.lat,
        lon: origin.lon,
        destination_id: destination.id,
        destination_name: destination.name,
        destination_sbb_name: destination.sbb_name,
        destination_country: destination.country,
        destination_lat: destination.lat,
        destination_lon: destination.lon,
        destination_altitude_m: destination.altitude_m,
      })
    }
  }
  const selectedPairs = allPairs.filter(pair => (fnv1a32(pair.key) % batch.total) === (batch.index - 1))

  if (!progress.runs[serviceDate]) {
    progress.runs[serviceDate] = {
      created_at: new Date().toISOString(),
      records: {},
      errors: {},
      metadata: {},
    }
  }
  const run = progress.runs[serviceDate]
  if (!run.records || typeof run.records !== 'object') run.records = {}
  if (!run.errors || typeof run.errors !== 'object') run.errors = {}
  run.metadata = {
    batch: `${batch.index}/${batch.total}`,
    concurrency,
    delay_ms: delayMs,
    origin_count: uniqueOrigins.length,
    destination_count: destinations.length,
    pair_count_total: allPairs.length,
    pair_count_selected: selectedPairs.length,
    service_date: serviceDate,
    updated_at: new Date().toISOString(),
  }

  const pendingPairs = selectedPairs.filter(pair => {
    if (force) return true
    const row = run.records[pair.key]
    return !(row && Number.isFinite(Number(row.duration_min)))
  })

  console.log(`[train-times] service date ${serviceDate}`)
  console.log(`[train-times] origins ${uniqueOrigins.length}, destinations ${destinations.length}`)
  console.log(`[train-times] selected pairs ${selectedPairs.length}/${allPairs.length} (batch ${batch.index}/${batch.total})`)
  console.log(`[train-times] pending pairs ${pendingPairs.length}`)

  if (pendingPairs.length === 0) {
    console.log('[train-times] nothing to fetch in this batch')
  }

  let throttleLock = Promise.resolve()
  let lastDispatchAt = 0
  async function throttle() {
    let release
    const current = new Promise(resolve => { release = resolve })
    const previous = throttleLock
    throttleLock = current
    await previous
    const now = Date.now()
    const waitMs = Math.max(0, delayMs - (now - lastDispatchAt))
    if (waitMs > 0) await sleep(waitMs)
    lastDispatchAt = Date.now()
    release()
  }

  async function fetchTypicalMinutes(pair) {
    const queryCandidates = [
      pair.destination_sbb_name,
      ...((DESTINATION_QUERY_ALIASES[pair.destination_id] || [])),
    ].map(v => String(v || '').trim()).filter(Boolean)

    let lastError = null
    for (const toQuery of queryCandidates) {
      try {
        const minutes = await fetchTypicalMinutesForQuery(pair, toQuery, 0)
        if (Number.isFinite(minutes) && minutes > 0) return minutes
      } catch (error) {
        lastError = error
      }
    }

    if (lastError) throw lastError
    throw new Error('No parseable connection duration')
  }

  async function fetchTypicalMinutesForQuery(pair, toQuery, attempt = 0) {
    await throttle()
    const url = new URL(BASE_URL)
    url.searchParams.set('from', pair.origin_key)
    url.searchParams.set('to', toQuery)
    url.searchParams.set('limit', '3')
    url.searchParams.set('date', serviceDate)
    url.searchParams.set('time', '08:00')

    const res = await fetch(url.toString(), {
      headers: API_TOKEN
        ? {
          accept: 'application/json',
          Authorization: `Bearer ${API_TOKEN}`,
        }
        : {
          accept: 'application/json',
        },
    })

    if (res.status === 429 && attempt < 1) {
      const retryAfter = Number.parseInt(String(res.headers.get('retry-after') || ''), 10)
      const backoffMs = Number.isFinite(retryAfter) ? retryAfter * 1000 : 2200
      await sleep(Math.max(backoffMs, 1200))
      return fetchTypicalMinutesForQuery(pair, toQuery, attempt + 1)
    }

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`HTTP ${res.status}: ${body.slice(0, 240)}`)
    }

    const payload = await res.json()
    const rows = Array.isArray(payload?.connections) ? payload.connections : []
    const minutes = rows
      .map(durationToMin)
      .filter(v => Number.isFinite(v) && v > 0)
      .map(v => Math.round(v))
    if (!minutes.length) {
      throw new Error(`No parseable connection duration for to="${toQuery}"`)
    }
    return Math.min(...minutes)
  }

  let processed = 0
  let successCount = 0
  let errorCount = 0
  let fallbackCount = 0
  const startedAt = Date.now()

  await runLimited(pendingPairs, concurrency, async (pair, index) => {
    try {
      const durationMin = await fetchTypicalMinutes(pair)
      run.records[pair.key] = {
        key: pair.key,
        origin_key: pair.origin_key,
        origin_city: pair.origin_city,
        destination_id: pair.destination_id,
        destination_name: pair.destination_name,
        destination_sbb_name: pair.destination_sbb_name,
        destination_country: pair.destination_country,
        duration_min: durationMin,
        checked_at: new Date().toISOString(),
        source: 'transport.opendata.ch',
      }
      delete run.errors[pair.key]
      successCount += 1
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      run.errors[pair.key] = {
        key: pair.key,
        origin_key: pair.origin_key,
        destination_id: pair.destination_id,
        destination_sbb_name: pair.destination_sbb_name,
        checked_at: new Date().toISOString(),
        error: errorMessage,
      }
      if (heuristicFallback) {
        const fallbackMin = heuristicTrainMin(pair.lat, pair.lon, {
          lat: pair.destination_lat,
          lon: pair.destination_lon,
          country: pair.destination_country,
          altitude_m: pair.destination_altitude_m,
        })
        run.records[pair.key] = {
          key: pair.key,
          origin_key: pair.origin_key,
          origin_city: pair.origin_city,
          destination_id: pair.destination_id,
          destination_name: pair.destination_name,
          destination_sbb_name: pair.destination_sbb_name,
          destination_country: pair.destination_country,
          duration_min: fallbackMin,
          checked_at: new Date().toISOString(),
          source: 'heuristic_fallback',
          fallback_reason: errorMessage,
        }
        successCount += 1
        fallbackCount += 1
      } else {
        errorCount += 1
      }
    }

    processed += 1
    if (processed % 20 === 0 || processed === pendingPairs.length) {
      saveProgress(progressPath, progress)
      console.log(`[train-times] progress ${processed}/${pendingPairs.length} (ok ${successCount}, fallback ${fallbackCount}, err ${errorCount})`)
    } else if ((index + 1) % 10 === 0) {
      console.log(`[train-times] progress ${processed}/${pendingPairs.length}`)
    }
  })

  saveProgress(progressPath, progress)

  const completedTotal = allPairs.reduce((count, pair) => {
    const row = run.records[pair.key]
    return row && Number.isFinite(Number(row.duration_min)) ? count + 1 : count
  }, 0)
  const missingTotal = allPairs.length - completedTotal
  const elapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1)

  console.log(`[train-times] finished in ${elapsedSec}s`)
  console.log(`[train-times] api fallbacks used ${fallbackCount}`)
  console.log(`[train-times] completed coverage ${completedTotal}/${allPairs.length}, missing ${missingTotal}`)
  console.log(`[train-times] progress saved to ${path.relative(ROOT, progressPath)}`)

  if (missingTotal === 0) {
    const payload = buildTrainTimesFromRecords(run.records || {})
    writeTrainTimesFile(OUTPUT_PATH, payload, { serviceDate, generatedAt: new Date().toISOString() })
    console.log(`[train-times] wrote final file ${path.relative(ROOT, OUTPUT_PATH)} (api rows ${payload.stats.rows_api}, fallback rows ${payload.stats.rows_fallback})`)
  } else {
    console.log('[train-times] run not complete yet; continue remaining batches or use --finalize after coverage is complete')
  }
}

main().catch(error => {
  console.error(`[train-times] ${error instanceof Error ? error.stack || error.message : String(error)}`)
  process.exit(1)
})
