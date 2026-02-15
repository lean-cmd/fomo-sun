#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DEST_PATH = path.resolve(ROOT, 'src/data/destinations.ts')

const REQUIRED_IDS = new Set([
  'st-moritz',
  'lucerne',
  'thun',
  'interlaken',
  'freiburg-im-breisgau',
  'weissenstein',
  'uetliberg',
  'bachtel',
  'pfannenstiel',
  'bern',
  'zurich',
  'napf',
  'moleson',
  'brienz',
  'hasliberg',
  'braunwald',
  'gurten',
  'bantiger',
  'leysin',
  'chasseral',
  'rochers-de-naye',
  'la-dole',
  'pilatus',
  'rigi',
])

function extractDestinationsArray(content) {
  const marker = 'export const destinations: Destination[] = ['
  const markerIdx = content.indexOf(marker)
  if (markerIdx < 0) throw new Error('destinations marker not found')
  const start = markerIdx + marker.length - 1
  if (content[start] !== '[') throw new Error('array start not found')

  let depth = 0
  let inSingle = false
  let inDouble = false
  let escaped = false

  for (let i = start; i < content.length; i++) {
    const ch = content[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (inSingle) {
      if (ch === "'") inSingle = false
      continue
    }
    if (inDouble) {
      if (ch === '"') inDouble = false
      continue
    }
    if (ch === "'") {
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
      if (depth === 0) return content.slice(start, i + 1)
    }
  }
  throw new Error('array end not found')
}

function toRad(v) {
  return (v * Math.PI) / 180
}

function haversineKm(aLat, aLon, bLat, bLon) {
  const R = 6371
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return R * (2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa)))
}

function isGenericNumbered(d) {
  const n = String(d.name || '')
  const id = String(d.id || '')
  if (/-panorama-\d+$/i.test(id)) return true
  if (/\bpanorama\s*\d+\b/i.test(n)) return true
  if (/\bpanoramaweg\s*\d+\b/i.test(n)) return true
  if (/\bviewpoint\s*\d+\b/i.test(n)) return true
  if (/\bterrace\s*\d+\b/i.test(n)) return true
  if (/\bridge\s*\d+\b/i.test(n)) return true
  return false
}

function scoreDestination(d) {
  let s = 0
  s += Math.max(0, Number(d.altitude_m || 0)) / 90
  if (d.country === 'CH') s += 12
  if (Array.isArray(d.types) && d.types.includes('mountain')) s += 8
  if (Array.isArray(d.types) && d.types.includes('viewpoint')) s += 6
  if (Array.isArray(d.types) && d.types.includes('town')) s += 4
  if (Array.isArray(d.types) && d.types.includes('lake')) s += 3
  if (d.webcam_url) s += 3
  if (d.sbb_url) s += 2
  if (d.maps_url) s += 1
  if (REQUIRED_IDS.has(String(d.id || ''))) s += 10_000
  if (isGenericNumbered(d)) s -= 80
  return s
}

