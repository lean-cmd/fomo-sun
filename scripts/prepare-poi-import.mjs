#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const TARGET_POI_COUNT = 500
const ROOT = process.cwd()
const INPUT = process.argv[2] || 'data/poi/swiss-poi-seed.csv'
const OUTPUT = process.argv[3] || 'src/data/poi-alpha-catalog.json'

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out.map(s => s.trim())
}

function num(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function normTypes(v) {
  if (!v) return []
  return [...new Set(v.split('|').map(x => x.trim()).filter(Boolean))]
}

function readCsv(absPath) {
  const raw = fs.readFileSync(absPath, 'utf8')
  const lines = raw.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0])
  const rows = []
  for (const line of lines.slice(1)) {
    if (line.startsWith('#')) continue
    const cols = parseCsvLine(line)
    const row = {}
    headers.forEach((h, i) => { row[h] = cols[i] ?? '' })
    rows.push(row)
  }
  return rows
}

function toPoi(row) {
  return {
    id: row.id,
    name: row.name,
    region: row.region,
    country: row.country,
    lat: num(row.lat),
    lon: num(row.lon),
    altitude_m: Math.round(num(row.altitude_m)),
    types: normTypes(row.types),
    plan_template: row.plan_template || '',
    maps_url: row.maps_url || '',
    sbb_url: row.sbb_url || '',
    webcam_url: row.webcam_url || '',
    status: row.status || 'candidate',
  }
}

function validPoi(p) {
  return Boolean(
    p.id && p.name && p.region &&
    (p.country === 'CH' || p.country === 'DE' || p.country === 'FR') &&
    Number.isFinite(p.lat) && Number.isFinite(p.lon)
  )
}

function dedupePois(rows) {
  const byId = new Map()
  for (const row of rows) {
    const poi = toPoi(row)
    if (!validPoi(poi)) continue
    const key = poi.id.toLowerCase()
    if (!byId.has(key)) byId.set(key, poi)
  }
  return [...byId.values()]
}

function summarize(pois) {
  const byCountry = { CH: 0, DE: 0, FR: 0 }
  for (const p of pois) byCountry[p.country] += 1
  return byCountry
}

function main() {
  const inPath = path.resolve(ROOT, INPUT)
  const outPath = path.resolve(ROOT, OUTPUT)
  if (!fs.existsSync(inPath)) {
    console.error(`Input CSV missing: ${inPath}`)
    process.exit(1)
  }

  const rows = readCsv(inPath)
  const pois = dedupePois(rows)
  const byCountry = summarize(pois)

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify({
    generated_at: new Date().toISOString(),
    target_poi_count: TARGET_POI_COUNT,
    actual_count: pois.length,
    by_country: byCountry,
    pois,
  }, null, 2) + '\n')

  console.log(`Wrote ${pois.length} POIs -> ${outPath}`)
  console.log(`CH=${byCountry.CH} DE=${byCountry.DE} FR=${byCountry.FR}`)
  if (pois.length < TARGET_POI_COUNT) {
    console.log(`Need +${TARGET_POI_COUNT - pois.length} more POIs to reach target ${TARGET_POI_COUNT}`)
  } else {
    console.log(`Target reached (${TARGET_POI_COUNT})`)
  }
}

main()
