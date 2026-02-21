type StampType = 'mountain' | 'lake' | 'town' | 'thermal' | 'ski' | 'viewpoint' | 'default'
type CountryCode = 'CH' | 'DE' | 'FR' | 'IT'
type StampFeatures = {
  lake: boolean
  rail: boolean
  town: boolean
  thermal: boolean
  forest: boolean
  snow: boolean
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

function detectFeatures(type: StampType, text: string, altitude = 0): StampFeatures {
  const lake = /\blake|see|lac|lago|shore|river|rhein|rhine|water\b/i.test(text) || type === 'lake'
  const rail = /\btrain|rail|bahn|funicular|gondola|cable car|sbb\b/i.test(text)
  const town = /\btown|city|old town|village|castle|burg|chateau\b/i.test(text) || type === 'town'
  const thermal = /\bthermal|spa|bath|wellness|terme\b/i.test(text) || type === 'thermal'
  const forest = /\bforest|wald|foret|pine|fir|wood\b/i.test(text)
  const snow = type === 'ski' || altitude >= 1650 || /\bski|snow|glacier\b/i.test(text)
  return { lake, rail, town, thermal, forest, snow }
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
  const horizon = 50 + Math.round(seeded(seed, 11) * 7)
  const farLift = Math.round(seeded(seed, 17) * 6)
  const midLift = Math.round(seeded(seed, 23) * 8)
  const nearLift = Math.round(seeded(seed, 29) * 10)
  const sunX = 70 + Math.round(seeded(seed, 31) * 14)
  const sunY = 20 + Math.round(seeded(seed, 37) * 8)
  const lakeY = horizon + 20
  const railY = horizon + 18

  const farRidge = [
    `M6 ${horizon + 8}`,
    `C 20 ${horizon - 10 - farLift}, 33 ${horizon - 8 + farLift}, 48 ${horizon - 12 - farLift}`,
    `C 62 ${horizon - 6 + farLift}, 77 ${horizon - 9 - farLift}, 94 ${horizon + 6}`,
    'L 94 80 L 6 80 Z',
  ].join(' ')

  const midRidge = [
    `M6 ${horizon + 14}`,
    `C 17 ${horizon + 4 - midLift}, 28 ${horizon + 6 + midLift}, 42 ${horizon + 2 - midLift}`,
    `C 58 ${horizon + 7 + midLift}, 76 ${horizon + 2 - midLift}, 94 ${horizon + 14}`,
    'L 94 80 L 6 80 Z',
  ].join(' ')

  const nearRidge = [
    `M6 ${horizon + 24}`,
    `C 20 ${horizon + 9 - nearLift}, 37 ${horizon + 15 + nearLift}, 52 ${horizon + 8 - nearLift}`,
    `C 66 ${horizon + 16 + nearLift}, 80 ${horizon + 8 - nearLift}, 94 ${horizon + 24}`,
    'L 94 80 L 6 80 Z',
  ].join(' ')

  const lakePath = [
    `M6 ${lakeY}`,
    `C 23 ${lakeY - 4}, 39 ${lakeY + 5}, 55 ${lakeY + 1}`,
    `C 69 ${lakeY - 2}, 80 ${lakeY + 2}, 94 ${lakeY}`,
    'L 94 80 L 6 80 Z',
  ].join(' ')

  const railTrack1 = `M6 ${railY} C 25 ${railY - 6}, 48 ${railY + 5}, 94 ${railY - 2}`
  const railTrack2 = `M6 ${railY + 2.8} C 25 ${railY - 3.2}, 48 ${railY + 7.8}, 94 ${railY + 0.8}`

  return (
    <g>
      <circle cx={sunX} cy={sunY} r="11.2" fill={palette.sun} opacity="0.92" />
      <path d={farRidge} fill={palette.ridgeFar} />
      <path d={midRidge} fill={palette.ridgeMid} />
      <path d={nearRidge} fill={palette.ridgeNear} />

      {features.snow && (
        <g fill={palette.snow} opacity="0.92">
          <path d={`M34 ${horizon - 10} L39 ${horizon - 1} L30 ${horizon - 1} Z`} />
          <path d={`M56 ${horizon - 14} L62 ${horizon - 3} L51 ${horizon - 3} Z`} />
          <path d={`M73 ${horizon - 11} L78 ${horizon - 2} L69 ${horizon - 2} Z`} />
        </g>
      )}

      <path d={`M6 ${horizon + 26} C 24 ${horizon + 20}, 45 ${horizon + 29}, 64 ${horizon + 22} C 75 ${horizon + 19}, 84 ${horizon + 23}, 94 ${horizon + 25} L94 80 L6 80 Z`} fill={palette.meadow} opacity="0.78" />

      {features.lake && <path d={lakePath} fill={palette.water} opacity="0.85" />}

      {features.rail && (
        <g>
          <path d={railTrack1} stroke={palette.rail} strokeWidth="1.6" strokeLinecap="round" fill="none" />
          <path d={railTrack2} stroke={palette.rail} strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.85" />
          <path d="M10 66h4M19 65h4M28 66h4M38 67h4M49 68h4M61 68h4M73 67h4M84 66h4" stroke={palette.rail} strokeWidth="1.05" strokeLinecap="round" opacity="0.66" />
        </g>
      )}

      {features.town && (
        <g opacity="0.95">
          <path d={`M18 ${horizon + 23} L22 ${horizon + 19} L26 ${horizon + 23} Z`} fill={palette.roof} />
          <rect x="19.4" y={horizon + 23} width="5.1" height="4.8" fill={mixHex(palette.roof, '#FFFFFF', 0.25)} />
          <path d={`M28 ${horizon + 23} L32 ${horizon + 18} L37 ${horizon + 23} Z`} fill={palette.roof} />
          <rect x="29.8" y={horizon + 23} width="5.8" height="5.8" fill={mixHex(palette.roof, '#FFFFFF', 0.22)} />
          <path d={`M39 ${horizon + 23} L43 ${horizon + 15} L47 ${horizon + 23} Z`} fill={palette.roof} />
          <rect x="41.2" y={horizon + 23} width="4.3" height="7.2" fill={mixHex(palette.roof, '#FFFFFF', 0.2)} />
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
    ...types,
    ...tourismTags,
    ...tourismHighlights,
  ].join(' ')
  const seed = hashCode(`${destinationId || safeName}|${country}|${regionCode}|${type}|${contextText.toLowerCase()}`)
  const palette = pickPalette(country, seed, cantonCode)
  const features = detectFeatures(type, contextText, altitude)
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
