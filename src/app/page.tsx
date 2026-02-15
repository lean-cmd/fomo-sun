'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { DaylightWindow, SunnyEscapesResponse, TravelMode, DestinationType, SunTimeline } from '@/lib/types'
import { Car, TrainFront } from 'lucide-react'
import { formatSunHours, formatTravelClock, splitSunHours } from '@/lib/format'

// ── Icons ─────────────────────────────────────────────────────────────
const CarI = ({ c = 'w-4 h-4' }: { c?: string }) => <Car className={c} strokeWidth={1.85} />
const TrainI = ({ c = 'w-4 h-4' }: { c?: string }) => <TrainFront className={c} strokeWidth={1.85} />
const BothI = ({ c = 'w-4 h-4' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
const FilterI = ({ c = 'w-4 h-4' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" /></svg>
const MapI = ({ c = 'w-3.5 h-3.5' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" /></svg>
const CamI = ({ c = 'w-3.5 h-3.5' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg>
const ChevD = ({ c = 'w-3.5 h-3.5' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
const LocI = ({ c = 'w-4 h-4' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
const WaIcon = ({ c = 'w-3 h-3' }: { c?: string }) => <svg className={c} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.616l4.573-1.46A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.239 0-4.326-.726-6.02-1.956a.5.5 0 00-.417-.07l-3.063.978.998-3.003a.5.5 0 00-.063-.426A9.946 9.946 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>

const FLAG: Record<string, string> = { CH: '🇨🇭', DE: '🇩🇪', FR: '🇫🇷' }
const TYPES: { id: DestinationType; label: string }[] = [
  { id: 'nature', label: 'Nature' }, { id: 'viewpoint', label: 'Views' }, { id: 'town', label: 'Town' },
  { id: 'lake', label: 'Lake' }, { id: 'family', label: 'Family' }, { id: 'food', label: 'Food & Wine' }, { id: 'thermal', label: 'Thermal' },
]
const modeLbl: Record<TravelMode, string> = { car: 'Car', train: 'Train', both: 'Car + Train' }
function fmtMin(m: number) { const h = Math.floor(m / 60); return h > 0 ? `${h}h ${m % 60}m` : `${m}m` }

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function normalizeWindow(win?: DaylightWindow): DaylightWindow {
  const start = clamp(Math.round(win?.start_hour ?? 7), 0, 23)
  const end = clamp(Math.round(win?.end_hour ?? 19), start + 1, 24)
  return { start_hour: start, end_hour: end }
}

function arrivalClockFromNow(travelMin: number) {
  const d = new Date(Date.now() + travelMin * 60_000)
  return d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
}

function SunHoursInline({
  minutes,
  valueClass = 'text-lg font-semibold text-slate-800',
  unitClass = 'text-sm text-slate-500',
}: {
  minutes: number
  valueClass?: string
  unitClass?: string
}) {
  const { value, unit } = splitSunHours(minutes)
  return (
    <span className="inline-flex items-baseline">
      <span className={valueClass}>{value}</span>
      <span className={`ml-0.5 ${unitClass}`}>{unit}</span>
    </span>
  )
}

function compactDaySegments(segments: SunTimeline['today']): SunTimeline['today'] {
  const dayOnly = segments.filter(
    (seg): seg is { condition: 'sun' | 'partial' | 'cloud'; pct: number } => seg.condition !== 'night'
  )
  const merged: SunTimeline['today'] = []
  for (const seg of dayOnly) {
    const prev = merged[merged.length - 1]
    if (prev && prev.condition === seg.condition) prev.pct += seg.pct
    else merged.push({ ...seg })
  }
  return merged.length ? merged : [{ condition: 'cloud', pct: 100 }]
}

function compressSegments(
  segments: SunTimeline['today'],
  maxSegments = 6
): SunTimeline['today'] {
  if (segments.length <= maxSegments) return segments

  const out: SunTimeline['today'] = []
  const bucketSize = segments.length / maxSegments
  for (let i = 0; i < maxSegments; i++) {
    const start = Math.floor(i * bucketSize)
    const end = Math.min(segments.length, Math.floor((i + 1) * bucketSize) || segments.length)
    const bucket = segments.slice(start, end)
    if (!bucket.length) continue

    const sums: Record<'sun' | 'partial' | 'cloud', number> = { sun: 0, partial: 0, cloud: 0 }
    let pct = 0
    for (const seg of bucket) {
      pct += seg.pct
      if (seg.condition === 'sun' || seg.condition === 'partial' || seg.condition === 'cloud') {
        sums[seg.condition] += seg.pct
      }
    }
    const condition = (Object.entries(sums).sort((a, b) => b[1] - a[1])[0]?.[0] || 'cloud') as 'sun' | 'partial' | 'cloud'
    out.push({ condition, pct })
  }

  return out.length ? out : segments
}

type WeatherKind = 'sunny' | 'partly' | 'cloudy' | 'foggy'
type SortMode = 'best' | 'fastest' | 'warmest'
type TripSpan = 'daytrip' | 'plus1day'
type DayFocus = 'today' | 'tomorrow'
type TrainPreviewRow = {
  id: string
  category: string
  line: string
  departure_hhmm: string
  arrival_hhmm: string
  duration_min: number
  platform?: string
  transfers: number
  sbb_url: string
  note?: string
}

function trainCategoryClass(category: string) {
  if (category.startsWith('IC')) return 'bg-rose-100 text-rose-700 border-rose-200'
  if (category.startsWith('IR')) return 'bg-sky-100 text-sky-700 border-sky-200'
  if (category.startsWith('S')) return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  return 'bg-amber-100 text-amber-700 border-amber-200'
}

function weatherKind(summary?: string): WeatherKind {
  const s = (summary || '').toLowerCase()
  if (s.includes('fog') || s.includes('low cloud')) return 'foggy'
  if (s.includes('partly')) return 'partly'
  if (s.includes('clear') || s.includes('sunny') || s.includes('sun')) return 'sunny'
  return 'cloudy'
}

function weatherChipLabel(summary?: string) {
  const kind = weatherKind(summary)
  if (kind === 'foggy') return 'Foggy'
  if (kind === 'partly') return 'Partly sunny'
  if (kind === 'sunny') return 'Sunny'
  return 'Cloudy'
}

function weatherGlyph(summary?: string) {
  const kind = weatherKind(summary)
  if (kind === 'sunny') return '☀️'
  if (kind === 'partly') return '⛅'
  if (kind === 'foggy') return '☁️'
  return '☁️'
}

function extractTemp(summary?: string) {
  if (!summary) return null
  const m = summary.match(/(-?\d+)\s*°c/i)
  return m ? Number(m[1]) : null
}

type CitySeed = { name: string; lat: number; lon: number }

const MANUAL_ORIGIN_CITIES: CitySeed[] = [
  { name: 'Basel', lat: 47.5596, lon: 7.5886 },
  { name: 'Binningen', lat: 47.5327, lon: 7.5692 },
  { name: 'Zurich', lat: 47.3769, lon: 8.5417 },
  { name: 'Bern', lat: 46.948, lon: 7.4474 },
  { name: 'Luzern', lat: 47.0502, lon: 8.3093 },
  { name: 'Aarau', lat: 47.3925, lon: 8.0442 },
  { name: 'Olten', lat: 47.3505, lon: 7.9032 },
  { name: 'Solothurn', lat: 47.2088, lon: 7.537 },
  { name: 'Winterthur', lat: 47.4988, lon: 8.7237 },
  { name: 'St. Gallen', lat: 47.4245, lon: 9.3767 },
  { name: 'Baden', lat: 47.4738, lon: 8.3077 },
  { name: 'Biel/Bienne', lat: 47.1368, lon: 7.2468 },
  { name: 'Thun', lat: 46.7579, lon: 7.627 },
  { name: 'Zug', lat: 47.1662, lon: 8.5155 },
  { name: 'Schaffhausen', lat: 47.6973, lon: 8.6349 },
  { name: 'Frauenfeld', lat: 47.5552, lon: 8.8988 },
]

const SWISS_CITY_FALLBACKS: CitySeed[] = [
  ...MANUAL_ORIGIN_CITIES,
  { name: 'Geneva', lat: 46.2044, lon: 6.1432 },
  { name: 'Lausanne', lat: 46.5197, lon: 6.6323 },
  { name: 'Lugano', lat: 46.0037, lon: 8.9511 },
  { name: 'Fribourg', lat: 46.8065, lon: 7.161 },
  { name: 'Neuchâtel', lat: 46.9896, lon: 6.9293 },
]

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const toRad = (v: number) => (v * Math.PI) / 180
  const R = 6371
  const dLat = toRad(bLat - aLat)
  const dLon = toRad(bLon - aLon)
  const aa = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2
  return R * (2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa)))
}

function fallbackNearestCity(lat: number, lon: number) {
  let best: CitySeed | null = null
  let bestDist = Infinity
  for (const city of SWISS_CITY_FALLBACKS) {
    const d = haversineKm(lat, lon, city.lat, city.lon)
    if (d < bestDist) {
      bestDist = d
      best = city
    }
  }
  return best && bestDist <= 160 ? best.name : `${lat.toFixed(2)}, ${lon.toFixed(2)}`
}

function pickNearestCityName(payload: unknown) {
  const rows = Array.isArray((payload as { results?: unknown[] })?.results)
    ? ((payload as { results: Array<Record<string, unknown>> }).results || [])
    : []
  if (rows.length === 0) return null

  const sorted = rows
    .map(r => {
      const feature = String(r.feature_code || '')
      const isCity = feature.startsWith('PPL')
      const pop = Number(r.population || 0)
      const name = String(r.name || '')
      return { isCity, pop, name }
    })
    .sort((a, b) => {
      if (a.isCity !== b.isCity) return a.isCity ? -1 : 1
      return b.pop - a.pop
    })

  return sorted[0]?.name || null
}

function formatGainTag(gainMin: number, originMin: number, originName: string) {
  if (gainMin <= 0) return ''
  const gainLabel = formatSunHours(gainMin)
  if (originMin <= 0) return `+${gainLabel} vs ${originName}`

  const gainPct = Math.round((gainMin / originMin) * 100)
  if (gainPct >= 100) {
    const ratio = (gainMin + originMin) / originMin
    const ratioRounded = ratio >= 10 ? Math.round(ratio) : Math.round(ratio * 10) / 10
    const ratioLabel = Number.isInteger(ratioRounded) ? `${ratioRounded}x` : `${ratioRounded.toFixed(1)}x`
    return `+${gainLabel} · ${ratioLabel} vs ${originName}`
  }
  if (gainPct >= 1) return `+${gainLabel} (+${gainPct}%) vs ${originName}`
  return `+${gainLabel} vs ${originName}`
}

function buildHourTicks(win?: DaylightWindow) {
  const { start_hour, end_hour } = normalizeWindow(win)
  const ticks: number[] = []
  for (let h = Math.ceil(start_hour / 2) * 2; h <= end_hour; h += 2) ticks.push(h)
  if (ticks.length === 0 || ticks[0] !== start_hour) ticks.unshift(start_hour)
  if (ticks[ticks.length - 1] !== end_hour) ticks.push(end_hour)
  return ticks
}

type EscapeCard = SunnyEscapesResponse['escapes'][number]

function ringTier(score: number) {
  if (score >= 0.9) return { id: 'elite', colors: ['#fbbf24', '#f59e0b', '#ef4444'], label: 'Elite' }
  if (score >= 0.75) return { id: 'strong', colors: ['#f59e0b', '#f97316', '#ef4444'], label: 'Strong' }
  if (score >= 0.55) return { id: 'promising', colors: ['#fb923c', '#f97316', '#dc2626'], label: 'Promising' }
  return { id: 'low', colors: ['#fdba74', '#fb923c', '#ea580c'], label: 'Low' }
}

function parseSunConditions(conditions: string) {
  const [sunPartRaw, cmpRaw] = conditions.split('|').map(p => p.trim())
  const sunMatch = sunPartRaw.match(/(\d+)\s*min/i)
  const sunMin = sunMatch ? Number(sunMatch[1]) : null
  const comparison = cmpRaw
    ? cmpRaw
      .replace('more sun than', 'vs')
      .replace(/\s+/g, ' ')
      .trim()
    : ''
  return { sunMin, comparison }
}

// ── FOMOscore Ring ────────────────────────────────────────────────────
function ScoreRing({
  score,
  size = 48,
  onTap,
  pulse = false,
  compact = false,
}: {
  score: number
  size?: number
  onTap?: () => void
  pulse?: boolean
  compact?: boolean
}) {
  const pct = Math.round(score * 100), r = (size - 8) / 2, circ = 2 * Math.PI * r
  const tier = ringTier(score)
  const gradId = `fomoRingGrad-${tier.id}`
  return (
    <button onClick={e => { e.stopPropagation(); onTap?.() }} aria-label={`FOMOscore ${pct}%`}
      className={`relative flex-shrink-0 ${onTap ? 'cursor-pointer' : 'cursor-default'} ${pulse ? 'score-pulse' : ''}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={tier.colors[0]} />
            <stop offset="55%" stopColor={tier.colors[1]} />
            <stop offset="100%" stopColor={tier.colors[2]} />
          </linearGradient>
        </defs>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={`url(#${gradId})`} strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - score)} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease', filter: 'drop-shadow(0 0 3px rgba(251, 191, 36, 0.45))' }} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className={`${compact ? 'text-[11px]' : 'text-[13px]'} font-bold text-slate-800`} style={{ fontFamily: 'Sora' }}>{pct}</span>
        <span className={`${compact ? 'text-[5px]' : 'text-[6px]'} font-bold text-amber-500 uppercase tracking-wider mt-[1px]`}>fomo™</span>
      </span>
    </button>
  )
}

// ── Timeline Bar ──────────────────────────────────────────────────────
function SunBar({
  timeline,
  demo,
  label,
  sunWindow,
  dayFocus,
  travelMin,
  forecastSunMin,
  showHourLabels = true,
  isLoading = false,
  compact = false,
}: {
  timeline: SunTimeline
  demo: boolean
  label?: string
  sunWindow?: { today: DaylightWindow; tomorrow: DaylightWindow }
  dayFocus?: DayFocus
  travelMin?: number
  forecastSunMin?: number
  showHourLabels?: boolean
  isLoading?: boolean
  compact?: boolean
}) {
  const h = demo ? 10.17 : new Date().getHours() + new Date().getMinutes() / 60
  const nowPct = Math.max(0, Math.min(100, (h / 24) * 100))
  const daysToRender = dayFocus ? [dayFocus] as const : (['today', 'tomorrow'] as const)
  return (
    <div className="space-y-2">
      {daysToRender.map(day => {
        const win = normalizeWindow(sunWindow?.[day])
        const leftNightPct = (win.start_hour / 24) * 100
        const daylightPct = ((win.end_hour - win.start_hour) / 24) * 100
        const rightNightPct = Math.max(0, 100 - leftNightPct - daylightPct)
        const daySegments = demo
          ? compressSegments(compactDaySegments(timeline[day]))
          : compactDaySegments(timeline[day])
        const dayTotal = Math.max(1, daySegments.reduce((sum, seg) => sum + seg.pct, 0))

        const ticks = buildHourTicks(win)
        const travelArrivalPct = day === 'today' && travelMin
          ? Math.max(0, Math.min(100, nowPct + ((travelMin / 60) / 24) * 100))
          : 0
        const segmentLabel = (segPct: number, condition: SunTimeline['today'][number]['condition']) => {
          if (condition === 'night') return undefined
          if (!forecastSunMin) return undefined
          const weight = condition === 'sun' ? 1 : condition === 'partial' ? 0.55 : 0.12
          const min = Math.max(0, Math.round((segPct / dayTotal) * forecastSunMin * weight))
          return `${min}min sunshine`
        }

        return (
          <div key={day} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 w-[84px] text-right flex-shrink-0 font-semibold capitalize truncate">
                {label || day}
              </span>
              <div className={`tl-wrap flex-1 ${isLoading ? 'timeline-loading' : ''}`}>
                <div className={`tl-bar ${compact ? 'h-[20px]' : ''}`}>
                  {leftNightPct > 0 && <div className="tl-seg tl-night" style={{ width: `${leftNightPct}%` }} />}
                  <div className="h-full flex" style={{ width: `${daylightPct}%` }}>
                    {daySegments.map((seg, i) => (
                      <div
                        key={i}
                        className={`tl-seg tl-${seg.condition}`}
                        style={{ width: `${(seg.pct / dayTotal) * 100}%` }}
                        title={segmentLabel(seg.pct, seg.condition)}
                      />
                    ))}
                  </div>
                  {rightNightPct > 0 && <div className="tl-seg tl-night" style={{ width: `${rightNightPct}%` }} />}
                  {day === 'today' && <div className="tl-now" style={{ left: `${nowPct}%` }} />}
                  {day === 'today' && travelMin && (
                    <>
                      <div className="tl-travel-overlay" style={{ width: `${travelArrivalPct}%` }} />
                      <div className="tl-arrive-label" style={{ left: `${travelArrivalPct}%` }}>
                        Arrive ~{arrivalClockFromNow(travelMin)}
                      </div>
                    </>
                  )}
                </div>
                {showHourLabels && (
                  <div className="tl-hour-row">
                    {ticks.map(t => <span key={t}>{t}</span>)}
                  </div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
export default function Home() {
  const [maxH, setMaxH] = useState(2)
  const [mode, setMode] = useState<TravelMode>('both')
  const [ga, setGA] = useState(false)
  const [types, setTypes] = useState<DestinationType[]>([])
  const [data, setData] = useState<SunnyEscapesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [openCard, setOpenCard] = useState<number | null>(0)
  const [openSetting, setOpenSetting] = useState<string | null>(null)
  const [demo, setDemo] = useState(true)
  const [scorePopup, setScorePopup] = useState<number | null>(null)
  const [selectedCity, setSelectedCity] = useState<string>('Basel')
  const [gpsOrigin, setGpsOrigin] = useState<{ lat: number; lon: number; name: string } | null>(null)
  const [originMode, setOriginMode] = useState<'manual' | 'gps'>('manual')
  const [locating, setLocating] = useState(false)
  const [hasSetOptimal, setHasSetOptimal] = useState(false)
  const [optimalHint, setOptimalHint] = useState(false)
  const [optimalH, setOptimalH] = useState<number | null>(null)
  const [showOptimalInfo, setShowOptimalInfo] = useState(false)
  const [queryMaxH, setQueryMaxH] = useState(maxH)
  const [sortBy, setSortBy] = useState<SortMode>('best')
  const [tripSpan, setTripSpan] = useState<TripSpan>('daytrip')
  const [tripSpanTouched, setTripSpanTouched] = useState(false)
  const [scorePulse, setScorePulse] = useState(false)
  const [isMobileControlSticky, setIsMobileControlSticky] = useState(false)
  const [showTopWhyInfo, setShowTopWhyInfo] = useState(false)
  const [isDraggingSlider, setIsDraggingSlider] = useState(false)
  const [sliderSnapPulse, setSliderSnapPulse] = useState(false)
  const [trainPreview, setTrainPreview] = useState<Record<string, { loading: boolean; rows: TrainPreviewRow[]; error?: string }>>({})
  const requestCtrlRef = useRef<AbortController | null>(null)
  const controlAnchorRef = useRef<HTMLElement | null>(null)
  const snapPulseRef = useRef<number | null>(null)
  const loadedTrainKeys = useRef<Set<string>>(new Set())

  const manualOrigin = useMemo(
    () => MANUAL_ORIGIN_CITIES.find(city => city.name === selectedCity) || MANUAL_ORIGIN_CITIES[0],
    [selectedCity]
  )
  const origin = originMode === 'gps' && gpsOrigin ? gpsOrigin : manualOrigin

  useEffect(() => {
    const t = setTimeout(() => setQueryMaxH(maxH), 260)
    return () => clearTimeout(t)
  }, [maxH])
  useEffect(() => () => {
    if (snapPulseRef.current !== null) window.clearTimeout(snapPulseRef.current)
  }, [])
  useEffect(() => {
    setScorePulse(true)
    const t = setTimeout(() => setScorePulse(false), 420)
    return () => clearTimeout(t)
  }, [queryMaxH])

  const load = useCallback(async () => {
    requestCtrlRef.current?.abort()
    const ctrl = new AbortController()
    requestCtrlRef.current = ctrl
    setLoading(true)
    try {
      const p = new URLSearchParams({
        lat: String(origin.lat), lon: String(origin.lon),
        max_travel_h: String(queryMaxH), mode, ga: String(ga), limit: '5', demo: String(demo),
        trip_span: tripSpan,
      })
      p.set('origin_kind', originMode)
      p.set('origin_name', origin.name)
      if (types.length) p.set('types', types.join(','))
      const res = await fetch(`/api/v1/sunny-escapes?${p}`, { signal: ctrl.signal })
      const d: SunnyEscapesResponse = await res.json()
      setData(d)
      if (!hasSetOptimal && d.optimal_travel_h) {
        const normalizedOpt = Math.round(Math.min(4.5, Math.max(1, d.optimal_travel_h)) * 4) / 4
        setMaxH(normalizedOpt)
        setOptimalH(normalizedOpt)
        setHasSetOptimal(true)
        setOptimalHint(true)
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') console.error(e)
    } finally {
      if (requestCtrlRef.current === ctrl) setLoading(false)
    }
  }, [queryMaxH, mode, ga, types, demo, origin.lat, origin.lon, origin.name, originMode, hasSetOptimal, tripSpan])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (scorePopup === null) return
    const h = () => setScorePopup(null)
    document.addEventListener('click', h); return () => document.removeEventListener('click', h)
  }, [scorePopup])
  useEffect(() => () => requestCtrlRef.current?.abort(), [])
  useEffect(() => {
    if (!optimalHint) return
    const t = setTimeout(() => setOptimalHint(false), 3600)
    return () => clearTimeout(t)
  }, [optimalHint])
  useEffect(() => {
    if (!showOptimalInfo) return
    const h = () => setShowOptimalInfo(false)
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [showOptimalInfo])
  useEffect(() => {
    if (!showTopWhyInfo) return
    const h = () => setShowTopWhyInfo(false)
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [showTopWhyInfo])
  useEffect(() => {
    if (!data?.escapes?.length) {
      setOpenCard(null)
      return
    }
    setOpenCard(0)
  }, [data?.escapes])
  useEffect(() => {
    if (!data || tripSpanTouched) return
    const hour = new Date().getHours()
    if (hour >= 17 || data.sunset.is_past || data.sunset.minutes_until <= 30) {
      if (tripSpan !== 'plus1day') {
        setTripSpan('plus1day')
        setHasSetOptimal(false)
        setOptimalH(null)
      }
    }
  }, [data, tripSpanTouched, tripSpan])
  useEffect(() => {
    const onScroll = () => {
      const anchorTop = controlAnchorRef.current?.getBoundingClientRect().top ?? 9999
      setIsMobileControlSticky(anchorTop < 52)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const detectLocation = async () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const lat = pos.coords.latitude
          const lon = pos.coords.longitude
          const localFallback = fallbackNearestCity(lat, lon)
          const r = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=8&language=en&format=json`)
          const d = await r.json()
          const nearestCity = pickNearestCityName(d) || localFallback
          setGpsOrigin({ lat, lon, name: nearestCity })
          setOriginMode('gps')
        } catch {
          setGpsOrigin({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            name: fallbackNearestCity(pos.coords.latitude, pos.coords.longitude),
          })
          setOriginMode('gps')
        }
        setLocating(false); setHasSetOptimal(false); setOptimalH(null)
      },
      () => setLocating(false), { enableHighAccuracy: false, timeout: 8000 }
    )
  }
  const selectManualCity = (name: string) => {
    setSelectedCity(name)
    setOriginMode('manual')
    setHasSetOptimal(false)
    setOptimalH(null)
  }

  const toggleType = (t: DestinationType) => setTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])
  const toggleSetting = (id: string) => setOpenSetting(p => p === id ? null : id)
  const filterSummary = types.length === 0 ? 'All types' : types.length <= 2 ? types.map(t => TYPES.find(x => x.id === t)?.label).join(', ') : `${types.length} selected`
  const markerOptH = optimalH ?? data?.optimal_travel_h ?? 2.5
  const optPct = ((markerOptH - 1) / 3.5) * 100
  const topEscape = data?.escapes?.[0] ?? null
  const originFomoPct = data ? Math.round(data.origin_conditions.sun_score * 100) : 0
  const originSunMin = data?.origin_conditions.sunshine_min ?? 0
  const topSunMin = topEscape?.sun_score.sunshine_forecast_min ?? 0
  const sunGainMin = Math.max(0, topSunMin - originSunMin)
  const sunGainTag = formatGainTag(sunGainMin, originSunMin, origin.name)
  const topTravelMin = topEscape
    ? Math.min(topEscape.travel.car?.duration_min ?? Infinity, topEscape.travel.train?.duration_min ?? Infinity)
    : Infinity
  const topTravelText = Number.isFinite(topTravelMin) ? fmtMin(topTravelMin) : 'n/a'
  const dayFocus: DayFocus = tripSpan === 'plus1day' ? 'tomorrow' : 'today'
  const originTempC = extractTemp(data?.origin_conditions.description || '') ?? 0
  const originWeatherText = weatherChipLabel(data?.origin_conditions.description || '')
  const fallbackNotice = data?._meta?.fallback_notice || ''
  const bestEscapeLabel = dayFocus === 'tomorrow' ? 'Best escape tomorrow' : 'Best escape today'
  const sortLabel = sortBy === 'best' ? 'Best now' : sortBy === 'fastest' ? 'Fastest' : 'Warmest'
  const sortedEscapes = useMemo(() => {
    if (!data?.escapes?.length) return []
    const list = [...data.escapes]
    const bestTravelMin = (e: EscapeCard) => Math.min(e.travel.car?.duration_min ?? Infinity, e.travel.train?.duration_min ?? Infinity)
    if (sortBy === 'fastest') {
      list.sort((a, b) => {
        const ta = bestTravelMin(a)
        const tb = bestTravelMin(b)
        if (ta !== tb) return ta - tb
        return b.sun_score.score - a.sun_score.score
      })
      return list
    }
    if (sortBy === 'warmest') {
      list.sort((a, b) => {
        const ta = a.weather_now?.temp_c ?? -99
        const tb = b.weather_now?.temp_c ?? -99
        if (tb !== ta) return tb - ta
        return b.sun_score.score - a.sun_score.score
      })
      return list
    }
    return list
  }, [data?.escapes, sortBy])
  useEffect(() => {
    if (openCard === null) return
    const escape = sortedEscapes[openCard]
    if (!escape) return
    if (mode === 'car' || !escape.travel.train) return

    const toName = escape.destination.sbb_name || escape.destination.name
    if (!toName) return
    const cacheKey = `${escape.destination.id}|${origin.name}|${demo ? 'demo' : 'live'}`
    if (loadedTrainKeys.current.has(cacheKey)) return
    loadedTrainKeys.current.add(cacheKey)

    setTrainPreview(prev => ({
      ...prev,
      [cacheKey]: { loading: true, rows: prev[cacheKey]?.rows || [] },
    }))

    fetch(`/api/v1/sbb-connections?from=${encodeURIComponent(origin.name)}&to=${encodeURIComponent(toName)}&limit=3&demo=${String(demo)}`)
      .then(async res => {
        if (!res.ok) throw new Error(`sbb-${res.status}`)
        const payload = await res.json()
        const rows = Array.isArray(payload?.connections) ? payload.connections as TrainPreviewRow[] : []
        setTrainPreview(prev => ({ ...prev, [cacheKey]: { loading: false, rows } }))
      })
      .catch(() => {
        setTrainPreview(prev => ({ ...prev, [cacheKey]: { loading: false, rows: [], error: 'unavailable' } }))
      })
  }, [openCard, sortedEscapes, mode, origin.name, demo])

  // v15: WhatsApp share includes fomosun.com link for virality
  const timelineEmojiPreview = (timeline?: SunTimeline) => {
    const segments = (dayFocus === 'tomorrow' ? timeline?.tomorrow : timeline?.today) || []
    if (!segments.length) return '☁️☁️⛅☀️'
    const slotCount = 8
    const slots: string[] = []
    for (const seg of segments) {
      const icon = seg.condition === 'sun'
        ? '☀️'
        : seg.condition === 'partial'
          ? '⛅'
          : seg.condition === 'night'
            ? '🌙'
            : '☁️'
      const n = Math.max(1, Math.round((seg.pct / 100) * slotCount))
      for (let i = 0; i < n; i += 1) slots.push(icon)
    }
    return slots.slice(0, slotCount).join('')
  }

  const buildWhatsAppHref = (escape: EscapeCard) => {
    const bestTravelMin = Math.min(escape.travel.car?.duration_min ?? Infinity, escape.travel.train?.duration_min ?? Infinity)
    const bestTravel = Number.isFinite(bestTravelMin) ? fmtMin(bestTravelMin) : 'n/a'
    const originSky = timelineEmojiPreview(data?.origin_timeline)
    const destinationSky = timelineEmojiPreview(escape.sun_timeline)
    const destinationSun = formatSunHours(escape.sun_score.sunshine_forecast_min)
    const originSun = formatSunHours(originSunMin)
    const ogUrl = `https://fomosun.com/api/og/${encodeURIComponent(escape.destination.id)}?score=${Math.round(escape.sun_score.score * 100)}&sun=${escape.sun_score.sunshine_forecast_min}&t=${Date.now()}`
    const shareText = [
      `☀️ FOMO Sun: escape the fog!`,
      ``,
      `${origin.name} (${originFomoPct}%) → ${escape.destination.name} (${Math.round(escape.sun_score.score * 100)}%)`,
      `${bestTravel} away · ${destinationSun} sun (${sunGainTag || `vs ${origin.name}`})`,
      `${dayFocus === 'tomorrow' ? 'Tomorrow' : 'Today'} sky`,
      `${origin.name}: ${originSky} (${originSun})`,
      `${escape.destination.name}: ${destinationSky}`,
      ``,
      `Plan: ${escape.plan[0]}`,
      escape.links.google_maps || '',
      `Preview image: ${ogUrl}`,
      ``,
      `Find your sunny escape: https://fomosun.com`,
    ].filter(Boolean).join('\n')
    return `https://wa.me/?text=${encodeURIComponent(shareText)}`
  }
  const topWhatsAppHref = topEscape ? buildWhatsAppHref(topEscape) : '#'
  const setTripSpanManual = (next: TripSpan) => {
    setTripSpan(next)
    setTripSpanTouched(true)
    setHasSetOptimal(false)
    setOptimalH(null)
  }
  const sliderLeftPct = ((maxH - 1) / 3.5) * 100
  const handleSliderChange = (value: number) => {
    setMaxH(value)
    setSliderSnapPulse(true)
    navigator.vibrate?.(5)
    if (snapPulseRef.current !== null) window.clearTimeout(snapPulseRef.current)
    snapPulseRef.current = window.setTimeout(() => setSliderSnapPulse(false), 90)
  }

  return (
    <div>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="max-w-xl mx-auto px-2.5 h-12 flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-medium border bg-white border-slate-200 text-slate-600 min-w-0">
            <LocI c="w-3 h-3" />
            <select
              value={selectedCity}
              onChange={e => selectManualCity(e.target.value)}
              className="bg-transparent text-[10px] font-semibold focus:outline-none text-slate-700 min-w-0"
              aria-label="Select origin city"
            >
              {MANUAL_ORIGIN_CITIES.map(city => (
                <option key={city.name} value={city.name} className="text-slate-800">
                  {city.name}
                </option>
              ))}
            </select>
          </label>

          <div className="flex-1 flex justify-center">
            <div className="inline-flex p-0.5 rounded-full border border-slate-200 bg-slate-50">
              <button
                onClick={() => setTripSpanManual('daytrip')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${tripSpan === 'daytrip' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
              >
                Today
              </button>
              <button
                onClick={() => setTripSpanManual('plus1day')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${tripSpan === 'plus1day' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
              >
                Tomorrow
              </button>
            </div>
          </div>

          <button
            onClick={() => { setDemo(!demo); setHasSetOptimal(false); setOptimalH(null) }}
            aria-label={`Switch to ${demo ? 'live' : 'demo'} mode`}
            className={`live-toggle ${demo ? 'is-demo' : 'is-live'}`}
          >
            <span className={`live-toggle-label ${demo ? 'active' : ''}`}>Demo</span>
            <span className={`live-toggle-label ${!demo ? 'active' : ''}`}>Live</span>
            <span className={`live-toggle-thumb ${demo ? '' : 'on'}`} />
          </button>
        </div>
      </header>

      {/* ══════ HERO ══════ */}
      <section className="hero-day pt-7 sm:pt-8 pb-12 sm:pb-14 px-4 relative">
        <>
          <div className="fog-w1 absolute top-10 left-0 w-full h-8 bg-gradient-to-r from-transparent via-slate-400/[.18] to-transparent rounded-full blur-[18px] pointer-events-none" />
          <div className="fog-w2 absolute top-[60px] left-[8%] w-4/5 h-6 bg-gradient-to-r from-transparent via-slate-400/[.12] to-transparent rounded-full blur-[14px] pointer-events-none" />
        </>

        <div className="relative z-10 max-w-xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="sun-anim w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 flex-shrink-0" />
            <div className={`text-[25px] sm:text-[28px] font-extrabold text-slate-800`}
              style={{ fontFamily: 'Sora', letterSpacing: '-1px' }}>
              FOMO <span className="text-amber-500">Sun</span>
            </div>
          </div>

          <p className={`text-[14px] sm:text-[15px] italic text-slate-500`}
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
            Stop chasing clouds. Find sun. ☀️
          </p>
          {data && (
            <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-left">
              <p className="text-[11px] text-slate-600">
                ☁️ {Math.round(originTempC)}°C · {originWeatherText} · <SunHoursInline minutes={originSunMin} valueClass="text-[12px] font-semibold text-slate-700" unitClass="text-[10px] text-slate-500" /> sun remaining
              </p>
              <div className="mt-1">
                <SunBar
                  timeline={data.origin_timeline}
                  demo={demo}
                  sunWindow={data.sun_window}
                  dayFocus={dayFocus}
                  label={origin.name}
                  forecastSunMin={originSunMin}
                  showHourLabels={false}
                  compact
                  isLoading={loading}
                />
              </div>
            </div>
          )}

          {data && topEscape && (
            <div className={`mt-3 sm:mt-4 rounded-2xl border text-left border-slate-200/80 bg-white/80 backdrop-blur-sm`}>
              <div className={`px-3.5 sm:px-4 py-3 bg-amber-50/90`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <ScoreRing score={topEscape.sun_score.score} size={40} compact />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className={`text-[9px] uppercase tracking-[1px] font-semibold text-amber-700/80`}>{bestEscapeLabel}</p>
                        <div className="relative">
                          <button
                            type="button"
                            onMouseEnter={() => setShowTopWhyInfo(true)}
                            onMouseLeave={() => setShowTopWhyInfo(false)}
                            onFocus={() => setShowTopWhyInfo(true)}
                            onBlur={() => setShowTopWhyInfo(false)}
                            onClick={(ev) => { ev.stopPropagation(); setShowTopWhyInfo(v => !v) }}
                            className={`text-[9px] underline-offset-2 hover:underline text-slate-500`}
                          >
                            Why
                          </button>
                          {showTopWhyInfo && (
                            <div className={`absolute z-10 mt-1 w-[220px] rounded-lg border px-2.5 py-2 text-[10px] leading-snug shadow-lg bg-white border-slate-200 text-slate-600`}>
                              Highest FOMO score inside your selected travel window (±30m), balancing sunshine and realistic travel time.
                            </div>
                          )}
                        </div>
                      </div>
                      <p className={`text-[14px] sm:text-[15px] mt-0.5 font-semibold text-slate-900`}>
                        {topEscape.destination.name}
                      </p>
                      <p className={`text-[10px] mt-0.5 text-slate-600`}>{topTravelText} · {topEscape.destination.region}</p>
                      <p className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px]" aria-hidden="true">☀️</span>
                        {sunGainMin > 0 ? (
                          <span className={`text-[10px] font-semibold text-emerald-700`}>
                            <SunHoursInline minutes={topSunMin} valueClass="text-[12px] font-semibold text-emerald-700" unitClass="text-[10px] text-emerald-600" /> sun · {sunGainTag}
                          </span>
                        ) : (
                          <span className={`text-[10px] text-slate-500`}>
                            <SunHoursInline minutes={topSunMin} valueClass="text-[12px] font-semibold text-slate-700" unitClass="text-[10px] text-slate-500" /> sun forecast in this travel window
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <a
                    href={topWhatsAppHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`wa-btn inline-flex items-center gap-1.5 rounded-full px-3 text-[10px] font-semibold transition-all self-start bg-white text-emerald-700 shadow-sm border border-emerald-100 hover:shadow hover:border-emerald-200`}
                  >
                    <WaIcon c="w-3.5 h-3.5" /> Share
                  </a>
                </div>
                <div className={`mt-2 rounded-md px-2.5 py-2 bg-white/70`}>
                  <SunBar
                    timeline={data.origin_timeline}
                    demo={demo}
                    sunWindow={data.sun_window}
                    dayFocus={dayFocus}
                    label={origin.name}
                    forecastSunMin={originSunMin}
                    isLoading={loading}
                  />
                  <SunBar
                    timeline={topEscape.sun_timeline}
                    demo={demo}
                    sunWindow={data.sun_window}
                    dayFocus={dayFocus}
                    label={topEscape.destination.name}
                    travelMin={Number.isFinite(topTravelMin) ? topTravelMin : undefined}
                    forecastSunMin={topSunMin}
                    isLoading={loading}
                  />
                </div>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* ══════ CONTROLS ══════ */}
      <section ref={controlAnchorRef} className="max-w-xl mx-auto px-4 -mt-6 sm:-mt-7 relative z-20">
        <div className={`sm:hidden sticky z-30 mb-2 ${isMobileControlSticky ? 'block' : 'hidden'}`} style={{ top: 'calc(max(8px, env(safe-area-inset-top)) + 48px)' }}>
          <div className={`rounded-xl border px-2.5 py-2 shadow-sm backdrop-blur-sm border-slate-200 bg-white/92`}>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[10px] font-semibold text-slate-600`}>Travel {formatTravelClock(maxH)} · {sortLabel}</span>
              <div className={`inline-flex p-0.5 rounded-full border border-slate-200 bg-slate-50`}>
                {([
                  ['fastest', 'F'],
                  ['best', 'B'],
                  ['warmest', 'W'],
                ] as [SortMode, string][]).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setSortBy(id)}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${sortBy === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {fallbackNotice && (
          <div className={`mb-2 rounded-xl border px-3 py-2 text-center text-[11px] font-medium bg-amber-50 border-amber-200 text-amber-700`}>
            {fallbackNotice}
          </div>
        )}
        <div className={`rounded-2xl shadow-lg border overflow-visible bg-white border-slate-100 shadow-slate-200/50`}>
          <div className="px-4 sm:px-5 pt-3.5 sm:pt-4 pb-3.5 sm:pb-4">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div className={`inline-flex p-1 rounded-full border border-slate-200 bg-slate-50`}>
                {([
                  ['fastest', 'Fastest'],
                  ['best', 'Best now'],
                  ['warmest', 'Warmest'],
                ] as [SortMode, string][]).map(([id, label]) => (
                  <button
                    key={id}
                    onClick={() => setSortBy(id)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition-all ${sortBy === id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-baseline mb-2">
              <span className={`text-[10px] font-semibold uppercase tracking-[1.2px] text-slate-400`}>Travel time (±30m)</span>
              <span className={`text-[20px] sm:text-[22px] font-bold tabular-nums text-slate-700`} style={{ fontFamily: 'Sora' }}>{formatTravelClock(maxH)}</span>
            </div>
            <div className="relative">
              <div
                className="pointer-events-none absolute -top-8 rounded-full bg-white/95 border border-amber-100 px-2.5 py-1 shadow-sm text-[12px] font-semibold text-slate-700 tabular-nums"
                style={{ left: `${sliderLeftPct}%`, transform: 'translateX(-50%)' }}
              >
                {formatTravelClock(maxH)}
              </div>
              <input
                type="range"
                min={1}
                max={4.5}
                step={0.25}
                value={maxH}
                className={`travel-slider ${isDraggingSlider ? 'dragging' : ''} ${sliderSnapPulse ? 'snap-pulse' : ''}`}
                onPointerDown={() => setIsDraggingSlider(true)}
                onPointerUp={() => setIsDraggingSlider(false)}
                onPointerCancel={() => setIsDraggingSlider(false)}
                onBlur={() => setIsDraggingSlider(false)}
                onChange={e => handleSliderChange(parseFloat(e.target.value))}
              />
              {data && (
                <>
                  <button
                    type="button"
                    aria-label="Explain optimal marker"
                    aria-expanded={showOptimalInfo}
                    className="opt-hit"
                    style={{ left: `${optPct}%` }}
                    onMouseEnter={() => setShowOptimalInfo(true)}
                    onMouseLeave={() => setShowOptimalInfo(false)}
                    onFocus={() => setShowOptimalInfo(true)}
                    onBlur={() => setShowOptimalInfo(false)}
                    onClick={(ev) => {
                      ev.stopPropagation()
                      setMaxH(markerOptH)
                      setOptimalH(markerOptH)
                      setHasSetOptimal(true)
                      setShowOptimalInfo(true)
                    }}
                  />
                  <div className={`opt-mark ${optimalHint ? 'opt-pop' : ''}`} style={{ left: `${optPct}%` }} aria-hidden="true">☀️</div>
                  {showOptimalInfo && (
                    <div className="opt-tip" style={{ left: `${optPct}%` }}>
                      Optimal = highest net sun after travel in this range.
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[8.5px] sm:text-[9px] text-slate-400">
              <span>Less time</span><span className="font-medium text-slate-500">Net sun optimized</span><span>More options</span>
            </div>
            {optimalHint && (
              <p className="mt-1 text-[10px] text-sky-600 font-medium">Auto-jumped to optimal net-sun range</p>
            )}
            <p className={`mt-1 text-[9.5px] font-medium text-slate-400`}>Sorting stays on <span className="text-slate-600">{sortLabel}</span> while you adjust travel time.</p>
            <div className={`flex justify-between text-[8.5px] sm:text-[9px] mt-1 px-0.5 text-slate-300`}>
              <span>1h</span><span>2h</span><span>3h</span><span>4h</span><span>4h 30m</span>
            </div>
          </div>

          <button onClick={() => toggleSetting('mode')} className={`setting-toggle w-full flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 border-t cursor-pointer border-slate-100`}>
            <div className="flex items-center gap-2">
              <CarI c={`w-[18px] h-[18px] text-slate-400`} />
              <span className={`text-[13px] font-medium text-slate-800`}>Travel mode</span>
              <span className={`text-[12px] text-slate-400`}>{modeLbl[mode]}</span>
            </div>
            <ChevD c={`w-3.5 h-3.5 text-slate-300 transition-transform ${openSetting === 'mode' ? 'rotate-180' : ''}`} />
          </button>
          {openSetting === 'mode' && (
            <div className="px-5 pb-4">
              <div className="flex gap-1.5">
                {([['car','Car',CarI],['train','Train',TrainI],['both','Both',BothI]] as [TravelMode,string,typeof CarI][]).map(([m,l,Ic]) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[12px] font-medium border transition-all
                      ${mode === m ? 'mode-btn-active' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                    <Ic c="w-4 h-4" /> {l}
                  </button>
                ))}
              </div>
              {(mode === 'train' || mode === 'both') && (
                <label className={`flex items-center gap-1.5 mt-2.5 text-[11px] cursor-pointer select-none text-slate-500`}>
                  <input type="checkbox" checked={ga} onChange={e => setGA(e.target.checked)} className="rounded border-slate-300 accent-amber-500 w-3.5 h-3.5" />
                  I have a GA travelcard
                </label>
              )}
            </div>
          )}

          <button onClick={() => toggleSetting('filter')} className={`setting-toggle w-full flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 border-t cursor-pointer border-slate-100`}>
            <div className="flex items-center gap-2">
              <FilterI c={`w-[18px] h-[18px] text-slate-400`} />
              <span className={`text-[13px] font-medium text-slate-800`}>Filters</span>
              <span className={`text-[12px] text-slate-400`}>{filterSummary}</span>
            </div>
            <ChevD c={`w-3.5 h-3.5 text-slate-300 transition-transform ${openSetting === 'filter' ? 'rotate-180' : ''}`} />
          </button>
          {openSetting === 'filter' && (
            <div className="px-5 pb-4">
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map(t => (
                  <button key={t.id} onClick={() => toggleType(t.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium border-[1.5px] transition-all select-none ${types.includes(t.id) ? 'chip-active' : 'chip-inactive'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ══════ RESULTS ══════ */}
      <section className="max-w-xl mx-auto px-4 mt-4 sm:mt-5 pb-14 sm:pb-16">
        {loading && !data ? (
          <div className="text-center py-16">
            <div className="sun-anim w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 mx-auto" />
            <p className={`mt-4 text-sm text-slate-400`}>Finding sunshine...</p>
          </div>
        ) : data?.escapes?.length ? (
          <>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className={`text-[16px] font-bold text-slate-800`} style={{ fontFamily: 'Sora', letterSpacing: '-0.3px' }}>
                {dayFocus === 'tomorrow' ? "Tomorrow's sunny escapes" : 'Your sunny escapes'}
              </h2>
              <span className={`text-[11px] text-slate-400`}>{sortedEscapes.length} found</span>
            </div>
            {loading && (
              <div className={`mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium border border-slate-200 bg-white text-slate-500`}>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                Updating forecast...
              </div>
            )}
            <div className={`space-y-2 transition-opacity duration-200 ${(loading || isDraggingSlider) ? 'opacity-70' : 'opacity-100'}`} aria-busy={loading ? 'true' : 'false'}>
              {sortedEscapes.map((e, i) => {
                const carMin = e.travel.car?.duration_min ?? Infinity
                const trainMin = e.travel.train?.duration_min ?? Infinity
                const conditionsMeta = parseSunConditions(e.conditions)
                const bestMode: 'car' | 'train' | null =
                  carMin <= trainMin
                    ? Number.isFinite(carMin) ? 'car' : Number.isFinite(trainMin) ? 'train' : null
                    : Number.isFinite(trainMin) ? 'train' : Number.isFinite(carMin) ? 'car' : null
                const bestMin = Math.min(carMin, trainMin)
                const trainCacheKey = `${e.destination.id}|${origin.name}|${demo ? 'demo' : 'live'}`
                const trainState = trainPreview[trainCacheKey]

                return (
                <div key={e.destination.id}
                  className={`escape-card anim-in d${Math.min(i+1,5)} cursor-pointer rounded-[14px] border border-slate-100`}
                  onClick={() => { setOpenCard(openCard === i ? null : i); setScorePopup(null) }}>
                  <div className="p-3 sm:p-4 flex gap-2.5 sm:gap-3 items-start">
                    <div className="score-wrap" onClick={ev => ev.stopPropagation()}>
                      <ScoreRing
                        score={e.sun_score.score}
                        onTap={() => setScorePopup(scorePopup === i ? null : i)}
                        pulse={scorePulse}
                      />
                      {scorePopup === i && (
                        <div className="score-popup">
                          <p className="text-[11px] font-semibold text-amber-500">{Math.round(e.sun_score.score * 100)}% FOMOscore</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Tier: {ringTier(e.sun_score.score).label}</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Clear-sky daylight expected.</p>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[11px]">{FLAG[e.destination.country]}</span>
                            <span className={`font-semibold text-[14px] sm:text-[15px] text-slate-800`}>{e.destination.name}</span>
                          </div>
                          <p className={`text-[10.5px] sm:text-[11px] mt-0.5 text-slate-400`}>{e.destination.region} · {e.destination.altitude_m.toLocaleString()} m</p>
                        </div>
                        <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-semibold border bg-sky-50 border-sky-100 text-sky-700`}>
                          <span aria-hidden="true">{weatherGlyph(e.weather_now?.summary)}</span>
                          <span>{weatherChipLabel(e.weather_now?.summary)}</span>
                          <span>{Math.round(e.weather_now?.temp_c ?? 0)}°</span>
                        </div>
                      </div>
                      {/* v18: compact card shows only the fastest travel mode */}
                      <div className="flex items-center gap-2.5 mt-1.5">
                        {bestMode && Number.isFinite(bestMin) && (
                          <span className={`flex items-center gap-1 text-[11px] text-slate-500`}>
                            {bestMode === 'car' ? <CarI c="w-[13px] h-[13px] text-slate-400" /> : <TrainI c="w-[13px] h-[13px] text-slate-400" />}
                            <strong className="text-slate-700">{bestMin} min</strong>
                            <span className="text-slate-400">by {bestMode}</span>
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1 text-[11px] text-slate-500`}>
                          <span aria-hidden="true">☀️</span>
                          <SunHoursInline
                            minutes={conditionsMeta.sunMin ?? e.sun_score.sunshine_forecast_min}
                            valueClass="text-[12px] font-semibold text-slate-700"
                            unitClass="text-[10px] text-slate-500"
                          />
                          {conditionsMeta.comparison && (
                            <span className={`font-semibold text-emerald-700`}>
                              {conditionsMeta.comparison}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* v15: timeline bars always visible, improved colors in CSS */}
                  <div className="px-4 pb-3">
                    {e.sun_timeline && (
                      <SunBar
                        timeline={e.sun_timeline}
                        demo={demo}
                        sunWindow={data.sun_window}
                        dayFocus={dayFocus}
                        travelMin={Number.isFinite(bestMin) ? bestMin : undefined}
                        forecastSunMin={e.sun_score.sunshine_forecast_min}
                        showHourLabels={false}
                        isLoading={loading}
                      />
                    )}
                  </div>

                  {openCard === i && (
                    <div className={`border-t px-4 py-3.5 anim-in rounded-b-[14px] border-slate-100 bg-slate-50/50`}>
                      <p className={`text-[11px] mb-2 leading-snug text-slate-600`}>Forecast: {e.weather_now?.summary || 'Mixed conditions'}</p>
                      {mode !== 'car' && e.travel.train && e.destination.sbb_name && (
                        <div className="mb-3 rounded-xl border border-slate-200 bg-white px-2.5 py-2">
                          <p className="text-[10px] font-semibold text-slate-700 mb-1.5">🚆 Next trains from {origin.name}</p>
                          {trainState?.loading ? (
                            <p className="text-[10px] text-slate-500">Loading live connections...</p>
                          ) : trainState?.rows?.length ? (
                            <div className="space-y-1.5">
                              {trainState.rows.slice(0, 3).map(row => (
                                <a
                                  key={`${row.id}-${row.departure_hhmm}`}
                                  href={row.sbb_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={ev => ev.stopPropagation()}
                                  className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border border-slate-100 px-2 py-1.5 hover:bg-slate-50"
                                >
                                  <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${trainCategoryClass(row.category)}`}>{row.line}</span>
                                  <span className="text-[10px] text-slate-600 font-medium tabular-nums">
                                    <strong className="text-slate-800">{row.departure_hhmm}</strong> → {row.arrival_hhmm}
                                  </span>
                                  <span className="text-[9px] text-slate-500 tabular-nums">
                                    {row.duration_min}m{row.transfers === 0 ? ', direct' : `, ${row.transfers}×`}
                                    {row.platform ? ` · Pl ${row.platform}` : ''}
                                  </span>
                                </a>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[10px] text-slate-500">Live connection preview unavailable right now.</p>
                          )}
                          {e.links.sbb && (
                            <a
                              href={e.links.sbb}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={ev => ev.stopPropagation()}
                              className="mt-1 inline-block text-[10px] font-medium text-red-600 hover:underline"
                            >
                              View all on SBB
                            </a>
                          )}
                        </div>
                      )}
                      <p className={`text-[9px] font-semibold uppercase tracking-[1.2px] mb-2 text-slate-400`}>Travel options</p>
                      <div className="flex items-center flex-wrap gap-2 mb-3">
                        {e.travel.car && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] bg-white text-slate-600 border border-slate-200`}>
                            <CarI c="w-3 h-3" />
                            <strong>{e.travel.car.duration_min} min</strong>
                            <span>car</span>
                          </span>
                        )}
                        {e.travel.train && (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] bg-white text-slate-600 border border-slate-200`}>
                            <TrainI c="w-3 h-3" />
                            <strong>{e.travel.train.duration_min} min</strong>
                            <span>train</span>
                            {e.travel.train.changes !== undefined && <span className="text-slate-400">{e.travel.train.changes}×</span>}
                            {e.travel.train.ga_included && <span className="text-[8px] bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded font-semibold">GA</span>}
                          </span>
                        )}
                      </div>

                      <p className={`text-[9px] font-semibold uppercase tracking-[1.2px] mb-2 text-slate-400`}>Trip plan</p>
                      <div className="space-y-1.5">
                        {e.plan.map((step, j) => (
                          <p key={j} className="text-[12px] leading-snug text-slate-600">{step}</p>
                        ))}
                      </div>
                      <div className="flex gap-1.5 mt-3">
                        {mode !== 'train' && e.links.google_maps && (
                          <a href={e.links.google_maps} target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-800 text-white text-[11px] font-semibold hover:bg-slate-700 transition-colors">
                            <MapI />
                            Navigate
                          </a>
                        )}
                        {mode !== 'car' && e.links.sbb && (
                          <a href={e.links.sbb} target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-red-600 text-white text-[11px] font-semibold hover:bg-red-500 transition-colors">
                            <TrainI c="w-3.5 h-3.5" />
                            SBB Timetable
                          </a>
                        )}
                        {e.links.webcam && <a href={e.links.webcam} target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white text-slate-500 border border-slate-200 text-[11px] font-semibold hover:bg-slate-50 transition-colors"><CamI /> Webcam</a>}
                      </div>
                      <a
                        href={buildWhatsAppHref(e)}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={ev => ev.stopPropagation()}
                        className={`wa-btn mt-2.5 inline-flex items-center gap-1.5 rounded-full px-3 text-[10px] font-semibold transition-all bg-white text-emerald-700 shadow-sm border border-emerald-100 hover:shadow hover:border-emerald-200`}
                      >
                        <WaIcon c="w-3.5 h-3.5" /> Share via WhatsApp
                      </a>
                    </div>
                  )}
                </div>
              )})}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <p className={`text-base mb-1 text-slate-500`}>No sunny escapes found</p>
            <p className={`text-xs text-slate-400`}>Try expanding your travel time or changing filters</p>
          </div>
        )}
      </section>
      <footer className={`px-4 pb-6 text-center text-slate-400`}>
        <div className="flex items-center justify-center gap-3 text-[11px]">
          <button
            onClick={detectLocation}
            disabled={locating}
            className={`underline-offset-2 hover:underline ${locating ? 'opacity-70' : ''}`}
          >
            {locating ? 'Locating...' : 'Use my location'}
          </button>
          {originMode === 'gps' && (
            <button
              onClick={() => { setOriginMode('manual'); setHasSetOptimal(false); setOptimalH(null) }}
              className="underline-offset-2 hover:underline"
            >
              Use selected city
            </button>
          )}
          <span className="opacity-40">•</span>
          <a href="/admin" className="underline-offset-2 hover:underline">
            Admin
          </a>
        </div>
      </footer>
    </div>
  )
}
