#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const DEST_PATH = path.resolve(process.cwd(), 'src/data/destinations.ts')

const COUNTRY_NAME = {
  CH: 'Switzerland',
  DE: 'Germany',
  FR: 'France',
  IT: 'Italy',
  LI: 'Liechtenstein',
}

const ROUTING_OVERRIDES = {
  chasseral: { maps_name: 'Chasseral, Switzerland', sbb_name: 'Nods, Chasseral' },
  weissenstein: { maps_name: 'Weissenstein, Solothurn, Switzerland', sbb_name: 'Oberdorf SO, Weissenstein' },
  'feldberg-schwarzwald': { maps_name: 'Feldberg, Black Forest, Germany', sbb_name: 'Feldberg-Bärental' },
  'grand-ballon': { maps_name: 'Grand Ballon, France', sbb_name: null },
}

const CORRIDOR_ADDITIONS = [
  {
    id: 'solothurn',
    name: 'Solothurn',
    region: 'Mittelland',
    country: 'CH',
    lat: 47.2082,
    lon: 7.5378,
    altitude_m: 432,
    types: ['town', 'food', 'family'],
    plan_template: 'Train ride through Mittelland | Old town walk | Riverside coffee stop',
    maps_name: 'Solothurn, Switzerland',
    sbb_name: 'Solothurn',
  },
  {
    id: 'olten',
    name: 'Olten',
    region: 'Mittelland',
    country: 'CH',
    lat: 47.3499,
    lon: 7.9033,
    altitude_m: 396,
    types: ['town', 'food', 'family'],
    plan_template: 'Quick rail hop | Aare riverside walk | Terrace lunch in old town',
    maps_name: 'Olten, Switzerland',
    sbb_name: 'Olten',
  },
  {
    id: 'grenchen',
    name: 'Grenchen',
    region: 'Mittelland',
    country: 'CH',
    lat: 47.1947,
    lon: 7.3959,
    altitude_m: 451,
    types: ['town', 'family', 'nature'],
    plan_template: 'Fast train corridor stop | Jura foothill walk | Coffee break with views',
    maps_name: 'Grenchen, Switzerland',
    sbb_name: 'Grenchen Süd',
  },
  {
    id: 'biel-bienne',
    name: 'Biel/Bienne',
    region: 'Seeland',
    country: 'CH',
    lat: 47.1368,
    lon: 7.2468,
    altitude_m: 434,
    types: ['town', 'lake', 'food'],
    plan_template: 'Direct rail via Biel corridor | Lakeside promenade | Old town café stop',
    maps_name: 'Biel/Bienne, Switzerland',
    sbb_name: 'Biel/Bienne',
  },
  {
    id: 'aarau',
    name: 'Aarau',
    region: 'Aargau',
    country: 'CH',
    lat: 47.3904,
    lon: 8.0457,
    altitude_m: 381,
    types: ['town', 'food', 'family'],
    plan_template: 'Fast Basel-Zurich rail leg | Painted eaves old town walk | Riverside coffee',
    maps_name: 'Aarau, Switzerland',
    sbb_name: 'Aarau',
  },
  {
    id: 'brugg-aargau',
    name: 'Brugg',
    region: 'Aargau',
    country: 'CH',
    lat: 47.4804,
    lon: 8.2085,
    altitude_m: 352,
    types: ['town', 'family', 'nature'],
    plan_template: 'Rail to Brugg | Short old-town loop | Aare-Limmat confluence walk',
    maps_name: 'Brugg, Switzerland',
    sbb_name: 'Brugg AG',
  },
  {
    id: 'zofingen',
    name: 'Zofingen',
    region: 'Aargau',
    country: 'CH',
    lat: 47.2878,
    lon: 7.9449,
    altitude_m: 439,
    types: ['town', 'food', 'family'],
    plan_template: 'Basel-Luzern corridor train stop | Historic center stroll | Terrace lunch',
    maps_name: 'Zofingen, Switzerland',
    sbb_name: 'Zofingen',
  },
  {
    id: 'sursee',
    name: 'Sursee',
    region: 'Luzern region',
    country: 'CH',
    lat: 47.1715,
    lon: 8.1119,
    altitude_m: 504,
    types: ['town', 'lake', 'food'],
    plan_template: 'Fast train to Sursee | Lakeside walk | Café with open-sky terrace',
    maps_name: 'Sursee, Switzerland',
    sbb_name: 'Sursee',
  },
  {
    id: 'walenstadt',
    name: 'Walenstadt',
    region: 'St. Gallen Alps',
    country: 'CH',
    lat: 47.1206,
    lon: 9.3128,
    altitude_m: 427,
    types: ['lake', 'nature', 'town'],
    plan_template: 'Zurich-Chur rail corridor | Lake Walen promenade | Panorama pause',
    maps_name: 'Walenstadt, Switzerland',
    sbb_name: 'Walenstadt',
  },
  {
    id: 'chur-city',
    name: 'Chur',
    region: 'Graubünden',
    country: 'CH',
    lat: 46.8508,
    lon: 9.5322,
    altitude_m: 593,
    types: ['town', 'food', 'family'],
    plan_template: 'Direct rail to Chur | Old-town alleys | Cable car viewpoint option',
    maps_name: 'Chur, Switzerland',
    sbb_name: 'Chur',
  },
]

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

