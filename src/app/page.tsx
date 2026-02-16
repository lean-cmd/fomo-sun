'use client'

import { useState, useEffect, useCallback, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Car,
  Clock3,
  ChevronDown,
  Cloud,
  Info,
  LocateFixed,
  MapPinned,
  Mountain,
  SlidersHorizontal,
  Sun,
  Thermometer,
  TrainFront,
} from 'lucide-react'
import {
  DaylightWindow,
  SunnyEscapesResponse,
  SunTimeline,
  TravelMode,
} from '@/lib/types'
import { formatSunHours, formatTravelClock } from '@/lib/format'
import { buildOriginSentences } from '@/lib/origin-sentences'

type TripSpan = 'daytrip' | 'plus1day'
type DayFocus = 'today' | 'tomorrow'
type EscapeCard = SunnyEscapesResponse['escapes'][number]
type TrainConnectionPreview = {
  id: string
  departure_hhmm: string
  arrival_hhmm: string
  duration_min: number
  transfers: number
  note?: string
}
type WeatherKind = 'sunny' | 'partly' | 'cloudy' | 'foggy'
type EscapeFilterChip = 'mountain' | 'town' | 'ski' | 'thermal' | 'lake'

type CitySeed = { name: string; lat: number; lon: number }

const MIN_TRAVEL_H = 0
const MAX_TRAVEL_H = 4.5
const JOYSTICK_MAX_PX = 42

const TRAVEL_BANDS = [
  { id: 'quick', label: '0-60min', minH: 0, maxH: 1, maxLabel: '1h' },
  { id: 'short', label: '1h-2h', minH: 1, maxH: 2, maxLabel: '2h' },
  { id: 'mid', label: '2h-3h', minH: 2, maxH: 3, maxLabel: '3h' },
  { id: 'long', label: '3h+', minH: 3, maxH: 4.5, maxLabel: '3hrs+' },
] as const

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

const TYPE_FILTER_CHIPS: { id: EscapeFilterChip; label: string }[] = [
  { id: 'mountain', label: '⛰️ Mountain' },
  { id: 'town', label: '🏘️ Town' },
  { id: 'ski', label: '🏔️ Ski' },
  { id: 'thermal', label: '♨️ Thermal' },
  { id: 'lake', label: '🌊 Lake' },
]

const FLAG: Record<string, string> = { CH: 'CH', DE: 'DE', FR: 'FR' }

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function normalizeWindow(win?: DaylightWindow): DaylightWindow {
  const start = clamp(Math.round(win?.start_hour ?? 7), 0, 23)
  const end = clamp(Math.round(win?.end_hour ?? 19), start + 1, 24)
  return { start_hour: start, end_hour: end }
}

function buildHourTicks(win?: DaylightWindow) {
  const { start_hour, end_hour } = normalizeWindow(win)
  const ticks: number[] = []
  for (let h = Math.ceil(start_hour / 2) * 2; h <= end_hour; h += 2) ticks.push(h)
  if (ticks.length === 0 || ticks[0] !== start_hour) ticks.unshift(start_hour)
  if (ticks[ticks.length - 1] !== end_hour) ticks.push(end_hour)
  return ticks
}

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

function weatherKind(summary?: string): WeatherKind {
  const s = (summary || '').toLowerCase()
  if (s.includes('fog') || s.includes('low cloud')) return 'foggy'
  if (s.includes('partly')) return 'partly'
  if (s.includes('clear') || s.includes('sunny') || s.includes('sun')) return 'sunny'
  return 'cloudy'
}

function weatherLabel(summary?: string) {
  const kind = weatherKind(summary)
  if (kind === 'sunny') return 'Sunny'
  if (kind === 'partly') return 'Partly sunny'
  if (kind === 'foggy') return 'Fog or low cloud'
  return 'Cloudy'
}

function weatherEmoji(summary?: string) {
  const kind = weatherKind(summary)
  if (kind === 'sunny' || kind === 'partly') return '☀️'
  if (kind === 'foggy') return '☁️'
  return '☁️'
}

function extractTemp(summary?: string) {
  if (!summary) return null
  const m = summary.match(/(-?\d+)\s*°c/i)
  return m ? Number(m[1]) : null
}

function ringTier(score: number) {
  if (score >= 0.9) return { id: 'elite', colors: ['#fbbf24', '#f59e0b', '#ef4444'] }
  if (score >= 0.75) return { id: 'strong', colors: ['#f59e0b', '#f97316', '#ef4444'] }
  if (score >= 0.55) return { id: 'promising', colors: ['#fb923c', '#f97316', '#dc2626'] }
  return { id: 'low', colors: ['#fdba74', '#fb923c', '#ea580c'] }
}

