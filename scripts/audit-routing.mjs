#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const ROOT = process.cwd()
const DEFAULT_BASE_URL = 'http://localhost:4011'
const DEFAULT_TRIP_SPANS = ['daytrip', 'plus1day']
const DEFAULT_MODES = ['both']
const COUNTRY_KEYWORDS = {
  CH: 'switzerland',
  DE: 'germany',
  FR: 'france',
  IT: 'italy',
  LI: 'liechtenstein',
}
const execFileAsync = promisify(execFile)

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

function parseBool(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  const v = String(value).trim().toLowerCase()
  if (v === 'true' || v === '1' || v === 'yes') return true
  if (v === 'false' || v === '0' || v === 'no') return false
  throw new Error(`Invalid boolean: ${value}`)
}

function parseList(value, fallback) {
  if (!value) return [...fallback]
  return String(value)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

function parseBatch(value) {
  if (!value) return { index: 1, total: 1 }
  const m = String(value).trim().match(/^(\d+)\/(\d+)$/)
  if (!m) throw new Error(`Invalid --batch value "${value}". Expected i/n`)
  const index = Number(m[1])
  const total = Number(m[2])
  if (!Number.isInteger(index) || !Number.isInteger(total) || total < 1 || index < 1 || index > total) {
    throw new Error(`Invalid --batch value "${value}". Index must be between 1 and n`)
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

function loadManualOriginsFromPage() {
  const file = path.join(ROOT, 'src/app/page.tsx')
  const source = fs.readFileSync(file, 'utf8')
  const block = source.match(/const\s+MANUAL_ORIGIN_CITIES:[\s\S]*?=\s*\[([\s\S]*?)\]\.sort/)
  if (!block) throw new Error('Could not parse MANUAL_ORIGIN_CITIES from src/app/page.tsx')
  const rows = []
  const re = /\{\s*name:\s*'([^']+)'\s*,\s*lat:\s*([-+]?\d+(?:\.\d+)?)\s*,\s*lon:\s*([-+]?\d+(?:\.\d+)?)\s*\}/g
  let m = re.exec(block[1])
  while (m) {
    rows.push({ name: m[1], lat: Number(m[2]), lon: Number(m[3]) })
    m = re.exec(block[1])
  }
  if (rows.length === 0) throw new Error('Parsed MANUAL_ORIGIN_CITIES but found zero entries')
  return rows.sort((a, b) => a.name.localeCompare(b.name))
}

function loadBucketsFromRoute() {
  const file = path.join(ROOT, 'src/app/api/v1/sunny-escapes/route.ts')
  const source = fs.readFileSync(file, 'utf8')
  const block = source.match(/const\s+UI_TRAVEL_BUCKETS\s*=\s*\[([\s\S]*?)\]\s*as const/)
  if (!block) throw new Error('Could not parse UI_TRAVEL_BUCKETS from src/app/api/v1/sunny-escapes/route.ts')
  const rows = []
  const re = /\{\s*id:\s*'([^']+)'\s*,\s*min_h:\s*([-+]?\d+(?:\.\d+)?)\s*,\s*max_h:\s*([-+]?\d+(?:\.\d+)?)\s*\}/g
  let m = re.exec(block[1])
  while (m) {
    rows.push({ id: m[1], min_h: Number(m[2]), max_h: Number(m[3]) })
    m = re.exec(block[1])
  }
  if (rows.length === 0) throw new Error('Parsed UI_TRAVEL_BUCKETS but found zero entries')
  return rows
}

function selectOrigins(raw, allOrigins) {
  if (!raw) return [...allOrigins]
  const names = parseList(raw, [])
  const byLower = new Map(allOrigins.map(o => [o.name.toLowerCase(), o]))
  const out = []
  for (const name of names) {
    const row = byLower.get(name.toLowerCase())
    if (!row) {
      const candidates = allOrigins.map(o => o.name).join(', ')
      throw new Error(`Unknown origin "${name}". Valid origins: ${candidates}`)
    }
    out.push(row)
  }
  return out
}

function selectTripSpans(raw) {
  const values = parseList(raw, DEFAULT_TRIP_SPANS)
  for (const v of values) {
    if (v !== 'daytrip' && v !== 'plus1day') {
      throw new Error(`Invalid trip span "${v}". Use daytrip or plus1day`)
    }
  }
  return values
}

function selectModes(raw) {
  const values = parseList(raw, DEFAULT_MODES)
  for (const v of values) {
    if (v !== 'car' && v !== 'train' && v !== 'both') {
      throw new Error(`Invalid mode "${v}". Use car, train, or both`)
    }
  }
  return values
}

function selectBuckets(raw, defaultBuckets) {
  if (!raw) return [...defaultBuckets]
  const byId = new Map(defaultBuckets.map(b => [b.id, b]))
  const tokens = parseList(raw, [])
  const custom = []
  for (const token of tokens) {
    if (byId.has(token)) {
      custom.push(byId.get(token))
      continue
    }
    const named = token.match(/^([a-zA-Z0-9_-]+):([-+]?\d+(?:\.\d+)?)\-([-+]?\d+(?:\.\d+)?)$/)
    if (named) {
      const min_h = Number(named[2])
      const max_h = Number(named[3])
      if (!Number.isFinite(min_h) || !Number.isFinite(max_h) || min_h > max_h) {
        throw new Error(`Invalid bucket range "${token}"`)
      }
      custom.push({ id: named[1], min_h, max_h })
      continue
    }
    const plain = token.match(/^([-+]?\d+(?:\.\d+)?)\-([-+]?\d+(?:\.\d+)?)$/)
    if (plain) {
      const min_h = Number(plain[1])
      const max_h = Number(plain[2])
      if (!Number.isFinite(min_h) || !Number.isFinite(max_h) || min_h > max_h) {
        throw new Error(`Invalid bucket range "${token}"`)
      }
      custom.push({ id: `custom-${min_h}-${max_h}`, min_h, max_h })
      continue
    }
    throw new Error(`Unknown bucket token "${token}". Use ids (${defaultBuckets.map(b => b.id).join(', ')}) or id:min-max`)
  }
  return custom
}

function createPermutations({ origins, tripSpans, modes, buckets, batch }) {
  const all = []
  for (const origin of origins) {
    for (const tripSpan of tripSpans) {
      for (const mode of modes) {
        for (const bucket of buckets) {
          const key = `${origin.name}|${tripSpan}|${mode}|${bucket.id}`
          all.push({ key, origin, tripSpan, mode, bucket })
        }
      }
    }
  }
  if (batch.total === 1) return { all, selected: all }
  const selected = all.filter(item => fnv1a32(item.key) % batch.total === (batch.index - 1))
  return { all, selected }
}

function asFiniteNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function normalizeText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function chosenTravel(escape, mode) {
  const carMin = asFiniteNumber(escape?.travel?.car?.duration_min)
  const trainMin = asFiniteNumber(escape?.travel?.train?.duration_min)
  if (mode === 'car') return { carMin, trainMin, chosenMin: carMin, missingRequired: !Number.isFinite(carMin) }
  if (mode === 'train') return { carMin, trainMin, chosenMin: trainMin, missingRequired: !Number.isFinite(trainMin) }
  const mins = [carMin, trainMin].filter(v => Number.isFinite(v))
  return {
    carMin,
    trainMin,
    chosenMin: mins.length > 0 ? Math.min(...mins) : null,
    missingRequired: mins.length === 0,
  }
}

function parseGoogleQueryLatLon(mapsUrl) {
  if (!mapsUrl) return { ok: false, reason: 'maps_url_missing' }
  try {
    const u = new URL(mapsUrl)
    const q = u.searchParams.get('q')
    if (!q) return { ok: false, reason: 'maps_url_missing_q_param' }
    const match = q.match(/([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)/)
    if (!match) return { ok: false, reason: 'maps_url_q_not_latlon' }
    return { ok: true, lat: Number(match[1]), lon: Number(match[2]) }
  } catch {
    return { ok: false, reason: 'maps_url_invalid' }
  }
}

function haversineKm(aLat, aLon, bLat, bLon) {
  const toRad = v => (v * Math.PI) / 180
  const R = 6371
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return R * (2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa)))
}

