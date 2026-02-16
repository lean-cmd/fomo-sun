'use client'

import { useState, useEffect, useCallback, useMemo, useRef, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import {
  Car,
  Clock3,
  ChevronDown,
  Cloud,
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
import { DestinationStamp, type StampType } from '@/components/DestinationStamp'

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
type WeatherKind = 'sunny' | 'partly' | 'cloudy' | 'foggy' | 'snowy'
type EscapeFilterChip = 'mountain' | 'town' | 'ski' | 'thermal' | 'lake'

type CitySeed = { name: string; lat: number; lon: number }

const MIN_TRAVEL_H = 0
const MAX_TRAVEL_H = 4.5
const JOYSTICK_MAX_PX = 42

const TRAVEL_BANDS = [
  { id: 'quick', label: '0-60min', minH: 0, maxH: 1, maxLabel: '1h' },
  { id: 'short', label: '1h-2h', minH: 1, maxH: 2, maxLabel: '2h' },
  { id: 'mid', label: '2h-3h', minH: 2, maxH: 3, maxLabel: '3h' },
  { id: 'long', label: '3hrs+', minH: 3, maxH: 4.5, maxLabel: '3hrs+' },
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

const HEADER_TAGLINES = [
  "Don't chase clouds. Chase sun.",
  'Fog below. Sun above.',
  'Find light, fast.',
  'Tomorrow looks better up high.',
  'Grey in town. Gold in the hills.',
  'Less fog. More day.',
] as const

const FLAG: Record<string, string> = { CH: 'CH', DE: 'DE', FR: 'FR', IT: 'IT' }
const TIMELINE_TICKS = [8, 10, 12, 14, 16, 18] as const

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function normalizeWindow(win?: DaylightWindow): DaylightWindow {
  const start = clamp(Math.round(win?.start_hour ?? 7), 0, 23)
  const end = clamp(Math.round(win?.end_hour ?? 19), start + 1, 24)
  return { start_hour: start, end_hour: end }
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
  if (s.includes('snow')) return 'snowy'
  if (s.includes('fog') || s.includes('low cloud')) return 'foggy'
  if (s.includes('partly')) return 'partly'
  if (s.includes('clear') || s.includes('sunny') || s.includes('sun')) return 'sunny'
  return 'cloudy'
}

function weatherLabel(summary?: string) {
  const kind = weatherKind(summary)
  if (kind === 'snowy') return 'Snow'
  if (kind === 'sunny') return 'Sunny'
  if (kind === 'partly') return 'Partly sunny'
  if (kind === 'foggy') return 'Fog or low cloud'
  return 'Cloudy'
}

function weatherEmoji(summary?: string) {
  const kind = weatherKind(summary)
  if (kind === 'snowy') return '❄️'
  if (kind === 'sunny' || kind === 'partly') return '☀️'
  if (kind === 'foggy') return '☁️'
  return '☁️'
}

function extractTemp(summary?: string) {
  if (!summary) return null
  const m = summary.match(/(-?\d+)\s*°c/i)
  return m ? Number(m[1]) : null
}

function FomoGlyph({ className = 'w-[42px] h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 58 20" className={className} aria-label="FOMO logo" role="img">
      <g fill="#334155" style={{ fontFamily: 'Jost, DM Sans, sans-serif', fontWeight: 700, letterSpacing: 0.7 }}>
        <text x="0" y="14" fontSize="13">F</text>
        <text x="21.8" y="14" fontSize="13">M</text>
      </g>
      <g fill="#f59e0b" stroke="#f59e0b" strokeLinecap="round" strokeWidth="1.15">
        <circle cx="11.2" cy="9" r="3.2" />
        <path d="M11.2 2.3v1.8M11.2 13.9v1.8M4.6 9h1.8M15.9 9h1.8M6.5 4.3l1.2 1.2M14.7 12.4l1.2 1.2M16 4.3l-1.2 1.2M7.7 12.4l-1.2 1.2" />
        <circle cx="35.8" cy="9" r="3.2" />
        <path d="M35.8 2.3v1.8M35.8 13.9v1.8M29.2 9H31M40.5 9h1.8M31.1 4.3l1.2 1.2M39.3 12.4l1.2 1.2M40.6 4.3l-1.2 1.2M32.3 12.4l-1.2 1.2" />
      </g>
    </svg>
  )
}

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const pct = Math.round(score * 100)
  const pctSize = Math.max(14, Math.round(size * 0.35))

  return (
    <div
      className="relative flex-shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: '#F5F0E8',
        boxShadow: 'inset 0 0 0 1px rgba(148, 163, 184, 0.25)',
      }}
      aria-label={`FOMO score ${pct}%`}
    >
      <svg className="absolute inset-0" viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="48" fill="none" stroke="#cbd5e1" strokeWidth="2.1" strokeDasharray="4.1 3.2" />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none pt-[2px]">
        <span
          className="text-slate-900"
          style={{ fontFamily: '"Bebas Neue", Sora, sans-serif', fontSize: `${pctSize}px`, letterSpacing: '0.3px' }}
        >
          {pct}%
        </span>
        <span style={{ width: `${Math.round(size * 0.72)}px` }}>
          <FomoGlyph className="w-full h-auto" />
        </span>
      </span>
    </div>
  )
}

function WhatsAppIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="currentColor">
      <path d="M12.04 2C6.56 2 2.11 6.43 2.11 11.9c0 1.75.46 3.46 1.34 4.97L2 22l5.3-1.39a9.9 9.9 0 0 0 4.74 1.2h.01c5.47 0 9.9-4.43 9.9-9.9A9.9 9.9 0 0 0 12.04 2Zm0 18.16h-.01a8.24 8.24 0 0 1-4.2-1.15l-.3-.18-3.14.82.84-3.06-.2-.31a8.22 8.22 0 0 1-1.26-4.37 8.28 8.28 0 0 1 8.27-8.27 8.29 8.29 0 0 1 8.27 8.27 8.28 8.28 0 0 1-8.27 8.27Zm4.53-6.2c-.25-.13-1.5-.74-1.73-.82-.23-.09-.4-.13-.57.12-.17.25-.66.82-.8.99-.15.17-.3.19-.55.07-.25-.13-1.07-.39-2.03-1.24-.75-.67-1.25-1.49-1.4-1.74-.15-.25-.02-.38.11-.5.12-.12.25-.3.38-.45.13-.15.17-.25.25-.42.08-.17.04-.31-.02-.43-.07-.13-.57-1.37-.78-1.88-.2-.48-.4-.41-.56-.42h-.48c-.17 0-.44.06-.67.31-.23.25-.88.86-.88 2.1s.9 2.43 1.02 2.6c.13.17 1.76 2.68 4.26 3.76.59.25 1.05.39 1.4.5.59.19 1.14.16 1.57.1.48-.07 1.5-.61 1.71-1.2.21-.59.21-1.09.15-1.2-.06-.11-.23-.17-.48-.3Z" />
    </svg>
  )
}

function compactLabel(name: string, max = 14) {
  if (name.length <= max) return name
  const first = name.split(/[ ,/-]/)[0]
  return first.length > 2 ? first : name.slice(0, max)
}