function ScoreRing({ score, size = 44 }: { score: number; size?: number }) {
  const pct = Math.round(score * 100)
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const tier = ringTier(score)
  const gradId = `fomo-ring-${tier.id}-${size}-${pct}`

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }} aria-label={`FOMO score ${pct}%`}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={tier.colors[0]} />
            <stop offset="55%" stopColor={tier.colors[1]} />
            <stop offset="100%" stopColor={tier.colors[2]} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={4} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gradId})`}
          strokeWidth={4}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - score)}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 300ms ease-out' }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[12px] font-semibold text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>{pct}%</span>
        <span className="text-[6px] tracking-[0.16em] text-amber-600 font-semibold">FOMO</span>
      </span>
    </div>
  )
}

function SunTimelineBar({
  timeline,
  dayFocus,
  sunWindow,
  showNowMarker = false,
  travelMin,
  compact = false,
}: {
  timeline: SunTimeline
  dayFocus: DayFocus
  sunWindow?: { today: DaylightWindow; tomorrow: DaylightWindow }
  showNowMarker?: boolean
  travelMin?: number
  compact?: boolean
}) {
  const win = normalizeWindow(sunWindow?.[dayFocus])
  const leftNightPct = (win.start_hour / 24) * 100
  const daylightPct = ((win.end_hour - win.start_hour) / 24) * 100
  const rightNightPct = Math.max(0, 100 - leftNightPct - daylightPct)
  const rawSegments = timeline?.[dayFocus] || []
  const daySegments = rawSegments.filter(seg => seg.condition !== 'night')
  const total = Math.max(1, daySegments.reduce((sum, seg) => sum + seg.pct, 0))
  const hourTicks = buildHourTicks(win)

  const now = new Date()
  const nowHour = now.getHours() + now.getMinutes() / 60
  const nowPct = clamp((nowHour / 24) * 100, 0, 100)
  const travelWidthPct = travelMin ? clamp(((travelMin / 60) / 24) * 100, 0, 100 - nowPct) : 0

  return (
    <div className="space-y-1">
      <div className={`fomo-timeline ${compact ? 'h-[20px]' : 'h-7'}`}>
        {leftNightPct > 0 && <div className="tl-seg tl-night" style={{ width: `${leftNightPct}%` }} />}
        <div className="h-full flex" style={{ width: `${daylightPct}%` }}>
          {daySegments.map((seg, idx) => (
            <div key={`${seg.condition}-${idx}`} className={`tl-seg tl-${seg.condition}`} style={{ width: `${(seg.pct / total) * 100}%` }} />
          ))}
        </div>
        {rightNightPct > 0 && <div className="tl-seg tl-night" style={{ width: `${rightNightPct}%` }} />}

        {showNowMarker && <div className="tl-now" style={{ left: `${nowPct}%` }} />}
        {travelMin && travelWidthPct > 0 && (
          <div className="tl-travel-overlay" style={{ left: `${nowPct}%`, width: `${travelWidthPct}%` }} />
        )}
      </div>
      {!compact && (
        <div className="fomo-timeline-hours">
          {hourTicks.map(t => <span key={t}>{t}</span>)}
        </div>
      )}
    </div>
  )
}

function timelineEmojiPreview(timeline: SunTimeline | undefined, dayFocus: DayFocus) {
  const segments = dayFocus === 'tomorrow' ? timeline?.tomorrow || [] : timeline?.today || []
  if (!segments.length) return '☁️☁️☁️☀️☀️☁️☁️🌙'
  const slotCount = 8
  const slots: string[] = []
  for (const seg of segments) {
    const icon = seg.condition === 'night' ? '🌙' : seg.condition === 'sun' || seg.condition === 'partial' ? '☀️' : '☁️'
    const n = Math.max(1, Math.round((seg.pct / 100) * slotCount))
    for (let i = 0; i < n; i += 1) slots.push(icon)
  }
  while (slots.length < slotCount) slots.push('☁️')
  return slots.slice(0, slotCount).join('')
}

function IconForMode({ mode }: { mode: 'car' | 'train' }) {
  return mode === 'car'
    ? <Car className="w-4 h-4" strokeWidth={1.8} />
    : <TrainFront className="w-4 h-4" strokeWidth={1.8} />
}

function WhatsAppIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#25D366" />
      <path
        fill="#fff"
        d="M16.6 13.9c-.2-.1-1.2-.6-1.4-.7-.2-.1-.3-.1-.5.1-.1.2-.6.7-.7.8-.1.1-.2.2-.4.1-.2-.1-.9-.3-1.7-1-.6-.5-1-1.1-1.1-1.3-.1-.2 0-.3.1-.4.1-.1.2-.2.3-.4.1-.1.1-.2.2-.3.1-.1 0-.2 0-.3s-.5-1.2-.7-1.6c-.2-.4-.3-.4-.5-.4h-.4c-.1 0-.3 0-.4.2-.1.2-.6.6-.6 1.5 0 .9.6 1.7.7 1.8.1.1 1.3 2 3.2 2.8 1.9.8 1.9.6 2.3.6.4 0 1.2-.5 1.3-1 .2-.5.2-.9.1-1-.1-.1-.2-.1-.4-.2Z"
      />
    </svg>
  )
}

function DestinationStamp({ escape }: { escape: EscapeCard }) {
  const typeSet = new Set(escape.destination.types || [])
  const stampKind = typeSet.has('thermal')
    ? 'thermal'
    : typeSet.has('lake')
      ? 'lake'
      : typeSet.has('town')
        ? 'town'
        : typeSet.has('mountain')
          ? 'mountain'
          : 'sun'

  return (
    <div className="hero-stamp" aria-hidden="true">
      <div className="hero-stamp-name">{escape.destination.name.toUpperCase()}</div>
      <svg viewBox="0 0 56 20" className="hero-stamp-icon">
        {stampKind === 'mountain' && <path d="M3 18 16 4 26 14 33 8 45 18Z" fill="currentColor" opacity="0.9" />}
        {stampKind === 'lake' && <path d="M4 12c4 0 4 2 8 2s4-2 8-2 4 2 8 2 4-2 8-2 4 2 8 2" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />}
        {stampKind === 'town' && (
          <>
            <rect x="8" y="9" width="16" height="9" fill="currentColor" opacity="0.9" />
            <path d="M33 18V6l5-4 5 4v12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          </>
        )}
        {stampKind === 'thermal' && (
          <>
            <path d="M12 18h32" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            <path d="M20 16c2-3-2-4 0-7m8 7c2-3-2-4 0-7m8 7c2-3-2-4 0-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
          </>
        )}
        {stampKind === 'sun' && (
          <>
            <circle cx="28" cy="10" r="4" fill="currentColor" />
            <path d="M28 1v4M28 15v4M19 10h4M33 10h4M22.5 4.5l2.8 2.8M30.7 12.7l2.8 2.8M33.5 4.5l-2.8 2.8M25.3 12.7l-2.8 2.8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </>
        )}
      </svg>
      <div className="hero-stamp-alt">{escape.destination.altitude_m}m</div>
    </div>
  )
}

function getBestTravel(escape: EscapeCard) {
  const car = escape.travel.car?.duration_min ?? Infinity
  const train = escape.travel.train?.duration_min ?? Infinity
  if (car <= train) {
    if (Number.isFinite(car)) return { mode: 'car' as const, min: car }
    if (Number.isFinite(train)) return { mode: 'train' as const, min: train }
    return null
  }
  if (Number.isFinite(train)) return { mode: 'train' as const, min: train }
  if (Number.isFinite(car)) return { mode: 'car' as const, min: car }
  return null
}

export default function Home() {
  const [rangeIndex, setRangeIndex] = useState(1)
  const [previewRangeIndex, setPreviewRangeIndex] = useState<number | null>(null)
  const [joyX, setJoyX] = useState(0)
  const [isJoystickActive, setIsJoystickActive] = useState(false)
  const [joystickNudge, setJoystickNudge] = useState(true)

  const [mode, setMode] = useState<TravelMode>('both')
  const [activeTypeChips, setActiveTypeChips] = useState<EscapeFilterChip[]>([])
  const [showResultFilters, setShowResultFilters] = useState(false)
  const [tripSpan, setTripSpan] = useState<TripSpan>('daytrip')
  const [tripSpanTouched, setTripSpanTouched] = useState(false)

  const [data, setData] = useState<SunnyEscapesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [demo, setDemo] = useState(true)
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [heroFlowDir, setHeroFlowDir] = useState<'left' | 'right'>('right')
  const [heroFlowTick, setHeroFlowTick] = useState(0)
  const [tickerIndex, setTickerIndex] = useState(0)
  const [tickerFade, setTickerFade] = useState(false)

  const [selectedCity, setSelectedCity] = useState<string>('Basel')
  const [gpsOrigin, setGpsOrigin] = useState<{ lat: number; lon: number; name: string } | null>(null)
  const [originMode, setOriginMode] = useState<'manual' | 'gps'>('manual')
  const [locating, setLocating] = useState(false)

  const [expandedScoreDetails, setExpandedScoreDetails] = useState<Record<string, boolean>>({})
  const [trainPreviewById, setTrainPreviewById] = useState<Record<string, { loading: boolean; rows: TrainConnectionPreview[]; error?: boolean }>>({})

  const requestCtrlRef = useRef<AbortController | null>(null)
  const resultsRef = useRef<HTMLElement | null>(null)
  const joystickZoneRef = useRef<HTMLDivElement | null>(null)
  const joyAnimRef = useRef<number | null>(null)
  const joyPosRef = useRef(0)
  const joyVelRef = useRef(0)
  const joyPrevTsRef = useRef(0)
  const joyPrevXRef = useRef(0)
  const joystickPointerRef = useRef<number | null>(null)
  const joystickDirRef = useRef<'left' | 'right' | null>(null)
  const joyBaseRangeRef = useRef(1)
  const previewRangeRef = useRef<number | null>(null)

  const manualOrigin = useMemo(
    () => MANUAL_ORIGIN_CITIES.find(city => city.name === selectedCity) || MANUAL_ORIGIN_CITIES[0],
    [selectedCity]
  )
  const origin = originMode === 'gps' && gpsOrigin ? gpsOrigin : manualOrigin
  const effectiveRangeIndex = previewRangeIndex ?? rangeIndex
  const activeBand = TRAVEL_BANDS[effectiveRangeIndex]
  const maxH = activeBand.maxH

  const dayFocus: DayFocus = tripSpan === 'plus1day' ? 'tomorrow' : 'today'
  const topEscape = data?.escapes?.[0] ?? null
  const fastestEscape = data?.fastest_escape ?? null
  const originSunMin = data?.origin_conditions.sunshine_min ?? 0
  const originTempC = extractTemp(data?.origin_conditions.description || '') ?? 0
  const originFomoPct = data ? Math.round(data.origin_conditions.sun_score * 100) : 0

  const applyJoyPosition = useCallback((nextJoy: number, updateRange = true) => {
    const clamped = clamp(nextJoy, -1, 1)
    joyPosRef.current = clamped
    setJoyX(clamped)
    if (!updateRange) return

    const magnitude = Math.abs(clamped)
    let shift = 0
    if (magnitude >= 0.26) shift = 1
    if (clamped < 0) shift *= -1

    const nextIndex = clamp(joyBaseRangeRef.current + shift, 0, TRAVEL_BANDS.length - 1)
    const prevIndex = previewRangeRef.current ?? rangeIndex
    if (nextIndex !== prevIndex) {
      previewRangeRef.current = nextIndex
      setPreviewRangeIndex(nextIndex)
      joystickDirRef.current = nextIndex > prevIndex ? 'right' : 'left'
      navigator.vibrate?.(4)
    }
  }, [rangeIndex])

  const stopJoystickAnim = useCallback(() => {
    if (joyAnimRef.current !== null) {
      cancelAnimationFrame(joyAnimRef.current)
      joyAnimRef.current = null
    }
  }, [])

  const startJoystickSpringBack = useCallback(() => {
    stopJoystickAnim()
    let x = joyPosRef.current
    let v = joyVelRef.current
    let lastTs = performance.now()
    const spring = 48
    const damping = 16
    const step = (ts: number) => {
      const dt = Math.min(0.032, Math.max(0.008, (ts - lastTs) / 1000))
      lastTs = ts
      const a = -spring * x - damping * v
      v += a * dt
      x += v * dt
      applyJoyPosition(x, false)
      if (Math.abs(x) < 0.002 && Math.abs(v) < 0.01) {
        joyVelRef.current = 0
        applyJoyPosition(0, false)
        setIsJoystickActive(false)
        joyAnimRef.current = null
        return
      }
      joyVelRef.current = v
      joyAnimRef.current = requestAnimationFrame(step)
    }
    joyAnimRef.current = requestAnimationFrame(step)
  }, [applyJoyPosition, stopJoystickAnim])

  const pulseJoystick = useCallback((dir: 'left' | 'right', strength = 0.72) => {
    stopJoystickAnim()
    setIsJoystickActive(true)
    applyJoyPosition(dir === 'left' ? -strength : strength, false)
    joyVelRef.current = 0
    window.setTimeout(() => {
      startJoystickSpringBack()
    }, 28)
  }, [applyJoyPosition, startJoystickSpringBack, stopJoystickAnim])

  const stepJoystickRange = useCallback((dir: 'left' | 'right') => {
    setJoystickNudge(false)
    const delta = dir === 'left' ? -1 : 1
    const next = clamp(rangeIndex + delta, 0, TRAVEL_BANDS.length - 1)
    if (next === rangeIndex) {
      pulseJoystick(dir, 0.58)
      return
    }
    joystickDirRef.current = dir
    previewRangeRef.current = null
    setPreviewRangeIndex(null)
    setRangeIndex(next)
    pulseJoystick(dir)
  }, [pulseJoystick, rangeIndex])

  const setJoystickRange = useCallback((targetIndex: number) => {
    const next = clamp(targetIndex, 0, TRAVEL_BANDS.length - 1)
    if (next === rangeIndex) {
      pulseJoystick(next === 0 ? 'right' : 'left', 0.5)
      return
    }
    const dir = next > rangeIndex ? 'right' : 'left'
    joystickDirRef.current = dir
    previewRangeRef.current = null
    setPreviewRangeIndex(null)
    setRangeIndex(next)
    setJoystickNudge(false)
    pulseJoystick(dir, 0.64)
  }, [pulseJoystick, rangeIndex])

  const joyFromPointerX = useCallback((clientX: number) => {
    const el = joystickZoneRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const center = rect.left + rect.width / 2
    return clamp((clientX - center) / JOYSTICK_MAX_PX, -1, 1)
  }, [])

  const onJoystickPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    joystickPointerRef.current = e.pointerId
    joystickZoneRef.current?.setPointerCapture(e.pointerId)
    setJoystickNudge(false)
    setIsJoystickActive(true)
    stopJoystickAnim()
    joyBaseRangeRef.current = rangeIndex
    previewRangeRef.current = rangeIndex
    const next = joyFromPointerX(e.clientX)
    joyPrevTsRef.current = performance.now()
    joyPrevXRef.current = next
    joyVelRef.current = 0
    applyJoyPosition(next)
  }

  const onJoystickPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerRef.current !== e.pointerId) return
    const next = joyFromPointerX(e.clientX)
    const now = performance.now()
    const dt = Math.max(1, now - joyPrevTsRef.current)
    joyVelRef.current = (next - joyPrevXRef.current) / (dt / 1000)
    joyPrevTsRef.current = now
    joyPrevXRef.current = next
    applyJoyPosition(next)
  }

  const onJoystickPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (joystickPointerRef.current !== e.pointerId) return
    try {
      joystickZoneRef.current?.releasePointerCapture(e.pointerId)
    } catch {
      // no-op if pointer capture was already released
    }
    joystickPointerRef.current = null
    const finalIndex = previewRangeRef.current ?? rangeIndex
    if (finalIndex !== rangeIndex) {
      joystickDirRef.current = finalIndex > rangeIndex ? 'right' : 'left'
    }
    setRangeIndex(finalIndex)
    previewRangeRef.current = null
    setPreviewRangeIndex(null)
    startJoystickSpringBack()
  }

  const onJoystickKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      stepJoystickRange('left')
      return
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      stepJoystickRange('right')
    }
  }

  const rangeLabel = activeBand.label

  useEffect(() => {
    requestCtrlRef.current?.abort()
    const ctrl = new AbortController()
    requestCtrlRef.current = ctrl
    setLoading(true)

    const run = async () => {
      try {
        const p = new URLSearchParams({
          lat: String(origin.lat),
          lon: String(origin.lon),
          max_travel_h: String(activeBand.maxH),
          travel_min_h: String(activeBand.minH),
          travel_max_h: String(activeBand.maxH),
          mode,
          limit: '15',
          demo: String(demo),
          trip_span: tripSpan,
          origin_kind: originMode,
          origin_name: origin.name,
        })
        const res = await fetch(`/api/v1/sunny-escapes?${p.toString()}`, { signal: ctrl.signal })
        const payload: SunnyEscapesResponse = await res.json()
        setData(payload)
        if (joystickDirRef.current) {
          setHeroFlowDir(joystickDirRef.current)
          setHeroFlowTick(v => v + 1)
          joystickDirRef.current = null
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') console.error(err)
      } finally {
        if (requestCtrlRef.current === ctrl) setLoading(false)
      }
    }

    run()
  }, [activeBand.maxH, activeBand.minH, mode, demo, tripSpan, origin.lat, origin.lon, origin.name, originMode])

  useEffect(() => () => {
    requestCtrlRef.current?.abort()
    stopJoystickAnim()
  }, [stopJoystickAnim])

  useEffect(() => {
    if (!joystickNudge) return
    const t = setTimeout(() => setJoystickNudge(false), 4500)
    return () => clearTimeout(t)
  }, [joystickNudge])

  useEffect(() => {
    if (!data || tripSpanTouched) return
    const hour = new Date().getHours()
    if (hour >= 17 || data.sunset.is_past || data.sunset.minutes_until <= 30) {
      setTripSpan('plus1day')
    }
  }, [data, tripSpanTouched])

  const originSentences = useMemo(() => {
    if (!data || !topEscape) return []
    const bestTravel = getBestTravel(topEscape)
    return buildOriginSentences({
      city: origin.name,
      condition: weatherLabel(data.origin_conditions.description),
      temp_c: originTempC,
      sun_hours_today: formatSunHours(data.origin_conditions.sunshine_min),
      sun_hours_tomorrow: formatSunHours(Math.round((data.tomorrow_sun_hours || 0) * 60)),
      best_escape_name: topEscape.destination.name,
      best_escape_sun: formatSunHours(topEscape.sun_score.sunshine_forecast_min),
      travel_time: bestTravel ? `${bestTravel.min} min` : 'short drive',
      altitude_m: topEscape.destination.altitude_m,
      origin_score_pct: originFomoPct,
      best_score_pct: Math.round(topEscape.sun_score.score * 100),
    })
  }, [data, topEscape, origin.name, originTempC, originFomoPct])

  useEffect(() => {
    setTickerIndex(0)
    if (originSentences.length <= 1) {
      setTickerFade(false)
      return
    }

    let fadeTimeout: number | null = null
    const interval = window.setInterval(() => {
      setTickerFade(true)
      fadeTimeout = window.setTimeout(() => {
        setTickerIndex(prev => (prev + 1) % originSentences.length)
        setTickerFade(false)
      }, 200)
    }, 6000)

    return () => {
      window.clearInterval(interval)
      if (fadeTimeout) window.clearTimeout(fadeTimeout)
    }
  }, [originSentences])

  const tickerText = originSentences[tickerIndex] || `Forecast in ${origin.name}: ${originTempC}° · ${weatherLabel(data?.origin_conditions.description)}`

  const detectLocation = async () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        try {
          const lat = pos.coords.latitude
          const lon = pos.coords.longitude
          const fallbackName = fallbackNearestCity(lat, lon)
          const r = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=8&language=en&format=json`)
          const payload = await r.json()
          const nearest = pickNearestCityName(payload) || fallbackName
          setGpsOrigin({ lat, lon, name: nearest })
        } catch {
          setGpsOrigin({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            name: fallbackNearestCity(pos.coords.latitude, pos.coords.longitude),
          })
        }
        setOriginMode('gps')
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000 }
    )
  }

  const selectManualCity = (name: string) => {
    setSelectedCity(name)
    setOriginMode('manual')
  }

  const fallbackNotice = data?._meta?.fallback_notice || ''
  const resultRows = data?.escapes || []

  const topBestTravel = topEscape ? getBestTravel(topEscape) : null
  const topSunMin = topEscape?.sun_score.sunshine_forecast_min ?? 0
  const topNetSunMin = topEscape?.net_sun_min ?? 0
  const sunGainMin = Math.max(0, topSunMin - originSunMin)

  const toggleTypeChip = (chip: EscapeFilterChip) => {
    setActiveTypeChips(prev => prev.includes(chip) ? prev.filter(x => x !== chip) : [...prev, chip])
  }

  const jumpToBestDetails = () => {
    if (topEscape) setOpenCardId(topEscape.destination.id)
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const filteredRows = useMemo(() => {
    const better = resultRows.filter(escape => escape.sun_score.sunshine_forecast_min > originSunMin)
    const typed = activeTypeChips.length === 0
      ? better
      : better.filter((escape) => {
        const has = (t: 'mountain' | 'town' | 'thermal' | 'lake') => escape.destination.types.includes(t)
        return activeTypeChips.some((chip) => {
          if (chip === 'ski') return has('mountain') && escape.destination.altitude_m >= 1200
          return has(chip)
        })
      })
    return typed
  }, [activeTypeChips, resultRows, originSunMin])

  const visibleRows = useMemo(() => filteredRows.slice(0, 5), [filteredRows])

  const displayRows = useMemo(() => {
    const base = visibleRows.map(escape => ({ escape, isFastest: false }))
    if (!fastestEscape) return base

    const existingIdx = base.findIndex(row => row.escape.destination.id === fastestEscape.destination.id)
    if (existingIdx >= 0) {
      return base.map((row, idx) => idx === existingIdx ? { ...row, isFastest: true } : row)
    }

    const merged = [...base]
    const insertAt = Math.min(1, merged.length)
    merged.splice(insertAt, 0, { escape: fastestEscape, isFastest: true })
    return merged.slice(0, 5)
  }, [fastestEscape, visibleRows])

  useEffect(() => {
    if (!displayRows.length) {
      setOpenCardId(null)
      return
    }
    setOpenCardId(displayRows[0]?.escape.destination.id ?? null)
  }, [displayRows])

  const timelineOriginPreview = timelineEmojiPreview(data?.origin_timeline, dayFocus)

  const buildWhatsAppHref = (escape: EscapeCard) => {
    const bestTravel = getBestTravel(escape)
    const travelText = bestTravel
      ? `${bestTravel.mode === 'car' ? '🚗' : '🚆'} ${formatTravelClock(bestTravel.min / 60)} from ${origin.name}`
      : ''
    const destinationSun = formatSunHours(escape.sun_score.sunshine_forecast_min)
    const destinationSky = timelineEmojiPreview(escape.sun_timeline, dayFocus)
    const gainMin = Math.max(0, escape.sun_score.sunshine_forecast_min - originSunMin)
    const shareText = [
      `🌤️ FOMO Sun: Escape the fog!`,
      '',
      `📍 ${escape.destination.name} (${escape.destination.altitude_m}m, ${escape.destination.region})`,
      `☀️ ${destinationSun} sun · FOMO ${Math.round(escape.sun_score.score * 100)}%`,
      travelText,
      '',
      `${origin.name}:    ${timelineOriginPreview}`,
      `${escape.destination.name}: ${destinationSky}`,
      '',
      gainMin > 0
        ? `🟢 +${formatSunHours(gainMin)} more sun than ${origin.name} ☀️`
        : `No additional sun vs ${origin.name}`,
      '',
      `→ fomosun.com`,
    ].filter(Boolean).join('\n')

    return `https://wa.me/?text=${encodeURIComponent(shareText)}`
  }

  const loadTrainPreview = useCallback(async (escape: EscapeCard) => {
    const id = escape.destination.id
    if (!escape.travel.train || !escape.destination.sbb_name) return
    const current = trainPreviewById[id]
    if (current?.loading || current?.rows?.length) return

    setTrainPreviewById(prev => ({ ...prev, [id]: { loading: true, rows: prev[id]?.rows || [] } }))
    try {
      const p = new URLSearchParams({
        from: origin.name,
        to: escape.destination.sbb_name,
        limit: '3',
        demo: String(demo),
        day_focus: dayFocus,
      })
      const res = await fetch(`/api/v1/sbb-connections?${p.toString()}`)
      const payload = await res.json()
      const rows = Array.isArray(payload?.connections) ? payload.connections : []
      setTrainPreviewById(prev => ({
        ...prev,
        [id]: {
          loading: false,
          rows,
          error: rows.length === 0,
        },
      }))
    } catch {
      setTrainPreviewById(prev => ({
        ...prev,
        [id]: {
          loading: false,
          rows: prev[id]?.rows || [],
          error: true,
        },
      }))
    }
  }, [dayFocus, demo, origin.name, trainPreviewById])

  useEffect(() => {
    if (!openCardId) return
    const active = displayRows.find(row => row.escape.destination.id === openCardId)?.escape
    if (!active || !active.travel.train || !active.destination.sbb_name) return
    const rec = trainPreviewById[active.destination.id]
    if (rec?.loading || rec?.rows?.length || rec?.error) return
    void loadTrainPreview(active)
  }, [displayRows, loadTrainPreview, openCardId, trainPreviewById])

  return (
    <div className="min-h-screen fomo-warm-bg fomo-grid-bg">
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur">
        <div className="max-w-xl mx-auto px-3 h-12 flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 h-8 min-w-0">
            <MapPinned className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.8} />
            <select
              value={selectedCity}
              onChange={e => selectManualCity(e.target.value)}
              className="bg-transparent text-[11px] text-slate-700 font-medium min-w-0 focus:outline-none"
              aria-label="Select origin city"
            >
              {MANUAL_ORIGIN_CITIES.map(city => (
                <option key={city.name} value={city.name}>{city.name}</option>
              ))}
            </select>
          </label>

          <div className="flex-1 flex justify-center">
            <div className="inline-flex p-0.5 rounded-full border border-slate-200 bg-slate-100">
              <button
                onClick={() => { setTripSpan('daytrip'); setTripSpanTouched(true) }}
                className={`px-2.5 h-7 rounded-full text-[10px] font-semibold transition ${tripSpan === 'daytrip' ? 'bg-white text-slate-900' : 'text-slate-500'}`}
              >
                Today
              </button>
              <button
                onClick={() => { setTripSpan('plus1day'); setTripSpanTouched(true) }}
                className={`px-2.5 h-7 rounded-full text-[10px] font-semibold transition ${tripSpan === 'plus1day' ? 'bg-white text-slate-900' : 'text-slate-500'}`}
              >
                Tomorrow
              </button>
            </div>
          </div>

          <button
            onClick={() => { setDemo(v => !v) }}
            className={`live-toggle ${demo ? 'is-demo' : 'is-live'}`}
            aria-label={`Switch to ${demo ? 'live' : 'demo'} mode`}
          >
            <span className={`live-toggle-label ${demo ? 'active' : ''}`}>Demo</span>
            <span className={`live-toggle-label ${!demo ? 'active' : ''}`}>Live</span>
            <span className={`live-toggle-thumb ${demo ? '' : 'on'}`} />
          </button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-3 pb-16">
        <section className="h-12 flex flex-col justify-center text-center">
          <p className="text-[13px] text-slate-700">
            <span className="text-slate-500">☀️ FOMO Sun | </span>
            <span className={`transition-opacity duration-[400ms] ${tickerFade ? 'opacity-0' : 'opacity-100'}`}>
              {tickerText}
            </span>
          </p>
          <p className="text-[10px] text-slate-400 inline-flex items-center justify-center gap-1 mt-0.5">
            <Info className="w-3 h-3" strokeWidth={1.8} /> Based on live forecast
          </p>
        </section>

        {fallbackNotice && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-medium px-3 py-2 mb-3 text-center">
            {fallbackNotice}
          </div>
        )}

        {topEscape && (
          <section
            key={`hero-${topEscape.destination.id}-${heroFlowTick}`}
            className={`fomo-card p-3.5 sm:p-4 mb-3 ${heroFlowDir === 'right' ? 'hero-flow-right' : 'hero-flow-left'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <ScoreRing score={topEscape.sun_score.score} size={44} />
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
                    Best escape {dayFocus === 'today' ? 'today' : 'tomorrow'}
                  </p>
                  <h1 className="text-[19px] leading-tight font-semibold text-slate-900 truncate" style={{ fontFamily: 'Sora, sans-serif' }}>
                    {topEscape.destination.name}
                  </h1>
                  <p className="text-[11px] text-slate-500 mt-0.5">{topEscape.destination.region} · {FLAG[topEscape.destination.country]}</p>
                  <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                    <p className="text-[19px] leading-none font-semibold text-amber-600 inline-flex items-end gap-1.5">
                      <Sun className="w-4 h-4 text-amber-500" strokeWidth={1.9} />
                      <span style={{ fontFamily: 'DM Mono, monospace' }}>{formatSunHours(topEscape.sun_score.sunshine_forecast_min)}</span>
                      {sunGainMin > 0 && (
                        <span className="text-[12px] text-emerald-600 font-semibold">
                          +{formatSunHours(sunGainMin)}
                        </span>
                      )}
                    </p>
                    {topBestTravel && (
                      <p className="text-[19px] leading-none text-slate-600 inline-flex items-end gap-1.5 font-medium" style={{ fontFamily: 'DM Mono, monospace' }}>
                        <IconForMode mode={topBestTravel.mode} />
                        {formatTravelClock(topBestTravel.min / 60)}
                      </p>
                    )}
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500" style={{ fontFamily: 'DM Mono, monospace' }}>
                    net {formatSunHours(topNetSunMin)} after arrival
                  </p>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <DestinationStamp escape={topEscape} />
                <a
                  href={buildWhatsAppHref(topEscape)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-11 rounded-full border border-emerald-200 bg-emerald-50/60 px-3 text-[11px] font-semibold text-slate-800 hover:bg-emerald-50"
                >
                  <WhatsAppIcon className="w-4 h-4" />
                  Share
                </a>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span className="font-medium">{origin.name}</span>
                <span style={{ fontFamily: 'DM Mono, monospace' }}>{formatSunHours(originSunMin)}</span>
              </div>
              <SunTimelineBar
                timeline={data?.origin_timeline || topEscape.sun_timeline}
                dayFocus={dayFocus}
                sunWindow={data?.sun_window}
                showNowMarker
                compact
              />

              <div className="flex items-center justify-between text-[11px] text-slate-700">
                <span className="font-semibold">{topEscape.destination.name}</span>
                <span style={{ fontFamily: 'DM Mono, monospace' }}>{formatSunHours(topEscape.sun_score.sunshine_forecast_min)}</span>
              </div>
              <SunTimelineBar
                timeline={topEscape.sun_timeline}
                dayFocus={dayFocus}
                sunWindow={data?.sun_window}
                travelMin={topBestTravel?.min}
                compact
              />
            </div>

            <div className="mt-3">
              <button
                type="button"
                onClick={jumpToBestDetails}
                className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                Plan this trip ↓
              </button>
            </div>
          </section>
        )}

        <section className="fomo-card p-3.5 sm:p-4 mb-3">
          <div className="text-center mb-2">
            <p className="text-[10px] uppercase tracking-[0.13em] text-slate-500 font-semibold">Travel joystick</p>
            <p className="text-[22px] font-semibold text-slate-900 leading-tight" style={{ fontFamily: 'DM Mono, monospace' }}>
              Max travel {activeBand.maxLabel}
            </p>
            <p className="text-[11px] text-slate-500">{rangeLabel} window · flick to switch</p>
          </div>

          <div className="flex justify-center mt-2"
          >
            <div
              ref={joystickZoneRef}
              className={`fomo-joystick ${isJoystickActive ? 'is-active' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2`}
              onPointerDown={onJoystickPointerDown}
              onPointerMove={onJoystickPointerMove}
              onPointerUp={onJoystickPointerUp}
              onPointerCancel={onJoystickPointerUp}
              onKeyDown={onJoystickKeyDown}
              role="slider"
              tabIndex={0}
              aria-label="Travel joystick"
              aria-valuemin={MIN_TRAVEL_H}
              aria-valuemax={MAX_TRAVEL_H}
              aria-valuenow={maxH}
            >
              <div className="fomo-joystick-base" />
              <div className="fomo-joystick-track" />
              <div className="fomo-joystick-center-stub" />
              <div className="fomo-joystick-stick" style={{ transform: `translateX(${joyX * JOYSTICK_MAX_PX}px)` }}>
                <div className={`fomo-joystick-knob ${joystickNudge ? 'joystick-knob-nudge' : ''}`} />
              </div>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-4 gap-1.5 text-[10px]">
            {TRAVEL_BANDS.map((band, idx) => {
              const active = idx === effectiveRangeIndex
              return (
                <button
                  key={band.id}
                  type="button"
                  onClick={() => setJoystickRange(idx)}
                  className={`h-7 rounded-full border inline-flex items-center justify-center ${
                    active ? 'border-amber-300 bg-amber-100 text-amber-800 font-semibold' : 'border-slate-200 bg-white text-slate-500'
                  } cursor-pointer hover:border-amber-200 active:scale-[0.98] transition`}
                  style={{ fontFamily: 'DM Mono, monospace' }}
                >
                  {band.label}
                </button>
              )
            })}
          </div>
        </section>

        <section ref={resultsRef}>
          <div className="flex items-baseline justify-between mb-2.5">
            <h2 className="text-[16px] font-semibold text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>
              Sunny escapes
            </h2>
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowResultFilters(v => !v)}
                className={`h-8 px-2.5 rounded-full border text-[11px] font-medium inline-flex items-center gap-1.5 transition ${
                  showResultFilters || activeTypeChips.length > 0
                    ? 'bg-amber-100 border-amber-300 text-amber-800'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
                aria-expanded={showResultFilters}
                aria-controls="result-filter-chips"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.8} />
                Filter
              </button>
              <label className="h-8 px-2.5 rounded-full border border-slate-200 bg-white text-[11px] text-slate-600 inline-flex items-center gap-1">
                {mode === 'car' ? <Car className="w-3.5 h-3.5" strokeWidth={1.8} /> : mode === 'train' ? <TrainFront className="w-3.5 h-3.5" strokeWidth={1.8} /> : <MapPinned className="w-3.5 h-3.5" strokeWidth={1.8} />}
                <select
                  value={mode}
                  onChange={e => setMode(e.target.value as TravelMode)}
                  className="bg-transparent focus:outline-none"
                  aria-label="Travel mode"
                >
                  <option value="both">Car + Train</option>
                  <option value="car">Car</option>
                  <option value="train">Train</option>
                </select>
              </label>
              <span className="text-[11px] text-slate-500" style={{ fontFamily: 'DM Mono, monospace' }}>{displayRows.length}</span>
            </div>
          </div>

          {showResultFilters && (
            <section id="result-filter-chips" className="mb-2.5 -mx-3 px-3 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-2 min-w-max">
                {TYPE_FILTER_CHIPS.map(chip => {
                  const active = activeTypeChips.includes(chip.id)
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => toggleTypeChip(chip.id)}
                      className={`h-8 px-3 rounded-full border text-[11px] font-medium whitespace-nowrap transition ${
                        active
                          ? 'bg-amber-100 border-amber-300 text-amber-800'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      {chip.label}
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {displayRows.length === 0 && !loading && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center">
              <p className="text-[14px] text-slate-700">No better escapes than {origin.name} in this joystick range.</p>
              <p className="text-[12px] text-slate-500 mt-1">Push the joystick right for broader options.</p>
            </div>
          )}

          <div className={`space-y-2.5 transition-opacity duration-150 ${(loading || isJoystickActive) ? 'opacity-60' : 'opacity-100'}`}>
            {displayRows.map(({ escape, isFastest }, index) => {
              const bestTravel = getBestTravel(escape)
              const isOpen = openCardId === escape.destination.id
              const scoreBreakdown = escape.sun_score.score_breakdown
              const showBreakdown = Boolean(expandedScoreDetails[escape.destination.id])
              const gainMin = Math.max(0, escape.sun_score.sunshine_forecast_min - originSunMin)

              return (
                <article
                  key={escape.destination.id}
                  className={`fomo-card overflow-hidden ${isFastest ? 'border-l-[3px] border-l-amber-400' : ''}`}
                  style={{ animation: `cardIn 260ms cubic-bezier(0.22, 1, 0.36, 1) ${Math.min(index * 45, 180)}ms both` }}
                >
                  <div className="px-3.5 pt-3.5 pb-2.5">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenCardId(prev => prev === escape.destination.id ? null : escape.destination.id)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-start gap-3">
                          <ScoreRing score={escape.sun_score.score} size={40} />

                          <div className="flex-1 min-w-0">
                            {isFastest && (
                              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold mb-1">
                                ⚡ Fastest escape
                              </p>
                            )}
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="text-[15px] font-semibold text-slate-900 truncate">{escape.destination.name}</h3>
                                <p className="text-[11px] text-slate-500 mt-0.5">{escape.destination.region} · {escape.destination.altitude_m.toLocaleString()}m · {FLAG[escape.destination.country]}</p>
                                <div className="mt-1.5 text-[11px] text-slate-500 inline-flex items-center gap-1">
                                  <span>{Math.round(escape.weather_now?.temp_c ?? 0)}°</span>
                                  <span>{weatherEmoji(escape.weather_now?.summary)}</span>
                                  <span>{weatherLabel(escape.weather_now?.summary)}</span>
                                </div>
                              </div>

                              <div className="shrink-0">
                                <div className="inline-flex items-end gap-3">
                                  <p className="text-[20px] leading-none text-amber-600 inline-flex items-end gap-1.5 font-semibold" style={{ fontFamily: 'DM Mono, monospace' }}>
                                    <Sun className="w-4 h-4 text-amber-500" strokeWidth={1.9} />
                                    <span>{formatSunHours(escape.sun_score.sunshine_forecast_min)}</span>
                                    {gainMin > 0 && (
                                      <span className="text-[12px] text-emerald-600 font-semibold">
                                        +{formatSunHours(gainMin)}
                                      </span>
                                    )}
                                  </p>
                                  {bestTravel && (
                                    <p className="text-[15px] leading-none text-slate-600 inline-flex items-end gap-1 font-medium" style={{ fontFamily: 'DM Mono, monospace' }}>
                                      <IconForMode mode={bestTravel.mode} />
                                      <span>{formatTravelClock(bestTravel.min / 60)}</span>
                                    </p>
                                  )}
                                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                </div>
                                <p className="mt-1 text-[11px] text-slate-500 text-right" style={{ fontFamily: 'DM Mono, monospace' }}>
                                  net {formatSunHours(escape.net_sun_min)}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className={`grid transition-all duration-200 ease-out ${isOpen ? 'grid-rows-[1fr] border-t border-slate-200' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <div className="px-3.5 py-3 space-y-3">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold mb-1.5">Detailed weather</p>
                          <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <Thermometer className="w-3.5 h-3.5" strokeWidth={1.8} />
                              {Math.round(escape.weather_now?.temp_c ?? 0)}°C
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Cloud className="w-3.5 h-3.5" strokeWidth={1.8} />
                              {escape.conditions}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Sun className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.8} />
                              {escape.sun_score.low_cloud_cover_pct}% low cloud
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Mountain className="w-3.5 h-3.5" strokeWidth={1.8} />
                              {escape.destination.altitude_m.toLocaleString()}m
                            </span>
                          </div>
                        </div>

                        {escape.travel.train && (
                          <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold mb-1.5">Live train info</p>
                            {trainPreviewById[escape.destination.id]?.loading ? (
                              <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                                <Clock3 className="w-3.5 h-3.5 animate-spin" />
                                Loading next departures
                              </p>
                            ) : trainPreviewById[escape.destination.id]?.rows?.length ? (
                              <div className="space-y-1.5">
                                {trainPreviewById[escape.destination.id].rows.slice(0, 3).map(conn => {
                                  const transferText = conn.transfers > 0 ? `${conn.transfers}x` : 'direct'
                                  return (
                                    <p key={conn.id} className="text-[11px] text-slate-700" style={{ fontFamily: 'DM Mono, monospace' }}>
                                      dep {conn.departure_hhmm} → arr {conn.arrival_hhmm} ({formatTravelClock(conn.duration_min / 60)}, {transferText})
                                    </p>
                                  )
                                })}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2 text-[11px] text-slate-700">
                                <span className="inline-flex items-center gap-1">
                                  <TrainFront className="w-3.5 h-3.5" strokeWidth={1.8} />
                                  {formatTravelClock(escape.travel.train.duration_min / 60)}
                                </span>
                                {typeof escape.travel.train.changes === 'number' && (
                                  <span className="text-slate-500">
                                    {escape.travel.train.changes} change{escape.travel.train.changes === 1 ? '' : 's'}
                                  </span>
                                )}
                                {trainPreviewById[escape.destination.id]?.error && (
                                  <span className="text-slate-500">Live departures unavailable</span>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {escape.plan.length > 0 && (
                          <div>
                            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold mb-1.5">Trip plan</p>
                            <div className="space-y-1">
                              {escape.plan.map((step, idx) => (
                                <p key={idx} className="text-[12px] text-slate-700 leading-snug">{step.replace(/[📍🥾🍽️💡]/g, '').trim()}</p>
                              ))}
                            </div>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setExpandedScoreDetails(prev => ({ ...prev, [escape.destination.id]: !prev[escape.destination.id] }))}
                          className="text-[11px] text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
                        >
                          How is this scored?
                        </button>

                        <div className={`grid transition-all duration-200 ${showBreakdown ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                          <div className="overflow-hidden">
                            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2">
                              {([
                                ['Net sun', scoreBreakdown.net_sun_pct],
                                ['Sunshine', scoreBreakdown.sunshine_pct],
                                ['Cloud', scoreBreakdown.cloud_pct],
                                ['Altitude', scoreBreakdown.altitude_bonus_pct],
                                [`Gain vs ${origin.name}`, scoreBreakdown.gain_pct],
                              ] as [string, number][]).map(([label, value], i) => (
                                <div key={label} className="grid grid-cols-[86px_1fr_36px] items-center gap-2 text-[11px]">
                                  <span className="text-slate-600" style={{ fontFamily: 'DM Mono, monospace' }}>{label}</span>
                                  <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                                    <div
                                      className="h-full rounded-full bg-amber-400"
                                      style={{ width: showBreakdown ? `${value}%` : 0, transition: `width 300ms ease-out ${i * 50}ms` }}
                                    />
                                  </div>
                                  <span className="text-slate-800 text-right" style={{ fontFamily: 'DM Mono, monospace' }}>{value}%</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {escape.links.google_maps && (
                            <a
                              href={escape.links.google_maps}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800"
                            >
                              <MapPinned className="w-3.5 h-3.5" strokeWidth={1.8} />
                              Navigate
                            </a>
                          )}
                          {escape.links.sbb && (
                            <a
                              href={escape.links.sbb}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-[11px] font-semibold hover:bg-slate-50"
                            >
                              🚆 SBB Timetable
                            </a>
                          )}
                          <a
                            href={buildWhatsAppHref(escape)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl border border-emerald-200 bg-emerald-50/60 text-slate-800 text-[11px] font-semibold hover:bg-emerald-50"
                          >
                            <WhatsAppIcon className="w-4 h-4" />
                            Share via WhatsApp
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          {loading && (
            <p className="mt-2 text-[11px] text-slate-500 inline-flex items-center gap-1">
              <Clock3 className="w-3.5 h-3.5 animate-spin" /> Updating forecast
            </p>
          )}
        </section>
      </main>

      <footer className="px-3 pb-6 text-center text-[11px] text-slate-500">
        <div className="inline-flex items-center gap-2.5">
          <button onClick={detectLocation} disabled={locating} className="hover:underline underline-offset-2 inline-flex items-center gap-1">
            <LocateFixed className="w-3.5 h-3.5" strokeWidth={1.8} />
            {locating ? 'Locating...' : 'Use my location'}
          </button>
          {originMode === 'gps' && (
            <button onClick={() => setOriginMode('manual')} className="hover:underline underline-offset-2">
              Use selected city
            </button>
          )}
          <span className="opacity-35">•</span>
          <a href="/admin" className="hover:underline underline-offset-2">Admin</a>
          <span className="opacity-35">•</span>
          <a href="/blog" className="hover:underline underline-offset-2">Blog</a>
          <span className="opacity-35">•</span>
          <a href="/about" className="hover:underline underline-offset-2">About</a>
        </div>
      </footer>
    </div>
  )
}
