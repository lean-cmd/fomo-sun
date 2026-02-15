#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const DEST_PATH = path.resolve(ROOT, 'src/data/destinations.ts')
const OUT_CSV = path.resolve(ROOT, 'data/poi/swiss-poi-seed.csv')

const TARGET_CH = 300
const TARGET_BORDER = 50 // DE + FR combined

const COUNTRY_ORDER = ['CH', 'DE', 'FR']

const CH_ZONES = [
  {
    key: 'jura-ridge',
    region: 'Swiss Jura Ridge',
    country: 'CH',
    center: [47.23, 7.24],
    spread: [0.18, 0.22],
    alt: [860, 1700],
    typePool: ['viewpoint', 'nature', 'mountain', 'family'],
    featured: [
      'Balmberg', 'Wasserfallen', 'Passwang', 'Mont Soleil', 'Mont Crosin', 'Chaumont',
      'Creux du Van', 'Mont Raimeux', 'Les Ordons', 'Soleil de la Tête', 'Pierre-Pertuis', 'Hasenmatt',
    ],
  },
  {
    key: 'basel-hills',
    region: 'Basel Uplands',
    country: 'CH',
    center: [47.43, 7.72],
    spread: [0.16, 0.2],
    alt: [520, 1250],
    typePool: ['nature', 'viewpoint', 'family', 'food'],
    featured: [
      'Belchenflue', 'Wisenberg', 'Homberg', 'Langenbruck Panorama', 'Gempenplateau', 'Bürenflue',
      'Sissach Panorama', 'Reigoldswil Ridge', 'Oberbaselbiet Trailhead', 'Arlesheim Heights',
    ],
  },
  {
    key: 'central-peaks',
    region: 'Central Swiss Peaks',
    country: 'CH',
    center: [46.98, 8.35],
    spread: [0.28, 0.35],
    alt: [900, 2350],
    typePool: ['mountain', 'viewpoint', 'nature', 'family'],
    featured: [
      'Stanserhorn', 'Bürgenstock', 'Klewenalp', 'Niederbauen', 'Brunni Engelberg', 'Melchsee-Frutt',
      'Titlis Panorama', 'Sörenberg Ridge', 'Schwägalp', 'Stoos Ridge Walk', 'Rigi Scheidegg', 'Pilatus Krienseregg',
      'Sattel Hochstuckli', 'Stoos Fronalp Traverse',
    ],
  },
  {
    key: 'bernese-oberland',
    region: 'Bernese Oberland',
    country: 'CH',
    center: [46.66, 7.92],
    spread: [0.34, 0.36],
    alt: [560, 2400],
    typePool: ['mountain', 'viewpoint', 'nature', 'family', 'food'],
    featured: [
      'Harder Kulm', 'Schynige Platte', 'Männlichen', 'First Grindelwald', 'Kleine Scheidegg', 'Mürren Sun Terrace',
      'Wengen Panorama', 'Kandersteg Heights', 'Niesen Kulm', 'Blausee Overlook', 'Lauterbrunnen Rim', 'Aeschi Terrace',
      'Adelboden Silleren', 'Lenk Betelberg', 'Beatenberg Panorama', 'Saxeten Ridge',
    ],
  },
  {
    key: 'engadin-grisons',
    region: 'Engadin & Grisons',
    country: 'CH',
    center: [46.72, 9.68],
    spread: [0.35, 0.36],
    alt: [1000, 2550],
    typePool: ['mountain', 'viewpoint', 'nature', 'town', 'food'],
    featured: [
      'Corviglia', 'Corvatsch', 'Diavolezza', 'Pontresina View', 'Samedan Terrace', 'Zuoz Plateau',
      'Scuol Panorama', 'Samnaun Heights', 'Flims Crestasee', 'Arosa Weisshorn', 'Davos Parsenn', 'Lenzerheide Heights',
      'Valbella Ridge', 'Bergün Alpine View', 'Savognin Sun Deck', 'Pizol Vista',
    ],
  },
  {
    key: 'valais-alpine',
    region: 'Valais Alpine',
    country: 'CH',
    center: [46.23, 7.42],
    spread: [0.3, 0.38],
    alt: [700, 2500],
    typePool: ['mountain', 'viewpoint', 'nature', 'thermal', 'town'],
    featured: [
      'Crans-Montana', 'Leukerbad Terrace', 'Verbier View', 'Nendaz Sun Deck', 'Anzère', 'Sion Hilltop',
      'Grimentz', 'Zinal Panorama', 'Saas-Fee Rim', 'Zermatt Sun Deck', 'Ovronnaz', 'Saillon Thermal View',
      'Aletsch Arena', 'Bettmeralp', 'Riederalp', 'Brig Panorama',
    ],
  },
  {
    key: 'ticino-sun',
    region: 'Ticino Sun Terrace',
    country: 'CH',
    center: [46.05, 8.95],
    spread: [0.28, 0.34],
    alt: [280, 2100],
    typePool: ['town', 'lake', 'viewpoint', 'mountain', 'food', 'family'],
    featured: [
      'Monte Brè', 'Monte San Salvatore', 'Cardada', 'Locarno Madonna del Sasso', 'Ascona Promenade', 'Morcote View',
      'Bellinzona Castles', 'Airolo Sun Deck', 'Bosco Gurin', 'Rasa Panorama', 'Carona Outlook', 'Mte Tamaro',
      'Mte Lema', 'Riviera Terrace',
    ],
  },
  {
    key: 'romandie-vistas',
    region: 'Romandie Viewpoints',
    country: 'CH',
    center: [46.57, 6.74],
    spread: [0.26, 0.32],
    alt: [620, 2200],
    typePool: ['viewpoint', 'nature', 'mountain', 'town', 'food'],
    featured: [
      'Les Pléiades', 'Jaman Pass', 'Lavaux Terraces', 'Mont Pèlerin', 'Charmey', 'Jaunpass Vista',
      'Villars', 'Diablerets View', 'Glacier 3000 Base', 'Fribourg Ramparts', 'Bulle Ridge', 'Yverdon Heights',
      'Neuchâtel Chaumont Trail', 'Morges Lakeside',
    ],
  },
  {
    key: 'lakes-towns',
    region: 'Swiss Lake Towns',
    country: 'CH',
    center: [46.93, 8.12],
    spread: [0.4, 0.45],
    alt: [360, 1200],
    typePool: ['town', 'lake', 'food', 'family', 'viewpoint'],
    featured: [
      'Weggis', 'Vitznau', 'Brunnen', 'Arth-Goldau Vista', 'Murten', 'Biel Lakeside',
      'Spiez', 'Sarnen', 'Alpnachstad', 'Meiringen', 'Appenzell View', 'Rapperswil Lakeside',
      'Stein am Rhein', 'Luzern Seebad', 'Montreux Lakeside', 'Vevey Terraces',
    ],
  },
  {
    key: 'thermal-family',
    region: 'Swiss Thermal & Family',
    country: 'CH',
    center: [46.78, 8.03],
    spread: [0.45, 0.5],
    alt: [380, 1600],
    typePool: ['thermal', 'family', 'town', 'nature', 'food'],
    featured: [
      'Bad Ragaz', 'Vals Thermal', 'Yverdon-les-Bains', 'Lavey-les-Bains', 'Schinznach Bad', 'Scuol Bogn',
      'Baden Limmat Thermal', 'Brigerbad', 'Charmey Bains', 'Zurzach Thermal', 'Saas-Grund Family', 'Hasliberg Muggestutz',
      'Braunwald Family Trail', 'Sörenberg Family Alps',
    ],
  },
]

