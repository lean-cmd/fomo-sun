#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DEST_PATH = path.resolve(ROOT, 'src/data/destinations.ts')
const CATALOG_PATH = path.resolve(ROOT, 'src/data/poi-alpha-catalog.json')

const ALLOWED_TYPES = new Set([
  'nature',
  'viewpoint',
  'town',
  'lake',
  'family',
  'food',
  'mountain',
  'thermal',
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

function parseExistingDestinations() {
  const raw = fs.readFileSync(DEST_PATH, 'utf8')
  const arrLiteral = extractDestinationsArray(raw)
  const arr = Function(`return (${arrLiteral});`)()
  if (!Array.isArray(arr)) throw new Error('Failed to parse destinations array')
  if (arr.length === 0) throw new Error('Parsed 0 existing destinations; aborting merge')
  return arr
}

function slugify(input) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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

function normalizeTypes(types) {
  const out = []
  const raw = Array.isArray(types) ? types : []
  for (const t of raw.map(x => String(x || '').trim().toLowerCase()).filter(Boolean)) {
    if (ALLOWED_TYPES.has(t) && !out.includes(t)) out.push(t)
  }
  if (out.length === 0) return ['nature', 'viewpoint']
  return out
}

function toNumber(v, fallback = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function esc(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function q(str) {
  return `'${esc(str)}'`
}

function renderDestination(d) {
  const lines = [
    '  {',
    `    id: ${q(d.id)},`,
    `    name: ${q(d.name)},`,
    `    region: ${q(d.region)},`,
    `    country: ${q(d.country)},`,
    `    lat: ${Number(d.lat).toFixed(4)},`,
    `    lon: ${Number(d.lon).toFixed(4)},`,
    `    altitude_m: ${Math.round(Number(d.altitude_m || 0))},`,
    `    types: [${d.types.map(t => q(t)).join(', ')}],`,
    `    plan_template: ${q(d.plan_template || 'Scenic stop | Short walk | Terrace break')},`,
  ]

  if (d.webcam_url) lines.push(`    webcam_url: ${q(d.webcam_url)},`)
  if (d.maps_url) lines.push(`    maps_url: ${q(d.maps_url)},`)
  if (d.sbb_url) lines.push(`    sbb_url: ${q(d.sbb_url)},`)
  if (d.description) lines.push(`    description: ${q(d.description)},`)

  lines.push('  },')
  return lines.join('\n')
}

function loadCatalog() {
  if (!fs.existsSync(CATALOG_PATH)) {
    throw new Error(`Catalog not found: ${CATALOG_PATH}`)
  }
  const raw = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'))
  const pois = Array.isArray(raw?.pois) ? raw.pois : []
  return pois
}

function cleanDestination(raw) {
  const id = slugify(raw.id || raw.name)
  const name = String(raw.name || '').trim()
  const region = String(raw.region || '').trim()
  const country = String(raw.country || '').trim().toUpperCase()
  const lat = toNumber(raw.lat)
  const lon = toNumber(raw.lon)
  const altitude = Math.round(toNumber(raw.altitude_m, 0))

  if (!id || !name || !region) return null
  if (!['CH', 'DE', 'FR'].includes(country)) return null
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null

  const maps = String(raw.maps_url || '').trim() || `https://maps.google.com/?q=${lat.toFixed(5)},${lon.toFixed(5)}`
  const sbb = String(raw.sbb_url || '').trim() || 'https://www.sbb.ch/en'
  const webcam = String(raw.webcam_url || '').trim()
  const types = normalizeTypes(raw.types)
  const plan = String(raw.plan_template || '').trim() || 'Scenic stop | Short walk | Terrace break'

  return {
    id,
    name,
    region,
    country,
    lat,
    lon,
    altitude_m: altitude,
    types,
    plan_template: plan,
    maps_url: maps,
    sbb_url: sbb,
    webcam_url: webcam,
    description: String(raw.description || '').trim(),
  }
}

function build() {
  const baseline = parseExistingDestinations().map(cleanDestination).filter(Boolean)
  const catalog = loadCatalog().map(cleanDestination).filter(Boolean)

  const byId = new Map()
  const byNameCountry = new Map()

  for (const d of baseline) {
    byId.set(d.id.toLowerCase(), d)
    byNameCountry.set(`${slugify(d.name)}:${d.country}`, d.id)
  }

  const additions = []

  for (const p of catalog) {
    const idKey = p.id.toLowerCase()
    if (byId.has(idKey)) continue

    const nameKey = `${slugify(p.name)}:${p.country}`
    if (byNameCountry.has(nameKey)) continue

    additions.push(p)
    byId.set(idKey, p)
    byNameCountry.set(nameKey, p.id)
  }

  additions.sort((a, b) => {
    if (a.country !== b.country) return a.country.localeCompare(b.country)
    if (a.region !== b.region) return a.region.localeCompare(b.region, 'de-CH')
    return a.name.localeCompare(b.name, 'de-CH')
  })

  const merged = [...baseline, ...additions]

  const byCountry = { CH: 0, DE: 0, FR: 0 }
  for (const d of merged) byCountry[d.country] += 1

  const body = merged.map(renderDestination).join('\n')
  const file = `import { Destination } from '@/lib/types'\n\n/**\n * FOMO Sun destination catalog (v28)\n * Generated from baseline destinations + curated POI alpha catalog import.\n */\nexport const destinations: Destination[] = [\n${body}\n]\n\n/** Default fallback origin: Basel */\nexport const DEFAULT_ORIGIN = {\n  name: 'Basel',\n  lat: 47.5596,\n  lon: 7.5886,\n}\n\n/** Get destinations filtered by type */\nexport function filterByType(types: string[]): Destination[] {\n  if (types.length === 0) return destinations\n  return destinations.filter(d => d.types.some(t => types.includes(t)))\n}\n\n/** Get destinations by country */\nexport function filterByCountry(country: 'CH' | 'DE' | 'FR'): Destination[] {\n  return destinations.filter(d => d.country === country)\n}\n`

  fs.writeFileSync(DEST_PATH, file)

  console.log(`Merged destinations: ${merged.length}`)
  console.log(`CH=${byCountry.CH} DE=${byCountry.DE} FR=${byCountry.FR}`)
  console.log(`Added from catalog: ${additions.length}`)
}

build()