function esc(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function q(str) {
  return `'${esc(str)}'`
}

function decodeSbbName(url) {
  if (!url) return null
  const m = url.match(/[?&]nach=([^&]+)/i)
  if (!m) return null
  try {
    return decodeURIComponent(m[1]).replace(/\+/g, ' ').trim() || null
  } catch {
    return m[1].replace(/\+/g, ' ').trim() || null
  }
}

function inferSbbName(row) {
  const override = ROUTING_OVERRIDES[row.id]
  if (override && Object.prototype.hasOwnProperty.call(override, 'sbb_name')) return override.sbb_name

  const fromUrl = decodeSbbName(row.sbb_url)
  if (fromUrl) return fromUrl

  const typeSet = new Set(row.types || [])
  const mountainLike =
    row.altitude_m >= 1450 &&
    !typeSet.has('town') &&
    (typeSet.has('viewpoint') || typeSet.has('mountain') || typeSet.has('nature'))

  if (mountainLike) return null

  if (row.country === 'CH') return row.name
  if (typeSet.has('town') || typeSet.has('lake') || typeSet.has('thermal')) return row.name
  return null
}

function inferMapsName(row) {
  const override = ROUTING_OVERRIDES[row.id]
  if (override?.maps_name) return override.maps_name
  if (row.maps_name) return row.maps_name
  return `${row.name}, ${COUNTRY_NAME[row.country] || row.country}`
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
    `    maps_name: ${q(d.maps_name)},`,
    d.sbb_name === null || d.sbb_name === undefined
      ? '    sbb_name: null,'
      : `    sbb_name: ${q(d.sbb_name)},`,
  ]
  if (d.webcam_url) out.push(`    webcam_url: ${q(d.webcam_url)},`)
  if (d.maps_url) out.push(`    maps_url: ${q(d.maps_url)},`)
  if (d.sbb_url) out.push(`    sbb_url: ${q(d.sbb_url)},`)
  if (d.description) out.push(`    description: ${q(d.description)},`)
  out.push('  },')
  return out.join('\n')
}

function mapUrlFromCoords(lat, lon) {
  return `https://maps.google.com/?q=${Number(lat).toFixed(5)},${Number(lon).toFixed(5)}`
}

function main() {
  const raw = fs.readFileSync(DEST_PATH, 'utf8')
  const arrLiteral = extractDestinationsArray(raw)
  const rows = Function(`return (${arrLiteral});`)()

  const byId = new Map(rows.map(r => [r.id, { ...r }]))

  for (const extra of CORRIDOR_ADDITIONS) {
    if (byId.has(extra.id)) continue
    byId.set(extra.id, {
      ...extra,
      maps_url: mapUrlFromCoords(extra.lat, extra.lon),
      sbb_url: 'https://www.sbb.ch/en/timetable.html',
    })
  }

  const enriched = Array.from(byId.values()).map(row => {
    const maps_name = inferMapsName(row)
    const sbb_name = inferSbbName(row)
    return {
      ...row,
      maps_name,
      sbb_name,
    }
  })

  enriched.sort((a, b) => {
    if (a.country !== b.country) return String(a.country).localeCompare(String(b.country))
    if (a.region !== b.region) return String(a.region).localeCompare(String(b.region), 'de-CH')
    return String(a.name).localeCompare(String(b.name), 'de-CH')
  })

  const body = enriched.map(renderDestination).join('\n')

  const file = `import { Destination } from '@/lib/types'\n\n/**\n * FOMO Sun destination catalog (curated v32)\n *\n * Routing metadata added:\n * - maps_name for Google Maps place-based deep links\n * - sbb_name for SBB timetable deep links\n */\nexport const destinations: Destination[] = [\n${body}\n]\n\n/** Default fallback origin: Basel */\nexport const DEFAULT_ORIGIN = {\n  name: 'Basel',\n  lat: 47.5596,\n  lon: 7.5886,\n}\n\n/** Get destinations filtered by type */\nexport function filterByType(types: string[]): Destination[] {\n  if (types.length === 0) return destinations\n  return destinations.filter(d => d.types.some(t => types.includes(t)))\n}\n\n/** Get destinations by country */\nexport function filterByCountry(country: 'CH' | 'DE' | 'FR'): Destination[] {\n  return destinations.filter(d => d.country === country)\n}\n`

  fs.writeFileSync(DEST_PATH, file)

  const summary = enriched.reduce((acc, d) => {
    acc[d.country] = (acc[d.country] || 0) + 1
    return acc
  }, {})
  const sbbMissing = enriched.filter(d => d.sbb_name === null).length
  console.log(`Destinations: ${enriched.length}`)
  console.log(`By country: ${JSON.stringify(summary)}`)
  console.log(`sbb_name null count: ${sbbMissing}`)
}

main()