function normalizeRegion(region) {
  return String(region || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function esc(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function q(str) {
  return `'${esc(str)}'`
}

function renderDestination(d) {
  const out = [
    '  {',
    `    id: ${q(d.id)},`,
    `    name: ${q(d.name)},`,
    `    region: ${q(d.region)},`,
    `    country: ${q(d.country)},`,
    `    lat: ${Number(d.lat).toFixed(4)},`,
    `    lon: ${Number(d.lon).toFixed(4)},`,
    `    altitude_m: ${Math.round(Number(d.altitude_m || 0))},`,
    `    types: [${(Array.isArray(d.types) ? d.types : []).map(x => q(x)).join(', ')}],`,
    `    plan_template: ${q(d.plan_template || 'Scenic stop | Short walk | Terrace break')},`,
  ]
  if (d.webcam_url) out.push(`    webcam_url: ${q(d.webcam_url)},`)
  if (d.maps_url) out.push(`    maps_url: ${q(d.maps_url)},`)
  if (d.sbb_url) out.push(`    sbb_url: ${q(d.sbb_url)},`)
  if (d.description) out.push(`    description: ${q(d.description)},`)
  out.push('  },')
  return out.join('\n')
}

function summarize(rows) {
  const by = { CH: 0, DE: 0, FR: 0 }
  for (const r of rows) by[r.country] = (by[r.country] || 0) + 1
  return by
}

function main() {
  const raw = fs.readFileSync(DEST_PATH, 'utf8')
  const arrLiteral = extractDestinationsArray(raw)
  const rows = Function(`return (${arrLiteral});`)()
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('Could not parse destinations')

  const noGeneric = rows.filter(d => REQUIRED_IDS.has(d.id) || !isGenericNumbered(d))

  const sorted = [...noGeneric].sort((a, b) => {
    const sa = scoreDestination(a)
    const sb = scoreDestination(b)
    if (sb !== sa) return sb - sa
    return String(a.name).localeCompare(String(b.name), 'de-CH')
  })

  const kept = []
  for (const d of sorted) {
    if (REQUIRED_IDS.has(d.id)) {
      kept.push(d)
      continue
    }
    const duplicate = kept.some(k => {
      if (k.country !== d.country) return false
      const dist = haversineKm(k.lat, k.lon, d.lat, d.lon)
      if (dist >= 5) return false
      const sameRegion = normalizeRegion(k.region) === normalizeRegion(d.region)
      return sameRegion
    })
    if (!duplicate) kept.push(d)
  }

  const uniqueById = new Map()
  for (const d of kept) {
    if (!uniqueById.has(d.id)) uniqueById.set(d.id, d)
  }

  let curated = [...uniqueById.values()]

  if (curated.length > 250) {
    const req = curated.filter(d => REQUIRED_IDS.has(d.id))
    const rest = curated
      .filter(d => !REQUIRED_IDS.has(d.id))
      .sort((a, b) => scoreDestination(b) - scoreDestination(a))
      .slice(0, 250 - req.length)
    curated = [...req, ...rest]
  }

  curated = curated.sort((a, b) => {
    if (a.country !== b.country) return a.country.localeCompare(b.country)
    if (a.region !== b.region) return String(a.region).localeCompare(String(b.region), 'de-CH')
    return String(a.name).localeCompare(String(b.name), 'de-CH')
  })

  const body = curated.map(renderDestination).join('\n')
  const file = `import { Destination } from '@/lib/types'\n\n/**\n * FOMO Sun destination catalog (curated v30)\n *\n * Curated for quality and distinctness:\n * - Removed generic numbered panorama placeholders\n * - De-duplicated near-identical POIs within 5km clusters\n */\nexport const destinations: Destination[] = [\n${body}\n]\n\n/** Default fallback origin: Basel */\nexport const DEFAULT_ORIGIN = {\n  name: 'Basel',\n  lat: 47.5596,\n  lon: 7.5886,\n}\n\n/** Get destinations filtered by type */\nexport function filterByType(types: string[]): Destination[] {\n  if (types.length === 0) return destinations\n  return destinations.filter(d => d.types.some(t => types.includes(t)))\n}\n\n/** Get destinations by country */\nexport function filterByCountry(country: 'CH' | 'DE' | 'FR'): Destination[] {\n  return destinations.filter(d => d.country === country)\n}\n`

  fs.writeFileSync(DEST_PATH, file)

  const by = summarize(curated)
  console.log(`Curated destinations: ${curated.length}`)
  console.log(`CH=${by.CH} DE=${by.DE} FR=${by.FR}`)

  const missingRequired = [...REQUIRED_IDS].filter(id => !curated.some(d => d.id === id))
  if (missingRequired.length) {
    console.log(`Missing required IDs: ${missingRequired.join(', ')}`)
  }
}

main()
