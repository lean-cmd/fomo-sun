type StampType = 'mountain' | 'lake' | 'town' | 'thermal' | 'ski' | 'viewpoint' | 'default'
type CountryCode = 'CH' | 'DE' | 'FR' | 'IT'
type CityVariant = 'none' | 'generic' | 'basel' | 'bern' | 'zurich' | 'geneva'
type StampFeatures = {
  lake: boolean
  rail: boolean
  town: boolean
  thermal: boolean
  forest: boolean
  snow: boolean
  alpine: boolean
  cableCar: boolean
  river: boolean
  cityVariant: CityVariant
  stMoritz: boolean
}

interface StampProps {
  name: string
  destinationId?: string
  altitude?: number
  region?: string
  type: StampType
  country?: CountryCode
  types?: string[]
  description?: string
  planTemplate?: string
  tourismTags?: string[]
  tourismHighlights?: string[]
  className?: string
}

type PosterPalette = {
  paper: string
  frame: string
  skyTop: string
  skyBottom: string
  sun: string
  ridgeFar: string
  ridgeMid: string
  ridgeNear: string
  meadow: string
  water: string
  rail: string
  roof: string
  text: string
  subtext: string
  snow: string
}

const COUNTRY_PALETTES: Record<CountryCode, PosterPalette[]> = {
  CH: [
    {
      paper: '#F4EBDD',
      frame: '#7A5A40',
      skyTop: '#6A8CB4',
      skyBottom: '#A8C2D8',
      sun: '#E4B15A',
      ridgeFar: '#7B8D92',
      ridgeMid: '#5C6F7A',
      ridgeNear: '#3F5563',
      meadow: '#7A966D',
      water: '#4C7A98',
      rail: '#60493E',
      roof: '#93473A',
      text: '#1F2937',
      subtext: '#475569',
      snow: '#F7F7F5',
    },
    {
      paper: '#F3EBDD',
      frame: '#6E5340',
      skyTop: '#577BA0',
      skyBottom: '#9FC2DB',
      sun: '#E1A354',
      ridgeFar: '#7D8F96',
      ridgeMid: '#597183',
      ridgeNear: '#2F475C',
      meadow: '#6F8F63',
      water: '#3E6E8F',
      rail: '#5A463B',
      roof: '#9C4D33',
      text: '#1E293B',
      subtext: '#4B5563',
      snow: '#F5F7FA',
    },
    {
      paper: '#F2E9DB',
      frame: '#6D553F',
      skyTop: '#5C7D9F',
      skyBottom: '#A2C6DE',
      sun: '#DBA05A',
      ridgeFar: '#7E8E94',
      ridgeMid: '#5C6A78',
      ridgeNear: '#364D60',
      meadow: '#6C8D6C',
      water: '#416F8C',
      rail: '#56443A',
      roof: '#8B4335',
      text: '#1F2A37',
      subtext: '#475569',
      snow: '#F6F8FA',
    },
  ],
  DE: [
    {
      paper: '#F2EADF',
      frame: '#6A4A34',
      skyTop: '#5D7A9E',
      skyBottom: '#A7BFD6',
      sun: '#D49D56',
      ridgeFar: '#7A8891',
      ridgeMid: '#576873',
      ridgeNear: '#334654',
      meadow: '#76885E',
      water: '#456B87',
      rail: '#514036',
      roof: '#8D3F33',
      text: '#1F2937',
      subtext: '#4B5563',
      snow: '#F5F6F8',
    },
    {
      paper: '#EEE6D8',
      frame: '#66503C',
      skyTop: '#4F7098',
      skyBottom: '#9BB8D1',
      sun: '#D9A35D',
      ridgeFar: '#75858D',
      ridgeMid: '#566874',
      ridgeNear: '#314552',
      meadow: '#6B8659',
      water: '#3E6785',
      rail: '#4F3D33',
      roof: '#7F3A2F',
      text: '#1F2937',
      subtext: '#52525B',
      snow: '#F6F7F8',
    },
  ],
  FR: [
    {
      paper: '#F3ECE2',
      frame: '#6C513B',
      skyTop: '#5D78A4',
      skyBottom: '#A8C0D8',
      sun: '#D8A963',
      ridgeFar: '#7F8B8E',
      ridgeMid: '#5D6A74',
      ridgeNear: '#364B5C',
      meadow: '#789068',
      water: '#497091',
      rail: '#5A463A',
      roof: '#9B493A',
      text: '#22303C',
      subtext: '#4B5563',
      snow: '#F7F8FB',
    },
    {
      paper: '#F0E8DD',
      frame: '#6F5640',
      skyTop: '#52739C',
      skyBottom: '#9DBBD6',
      sun: '#DBA95E',
      ridgeFar: '#7C8C92',
      ridgeMid: '#576D7A',
      ridgeNear: '#334859',
      meadow: '#6F8B64',
      water: '#406C8C',
      rail: '#574336',
      roof: '#93443A',
      text: '#1F3348',
      subtext: '#52525B',
      snow: '#F7F7FA',
    },
  ],
  IT: [
    {
      paper: '#F4ECDF',
      frame: '#6A4F39',
      skyTop: '#5D7DA0',
      skyBottom: '#A9C8DF',
      sun: '#DFAD5A',
      ridgeFar: '#7C888E',
      ridgeMid: '#5A6B75',
      ridgeNear: '#344A57',
      meadow: '#789461',
      water: '#467290',
      rail: '#584538',
      roof: '#A34B39',
      text: '#1F2A37',
      subtext: '#4B5563',
      snow: '#F7F8FB',
    },
    {
      paper: '#F2EBDD',
      frame: '#705740',
      skyTop: '#5879A3',
      skyBottom: '#A1C4DE',
      sun: '#DDA555',
      ridgeFar: '#7A888D',
      ridgeMid: '#5A6870',
      ridgeNear: '#314554',
      meadow: '#718E5F',
      water: '#3F6F8D',
      rail: '#584436',
      roof: '#A14136',
      text: '#2A3442',
      subtext: '#52525B',
      snow: '#F7F9FA',
    },
  ],
}

