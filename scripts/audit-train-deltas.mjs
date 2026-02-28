#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DESTINATIONS_PATH = path.resolve(ROOT, 'src/data/destinations.ts')
const PAGE_PATH = path.resolve(ROOT, 'src/app/page.tsx')
const TRAIN_TIMES_PATH = path.resolve(ROOT, 'src/data/train-times.ts')
const OUTPUT_PATH = path.resolve(ROOT, 'artifacts/train-time-deltas.md')
const API_SOURCE = 'transport.opendata.ch'

function fnv1a32(input) {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = (hash + (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)) >>> 0
  }
  return hash >>> 0
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

function extractObjectByMarker(source, marker) {
  const markerIdx = source.indexOf(marker)
  if (markerIdx < 0) throw new Error(`Marker not found: ${marker}`)
  const start = source.indexOf('{', markerIdx)
  if (start < 0) throw new Error(`Object start not found after marker: ${marker}`)

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
    if (ch === '{') depth += 1
    if (ch === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, i + 1)
    }
  }
  throw new Error(`Object close not found for marker: ${marker}`)
}

function loadOrigins() {
  const source = fs.readFileSync(PAGE_PATH, 'utf8')
  const block = source.match(/const\s+MANUAL_ORIGIN_CITIES:[\s\S]*?=\s*\[([\s\S]*?)\]\.sort/)
  if (!block) throw new Error('Could not parse MANUAL_ORIGIN_CITIES')
  const rows = []
  const re = /\{\s*name:\s*'([^']+)'\s*,\s*lat:\s*([-+]?\d+(?:\.\d+)?)\s*,\s*lon:\s*([-+]?\d+(?:\.\d+)?)\s*\}/g
  let m = re.exec(block[1])
  while (m) {
    rows.push({ name: m[1], lat: Number(m[2]), lon: Number(m[3]) })
    m = re.exec(block[1])
  }
  return rows
}

function loadDestinations() {
  const source = fs.readFileSync(DESTINATIONS_PATH, 'utf8')
  const arrayText = extractArrayByMarker(source, 'const destinationCatalog: Destination[] =')
  const rows = Function(`return (${arrayText});`)()
  if (!Array.isArray(rows)) throw new Error('Failed to parse destination catalog')
  return rows.filter(row => typeof row?.id === 'string' && typeof row?.sbb_name === 'string' && row.sbb_name.trim())
}

function loadTrainTimes() {
  const source = fs.readFileSync(TRAIN_TIMES_PATH, 'utf8')
  const objectText = extractObjectByMarker(source, 'export const TRAIN_TIME_MIN_BY_ORIGIN')
  const sourceText = extractObjectByMarker(source, 'export const TRAIN_TIME_SOURCE_BY_ORIGIN')
  const durations = Function(`return (${objectText});`)()
  const sources = Function(`return (${sourceText});`)()
  if (!durations || typeof durations !== 'object') throw new Error('Failed to parse TRAIN_TIME_MIN_BY_ORIGIN')
  if (!sources || typeof sources !== 'object') throw new Error('Failed to parse TRAIN_TIME_SOURCE_BY_ORIGIN')
  return { durations, sources }
}

function heuristicTrainMin(origin, destination) {
  const R = 6371
  const dLa = (destination.lat - origin.lat) * Math.PI / 180
  const dLo = (destination.lon - origin.lon) * Math.PI / 180
  const a = Math.sin(dLa / 2) ** 2
    + Math.cos(origin.lat * Math.PI / 180) * Math.cos(destination.lat * Math.PI / 180) * Math.sin(dLo / 2) ** 2
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
  const carSpeedKmh = roadKm < 35 ? 45 : roadKm < 95 ? 56 : roadKm < 230 ? 66 : 72
  const carPenaltyMin = (isCrossBorder ? 8 : 0) + (altitude > 1400 ? 10 : 0) + (altitude > 1800 ? 8 : 0)
  const carMin = isSamePlace ? 0 : Math.max(8, Math.round((roadKm / carSpeedKmh) * 60 + carPenaltyMin))
  if (isSamePlace) return 0
  const trainBase = isCrossBorder ? carMin * 1.22 : carMin * 1.02
  const trainPenalty = isCrossBorder ? 18 : 8
  return Math.max(12, Math.round(trainBase + trainPenalty))
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
}