const BORDER_ZONES = [
  {
    key: 'de-black-forest',
    region: 'Black Forest',
    country: 'DE',
    center: [47.89, 8.02],
    spread: [0.22, 0.28],
    alt: [420, 1500],
    typePool: ['nature', 'viewpoint', 'mountain', 'family', 'food'],
    featured: [
      'Schluchsee', 'Hinterzarten', 'Titisee-Neustadt', 'Todtmoos', 'St Blasien Ridge', 'Menzenschwand',
      'Hochschwarzwald Panorama', 'Wutach Vista', 'Freudenstadt South', 'Baiersbronn Höhen',
    ],
  },
  {
    key: 'de-bodensee-hegau',
    region: 'Bodensee & Hegau',
    country: 'DE',
    center: [47.73, 8.9],
    spread: [0.2, 0.3],
    alt: [380, 980],
    typePool: ['town', 'lake', 'viewpoint', 'food', 'family'],
    featured: [
      'Meersburg', 'Überlingen', 'Singen Hohentwiel', 'Radolfzell', 'Sipplingen Heights', 'Bodman-Ludwigshafen',
      'Stockach Panorama', 'Aach Hegau', 'Allensbach Lakeside', 'Reichenau Island View',
    ],
  },
  {
    key: 'fr-alsace',
    region: 'Alsace',
    country: 'FR',
    center: [48.09, 7.35],
    spread: [0.22, 0.26],
    alt: [140, 900],
    typePool: ['town', 'food', 'family', 'viewpoint'],
    featured: [
      'Riquewihr', 'Kaysersberg', 'Ribeauvillé', 'Hunawihr', 'Obernai', 'Barr Vineyards',
      'Thann', 'Guebwiller', 'Turckheim', 'Sélestat Heights',
    ],
  },
  {
    key: 'fr-vosges',
    region: 'Vosges',
    country: 'FR',
    center: [48.02, 7.02],
    spread: [0.24, 0.28],
    alt: [620, 1450],
    typePool: ['nature', 'mountain', 'viewpoint', 'food', 'family'],
    featured: [
      'Markstein', 'Le Markstein Pass', 'Gérardmer', 'La Bresse', 'Col de la Schlucht', 'Lac Blanc Ridge',
      'Le Bonhomme', 'Munster Valley View', 'Orbey Panorama', 'Route des Crêtes South',
    ],
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
      if (depth === 0) {
        return content.slice(start, i + 1)
      }
    }
  }

  throw new Error('array end not found')
}