function csvEscape(value) {
  if (value === null || value === undefined) return ''
  const text = String(value)
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function writeCsv(filePath, columns, rows) {
  const lines = [columns.join(',')]
  for (const row of rows) {
    lines.push(columns.map(col => csvEscape(row[col])).join(','))
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8')
}

function splitCurlHeadersAndBody(raw) {
  const text = String(raw || '')
  const marker = '\n__FOMO_STATUS__:'
  const markerIdx = text.lastIndexOf(marker)
  if (markerIdx < 0) throw new Error('curl missing status marker')
  const payloadChunk = text.slice(0, markerIdx)
  const statusRaw = text.slice(markerIdx + marker.length).trim().split(/\s+/)[0]
  const status = Number.parseInt(statusRaw, 10)
  if (!Number.isFinite(status)) throw new Error(`curl invalid status marker: ${statusRaw}`)

  const sep = payloadChunk.includes('\r\n\r\n') ? '\r\n\r\n' : '\n\n'
  const sections = payloadChunk.split(sep)
  const hasHeaders = sections.length > 1 && sections[0].startsWith('HTTP/')
  if (!hasHeaders) return { status, body: payloadChunk }
  return { status, body: sections[sections.length - 1] }
}

async function fetchJsonViaCurl(url, timeoutMs) {
  const args = ['-sS', '-L', '--max-time', String(Math.max(5, Math.ceil(timeoutMs / 1000))), '-D', '-', '-w', '\n__FOMO_STATUS__:%{http_code}\n', url]
  const { stdout } = await execFileAsync('curl', args, { maxBuffer: 16 * 1024 * 1024 })
  const { status, body } = splitCurlHeadersAndBody(stdout)
  let data
  try {
    data = JSON.parse(body)
  } catch {
    throw new Error(`Expected JSON (${status}) but got: ${String(body).slice(0, 200)}`)
  }
  if (status < 200 || status >= 300) throw new Error(`HTTP ${status}: ${JSON.stringify(data).slice(0, 280)}`)
  return data
}

async function fetchJson(url, timeoutMs = 30000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      const txt = await res.text()
      let data
      try {
        data = JSON.parse(txt)
      } catch {
        throw new Error(`Expected JSON (${res.status}) but got: ${txt.slice(0, 200)}`)
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(data).slice(0, 280)}`)
      return data
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.toLowerCase().includes('fetch failed')) throw error
      return await fetchJsonViaCurl(url, timeoutMs)
    }
  } finally {
    clearTimeout(timer)
  }
}

async function runLimited(items, limit, worker) {
  let cursor = 0
  const outputs = new Array(items.length)
  async function runOne() {
    while (true) {
      const i = cursor
      cursor += 1
      if (i >= items.length) return
      outputs[i] = await worker(items[i], i)
    }
  }
  const workers = []
  const width = Math.max(1, Math.min(limit, items.length))
  for (let i = 0; i < width; i += 1) workers.push(runOne())
  await Promise.all(workers)
  return outputs
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function formatPct(numerator, denominator) {
  if (denominator <= 0) return '0.0%'
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

function parseGeoAdminCoords(row) {
  const attrs = row?.attrs || {}
  const latCandidates = [attrs.lat, attrs.Lat, attrs.y, row?.lat, row?.y]
  const lonCandidates = [attrs.lon, attrs.Lon, attrs.x, row?.lon, row?.x]
  const lat = latCandidates.map(asFiniteNumber).find(Number.isFinite)
  const lon = lonCandidates.map(asFiniteNumber).find(Number.isFinite)
  if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon }

  const geom = row?.attrs?.geom_st_box2d || row?.attrs?.geom_quadindex
  if (typeof geom === 'string') {
    const nums = geom.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || []
    if (nums.length >= 2) {
      const maybeLon = nums[0]
      const maybeLat = nums[1]
      if (Number.isFinite(maybeLat) && Number.isFinite(maybeLon)) return { lat: maybeLat, lon: maybeLon }
    }
  }

  return null
}

function toReproCommand(permutation, options) {
  const bucketArg = `${permutation.bucket.id}:${permutation.bucket.min_h}-${permutation.bucket.max_h}`
  return [
    'node scripts/audit-routing.mjs',
    `--base-url ${options.baseUrl}`,
    `--origins "${permutation.origin.name}"`,
    `--trip-spans ${permutation.tripSpan}`,
    `--modes ${permutation.mode}`,
    `--buckets ${bucketArg}`,
    `--demo ${String(options.demo)}`,
    '--concurrency 1',
  ].join(' ')
}

function topCounts(rows, keyFn, limit = 20) {
  const counts = new Map()
  for (const row of rows) {
    const key = keyFn(row)
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
}

function appendFailure(failures, payload) {
  failures.push({
    timestamp: new Date().toISOString(),
    ...payload,
  })
}

function appendWarning(warnings, payload) {
  warnings.push({
    timestamp: new Date().toISOString(),
    ...payload,
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  const allOrigins = loadManualOriginsFromPage()
  const defaultBuckets = loadBucketsFromRoute()
  const origins = selectOrigins(args.origins, allOrigins)
  const tripSpans = selectTripSpans(args['trip-spans'])
  const modes = selectModes(args.modes)
  const buckets = selectBuckets(args.buckets, defaultBuckets)
  const batch = parseBatch(args.batch)
  const baseUrl = String(args['base-url'] || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const demo = parseBool(args.demo, true)
  const concurrency = Math.max(1, Number.parseInt(String(args.concurrency || '4'), 10) || 4)
  const geocodeCh = parseBool(args['geocode-ch'], false)
  const reportDir = path.resolve(ROOT, String(args['report-dir'] || 'artifacts'))
  ensureDir(reportDir)
  ensureDir(path.join(reportDir, 'cache'))

  const { all: allPermutations, selected: selectedPermutations } = createPermutations({
    origins,
    tripSpans,
    modes,
    buckets,
    batch,
  })

  const failures = []
  const warnings = []
  const matrix = new Map()
  const geocodeCachePath = path.join(reportDir, 'cache', 'geo-admin-geocode.json')
  let geoCache = {}
  if (geocodeCh && fs.existsSync(geocodeCachePath)) {
    try {
      geoCache = JSON.parse(fs.readFileSync(geocodeCachePath, 'utf8'))
    } catch {
      geoCache = {}
    }
  }
  const geocodeMemo = new Map()
  let geocodeDirty = false

  async function geocodeCH(query) {
    if (!geocodeCh || !query) return null
    if (geocodeMemo.has(query)) return geocodeMemo.get(query)
    const cached = geoCache[query]
    if (cached && Number.isFinite(cached.lat) && Number.isFinite(cached.lon)) {
      geocodeMemo.set(query, cached)
      return cached
    }

    const url = `https://api3.geo.admin.ch/rest/services/api/SearchServer?searchText=${encodeURIComponent(query)}&lang=en&type=locations`
    const resultPromise = fetchJson(url, 15000)
      .then(data => {
        const best = Array.isArray(data?.results) ? data.results[0] : null
        const coords = best ? parseGeoAdminCoords(best) : null
        const out = coords ? { lat: coords.lat, lon: coords.lon } : null
        geoCache[query] = out
        geocodeDirty = true
        return out
      })
      .catch(() => {
        geoCache[query] = null
        geocodeDirty = true
        return null
      })
    geocodeMemo.set(query, resultPromise)
    return resultPromise
  }

  console.log(
    `[audit-routing] permutations selected ${selectedPermutations.length}/${allPermutations.length} | batch ${batch.index}/${batch.total} | demo=${demo} | base=${baseUrl}`
  )

  await runLimited(selectedPermutations, concurrency, async (perm, index) => {
    const req = new URL(`${baseUrl}/api/v1/sunny-escapes`)
    req.searchParams.set('lat', String(perm.origin.lat))
    req.searchParams.set('lon', String(perm.origin.lon))
    req.searchParams.set('origin_name', perm.origin.name)
    req.searchParams.set('origin_kind', 'manual')
    req.searchParams.set('trip_span', perm.tripSpan)
    req.searchParams.set('mode', perm.mode)
    req.searchParams.set('travel_min_h', String(perm.bucket.min_h))
    req.searchParams.set('travel_max_h', String(perm.bucket.max_h))
    req.searchParams.set('max_travel_h', '6.5')
    req.searchParams.set('limit', '20')
    req.searchParams.set('demo', String(demo))
    const requestUrl = req.toString()
    const requestedWindowMin = Math.round(perm.bucket.min_h * 60)
    const requestedWindowMax = Math.round(perm.bucket.max_h * 60)

    let data
    try {
      data = await fetchJson(requestUrl, 45000)
    } catch (error) {
      appendFailure(failures, {
        failure_type: 'request_error',
        message: error instanceof Error ? error.message : String(error),
        origin: perm.origin.name,
        origin_lat: perm.origin.lat,
        origin_lon: perm.origin.lon,
        trip_span: perm.tripSpan,
        mode: perm.mode,
        bucket_id: perm.bucket.id,
        bucket_min_h: perm.bucket.min_h,
        bucket_max_h: perm.bucket.max_h,
        requested_window_min: requestedWindowMin,
        requested_window_max: requestedWindowMax,
        destination_id: '',
        destination_name: '',
        country: '',
        maps_name: '',
        car_min: '',
        train_min: '',
        chosen_min: '',
        request_url: requestUrl,
      })
      return
    }

    const escapes = Array.isArray(data?.escapes) ? data.escapes : []
    const matrixKey = `${perm.origin.name}|${perm.mode}|${perm.bucket.id}`
    const entry = matrix.get(matrixKey) || { origin: perm.origin.name, mode: perm.mode, bucket_id: perm.bucket.id, counts: [] }
    entry.counts.push(escapes.length)
    matrix.set(matrixKey, entry)

    for (const escape of escapes) {
      const destination = escape?.destination || {}
      const destinationId = String(destination?.id || '')
      const destinationName = String(destination?.name || '')
      const country = String(destination?.country || '')
      const mapsName = String(destination?.maps_name || '')
      const lat = asFiniteNumber(destination?.lat)
      const lon = asFiniteNumber(destination?.lon)
      const travel = chosenTravel(escape, perm.mode)

      const baseRow = {
        origin: perm.origin.name,
        origin_lat: perm.origin.lat,
        origin_lon: perm.origin.lon,
        trip_span: perm.tripSpan,
        mode: perm.mode,
        bucket_id: perm.bucket.id,
        bucket_min_h: perm.bucket.min_h,
        bucket_max_h: perm.bucket.max_h,
        requested_window_min: requestedWindowMin,
        requested_window_max: requestedWindowMax,
        destination_id: destinationId,
        destination_name: destinationName,
        country,
        maps_name: mapsName,
        car_min: travel.carMin ?? '',
        train_min: travel.trainMin ?? '',
        chosen_min: travel.chosenMin ?? '',
        request_url: requestUrl,
      }

      if (!mapsName.trim()) {
        appendFailure(failures, {
          ...baseRow,
          failure_type: 'missing_maps_name',
          message: 'destination.maps_name is empty',
        })
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        appendFailure(failures, {
          ...baseRow,
          failure_type: 'invalid_destination_coords',
          message: `destination.lat/lon invalid: lat=${destination?.lat}, lon=${destination?.lon}`,
        })
      }

      if (travel.missingRequired) {
        appendFailure(failures, {
          ...baseRow,
          failure_type: 'missing_required_travel_mode',
          message: `missing required travel mode for mode=${perm.mode}`,
        })
      } else if (Number.isFinite(travel.chosenMin)) {
        const minWithTolerance = requestedWindowMin - 1
        const maxWithTolerance = requestedWindowMax + 1
        if (travel.chosenMin < minWithTolerance || travel.chosenMin > maxWithTolerance) {
          appendFailure(failures, {
            ...baseRow,
            failure_type: 'out_of_window',
            message: `chosen travel min ${travel.chosenMin} not in [${requestedWindowMin}, ${requestedWindowMax}] (+/-1)`,
          })
        }
      }

      const mapsLinkRaw = String(escape?.links?.google_maps || '')
      if (!mapsLinkRaw) {
        appendFailure(failures, {
          ...baseRow,
          failure_type: 'maps_link_missing',
          message: 'escape.links.google_maps is missing',
        })
      } else {
        try {
          const u = new URL(mapsLinkRaw)
          if (u.host !== 'www.google.com') {
            appendFailure(failures, {
              ...baseRow,
              failure_type: 'maps_host_invalid',
              message: `host ${u.host} is not www.google.com`,
            })
          }
          if (!u.pathname.startsWith('/maps/dir/')) {
            appendFailure(failures, {
              ...baseRow,
              failure_type: 'maps_path_invalid',
              message: `path ${u.pathname} does not start with /maps/dir/`,
            })
          }
          if (u.searchParams.get('api') !== '1') {
            appendFailure(failures, {
              ...baseRow,
              failure_type: 'maps_api_param_invalid',
              message: 'google maps link is missing api=1',
            })
          }
          if (u.searchParams.get('travelmode') !== 'driving') {
            appendFailure(failures, {
              ...baseRow,
              failure_type: 'maps_travelmode_invalid',
              message: 'google maps link is missing travelmode=driving',
            })
          }
          const destinationParam = u.searchParams.get('destination') || ''
          if (!destinationParam) {
            appendFailure(failures, {
              ...baseRow,
              failure_type: 'maps_destination_missing',
              message: 'google maps link is missing destination param',
            })
          } else {
            const normalizedDestination = normalizeText(destinationParam)
            const keyword = COUNTRY_KEYWORDS[country]
            if (keyword && !normalizedDestination.includes(keyword)) {
              appendFailure(failures, {
                ...baseRow,
                failure_type: 'maps_destination_missing_country',
                message: `destination param "${destinationParam}" missing country keyword "${keyword}"`,
              })
            }
            const matchesName = normalizeText(destinationName) && normalizedDestination.includes(normalizeText(destinationName))
            const matchesMapsName = normalizeText(mapsName) && normalizedDestination.includes(normalizeText(mapsName))
            if (!matchesName && !matchesMapsName) {
              appendWarning(warnings, {
                ...baseRow,
                warning_type: 'maps_name_mismatch_risk',
                message: `destination param "${destinationParam}" does not include destination.name or destination.maps_name`,
              })
            }
          }
          if (!u.searchParams.get('origin')) {
            appendFailure(failures, {
              ...baseRow,
              failure_type: 'maps_origin_missing',
              message: 'origin_kind=manual but google maps link has no origin query param',
            })
          }
        } catch {
          appendFailure(failures, {
            ...baseRow,
            failure_type: 'maps_url_invalid',
            message: `google maps link is not a valid URL: ${mapsLinkRaw}`,
          })
        }
      }

      const carDistanceKm = asFiniteNumber(escape?.travel?.car?.distance_km)
      if (Number.isFinite(carDistanceKm) && Number.isFinite(travel.carMin) && travel.carMin > 0) {
        const speedKmh = carDistanceKm / (travel.carMin / 60)
        if (speedKmh > 130 || speedKmh < 15) {
          appendWarning(warnings, {
            ...baseRow,
            warning_type: 'car_speed_implausible',
            message: `car implied speed ${speedKmh.toFixed(1)} km/h from ${carDistanceKm}km in ${travel.carMin}min`,
          })
        }
      }

      const parsedMapsCoords = parseGoogleQueryLatLon(destination?.maps_url)
      if (destination?.maps_url) {
        if (!parsedMapsCoords.ok) {
          appendWarning(warnings, {
            ...baseRow,
            warning_type: 'maps_url_coordinate_parse_failed',
            message: parsedMapsCoords.reason,
          })
        } else if (Number.isFinite(lat) && Number.isFinite(lon)) {
          const deltaLat = Math.abs(parsedMapsCoords.lat - lat)
          const deltaLon = Math.abs(parsedMapsCoords.lon - lon)
          if (deltaLat > 0.02 || deltaLon > 0.02) {
            appendWarning(warnings, {
              ...baseRow,
              warning_type: 'maps_url_coordinate_mismatch',
              message: `maps_url q=(${parsedMapsCoords.lat},${parsedMapsCoords.lon}) differs from destination (${lat},${lon})`,
            })
          }
        }
      }

      if (geocodeCh && country === 'CH' && Number.isFinite(lat) && Number.isFinite(lon)) {
        const query = mapsName.trim() || destinationName.trim()
        const geo = await geocodeCH(query)
        if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lon)) {
          const distKm = haversineKm(lat, lon, geo.lat, geo.lon)
          if (distKm > 30) {
            appendWarning(warnings, {
              ...baseRow,
              warning_type: 'geocode_far_from_stored_coords',
              message: `geo.admin match is ${distKm.toFixed(1)}km away for query "${query}"`,
            })
          }
        }
      }
    }

    if ((index + 1) % 10 === 0 || index + 1 === selectedPermutations.length) {
      console.log(`[audit-routing] ${index + 1}/${selectedPermutations.length} permutations processed`)
    }
  })

  if (geocodeCh && geocodeDirty) {
    fs.writeFileSync(geocodeCachePath, JSON.stringify(geoCache, null, 2))
  }

  const failuresPath = path.join(reportDir, 'routing-audit-failures.csv')
  const warningsPath = path.join(reportDir, 'routing-audit-warnings.csv')
  const summaryPath = path.join(reportDir, 'routing-audit-summary.md')

  writeCsv(
    failuresPath,
    [
      'timestamp',
      'failure_type',
      'message',
      'origin',
      'origin_lat',
      'origin_lon',
      'trip_span',
      'mode',
      'bucket_id',
      'bucket_min_h',
      'bucket_max_h',
      'requested_window_min',
      'requested_window_max',
      'destination_id',
      'destination_name',
      'country',
      'maps_name',
      'car_min',
      'train_min',
      'chosen_min',
      'request_url',
    ],
    failures
  )

  writeCsv(
    warningsPath,
    [
      'timestamp',
      'warning_type',
      'message',
      'origin',
      'origin_lat',
      'origin_lon',
      'trip_span',
      'mode',
      'bucket_id',
      'bucket_min_h',
      'bucket_max_h',
      'requested_window_min',
      'requested_window_max',
      'destination_id',
      'destination_name',
      'country',
      'maps_name',
      'car_min',
      'train_min',
      'chosen_min',
      'request_url',
    ],
    warnings
  )

  const failureTop = topCounts(
    failures,
    f => (f.destination_id ? `${f.destination_name || f.destination_id} (${f.country || '?'})` : null),
    20
  )
  const mismatchTop = topCounts(
    warnings.filter(w => w.warning_type === 'maps_name_mismatch_risk'),
    w => `${w.destination_name || w.destination_id} (${w.country || '?'})`,
    20
  )

  const firstFailure = failures[0]
  const firstFailurePermutation = firstFailure
    ? {
        origin: { name: firstFailure.origin, lat: Number(firstFailure.origin_lat), lon: Number(firstFailure.origin_lon) },
        tripSpan: firstFailure.trip_span,
        mode: firstFailure.mode,
        bucket: { id: firstFailure.bucket_id, min_h: Number(firstFailure.bucket_min_h), max_h: Number(firstFailure.bucket_max_h) },
      }
    : null
  const reproCommand = firstFailurePermutation
    ? toReproCommand(firstFailurePermutation, { baseUrl, demo })
    : null

  const matrixRows = [...matrix.values()]
    .map(row => {
      const min = row.counts.length > 0 ? Math.min(...row.counts) : 0
      const avg = row.counts.length > 0 ? row.counts.reduce((s, n) => s + n, 0) / row.counts.length : 0
      return {
        origin: row.origin,
        mode: row.mode,
        bucket_id: row.bucket_id,
        samples: row.counts.length,
        avg_results: avg,
        min_results: min,
      }
    })
    .sort((a, b) => a.origin.localeCompare(b.origin) || a.mode.localeCompare(b.mode) || a.bucket_id.localeCompare(b.bucket_id))

  const summary = []
  summary.push('# Routing Audit Summary')
  summary.push('')
  summary.push(`- Generated: ${new Date().toISOString()}`)
  summary.push(`- Base URL: ${baseUrl}`)
  summary.push(`- Demo mode: ${demo}`)
  summary.push(`- Batch: ${batch.index}/${batch.total}`)
  summary.push(`- Permutations checked: ${selectedPermutations.length} (out of ${allPermutations.length} total)`)
  summary.push(`- Hard failures: ${failures.length}`)
  summary.push(`- Warnings: ${warnings.length}`)
  summary.push(`- Failure rate: ${formatPct(failures.length, Math.max(1, selectedPermutations.length))} per permutation`)
  summary.push('')
  summary.push('## Top 20 Destinations Causing Hard Failures')
  summary.push('')
  if (failureTop.length === 0) {
    summary.push('_None_')
  } else {
    summary.push('| Destination | Failures |')
    summary.push('|---|---:|')
    for (const [name, count] of failureTop) {
      summary.push(`| ${name} | ${count} |`)
    }
  }
  summary.push('')
  summary.push('## Top 20 maps_name mismatch risk entries')
  summary.push('')
  if (mismatchTop.length === 0) {
    summary.push('_None_')
  } else {
    summary.push('| Destination | Warnings |')
    summary.push('|---|---:|')
    for (const [name, count] of mismatchTop) {
      summary.push(`| ${name} | ${count} |`)
    }
  }
  summary.push('')
  summary.push('## Per-origin Matrix (results returned per bucket by mode)')
  summary.push('')
  if (matrixRows.length === 0) {
    summary.push('_No matrix rows generated_')
  } else {
    summary.push('| Origin | Mode | Bucket | Samples | Avg results | Min results |')
    summary.push('|---|---|---|---:|---:|---:|')
    for (const row of matrixRows) {
      summary.push(
        `| ${row.origin} | ${row.mode} | ${row.bucket_id} | ${row.samples} | ${row.avg_results.toFixed(2)} | ${row.min_results} |`
      )
    }
  }
  summary.push('')
  summary.push('## Reproduce One Failing Permutation')
  summary.push('')
  if (firstFailure && reproCommand) {
    summary.push(`- Failure type: \`${firstFailure.failure_type}\``)
    summary.push(`- Destination: ${firstFailure.destination_name || '(n/a)'}`)
    summary.push(`- Request URL: ${firstFailure.request_url}`)
    summary.push('')
    summary.push('```bash')
    summary.push(reproCommand)
    summary.push('```')
  } else {
    summary.push('No hard failures found in this run.')
  }
  summary.push('')
  summary.push('## Artifacts')
  summary.push('')
  summary.push(`- ${path.relative(ROOT, summaryPath)}`)
  summary.push(`- ${path.relative(ROOT, failuresPath)}`)
  summary.push(`- ${path.relative(ROOT, warningsPath)}`)
  if (geocodeCh) summary.push(`- ${path.relative(ROOT, geocodeCachePath)}`)
  summary.push('')

  fs.writeFileSync(summaryPath, summary.join('\n'), 'utf8')

  console.log('')
  console.log('=== Routing Audit (Top Summary) ===')
  console.log(`Permutations checked: ${selectedPermutations.length}/${allPermutations.length}`)
  console.log(`Hard failures: ${failures.length}`)
  console.log(`Warnings: ${warnings.length}`)
  if (failureTop.length > 0) {
    console.log('Top failing destinations:')
    for (const [name, count] of failureTop.slice(0, 10)) {
      console.log(`  - ${name}: ${count}`)
    }
  } else {
    console.log('Top failing destinations: none')
  }
  if (mismatchTop.length > 0) {
    console.log('Top maps_name mismatch risks:')
    for (const [name, count] of mismatchTop.slice(0, 10)) {
      console.log(`  - ${name}: ${count}`)
    }
  } else {
    console.log('Top maps_name mismatch risks: none')
  }
  if (reproCommand) {
    console.log('Reproduce one failing permutation:')
    console.log(`  ${reproCommand}`)
  } else {
    console.log('Reproduce one failing permutation: none (no hard failures)')
  }
  console.log(`Summary written: ${path.relative(ROOT, summaryPath)}`)
}

main().catch(err => {
  console.error(`[audit-routing] ${err instanceof Error ? err.stack || err.message : String(err)}`)
  process.exit(1)
})