function SunTimelineBar({
  timeline,
  dayFocus,
  sunWindow,
  showNowMarker = false,
  travelMin,
  compact = false,
  label,
  sunLabel,
}: {
  timeline: SunTimeline
  dayFocus: DayFocus
  sunWindow?: { today: DaylightWindow; tomorrow: DaylightWindow }
  showNowMarker?: boolean
  travelMin?: number
  compact?: boolean
  label?: string
  sunLabel?: string
}) {
  const win = normalizeWindow(sunWindow?.[dayFocus])
  const leftNightPct = (win.start_hour / 24) * 100
  const daylightPct = ((win.end_hour - win.start_hour) / 24) * 100
  const rightNightPct = Math.max(0, 100 - leftNightPct - daylightPct)
  const rawSegments = timeline?.[dayFocus] || []
  const daySegments = rawSegments.filter(seg => seg.condition !== 'night')
  const total = Math.max(1, daySegments.reduce((sum, seg) => sum + seg.pct, 0))
  const now = new Date()
  const nowHour = now.getHours() + now.getMinutes() / 60
  const nowPct = clamp((nowHour / 24) * 100, 0, 100)
  const travelWidthPct = travelMin ? clamp(((travelMin / 60) / 24) * 100, 0, 100 - nowPct) : 0

  return (
    <div className="flex items-start gap-2">
      <div className="flex-1 min-w-0">
        <div className={`fomo-timeline ${compact ? 'h-[20px]' : 'h-7'}`}>
          {leftNightPct > 0 && <div className="tl-seg tl-night" style={{ width: `${leftNightPct}%` }} />}
          <div className="h-full flex" style={{ width: `${daylightPct}%` }}>
            {daySegments.map((seg, idx) => (
              <div key={`${seg.condition}-${idx}`} className={`tl-seg tl-${seg.condition}`} style={{ width: `${(seg.pct / total) * 100}%` }} />
            ))}
          </div>
          {rightNightPct > 0 && <div className="tl-seg tl-night" style={{ width: `${rightNightPct}%` }} />}

          {label && (
            <span className="tl-bar-label" title={label}>
              {label}
            </span>
          )}

          {showNowMarker && <div className="tl-now" style={{ left: `${nowPct}%` }} />}
          {travelMin && travelWidthPct > 0 && (
            <div className="tl-travel-overlay" style={{ left: `${nowPct}%`, width: `${travelWidthPct}%` }} />
          )}
        </div>
        <div className="tl-hour-strip" aria-hidden="true">
          {TIMELINE_TICKS.map(hour => (
            <span key={hour} className="tl-hour-tick" style={{ left: `${(hour / 24) * 100}%` }}>
              <i />
              <em>{hour}</em>
            </span>
          ))}
        </div>
      </div>
      {sunLabel && (
        <span className="text-[11px] text-slate-600 mt-0.5" style={{ fontFamily: 'DM Mono, monospace' }}>
          {sunLabel}
        </span>
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

function stampTypeFromDestination(destination: EscapeCard['destination']): StampType {
  const typeSet = new Set(destination.types || [])
  if (typeSet.has('thermal')) return 'thermal'
  if (typeSet.has('lake')) return 'lake'
  if (typeSet.has('town')) return 'town'
  if (typeSet.has('viewpoint')) return 'viewpoint'
  if (typeSet.has('mountain')) return destination.altitude_m >= 1400 ? 'ski' : 'mountain'
  return 'default'
}

function FomoWordmark({ className = 'w-[118px] h-[26px]' }: { className?: string }) {
  return (
    <FomoGlyph className={className} />
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
  const [joystickErrorShake, setJoystickErrorShake] = useState(false)

  const [mode, setMode] = useState<TravelMode>('both')
  const [activeTypeChips, setActiveTypeChips] = useState<EscapeFilterChip[]>([])
  const [showResultFilters, setShowResultFilters] = useState(false)
  const [tripSpan, setTripSpan] = useState<TripSpan>('daytrip')
  const [tripSpanTouched, setTripSpanTouched] = useState(false)

  const [data, setData] = useState<SunnyEscapesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [demo, setDemo] = useState(false)
  const [openCardId, setOpenCardId] = useState<string | null>(null)
  const [heroFlowDir, setHeroFlowDir] = useState<'left' | 'right'>('right')
  const [heroFlowTick, setHeroFlowTick] = useState(0)
  const [cardFlowDir, setCardFlowDir] = useState<'left' | 'right'>('right')
  const [cardFlowTick, setCardFlowTick] = useState(0)
  const [taglineIndex, setTaglineIndex] = useState(() => Math.floor(Math.random() * HEADER_TAGLINES.length))
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null)

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
  const joystickErrorTimerRef = useRef<number | null>(null)

  const manualOrigin = useMemo(
    () => MANUAL_ORIGIN_CITIES.find(city => city.name === selectedCity) || MANUAL_ORIGIN_CITIES[0],
    [selectedCity]
  )
  const origin = originMode === 'gps' && gpsOrigin ? gpsOrigin : manualOrigin
  const effectiveRangeIndex = previewRangeIndex ?? rangeIndex
  const activeBand = TRAVEL_BANDS[effectiveRangeIndex]
  const maxH = activeBand.maxH

  const dayFocus: DayFocus = tripSpan === 'plus1day' ? 'tomorrow' : 'today'
  const topEscapeCurrent = data?.escapes?.[0] ?? null
  const fastestEscape = data?.fastest_escape ?? null
  const originSunMin = data?.origin_conditions.sunshine_min ?? 0

  const applyJoyPosition = useCallback((nextJoy: number, updateRange = true) => {
    const clamped = clamp(nextJoy, -1, 1)
    joyPosRef.current = clamped
    setJoyX(clamped)
    if (!updateRange) return

    const magnitude = Math.abs(clamped)
    let shift = 0
    if (magnitude >= 0.34) shift = 1
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
    const spring = 92
    const damping = 26
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
    }, 16)
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
    if (e.repeat) return
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

  useEffect(() => {
    const onDocKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (e.defaultPrevented) return
      if (e.altKey || e.ctrlKey || e.metaKey) return
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        stepJoystickRange('left')
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        stepJoystickRange('right')
      }
    }
    document.addEventListener('keydown', onDocKeyDown)
    return () => document.removeEventListener('keydown', onDocKeyDown)
  }, [stepJoystickRange])

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
        setLastUpdatedAt(new Date())
        if (joystickDirRef.current) {
          const dir = joystickDirRef.current
          setHeroFlowDir(dir)
          setCardFlowDir(dir)
          setHeroFlowTick(v => v + 1)
          setCardFlowTick(v => v + 1)
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
    if (joystickErrorTimerRef.current !== null) {
      window.clearTimeout(joystickErrorTimerRef.current)
      joystickErrorTimerRef.current = null
    }
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

  useEffect(() => {
    if (!data?._meta?.request_id) return
    setTaglineIndex(prev => (prev + 1) % HEADER_TAGLINES.length)
  }, [data?._meta?.request_id])

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
  const heroDayFocus: DayFocus = 'tomorrow'

  const topEscapeTomorrow = useMemo(() => {
    if (!resultRows.length) return fastestEscape ?? null
    return [...resultRows]
      .sort((a, b) => {
        const aTomorrow = Math.round((a.tomorrow_sun_hours ?? 0) * 60)
        const bTomorrow = Math.round((b.tomorrow_sun_hours ?? 0) * 60)
        if (bTomorrow !== aTomorrow) return bTomorrow - aTomorrow
        const aTravel = getBestTravel(a)?.min ?? Infinity
        const bTravel = getBestTravel(b)?.min ?? Infinity
        if (aTravel !== bTravel) return aTravel - bTravel
        return b.sun_score.score - a.sun_score.score
      })[0] ?? fastestEscape ?? null
  }, [resultRows, fastestEscape])

  const heroEscape = topEscapeTomorrow ?? topEscapeCurrent ?? fastestEscape ?? null
  const heroOriginSunMin = Math.round((data?.tomorrow_sun_hours ?? 0) * 60) || originSunMin

  const topBestTravel = heroEscape ? getBestTravel(heroEscape) : null
  const topSunMin = heroEscape ? Math.round((heroEscape.tomorrow_sun_hours ?? 0) * 60) : 0
  const resolvedTopSunMin = topSunMin > 0 ? topSunMin : (heroEscape?.sun_score.sunshine_forecast_min ?? 0)
  const sunGainMin = Math.max(0, resolvedTopSunMin - heroOriginSunMin)
  const dataUpdatedText = useMemo(() => {
    if (!lastUpdatedAt) return 'just now'
    const deltaMin = Math.max(0, Math.round((Date.now() - lastUpdatedAt.getTime()) / 60000))
    if (deltaMin <= 1) return 'just now'
    return `${deltaMin} min ago`
  }, [lastUpdatedAt, loading, data])

  const heroInfoLine = useMemo(() => {
    if (!heroEscape) return ''
    const travel = topBestTravel ? formatTravelClock(topBestTravel.min / 60) : 'short'
    const city = compactLabel(origin.name, 12)
    const gain = formatSunHours(sunGainMin)
    const sun = formatSunHours(resolvedTopSunMin)
    const originSun = formatSunHours(heroOriginSunMin)
    const templates = sunGainMin > 0
      ? [
        `+${gain} more sun than ${city}. ${travel} by ${topBestTravel?.mode || 'car'}. Go.`,
        `${sun} sunshine. ${city} gets ${originSun}. ${travel} away.`,
        `While ${city} sits in fog, ${heroEscape.destination.name} has ${sun}. ${travel}.`,
      ]
      : [
        `${sun} sunshine forecast. ${travel} by ${topBestTravel?.mode || 'car'}. Worth it.`,
        `${heroEscape.destination.name} leads tomorrow with ${sun}. ${travel} away.`,
      ]
    const idx = Math.abs((heroFlowTick + heroEscape.destination.id.length) % templates.length)
    return templates[idx] || templates[0]
  }, [heroEscape, origin.name, topBestTravel, resolvedTopSunMin, sunGainMin, heroOriginSunMin, heroFlowTick])

  const toggleTypeChip = (chip: EscapeFilterChip) => {
    setActiveTypeChips(prev => prev.includes(chip) ? prev.filter(x => x !== chip) : [...prev, chip])
  }

  const jumpToBestDetails = () => {
    if (heroEscape) setOpenCardId(heroEscape.destination.id)
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const filteredRows = useMemo(() => {
    const strictBetter = resultRows.filter(escape => escape.sun_score.sunshine_forecast_min > originSunMin)
    const baseline = strictBetter.length >= 5
      ? strictBetter
      : resultRows.filter(escape => escape.sun_score.sunshine_forecast_min >= originSunMin)
    const typed = activeTypeChips.length === 0
      ? baseline
      : baseline.filter((escape) => {
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

    // Only use fastest as a hard fallback when the selected bucket has no rows.
    if (base.length > 0) return base

    const merged = [...base]
    const insertAt = Math.min(1, merged.length)
    merged.splice(insertAt, 0, { escape: fastestEscape, isFastest: true })
    return merged.slice(0, 5)
  }, [fastestEscape, visibleRows])

  const fastestTravelMin = fastestEscape ? (getBestTravel(fastestEscape)?.min ?? null) : null

  useEffect(() => {
    if (loading || activeTypeChips.length > 0 || visibleRows.length > 0 || fastestTravelMin === null) return
    const targetIdx = TRAVEL_BANDS.findIndex((band) => fastestTravelMin >= band.minH * 60 && fastestTravelMin <= band.maxH * 60)
    if (targetIdx < 0 || targetIdx === rangeIndex) return

    const dir: 'left' | 'right' = targetIdx > rangeIndex ? 'right' : 'left'
    joystickDirRef.current = dir
    setJoystickErrorShake(true)
    pulseJoystick(dir, 0.58)

    if (joystickErrorTimerRef.current !== null) {
      window.clearTimeout(joystickErrorTimerRef.current)
    }
    joystickErrorTimerRef.current = window.setTimeout(() => {
      setJoystickErrorShake(false)
      previewRangeRef.current = null
      setPreviewRangeIndex(null)
      setRangeIndex(targetIdx)
      setJoystickNudge(false)
      joystickErrorTimerRef.current = null
    }, 260)
  }, [activeTypeChips.length, fastestTravelMin, loading, pulseJoystick, rangeIndex, visibleRows.length])

  useEffect(() => {
    if (!displayRows.length) {
      setOpenCardId(null)
      return
    }
    setOpenCardId(displayRows[0]?.escape.destination.id ?? null)
  }, [displayRows])

  const buildWhatsAppHref = (escape: EscapeCard, shareDay: DayFocus = dayFocus) => {
    const isTomorrowShare = shareDay === 'tomorrow'
    const bestTravel = getBestTravel(escape)
    const travelText = bestTravel
      ? `${bestTravel.mode === 'car' ? '🚗' : '🚆'} ${formatTravelClock(bestTravel.min / 60)} from ${origin.name}`
      : ''
    const destinationMin = isTomorrowShare
      ? Math.round((escape.tomorrow_sun_hours ?? 0) * 60)
      : escape.sun_score.sunshine_forecast_min
    const destinationSunMin = destinationMin > 0 ? destinationMin : escape.sun_score.sunshine_forecast_min
    const destinationSun = formatSunHours(destinationSunMin)
    const originComparisonMin = isTomorrowShare ? heroOriginSunMin : originSunMin
    const originTimelinePreview = timelineEmojiPreview(data?.origin_timeline, shareDay)
    const destinationSky = timelineEmojiPreview(escape.sun_timeline, shareDay)
    const gainMin = Math.max(0, destinationSunMin - originComparisonMin)
    const shareText = [
      `🌤️ FOMO Sun: Escape the fog!`,
      '',
      `📍 ${escape.destination.name} (${escape.destination.altitude_m}m, ${escape.destination.region})`,
      `☀️ ${destinationSun} sun · FOMO ${Math.round(escape.sun_score.score * 100)}%`,
      travelText,
      '',
      `${origin.name}:    ${originTimelinePreview}`,
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
        <div className="max-w-xl mx-auto px-3 h-14 flex items-center gap-2">
          <div className="shrink-0 min-w-0">
            <FomoWordmark className="w-[90px] h-[22px]" />
            <p className="mt-0.5 text-[9px] leading-none text-slate-500 truncate max-w-[112px]">
              {HEADER_TAGLINES[taglineIndex]}
            </p>
          </div>

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
        </div>
      </header>

      <main className="max-w-xl mx-auto px-3 pb-16">

        {fallbackNotice && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-xs font-medium px-3 py-2 mb-3 text-center">
            {fallbackNotice}
          </div>
        )}

        {heroEscape && (
          <section
            key={`hero-${heroEscape.destination.id}-${heroFlowTick}`}
            className={`fomo-card relative overflow-visible p-3.5 sm:p-4 mb-3 ${heroFlowDir === 'right' ? 'hero-flow-right' : 'hero-flow-left'}`}
          >
            <div className="pointer-events-none absolute -top-2 right-3 sm:right-4 z-[2] rotate-[3deg]">
              <DestinationStamp
                name={heroEscape.destination.name}
                altitude={heroEscape.destination.altitude_m}
                region={heroEscape.destination.region}
                type={stampTypeFromDestination(heroEscape.destination)}
                country={heroEscape.destination.country}
                className="h-[112px] w-[80px] drop-shadow-[0_10px_20px_rgba(180,83,9,0.18)]"
              />
            </div>

            <div className="flex items-start justify-between gap-3 pr-[88px] sm:pr-[96px]">
              <div className="flex items-start gap-3 min-w-0">
                <div className="sm:scale-[1.16] sm:origin-top-left">
                  <ScoreRing score={heroEscape.sun_score.score} size={48} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
                    Best escape tomorrow
                  </p>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <h1 className="text-[19px] leading-tight font-semibold text-slate-900 truncate" style={{ fontFamily: 'Sora, sans-serif' }}>
                      {heroEscape.destination.name}
                    </h1>
                    <span className="text-[11px] text-slate-500" style={{ fontFamily: 'DM Mono, monospace' }}>
                      {heroEscape.destination.altitude_m}m
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {heroEscape.destination.region} · {FLAG[heroEscape.destination.country]}
                    </span>
                  </div>

                  <p className="mt-1 text-[12px] text-slate-600">
                    {heroInfoLine}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 space-y-1">
              <SunTimelineBar
                timeline={data?.origin_timeline || heroEscape.sun_timeline}
                dayFocus={heroDayFocus}
                sunWindow={data?.sun_window}
                showNowMarker
                label={origin.name}
                sunLabel={`☀️ ${formatSunHours(heroOriginSunMin)}`}
                compact
              />
              <SunTimelineBar
                timeline={heroEscape.sun_timeline}
                dayFocus={heroDayFocus}
                sunWindow={data?.sun_window}
                label={heroEscape.destination.name}
                sunLabel={`☀️ ${formatSunHours(resolvedTopSunMin)}`}
                travelMin={topBestTravel?.min}
                compact
              />
            </div>

            <div className="mt-3 inline-flex items-center gap-4">
              <button
                type="button"
                onClick={jumpToBestDetails}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600 hover:text-slate-900"
              >
                Escape now ↓
              </button>
              <a
                href={buildWhatsAppHref(heroEscape, heroDayFocus)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600 hover:text-slate-900"
              >
                <WhatsAppIcon className="w-3.5 h-3.5" />
                Share ↗
              </a>
            </div>
          </section>
        )}

        <section className="fomo-card p-3.5 sm:p-4 mb-3">
          <div className="text-center mb-2">
            <p className="text-[10px] uppercase tracking-[0.13em] text-slate-500 font-semibold">Travel joystick</p>
            <p className="text-[22px] font-semibold text-slate-900 leading-tight" style={{ fontFamily: 'DM Mono, monospace' }}>
              Max travel {activeBand.maxLabel}
            </p>
            <p className="text-[11px] text-slate-500 sm:hidden">Range {rangeLabel} · flick left or right</p>
            <p className="hidden sm:block text-[11px] text-slate-500">Range {rangeLabel} · click ← → to switch</p>
          </div>

          <div className="flex justify-center items-center gap-2 mt-2">
            <button
              type="button"
              onClick={() => stepJoystickRange('left')}
              className="hidden sm:inline-flex h-6 min-w-6 px-1.5 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.08)] text-[11px] font-semibold hover:bg-slate-50"
              style={{ fontFamily: 'DM Mono, monospace' }}
              aria-label="Move joystick range left"
            >
              ←
            </button>
            <div
              ref={joystickZoneRef}
              className={`fomo-joystick ${isJoystickActive ? 'is-active' : ''} ${joystickErrorShake ? 'joystick-error-shake' : ''} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2`}
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
              <div className="fomo-joystick-stick" style={{ transform: `translateX(${joyX * JOYSTICK_MAX_PX}px)` }}>
                <div className={`fomo-joystick-knob ${joystickNudge ? 'joystick-knob-nudge' : ''}`} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => stepJoystickRange('right')}
              className="hidden sm:inline-flex h-6 min-w-6 px-1.5 items-center justify-center rounded-md border border-slate-300 bg-white text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.08)] text-[11px] font-semibold hover:bg-slate-50"
              style={{ fontFamily: 'DM Mono, monospace' }}
              aria-label="Move joystick range right"
            >
              →
            </button>
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

          <div className={`space-y-2.5 transition-opacity duration-200 ${loading ? 'opacity-65' : 'opacity-100'}`}>
            {displayRows.map(({ escape, isFastest }, index) => {
              const bestTravel = getBestTravel(escape)
              const isOpen = openCardId === escape.destination.id
              const scoreBreakdown = escape.sun_score.score_breakdown
              const showBreakdown = Boolean(expandedScoreDetails[escape.destination.id])
              const gainMin = Math.max(0, escape.sun_score.sunshine_forecast_min - originSunMin)
              const cardFlowAnimation = cardFlowDir === 'right'
                ? 'cardFlowRight 320ms cubic-bezier(0.22, 1, 0.36, 1)'
                : 'cardFlowLeft 320ms cubic-bezier(0.22, 1, 0.36, 1)'

              return (
                <article
                  key={`${escape.destination.id}-${cardFlowTick}`}
                  className={`fomo-card overflow-hidden ${isFastest ? 'border-l-[3px] border-l-amber-400' : ''}`}
                  style={{ animation: `${cardFlowAnimation} ${Math.min(index * 30, 120)}ms both` }}
                >
                  <div className="px-3.5 pt-3.5 pb-2.5">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenCardId(prev => prev === escape.destination.id ? null : escape.destination.id)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-start gap-3">
                          <ScoreRing score={escape.sun_score.score} size={48} />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <h3 className="text-[15px] font-semibold text-slate-900 truncate">{escape.destination.name}</h3>
                                  {isFastest && (
                                    <span className="shrink-0 rounded-full border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[9px] uppercase tracking-[0.08em] text-amber-800 font-semibold">
                                      ⚡ Fastest
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 mt-0.5">{escape.destination.region} · {escape.destination.altitude_m.toLocaleString()}m · {FLAG[escape.destination.country]}</p>
                                <div className="mt-1.5 text-[11px] text-slate-500 inline-flex items-center gap-1">
                                  <span>{Math.round(escape.weather_now?.temp_c ?? 0)}°</span>
                                  <span>{weatherEmoji(escape.weather_now?.summary)}</span>
                                  <span>{weatherLabel(escape.weather_now?.summary)}</span>
                                </div>
                              </div>

                              <div className="shrink-0">
                                <div className="inline-flex items-center gap-4">
                                  <p className="text-[20px] leading-none text-amber-600 inline-flex items-center gap-2 font-semibold" style={{ fontFamily: 'DM Mono, monospace' }}>
                                    <Sun className="w-4 h-4 text-amber-500" strokeWidth={1.9} />
                                    <span>{formatSunHours(escape.sun_score.sunshine_forecast_min)}</span>
                                    {gainMin > 0 && (
                                      <span className="text-[12px] text-emerald-500 font-semibold -ml-0.5">
                                        +{formatSunHours(gainMin)}
                                      </span>
                                    )}
                                  </p>
                                  {bestTravel && (
                                    <p className="text-[15px] leading-none text-slate-600 inline-flex items-center gap-1.5 font-medium" style={{ fontFamily: 'DM Mono, monospace' }}>
                                      <IconForMode mode={bestTravel.mode} />
                                      <span>{formatTravelClock(bestTravel.min / 60)}</span>
                                    </p>
                                  )}
                                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                </div>
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

                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
                          {escape.links.google_maps && (
                            <a
                              href={escape.links.google_maps}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-slate-600 font-semibold hover:text-slate-900"
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
                              className="inline-flex items-center gap-1 text-slate-600 font-semibold hover:text-slate-900"
                            >
                              🚆 SBB Timetable
                            </a>
                          )}
                          <a
                            href={buildWhatsAppHref(escape)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-slate-600 font-semibold hover:text-slate-900"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5" />
                            Share ↗
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

          <p className="mt-2 text-[10px] text-slate-400">
            Data: {demo ? 'Demo forecast model' : 'Open-Meteo live forecast'} · Updated {dataUpdatedText}
          </p>
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
          <button
            onClick={() => { setDemo(v => !v) }}
            className={`live-toggle scale-[0.9] origin-center ${demo ? 'is-demo' : 'is-live'}`}
            aria-label={`Switch to ${demo ? 'live' : 'demo'} mode`}
          >
            <span className={`live-toggle-label ${demo ? 'active' : ''}`}>Demo</span>
            <span className={`live-toggle-label ${!demo ? 'active' : ''}`}>Live</span>
            <span className={`live-toggle-thumb ${demo ? '' : 'on'}`} />
          </button>
          <span className="opacity-35">•</span>
          <a href="/blog" className="hover:underline underline-offset-2">Blog</a>
          <span className="opacity-35">•</span>
          <a href="/about" className="hover:underline underline-offset-2">About</a>
        </div>
      </footer>
    </div>
  )
}