function parseExistingDestinations() {
  const raw = fs.readFileSync(DEST_PATH, 'utf8')
  const arrLiteral = extractDestinationsArray(raw)
  const arr = Function(`return (${arrLiteral});`)()
  if (Array.isArray(arr) && arr.length === 0) {
    throw new Error('Parsed 0 existing destinations; aborting to avoid empty baseline merge')
  }
  return Array.isArray(arr) ? arr : []
}

function slugify(input) {
  return String(input || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0)
}

function rand01(seed) {
  return (hash(seed) % 100000) / 100000
}

function jitter(seed, amount) {
  return (rand01(seed) * 2 - 1) * amount
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v))
}

function pickTypes(seed, pool) {
  const unique = [...new Set(pool)]
  const out = []
  const count = 3 + (hash(seed + ':count') % 2)
  let i = 0
  while (out.length < Math.min(count, unique.length) && i < 20) {
    const idx = hash(`${seed}:${i}`) % unique.length
    const t = unique[idx]
    if (!out.includes(t)) out.push(t)
    i += 1
  }
  return out
}

function inferPlan(types) {
  if (types.includes('thermal')) return 'Thermal bath session | Scenic promenade | Terrace meal before return'
  if (types.includes('mountain') || types.includes('viewpoint')) return 'Cable car or short hike | Panorama viewpoint stop | Mountain hut lunch'
  if (types.includes('lake')) return 'Lakeside walk | Viewpoint detour | Café break and return'
  if (types.includes('town')) return 'Old town stroll | Local viewpoint | Lunch and easy return'
  return 'Scenic stop | Short walk | Coffee or lunch and return'
}

function toRow(poi) {
  return {
    id: poi.id,
    name: poi.name,
    region: poi.region,
    country: poi.country,
    lat: Number(poi.lat),
    lon: Number(poi.lon),
    altitude_m: Math.round(Number(poi.altitude_m || 0)),
    types: Array.isArray(poi.types) ? poi.types : [],
    plan_template: poi.plan_template || inferPlan(Array.isArray(poi.types) ? poi.types : []),
    maps_url: poi.maps_url || `https://maps.google.com/?q=${Number(poi.lat).toFixed(5)},${Number(poi.lon).toFixed(5)}`,
    sbb_url: poi.sbb_url || 'https://www.sbb.ch/en',
    webcam_url: poi.webcam_url || '',
    status: poi.status || 'candidate',
  }
}