const CANTON_ACCENT: Record<string, string> = {
  AG: '#9A3412',
  AI: '#7C2D12',
  AR: '#0F766E',
  BE: '#B45309',
  BL: '#9F1239',
  BS: '#A21CAF',
  FR: '#1D4ED8',
  GE: '#0F766E',
  GL: '#0E7490',
  GR: '#1E3A8A',
  JU: '#A16207',
  LU: '#A8432A',
  NE: '#374151',
  NW: '#0369A1',
  OW: '#14532D',
  SG: '#9F1239',
  SH: '#475569',
  SO: '#7C3AED',
  SZ: '#B91C1C',
  TG: '#0F766E',
  TI: '#B91C1C',
  UR: '#7C2D12',
  VD: '#1D4ED8',
  VS: '#9A3412',
  ZG: '#7C3AED',
  ZH: '#1D4ED8',
}

const STAMP_REGION_ALIAS: Record<string, string> = {
  'BERNESE OBERLAND': 'OBERLAND',
  'BERNER OBERLAND': 'OBERLAND',
  'EASTERN SWITZERLAND': 'EAST CH',
  'LAKE LUCERNE': 'LUCERNE',
  'LAKE MAGGIORE': 'MAGGIORE',
  'LAKE COMO': 'COMO',
  'BLACK FOREST': 'SCHWARZWALD',
  'FRENCH ALPS': 'ALPES FR',
  'LOWER ENGINADIN': 'ENGADIN',
  'LOWER ENGADIN': 'ENGADIN',
  'GRISONS': 'GRAUBUENDEN',
}

const SWISS_CANTON_HINTS: Array<{ pattern: RegExp; code: string }> = [
  { pattern: /\bAARGAU\b/i, code: 'AG' },
  { pattern: /\bBASEL\b|\bBASEL UPLANDS\b/i, code: 'BL' },
  { pattern: /\bBERN|\bBERNESE|\bBERNER\b/i, code: 'BE' },
  { pattern: /\bFRIBOURG\b/i, code: 'FR' },
  { pattern: /\bGENEVA\b|\bGENEVE\b/i, code: 'GE' },
  { pattern: /\bGRAUBUNDEN\b|\bGRISONS\b|\bENGADIN\b/i, code: 'GR' },
  { pattern: /\bJURA\b/i, code: 'JU' },
  { pattern: /\bLUZERN\b|\bLUCERNE\b/i, code: 'LU' },
  { pattern: /\bNEUCHATEL\b/i, code: 'NE' },
  { pattern: /\bOBWALDEN\b/i, code: 'OW' },
  { pattern: /\bSCHAFFHAUSEN\b/i, code: 'SH' },
  { pattern: /\bSCHWYZ\b/i, code: 'SZ' },
  { pattern: /\bSOLOTHURN\b/i, code: 'SO' },
  { pattern: /\bST\.\s*GALLEN\b|\bSANKT GALLEN\b/i, code: 'SG' },
  { pattern: /\bTHURGAU\b/i, code: 'TG' },
  { pattern: /\bTICINO\b|\bLUGANO\b|\bLOCARNO\b|\bASCONA\b/i, code: 'TI' },
  { pattern: /\bURI\b/i, code: 'UR' },
  { pattern: /\bVAUD\b|\bLAUSANNE\b|\bMONTREUX\b|\bLAVAUX\b/i, code: 'VD' },
  { pattern: /\bVALAIS\b|\bWALLIS\b|\bZERMATT\b/i, code: 'VS' },
  { pattern: /\bZUG\b/i, code: 'ZG' },
  { pattern: /\bZURICH\b/i, code: 'ZH' },
]

