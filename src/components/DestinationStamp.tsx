type StampType = 'mountain' | 'lake' | 'town' | 'thermal' | 'ski' | 'viewpoint' | 'default'
type CountryCode = 'CH' | 'DE' | 'FR' | 'IT'
type StampMotif = 'sunburst' | 'rail' | 'castle' | 'forest' | 'wave' | 'spa'

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

type StampPalette = {
  paper: string
  paperShade: string
  ink: string
  accent: string
  accentMuted: string
  frame: string
  sun: string
}

const COUNTRY_PALETTES: Record<CountryCode, StampPalette[]> = {
  CH: [
    { paper: '#F4EBDD', paperShade: '#EBDCC6', ink: '#1F2937', accent: '#B45309', accentMuted: '#8A3B12', frame: '#7A5A40', sun: '#D8A047' },
    { paper: '#F2EDE2', paperShade: '#E5DCC9', ink: '#233447', accent: '#A33B2C', accentMuted: '#7F2D23', frame: '#71563F', sun: '#DAAE62' },
    { paper: '#F3EEE5', paperShade: '#E9DFCE', ink: '#22313F', accent: '#0F766E', accentMuted: '#155E75', frame: '#69523D', sun: '#D0A45D' },
  ],
  DE: [
    { paper: '#F2EADF', paperShade: '#E6D8C4', ink: '#1E293B', accent: '#B45309', accentMuted: '#7C2D12', frame: '#6A4A34', sun: '#D4A15A' },
    { paper: '#EFE8DD', paperShade: '#E2D4C1', ink: '#1F2937', accent: '#475569', accentMuted: '#334155', frame: '#66503C', sun: '#CFA061' },
  ],
  FR: [
    { paper: '#F3ECE2', paperShade: '#E8DBCA', ink: '#22303C', accent: '#9A3412', accentMuted: '#7C2D12', frame: '#6C513B', sun: '#D3A55F' },
    { paper: '#F1EBE0', paperShade: '#E6D9C6', ink: '#1F3348', accent: '#1D4E89', accentMuted: '#1E3A8A', frame: '#6F5640', sun: '#D9AF68' },
  ],
  IT: [
    { paper: '#F4ECDF', paperShade: '#E9DDC9', ink: '#1F2A37', accent: '#0F766E', accentMuted: '#14532D', frame: '#6A4F39', sun: '#D9A960' },
    { paper: '#F2EBDD', paperShade: '#E7D8C3', ink: '#2A3442', accent: '#9F1239', accentMuted: '#7A1130', frame: '#705740', sun: '#D3A053' },
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

function stampMotif(type: StampType, text: string): StampMotif {
  if (/\bthermal|spa|bath|wellness|terme\b/i.test(text) || type === 'thermal') return 'spa'
  if (/\blake|see|lac|lago|shore|river|rhein|rhine\b/i.test(text) || type === 'lake') return 'wave'
  if (/\bcastle|chateau|burg|fort\b/i.test(text) || type === 'town') return 'castle'
  if (/\btrain|rail|bahn|funicular|gondola\b/i.test(text)) return 'rail'
  if (/\bforest|wald|foret|pine|fir\b/i.test(text)) return 'forest'
  if (type === 'ski' || type === 'viewpoint' || type === 'mountain') return 'sunburst'
  return 'sunburst'
}

function pickPalette(country: CountryCode, seed: number, cantonCode: string) {
  const variants = COUNTRY_PALETTES[country] || COUNTRY_PALETTES.CH
  const base = variants[seed % variants.length]
  if (country !== 'CH') return base
  const cantonColor = CANTON_ACCENT[cantonCode]
  if (!cantonColor) return base
  return { ...base, accent: cantonColor }
}

function renderSilhouette(
  type: StampType,
  palette: StampPalette,
  seed: number,
  altitude?: number
) {
  const jitterA = Math.round(seeded(seed, 21) * 5)
  const jitterB = Math.round(seeded(seed, 37) * 5)
  const hasSnow = (altitude || 0) >= 1650 || type === 'ski'

  switch (type) {
    case 'mountain':
    case 'ski':
      return (
        <g>
          <path d={`M8 45 L24 ${25 + jitterA} L36 36 L53 ${17 + jitterB} L76 45 Z`} fill={palette.ink} />
          <path d={`M8 45 L20 ${32 + jitterA} L32 40 L47 ${28 + jitterB} L64 42 L76 45 Z`} fill={palette.accent} opacity="0.42" />
          {hasSnow && (
            <g fill="#F6F7F9" opacity="0.9">
              <path d={`M52 ${18 + jitterB} L58 ${27 + jitterB} L47 ${27 + jitterB} Z`} />
              <path d={`M24 ${26 + jitterA} L29 ${33 + jitterA} L20 ${33 + jitterA} Z`} />
            </g>
          )}
        </g>
      )
    case 'lake':
      return (
        <g>
          <path d={`M8 36 L24 ${24 + jitterA} L42 33 L60 ${22 + jitterB} L76 36 L76 45 L8 45 Z`} fill={palette.ink} opacity="0.86" />
          <path d="M11 47c5 0 6-2 11-2 5 0 6 2 11 2 5 0 6-2 11-2 5 0 6 2 11 2 5 0 6-2 11-2" fill="none" stroke={palette.accent} strokeWidth="2.3" strokeLinecap="round" />
        </g>
      )
    case 'town':
      return (
        <g>
          <path d="M8 45h68v6H8z" fill={palette.accent} opacity="0.24" />
          <path d={`M12 45 L21 ${36 + jitterA} L30 45 Z`} fill={palette.ink} />
          <path d={`M31 45 L40 ${33 + jitterB} L49 45 Z`} fill={palette.ink} />
          <path d={`M50 45 L57 ${37 + jitterA} L64 45 Z`} fill={palette.ink} />
          <path d="M66 45 L66 26 L71 20 L76 26 L76 45 Z" fill={palette.ink} />
        </g>
      )
    case 'thermal':
      return (
        <g>
          <path d="M8 45h68" stroke={palette.accent} strokeWidth="3.1" strokeLinecap="round" />
          <path d={`M24 42c3-5-2-8 1-${11 + jitterA}M40 42c3-5-2-8 1-${11 + jitterB}M56 42c3-5-2-8 1-13`} stroke={palette.ink} strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
      )
    case 'viewpoint':
      return (
        <g>
          <path d="M8 45 C20 31, 35 30, 50 36 C60 39, 68 42, 76 45 Z" fill={palette.ink} />
          <path d="M58 40v-11h6v11M56 29h10" stroke={palette.accent} strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )
    default:
      return (
        <g>
          <path d="M8 45h68" stroke={palette.ink} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M23 45a18 18 0 0 1 36 0" fill={palette.accent} />
        </g>
      )
  }
}

function renderMotif(motif: StampMotif, palette: StampPalette, seed: number) {
  const nudge = Math.round(seeded(seed, 84) * 3)
  if (motif === 'rail') {
    return (
      <g transform={`translate(${nudge},0)`}>
        <path d="M13 25h22" stroke={palette.accent} strokeWidth="1.8" strokeLinecap="round" />
        <path d="M15 27v5h18v-5z" fill={palette.accentMuted} />
        <circle cx="20" cy="33.8" r="1.2" fill={palette.ink} />
        <circle cx="28" cy="33.8" r="1.2" fill={palette.ink} />
      </g>
    )
  }
  if (motif === 'castle') {
    return (
      <g transform={`translate(${nudge},0)`}>
        <path d="M14 33h18v-10h-4v3h-3v-3h-4v3h-3v-3h-4z" fill={palette.accentMuted} />
        <rect x="21.5" y="28" width="3" height="5" fill={palette.paperShade} />
      </g>
    )
  }
  if (motif === 'forest') {
    return (
      <g transform={`translate(${nudge},0)`}>
        <path d="M16 34 L21 24 L26 34 ZM24 34 L29 23 L34 34 Z" fill={palette.accentMuted} />
        <path d="M21 34v3M29 34v3" stroke={palette.ink} strokeWidth="1.3" strokeLinecap="round" />
      </g>
    )
  }
  if (motif === 'wave') {
    return (
      <path d={`M13 ${33 + nudge}c4 0 4-1.5 8-1.5s4 1.5 8 1.5 4-1.5 8-1.5`} fill="none" stroke={palette.accentMuted} strokeWidth="1.8" strokeLinecap="round" />
    )
  }
  if (motif === 'spa') {
    return (
      <g>
        <path d={`M20 ${35 + nudge}c2.5-4-1.5-6.5 0.8-10M28 ${35 + nudge}c2.5-4-1.5-6.5 0.8-10`} fill="none" stroke={palette.accentMuted} strokeWidth="1.6" strokeLinecap="round" />
      </g>
    )
  }
  return (
    <g>
      <circle cx={22 + nudge} cy="25" r="4.8" fill={palette.sun} opacity="0.92" />
      <path d={`M22 ${17 + nudge}v3M22 ${30 + nudge}v3M14 ${25 + nudge}h3M27 ${25 + nudge}h3`} stroke={palette.accentMuted} strokeWidth="1.2" strokeLinecap="round" />
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
  const motif = stampMotif(type, contextText)
  const idBase = sanitizeId(`${destinationId || safeName}-${country}-${regionCode}-${type}`)
  const grainId = `grain-${idBase}`
  const paperId = `paper-${idBase}`
  const topBandId = `top-${idBase}`
  const sunX = 60 + Math.round(seeded(seed, 49) * 14)
  const sunY = 18 + Math.round(seeded(seed, 57) * 5)

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
          <stop offset="100%" stopColor={palette.paperShade} />
        </linearGradient>
        <linearGradient id={topBandId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={palette.accent} stopOpacity="0.86" />
          <stop offset="100%" stopColor={palette.accentMuted} stopOpacity="0.72" />
        </linearGradient>
        <filter id={grainId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="3" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grey" />
          <feBlend in="SourceGraphic" in2="grey" mode="multiply" />
        </filter>
      </defs>

      <rect x="1.5" y="1.5" width="97" height="121" rx="5" fill={`url(#${paperId})`} stroke={palette.frame} strokeWidth="1.5" strokeDasharray="4 3" />
      <rect x="4.5" y="4.5" width="91" height="13.8" rx="2.4" fill={`url(#${topBandId})`} />
      {renderFlag(country)}

      {country === 'CH' && cantonCode && (
        <g>
          <rect x="8" y="8.8" width="17" height="13.2" rx="2.2" fill={CANTON_ACCENT[cantonCode] || palette.accentMuted} />
          <text x="16.5" y="17.8" textAnchor="middle" fill="#F8FAFC" fontSize="7.6" style={{ fontFamily: '"Jost", sans-serif', fontWeight: 700, letterSpacing: '0.5px' }}>
            {cantonCode}
          </text>
        </g>
      )}

      <circle cx={sunX} cy={sunY} r="8.6" fill={palette.sun} opacity="0.9" />

      <g transform="translate(8,26)">
        {renderMotif(motif, palette, seed)}
      </g>

      <g transform="translate(8,18) scale(1.08)">
        {renderSilhouette(type, palette, seed, altitude)}
      </g>

      <text
        x="50"
        y="92"
        fill={palette.ink}
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
        y="104.6"
        fill={palette.accentMuted}
        textAnchor="middle"
        fontSize="8"
        style={{ fontFamily: '"Jost", sans-serif', fontWeight: 500, letterSpacing: '1.05px' }}
      >
        · {safeRegion || regionCode} ·
      </text>

      {country !== 'CH' && (
        <text
          x="50"
          y="112.6"
          fill={palette.ink}
          textAnchor="middle"
          fontSize="6.6"
          style={{ fontFamily: '"Jost", sans-serif', fontWeight: 500, letterSpacing: '1px', opacity: 0.7 }}
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
        opacity="0.07"
        filter={`url(#${grainId})`}
      />
    </svg>
  )
}