function csvEscape(v) {
  const s = String(v ?? '')
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function writeCsv(rows) {
  const header = ['id', 'name', 'region', 'country', 'lat', 'lon', 'altitude_m', 'types', 'plan_template', 'maps_url', 'sbb_url', 'webcam_url', 'status']
  const lines = [header.join(',')]
  for (const r of rows) {
    lines.push([
      r.id,
      r.name,
      r.region,
      r.country,
      r.lat.toFixed(5),
      r.lon.toFixed(5),
      String(r.altitude_m),
      r.types.join('|'),
      r.plan_template,
      r.maps_url,
      r.sbb_url,
      r.webcam_url,
      r.status,
    ].map(csvEscape).join(','))
  }
  fs.mkdirSync(path.dirname(OUT_CSV), { recursive: true })
  fs.writeFileSync(OUT_CSV, lines.join('\n') + '\n')
}

function makeGeneratedPoi(zone, name, idx) {
  const idBase = slugify(name)
  const id = idBase || `${zone.key}-${idx + 1}`
  const lat = clamp(zone.center[0] + jitter(`${zone.key}:${id}:lat`, zone.spread[0]), 45.6, 48.1)
  const lon = clamp(zone.center[1] + jitter(`${zone.key}:${id}:lon`, zone.spread[1]), 5.7, 10.8)
  const altRange = Math.max(1, zone.alt[1] - zone.alt[0])
  const altitude_m = zone.alt[0] + (hash(`${zone.key}:${id}:alt`) % (altRange + 1))
  const types = pickTypes(`${zone.key}:${id}`, zone.typePool)

  return {
    id,
    name,
    region: zone.region,
    country: zone.country,
    lat,
    lon,
    altitude_m,
    types,
    plan_template: inferPlan(types),
    maps_url: `https://maps.google.com/?q=${lat.toFixed(5)},${lon.toFixed(5)}`,
    sbb_url: 'https://www.sbb.ch/en',
    webcam_url: '',
    status: 'candidate',
  }
}

function summarize(rows) {
  const out = { CH: 0, DE: 0, FR: 0 }
  for (const r of rows) out[r.country] += 1
  return out
}

function main() {
  const existing = parseExistingDestinations()

  const byId = new Map()
  for (const d of existing) {
    const row = toRow({ ...d, status: 'baseline' })
    byId.set(row.id.toLowerCase(), row)
  }

  const addPoi = (poi) => {
    const row = toRow(poi)
    const key = row.id.toLowerCase()
    if (!key) return false
    if (byId.has(key)) return false
    byId.set(key, row)
    return true
  }

  for (const zone of CH_ZONES) {
    zone.featured.forEach((name, idx) => addPoi(makeGeneratedPoi(zone, name, idx)))
  }

  for (const zone of BORDER_ZONES) {
    zone.featured.forEach((name, idx) => addPoi(makeGeneratedPoi(zone, name, idx)))
  }

  const countCountry = (c) => Array.from(byId.values()).filter(r => r.country === c).length

  const fillerByZone = new Map()
  const addFillerForZone = (zone) => {
    const next = (fillerByZone.get(zone.key) || 0) + 1
    fillerByZone.set(zone.key, next)
    const name = `${zone.region} Panorama ${String(next).padStart(2, '0')}`
    return addPoi(makeGeneratedPoi(zone, name, next + 999))
  }

  let guard = 0
  while (countCountry('CH') < TARGET_CH && guard < 5000) {
    for (const zone of CH_ZONES) {
      addFillerForZone(zone)
      if (countCountry('CH') >= TARGET_CH) break
    }
    guard += 1
  }

  guard = 0
  while (countCountry('DE') + countCountry('FR') < TARGET_BORDER && guard < 5000) {
    for (const zone of BORDER_ZONES) {
      addFillerForZone(zone)
      if (countCountry('DE') + countCountry('FR') >= TARGET_BORDER) break
    }
    guard += 1
  }

  const rows = Array.from(byId.values()).sort((a, b) => {
    const ca = COUNTRY_ORDER.indexOf(a.country)
    const cb = COUNTRY_ORDER.indexOf(b.country)
    if (ca !== cb) return ca - cb
    if (a.region !== b.region) return a.region.localeCompare(b.region, 'de-CH')
    return a.name.localeCompare(b.name, 'de-CH')
  })

  writeCsv(rows)

  const totals = summarize(rows)
  console.log(`Wrote ${rows.length} rows -> ${path.relative(ROOT, OUT_CSV)}`)
  console.log(`CH=${totals.CH} DE=${totals.DE} FR=${totals.FR} BORDER=${totals.DE + totals.FR}`)
}

main()