function main() {
  const origins = loadOrigins()
  const destinations = loadDestinations()
  const { durations: trainTimes, sources: trainSources } = loadTrainTimes()

  const basel = origins.find(o => o.name.toLowerCase() === 'basel') || { name: 'Basel', lat: 47.5596, lon: 7.5886 }
  const zurich = origins.find(o => o.name.toLowerCase() === 'zurich') || { name: 'Zurich', lat: 47.3769, lon: 8.5417 }
  const originSpecs = [
    { key: 'Basel SBB', origin: basel, label: 'Basel SBB' },
    { key: 'Zürich HB', origin: zurich, label: 'Zürich HB' },
  ]

  const withCoverage = destinations.filter(dest => originSpecs.some(origin => (
    Number.isFinite(Number(trainTimes?.[origin.key]?.[dest.id]))
    && trainSources?.[origin.key]?.[dest.id] === API_SOURCE
  )))
  const samplePool = withCoverage.length > 0 ? withCoverage : destinations
  const sampledDestinations = [...samplePool]
    .sort((a, b) => fnv1a32(a.id) - fnv1a32(b.id))
    .slice(0, 50)

  const deltas = []
  let coveredApiRows = 0
  let coveredFallbackRows = 0
  for (const destination of sampledDestinations) {
    for (const originSpec of originSpecs) {
      const precomputed = Number(trainTimes?.[originSpec.key]?.[destination.id])
      const source = String(trainSources?.[originSpec.key]?.[destination.id] || '')
      if (!Number.isFinite(precomputed)) continue
      if (source === API_SOURCE) coveredApiRows += 1
      else coveredFallbackRows += 1
      if (source !== API_SOURCE) continue
      const heuristic = heuristicTrainMin(originSpec.origin, destination)
      const delta = Math.round(precomputed - heuristic)
      deltas.push({
        origin_key: originSpec.key,
        destination_id: destination.id,
        destination_name: destination.name,
        destination_country: destination.country,
        heuristic_min: heuristic,
        precomputed_min: Math.round(precomputed),
        delta_min: delta,
        abs_delta_min: Math.abs(delta),
      })
    }
  }

  const top = [...deltas].sort((a, b) => b.abs_delta_min - a.abs_delta_min).slice(0, 20)

  const lines = []
  lines.push('# Train Time Delta Audit')
  lines.push('')
  lines.push(`- Generated: ${new Date().toISOString()}`)
  lines.push('- Origins compared: Basel SBB, Zürich HB')
  lines.push(`- Destinations sampled: ${sampledDestinations.length}`)
  lines.push(`- Delta rows with API coverage: ${deltas.length}`)
  lines.push(`- API rows observed in sample: ${coveredApiRows}`)
  lines.push(`- Fallback rows observed in sample (excluded from delta ranking): ${coveredFallbackRows}`)
  lines.push('')
  lines.push('Top 20 absolute deltas (precomputed - heuristic):')
  lines.push('')
  if (top.length === 0) {
    lines.push('_No precomputed rows available yet._')
  } else {
    lines.push('| Origin | Destination | Country | Heuristic (min) | Precomputed (min) | Delta (min) |')
    lines.push('|---|---|---|---:|---:|---:|')
    for (const row of top) {
      lines.push(`| ${row.origin_key} | ${row.destination_name} (\`${row.destination_id}\`) | ${row.destination_country} | ${row.heuristic_min} | ${row.precomputed_min} | ${row.delta_min > 0 ? '+' : ''}${row.delta_min} |`)
    }
  }
  lines.push('')

  ensureDir(OUTPUT_PATH)
  fs.writeFileSync(OUTPUT_PATH, `${lines.join('\n')}\n`, 'utf8')
  console.log(`[audit-train-deltas] wrote ${path.relative(ROOT, OUTPUT_PATH)}`)
}

main()