function sanitizeId(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'stamp'
}

function hashCode(seed: string) {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seeded(seed: number, salt = 0) {
  const mixed = Math.imul(seed ^ (salt * 374761393), 668265263) >>> 0
  return (mixed % 1000) / 1000
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function hexToRgb(hex: string) {
  const m = hex.replace('#', '')
  const safe = m.length === 3
    ? m.split('').map((ch) => `${ch}${ch}`).join('')
    : m
  const int = Number.parseInt(safe, 16)
  const r = (int >> 16) & 255
  const g = (int >> 8) & 255
  const b = int & 255
  return { r, g, b }
}

function rgbToHex(r: number, g: number, b: number) {
  const to = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0')
  return `#${to(r)}${to(g)}${to(b)}`
}

function mixHex(a: string, b: string, t: number) {
  const aa = hexToRgb(a)
  const bb = hexToRgb(b)
  const p = clamp(t, 0, 1)
  return rgbToHex(
    aa.r + (bb.r - aa.r) * p,
    aa.g + (bb.g - aa.g) * p,
    aa.b + (bb.b - aa.b) * p
  )
}

function stampNameStyle(name: string) {
  const len = name.length
  if (len >= 18) return { size: 12.6, spacing: 0.85 }
  if (len >= 14) return { size: 14.4, spacing: 1.02 }
  if (len >= 11) return { size: 16.1, spacing: 1.2 }
  return { size: 18.2, spacing: 1.5 }
}

function stampRegionLabel(region?: string, maxChars = 20) {
  const raw = (region || '').trim().toUpperCase()
  if (!raw) return ''
  const alias = STAMP_REGION_ALIAS[raw]
  if (alias) return alias
  if (raw.length <= maxChars) return raw

  const words = raw.split(/\s+/).filter(Boolean)
  if (words.length >= 2) {
    const firstTwo = `${words[0]} ${words[1]}`
    if (firstTwo.length <= maxChars) return firstTwo
    if (words[0].length <= maxChars) return words[0]
    return words[0].slice(0, maxChars)
  }

  return words[0].slice(0, maxChars)
}

function swissCanton(region?: string) {
  const raw = (region || '').trim()
  if (!raw) return ''
  const withCode = raw.match(/(?:,\s*|\s+)([A-Z]{2})\b/)
  if (withCode?.[1]) return withCode[1]
  for (const hint of SWISS_CANTON_HINTS) {
    if (hint.pattern.test(raw)) return hint.code
  }
  return ''
}

function regionToken(country: CountryCode, region?: string) {
  if (country === 'CH') {
    const code = swissCanton(region)
    if (code) return code
  }

  const raw = (region || '').trim().toUpperCase()
  if (!raw) return country
  const words = raw
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  if (!words.length) return country
  if (words.length === 1) return words[0].slice(0, 3)
  return `${words[0][0]}${words[1][0]}${words[0].slice(1, 2)}`
}

function detectFeatures(type: StampType, text: string, altitude = 0, destinationId = '', destinationName = ''): StampFeatures {
  const id = (destinationId || '').toLowerCase()
  const cityName = destinationName || ''
  const matchesBasel = id === 'basel' || /\bbasel\b/i.test(cityName)
  const matchesBern = id === 'bern' || /\bbern\b/i.test(cityName)
  const matchesZurich = id === 'zurich' || /\bzurich\b|\bzuerich\b/i.test(cityName)
  const matchesGeneva = id === 'geneva' || /\bgeneva\b|\bgeneve\b/i.test(cityName)
  const stMoritz = id === 'st-moritz' || /\bst\.?\s*moritz\b/i.test(cityName)

  const river = /\briver|riverside|rhine|rhein|aare|limmat|rhone|rhône|fluss|fleuve\b/i.test(text)
  const lake = /\blake|see|lac|lago|shore|waterfront|harbor|harbour\b/i.test(text) || type === 'lake' || river
  const rail = /\btrain|rail|bahn|sbb|tram|cogwheel|rack railway|glacier express\b/i.test(text)
  const cableCar = /\bcable car|gondola|funicular|lift|seilbahn|telepherique|funivia|aerial\b/i.test(text)
  const townLike = /\btown|city|old town|village|castle|burg|chateau|skyline|arcade\b/i.test(text) || type === 'town'
  const thermal = /\bthermal|spa|bath|wellness|terme\b/i.test(text) || type === 'thermal'
  const forest = /\bforest|wald|foret|pine|fir|wood\b/i.test(text)
  const alpine = type === 'ski'
    || altitude >= 1450
    || /\balp|alpine|summit|ridge|peak|glacier|high altitude|panorama\b/i.test(text)
    || stMoritz
  const snow = type === 'ski' || altitude >= 1650 || /\bski|snow|glacier|winter\b/i.test(text) || (alpine && altitude >= 1500)

  let cityVariant: CityVariant = 'none'
  if (matchesBasel) cityVariant = 'basel'
  else if (matchesBern) cityVariant = 'bern'
  else if (matchesZurich) cityVariant = 'zurich'
  else if (matchesGeneva) cityVariant = 'geneva'
  else if (townLike) cityVariant = 'generic'

  return {
    lake,
    rail: rail || cableCar,
    town: townLike || cityVariant !== 'none',
    thermal,
    forest,
    snow,
    alpine,
    cableCar,
    river,
    cityVariant,
    stMoritz,
  }
}

function pickPalette(country: CountryCode, seed: number, cantonCode: string): PosterPalette {
  const variants = COUNTRY_PALETTES[country] || COUNTRY_PALETTES.CH
  const base = variants[seed % variants.length]
  if (country !== 'CH') return base
  const tint = CANTON_ACCENT[cantonCode]
  if (!tint) return base
  return {
    ...base,
    skyBottom: mixHex(base.skyBottom, tint, 0.14),
    meadow: mixHex(base.meadow, tint, 0.16),
    water: mixHex(base.water, tint, 0.18),
    roof: mixHex(base.roof, tint, 0.2),
  }
}

function renderScene(seed: number, palette: PosterPalette, features: StampFeatures) {
  const horizon = 49 + Math.round(seeded(seed, 11) * 8)
  const mountainScale = features.alpine ? 1.4 : 1
  const sunX = 68 + Math.round(seeded(seed, 31) * 16)
  const sunY = 16 + Math.round(seeded(seed, 37) * 9)
  const lakeY = horizon + 20
  const railY = horizon + 29
  const riverY = horizon + 28
  const skylineY = horizon + 22

  const ridgePoints = (baseY: number, amplitude: number, salt: number) => {
    const points: Array<{ x: number; y: number }> = []
    for (let i = 0; i < 8; i += 1) {
      const x = 6 + (88 / 7) * i
      const wave = Math.sin((i / 7) * Math.PI * (2.1 + seeded(seed, salt + 50) * 0.95))
      const noise = (seeded(seed, salt + i * 7) - 0.5) * amplitude * 0.34
      const sharp = i % 2 === 0 ? 1.15 : 0.72
      const y = clamp(baseY - Math.max(0, wave) * amplitude * sharp + noise, 8, 78)
      points.push({ x, y: Number(y.toFixed(2)) })
    }
    return points
  }

  const toRidgePath = (points: Array<{ x: number; y: number }>) => {
    const line = points
      .map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`)
      .join(' ')
    return `${line} L94 80 L6 80 Z`
  }

  const farPoints = ridgePoints(horizon + 8, (9 + seeded(seed, 17) * 5) * mountainScale, 101)
  const midPoints = ridgePoints(horizon + 14, (14 + seeded(seed, 23) * 6) * mountainScale, 171)
  const nearPoints = ridgePoints(horizon + 23, (20 + seeded(seed, 29) * 8) * mountainScale, 241)
  const farRidge = toRidgePath(farPoints)
  const midRidge = toRidgePath(midPoints)
  const nearRidge = toRidgePath(nearPoints)

  const lakePath = [
    `M6 ${lakeY}`,
    `C 23 ${lakeY - 4}, 39 ${lakeY + 5}, 55 ${lakeY + 1}`,
    `C 69 ${lakeY - 2}, 80 ${lakeY + 2}, 94 ${lakeY}`,
    'L 94 80 L 6 80 Z',
  ].join(' ')

  const meadowPath = [
    `M6 ${horizon + 26}`,
    `C 18 ${horizon + 20}, 34 ${horizon + 29}, 48 ${horizon + 22}`,
    `C 63 ${horizon + 16}, 77 ${horizon + 27}, 94 ${horizon + 24}`,
    'L94 80 L6 80 Z',
  ].join(' ')

  const snowPeaks = [...midPoints, ...nearPoints]
    .sort((a, b) => a.y - b.y)
    .slice(0, features.alpine ? 6 : 3)

  const railColor = mixHex(palette.ridgeNear, '#DBE4EF', 0.42)
  const sleeperColor = mixHex(railColor, '#0F172A', 0.24)
  const railStartX = 8
  const railEndX = 92
  const railSlope = -2 / (railEndX - railStartX)

  const cableX1 = 12
  const cableY1 = features.alpine ? 35 : 38
  const cableX2 = 88
  const cableY2 = features.alpine ? 22 : 27
  const cableYAt = (x: number) => cableY1 + ((x - cableX1) / (cableX2 - cableX1)) * (cableY2 - cableY1)

  const skylineBase = mixHex(palette.ridgeNear, '#0F172A', 0.22)
  const skylineAccent = mixHex(skylineBase, '#E2E8F0', 0.16)
  const riverColor = mixHex(palette.water, '#A3BCD3', 0.1)

  return (
    <g>
      <circle cx={sunX} cy={sunY} r="11.2" fill={palette.sun} opacity="0.92" />
      <path d={farRidge} fill={palette.ridgeFar} />
      <path d={midRidge} fill={palette.ridgeMid} />
      <path d={nearRidge} fill={palette.ridgeNear} />

      {features.snow && (
        <g fill={palette.snow} opacity={features.alpine ? 0.95 : 0.9}>
          {snowPeaks.map((peak, idx) => {
            const width = features.alpine ? 3.2 : 2.5
            const depth = features.alpine ? 4.5 : 3.3
            const drift = (seeded(seed, 400 + idx) - 0.5) * 1.1
            const x = peak.x + drift
            const y = peak.y + 0.8
            return (
              <path
                key={`snow-${idx}`}
                d={`M${(x - width).toFixed(1)} ${(y + depth).toFixed(1)} L${x.toFixed(1)} ${y.toFixed(1)} L${(x + width).toFixed(1)} ${(y + depth).toFixed(1)} Z`}
              />
            )
          })}
        </g>
      )}

      <path d={meadowPath} fill={palette.meadow} opacity="0.8" />

      {(features.lake || features.river) && (
        <path d={lakePath} fill={palette.water} opacity="0.86" />
      )}

      {features.cityVariant === 'basel' && (
        <g opacity="0.98">
          <path d={`M6 ${riverY} C 23 ${riverY - 3.4}, 45 ${riverY + 2.7}, 94 ${riverY - 1.6} L 94 80 L 6 80 Z`} fill={riverColor} />
          <g fill={skylineBase}>
            <rect x="12" y={skylineY - 4} width="7" height="4" />
            <rect x="20.5" y={skylineY - 7} width="6" height="7" />
            <rect x="28.5" y={skylineY - 5} width="8" height="5" />
            <rect x="39" y={skylineY - 8} width="6.5" height="8" />
            <rect x="47.5" y={skylineY - 6} width="7.5" height="6" />
            <path d={`M66 ${skylineY + 1} L66 ${skylineY - 11} L69.9 ${skylineY - 13} L69.9 ${skylineY + 1} Z`} fill={skylineAccent} />
            <path d={`M72 ${skylineY + 1} L72 ${skylineY - 10} L75.9 ${skylineY - 12} L75.9 ${skylineY + 1} Z`} fill={skylineAccent} />
          </g>
          <g>
            <path d={`M30 ${riverY - 0.9} h11 l-1.7 2.8 h-7.6 z`} fill={mixHex(palette.roof, '#FFFFFF', 0.16)} />
            <path d={`M34.8 ${riverY - 3.4} l2.2 0.9 l-0.7 2 h-1.5 z`} fill={mixHex(palette.frame, '#E2E8F0', 0.22)} />
          </g>
        </g>
      )}

      {features.cityVariant === 'bern' && (
        <g opacity="0.98">
          <path d={`M6 ${riverY + 0.5} C 23 ${riverY - 2.2}, 44 ${riverY + 2.9}, 94 ${riverY - 1.1} L 94 80 L 6 80 Z`} fill={riverColor} />
          <g fill={skylineBase}>
            <rect x="16" y={skylineY - 4} width="7.2" height="4" />
            <rect x="24.5" y={skylineY - 7} width="5.6" height="7" />
            <rect x="31.4" y={skylineY - 5} width="8.3" height="5" />
            <rect x="41.2" y={skylineY - 6.5} width="6.2" height="6.5" />
            <path d={`M52 ${skylineY + 1} L52 ${skylineY - 11} L54.2 ${skylineY - 16} L56.4 ${skylineY - 11} L56.4 ${skylineY + 1} Z`} fill={skylineAccent} />
          </g>
        </g>
      )}

      {features.cityVariant === 'zurich' && (
        <g opacity="0.98">
          <path d={`M6 ${riverY + 0.9} C 24 ${riverY - 2.5}, 46 ${riverY + 2.6}, 94 ${riverY - 1.3} L 94 80 L 6 80 Z`} fill={riverColor} />
          <g fill={skylineBase}>
            <rect x="14" y={skylineY - 4} width="8" height="4" />
            <rect x="23.8" y={skylineY - 6} width="6.3" height="6" />
            <rect x="32.4" y={skylineY - 8} width="5.5" height="8" />
            <path d={`M42 ${skylineY + 1} L42 ${skylineY - 8} L44.3 ${skylineY - 12} L46.6 ${skylineY - 8} L46.6 ${skylineY + 1} Z`} fill={skylineAccent} />
            <path d={`M49.8 ${skylineY + 1} L49.8 ${skylineY - 8} L52.1 ${skylineY - 12} L54.4 ${skylineY - 8} L54.4 ${skylineY + 1} Z`} fill={skylineAccent} />
            <rect x="58" y={skylineY - 5} width="7.8" height="5" />
          </g>
        </g>
      )}

      {features.cityVariant === 'geneva' && (
        <g opacity="0.98">
          <path d={`M6 ${riverY + 1.3} C 24 ${riverY - 2}, 48 ${riverY + 2.2}, 94 ${riverY - 1.2} L 94 80 L 6 80 Z`} fill={riverColor} />
          <g fill={skylineBase}>
            <rect x="16" y={skylineY - 4} width="8.2" height="4" />
            <rect x="25.8" y={skylineY - 6.6} width="6" height="6.6" />
            <rect x="33.5" y={skylineY - 5} width="7.1" height="5" />
            <rect x="43.2" y={skylineY - 7.2} width="5.3" height="7.2" />
            <rect x="50" y={skylineY - 5.4} width="8" height="5.4" />
          </g>
          <path d={`M63 ${riverY - 0.3} C63 ${riverY - 9.5}, 66.6 ${riverY - 15.2}, 64.8 ${riverY - 20}`} stroke={mixHex(palette.water, '#FFFFFF', 0.45)} strokeWidth="1.1" fill="none" strokeLinecap="round" opacity="0.85" />
        </g>
      )}

      {features.cityVariant === 'generic' && (
        <g opacity="0.96">
          {features.river && (
            <path d={`M6 ${riverY + 0.8} C 24 ${riverY - 2.2}, 46 ${riverY + 2.4}, 94 ${riverY - 1.1} L 94 80 L 6 80 Z`} fill={riverColor} />
          )}
          <g fill={skylineBase}>
            <rect x="18" y={skylineY - 4.4} width="8.5" height="4.4" />
            <rect x="28.3" y={skylineY - 7} width="6.1" height="7" />
            <rect x="36.5" y={skylineY - 5.2} width="9" height="5.2" />
            <rect x="47.4" y={skylineY - 8.2} width="5.8" height="8.2" />
          </g>
        </g>
      )}

      {features.rail && (
        <g opacity="0.9">
          <path d={`M${railStartX} ${railY} L${railEndX} ${railY - 2}`} stroke={railColor} strokeWidth="1.4" strokeLinecap="round" fill="none" />
          <path d={`M${railStartX} ${railY + 2.1} L${railEndX} ${railY + 0.1}`} stroke={railColor} strokeWidth="1.15" strokeLinecap="round" fill="none" />
          {Array.from({ length: 8 }).map((_, idx) => {
            const x = 12 + idx * 10.5
            const y1 = railY + (x - railStartX) * railSlope
            return (
              <path
                key={`sleeper-${idx}`}
                d={`M${x.toFixed(1)} ${(y1 - 0.2).toFixed(1)} L${x.toFixed(1)} ${(y1 + 2.6).toFixed(1)}`}
                stroke={sleeperColor}
                strokeWidth="0.9"
                strokeLinecap="round"
              />
            )
          })}
        </g>
      )}

      {features.cableCar && (
        <g opacity="0.94">
          <path d={`M${cableX1} ${cableY1} L${cableX2} ${cableY2}`} stroke={mixHex(palette.frame, '#E2E8F0', 0.3)} strokeWidth="1.1" strokeLinecap="round" />
          <path d={`M${cableX1} ${cableY1} L${cableX1} ${cableY1 + 10}`} stroke={mixHex(palette.frame, '#0F172A', 0.15)} strokeWidth="1" />
          <path d={`M${cableX2} ${cableY2} L${cableX2} ${cableY2 + 9}`} stroke={mixHex(palette.frame, '#0F172A', 0.15)} strokeWidth="1" />
          {[42, 63].map((x, idx) => {
            const y = cableYAt(x)
            return (
              <g key={`cabin-${idx}`}>
                <path d={`M${x} ${y.toFixed(1)} L${x} ${(y + 3.6).toFixed(1)}`} stroke={mixHex(palette.frame, '#E2E8F0', 0.35)} strokeWidth="0.8" />
                <rect
                  x={(x - 2.6).toFixed(1)}
                  y={(y + 3.4).toFixed(1)}
                  width="5.2"
                  height="3.7"
                  rx="0.8"
                  fill={mixHex(palette.roof, '#E2E8F0', 0.18)}
                />
              </g>
            )
          })}
        </g>
      )}

      {features.stMoritz && (
        <g opacity="0.96">
          <circle cx="72" cy={horizon + 11} r="3.9" fill="#EBC0A1" />
          <rect x="68.7" y={horizon + 10.2} width="6.8" height="2.2" rx="1.1" fill={mixHex(palette.water, '#0F172A', 0.3)} />
          <path d={`M67 ${horizon + 18.2} C 69 ${horizon + 15.4}, 75 ${horizon + 15.3}, 78 ${horizon + 18.2} L 75.5 ${horizon + 24.5} L 69.5 ${horizon + 24.5} Z`} fill={mixHex(palette.roof, '#FFFFFF', 0.12)} />
          <path d={`M66.5 ${horizon + 25} L79.4 ${horizon + 31.2}`} stroke={mixHex(palette.frame, '#E2E8F0', 0.2)} strokeWidth="1.1" strokeLinecap="round" />
          <path d={`M65.2 ${horizon + 26.2} L78.2 ${horizon + 32.2}`} stroke={mixHex(palette.frame, '#F8FAFC', 0.24)} strokeWidth="1.05" strokeLinecap="round" />
        </g>
      )}

      {features.town && features.cityVariant === 'none' && (
        <g opacity="0.94">
          <path d={`M18 ${horizon + 23} L22 ${horizon + 19} L26 ${horizon + 23} Z`} fill={palette.roof} />
          <rect x="19.4" y={horizon + 23} width="5.1" height="4.8" fill={mixHex(palette.roof, '#FFFFFF', 0.25)} />
          <path d={`M28 ${horizon + 23} L32 ${horizon + 18} L37 ${horizon + 23} Z`} fill={palette.roof} />
          <rect x="29.8" y={horizon + 23} width="5.8" height="5.8" fill={mixHex(palette.roof, '#FFFFFF', 0.22)} />
        </g>
      )}

      {features.forest && (
        <g fill={mixHex(palette.meadow, '#0F172A', 0.38)} opacity="0.95">
          <path d={`M68 ${horizon + 25} L71 ${horizon + 19} L74 ${horizon + 25} Z`} />
          <path d={`M73 ${horizon + 25} L76 ${horizon + 18} L79 ${horizon + 25} Z`} />
          <path d={`M78 ${horizon + 25} L81 ${horizon + 20} L84 ${horizon + 25} Z`} />
        </g>
      )}

      {features.thermal && (
        <g stroke={mixHex(palette.water, '#FFFFFF', 0.35)} strokeWidth="1.3" strokeLinecap="round" fill="none" opacity="0.86">
          <path d={`M74 ${horizon + 12}c2.2-3-1.2-5.2 0.7-8.1`} />
          <path d={`M79 ${horizon + 13}c2.2-3-1.2-5.2 0.7-8.1`} />
          <path d={`M84 ${horizon + 12}c2.2-3-1.2-5.2 0.7-8.1`} />
        </g>
      )}
    </g>
  )
}

function renderFlag(country: CountryCode) {
  if (country === 'CH') {
    return (
      <g>
        <rect x="76" y="8.5" width="14" height="14" rx="1" fill="#DA291C" />
        <rect x="81.35" y="10.6" width="3.3" height="9.7" fill="#F8FAFC" rx="0.45" />
        <rect x="78.2" y="13.8" width="9.6" height="3.3" fill="#F8FAFC" rx="0.45" />
      </g>
    )
  }
  if (country === 'DE') {
    return (
      <g>
        <rect x="72" y="10" width="18" height="12" rx="2.2" fill="#15181C" />
        <rect x="72" y="14" width="18" height="4" fill="#8F2D2D" />
        <rect x="72" y="18" width="18" height="4" fill="#C08A35" />
      </g>
    )
  }
  if (country === 'FR') {
    return (
      <g>
        <rect x="72" y="10" width="18" height="12" rx="2.2" fill="#F8FAFC" />
        <rect x="72" y="10" width="6" height="12" fill="#355D96" />
        <rect x="84" y="10" width="6" height="12" fill="#B14545" />
      </g>
    )
  }
  return (
    <g>
      <rect x="72" y="10" width="18" height="12" rx="2.2" fill="#F8FAFC" />
      <rect x="72" y="10" width="6" height="12" fill="#2F7D5C" />
      <rect x="84" y="10" width="6" height="12" fill="#B54848" />
    </g>
  )
}

export type { StampProps, StampType }

export function DestinationStamp({
  name,
  destinationId,
  altitude,
  region,
  type,
  country = 'CH',
  types = [],
  description = '',
  planTemplate = '',
  tourismTags = [],
  tourismHighlights = [],
  className = '',
}: StampProps) {
  const safeName = (name || 'DESTINATION').toUpperCase().slice(0, 24)
  const safeRegion = stampRegionLabel(region)
  const style = stampNameStyle(safeName)
  const cantonCode = country === 'CH' ? swissCanton(region) : ''
  const regionCode = regionToken(country, region)
  const contextText = [
    safeName,
    safeRegion,
    description,
    planTemplate,
    ...types,
    ...tourismTags,
    ...tourismHighlights,
  ].join(' ')
  const seed = hashCode(`${destinationId || safeName}|${country}|${regionCode}|${type}|${contextText.toLowerCase()}`)
  const palette = pickPalette(country, seed, cantonCode)
  const features = detectFeatures(type, contextText, altitude, destinationId || '', name || safeName)
  const idBase = sanitizeId(`${destinationId || safeName}-${country}-${regionCode}-${type}`)
  const grainId = `grain-${idBase}`
  const paperId = `paper-grad-${idBase}`
  const skyId = `sky-grad-${idBase}`
  const artClip = `art-clip-${idBase}`

  return (
    <svg
      viewBox="0 0 100 124"
      className={className}
      role="img"
      aria-label={`${safeName} destination stamp`}
    >
      <defs>
        <linearGradient id={paperId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={palette.paper} />
          <stop offset="100%" stopColor={mixHex(palette.paper, '#D6C8AF', 0.28)} />
        </linearGradient>
        <linearGradient id={skyId} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={palette.skyTop} />
          <stop offset="100%" stopColor={palette.skyBottom} />
        </linearGradient>
        <clipPath id={artClip}>
          <rect x="6" y="8" width="88" height="72" rx="3.2" />
        </clipPath>
        <filter id={grainId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grey" />
          <feBlend in="SourceGraphic" in2="grey" mode="multiply" />
        </filter>
      </defs>

      <rect x="1.5" y="1.5" width="97" height="121" rx="5" fill={`url(#${paperId})`} stroke={palette.frame} strokeWidth="1.5" strokeDasharray="4 3" />

      <g clipPath={`url(#${artClip})`}>
        <rect x="6" y="8" width="88" height="72" fill={`url(#${skyId})`} />
        {renderScene(seed, palette, features)}
      </g>

      <rect x="6" y="8" width="88" height="72" rx="3.2" fill="none" stroke={mixHex(palette.frame, '#FFFFFF', 0.28)} strokeWidth="0.8" />
      {renderFlag(country)}

      <text
        x="50"
        y="95"
        fill={palette.text}
        textAnchor="middle"
        fontSize={style.size}
        lengthAdjust="spacingAndGlyphs"
        textLength="84"
        style={{
          fontFamily: '"Bebas Neue", sans-serif',
          letterSpacing: `${style.spacing}px`,
        }}
      >
        {safeName}
      </text>

      <text
        x="50"
        y="107.2"
        fill={palette.subtext}
        textAnchor="middle"
        fontSize="7.8"
        style={{ fontFamily: '"Jost", sans-serif', fontWeight: 500, letterSpacing: '1.05px' }}
      >
        · {safeRegion || regionCode} ·
      </text>

      {country !== 'CH' && (
        <text
          x="50"
          y="114.2"
          fill={palette.subtext}
          textAnchor="middle"
          fontSize="6.2"
          style={{ fontFamily: '"Jost", sans-serif', fontWeight: 500, letterSpacing: '0.9px', opacity: 0.78 }}
        >
          {country} REGION {regionCode}
        </text>
      )}

      <rect
        x="3"
        y="3"
        width="94"
        height="118"
        rx="4"
        fill="#000"
        opacity="0.08"
        filter={`url(#${grainId})`}
      />
    </svg>
  )
}
