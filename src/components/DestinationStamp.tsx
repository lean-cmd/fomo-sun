type StampType = 'mountain' | 'lake' | 'town' | 'thermal' | 'ski' | 'viewpoint' | 'default'

interface StampProps {
  name: string
  altitude?: number
  region?: string
  type: StampType
  country?: 'CH' | 'DE' | 'FR' | 'IT'
  className?: string
}

type Palette = { silhouette: string; accent: string }

const TYPE_PALETTE: Record<StampType, Palette> = {
  mountain: { silhouette: '#334155', accent: '#F59E0B' },
  lake: { silhouette: '#334155', accent: '#3B82F6' },
  town: { silhouette: '#92400E', accent: '#334155' },
  thermal: { silhouette: '#64748B', accent: '#60A5FA' },
  ski: { silhouette: '#334155', accent: '#E2E8F0' },
  viewpoint: { silhouette: '#334155', accent: '#F59E0B' },
  default: { silhouette: '#334155', accent: '#F59E0B' },
}

function sanitizeId(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'stamp'
}

function stampNameStyle(name: string) {
  const len = name.length
  if (len >= 18) return { size: 14, spacing: 1.0 }
  if (len >= 14) return { size: 16, spacing: 1.25 }
  if (len >= 11) return { size: 18, spacing: 1.55 }
  return { size: 21, spacing: 1.9 }
}

function renderSilhouette(type: StampType, palette: Palette) {
  switch (type) {
    case 'mountain':
      return (
        <g>
          <path d="M8 44 L26 18 L40 34 L55 14 L74 44 Z" fill={palette.silhouette} />
          <circle cx="63" cy="15" r="6" fill={palette.accent} opacity="0.9" />
        </g>
      )
    case 'lake':
      return (
        <g>
          <path d="M8 34 L26 20 L44 30 L61 18 L78 33 L78 42 L8 42 Z" fill={palette.silhouette} opacity="0.9" />
          <path d="M10 47c6 0 6-2 12-2s6 2 12 2 6-2 12-2 6 2 12 2 6-2 12-2" fill="none" stroke={palette.accent} strokeWidth="2.3" strokeLinecap="round" />
        </g>
      )
    case 'town':
      return (
        <g>
          <path d="M9 42h70v6H9z" fill={palette.accent} opacity="0.22" />
          <path d="M11 42 L21 34 L29 42 Z" fill={palette.silhouette} />
          <path d="M30 42 L41 32 L50 42 Z" fill={palette.silhouette} />
          <path d="M52 42 L60 36 L68 42 Z" fill={palette.silhouette} />
          <path d="M70 42 L70 24 L74 18 L78 24 L78 42 Z" fill={palette.silhouette} />
        </g>
      )
    case 'thermal':
      return (
        <g>
          <path d="M8 45h70" stroke={palette.accent} strokeWidth="3.2" strokeLinecap="round" />
          <path d="M25 42c3-5-2-8 1-13M41 42c3-5-2-8 1-13M57 42c3-5-2-8 1-13" stroke={palette.silhouette} strokeWidth="2" strokeLinecap="round" fill="none" />
        </g>
      )
    case 'ski':
      return (
        <g>
          <path d="M8 44 L74 24 L74 44 Z" fill={palette.silhouette} />
          <path d="M26 32l8-5 5 8-8 5z" fill={palette.accent} />
          <circle cx="39" cy="24.5" r="2.1" fill={palette.accent} />
          <path d="M31 35l17 5M27 38l17 5" stroke={palette.accent} strokeWidth="1.4" strokeLinecap="round" />
        </g>
      )
    case 'viewpoint':
      return (
        <g>
          <path d="M8 44 C20 30, 34 29, 52 36 C62 39, 70 41, 78 44 Z" fill={palette.silhouette} />
          <path d="M58 38v-10h6v10M56 28h10" stroke={palette.accent} strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="22" cy="20" r="5" fill={palette.accent} opacity="0.9" />
        </g>
      )
    default:
      return (
        <g>
          <path d="M8 44h70" stroke={palette.silhouette} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M24 44a19 19 0 0 1 38 0" fill={palette.accent} />
          <path d="M43 15v7M32 19l5 4M55 19l-5 4M28 29h7M59 29h-7" stroke={palette.accent} strokeWidth="1.8" strokeLinecap="round" />
        </g>
      )
  }
}

function renderFlag(country: 'CH' | 'DE' | 'FR' | 'IT') {
  if (country === 'CH') {
    return (
      <g>
        <rect x="76" y="9" width="14" height="14" rx="1" fill="#da291c" />
        <rect x="81.35" y="11.2" width="3.3" height="9.6" fill="#f8fafc" rx="0.45" />
        <rect x="78.2" y="14.35" width="9.6" height="3.3" fill="#f8fafc" rx="0.45" />
      </g>
    )
  }
  if (country === 'DE') {
    return (
      <g>
        <rect x="72" y="10" width="18" height="12" rx="2.2" fill="#101418" />
        <rect x="72" y="14" width="18" height="4" fill="#a53a3a" />
        <rect x="72" y="18" width="18" height="4" fill="#c79a4a" />
      </g>
    )
  }
  if (country === 'FR') {
    return (
      <g>
        <rect x="72" y="10" width="18" height="12" rx="2.2" fill="#f8fafc" />
        <rect x="72" y="10" width="6" height="12" fill="#5b84b9" />
        <rect x="84" y="10" width="6" height="12" fill="#c56262" />
      </g>
    )
  }
  return (
    <g>
      <rect x="72" y="10" width="18" height="12" rx="2.2" fill="#f8fafc" />
      <rect x="72" y="10" width="6" height="12" fill="#5a9f7a" />
      <rect x="84" y="10" width="6" height="12" fill="#c76262" />
    </g>
  )
}

export type { StampProps, StampType }

export function DestinationStamp({
  name,
  region,
  type,
  country = 'CH',
  className = '',
}: StampProps) {
  const safeName = (name || 'DESTINATION').toUpperCase().slice(0, 24)
  const safeRegion = region ? region.slice(0, 24) : ''
  const style = stampNameStyle(safeName)
  const palette = TYPE_PALETTE[type] ?? TYPE_PALETTE.default
  const grainId = `grain-${sanitizeId(`${safeName}-${type}-${country}`)}`

  return (
    <svg
      viewBox="0 0 100 124"
      className={className}
      role="img"
      aria-label={`${safeName} destination stamp`}
    >
      <defs>
        <filter id={grainId}>
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" result="noise" />
          <feColorMatrix type="saturate" values="0" in="noise" result="grey" />
          <feBlend in="SourceGraphic" in2="grey" mode="multiply" />
        </filter>
      </defs>

      <rect x="1.5" y="1.5" width="97" height="121" rx="5" fill="#F5F0E8" stroke="#CBD5E1" strokeWidth="1.5" strokeDasharray="4 3" />
      {renderFlag(country)}

      <g transform="translate(6,4) scale(1.12)">
        {renderSilhouette(type, palette)}
      </g>

      <text
        x="50"
        y="71"
        fill="#1E293B"
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

      {safeRegion && (
        <text
          x="50"
          y="88"
          fill="#64748B"
          textAnchor="middle"
          fontSize="9.5"
          style={{ fontFamily: '"Jost", sans-serif', fontWeight: 300, letterSpacing: '0.3px' }}
        >
          · {safeRegion} ·
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
