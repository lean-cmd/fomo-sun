'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Car,
  Clock3,
  ChevronDown,
  Cloud,
  Heart,
  Info,
  LocateFixed,
  MapPinned,
  Mountain,
  SlidersHorizontal,
  Sun,
  Thermometer,
  TrainFront,
  X,
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
type WeatherKind = 'sunny' | 'partly' | 'cloudy' | 'foggy'
type EscapeFilterChip = 'mountain' | 'town' | 'ski' | 'thermal' | 'lake'

type CitySeed = { name: string; lat: number; lon: number }

const MIN_TRAVEL_H = 1
const MAX_TRAVEL_H = 3
const JOYSTICK_CENTER_H = 2

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

function quantizeHour(v: number) {
  return clamp(Math.round(v * 4) / 4, MIN_TRAVEL_H, MAX_TRAVEL_H)
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
  const travelPct = travelMin ? clamp(nowPct + ((travelMin / 60) / 24) * 100, 0, 100) : 0

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
        {showNowMarker && travelMin && <div className="tl-travel-overlay" style={{ width: `${travelPct}%` }} />}
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
  const [maxH, setMaxH] = useState(2)
  const [sliderPos, setSliderPos] = useState(0)
  const [isDraggingSlider, setIsDraggingSlider] = useState(false)
  const [showSliderValue, setShowSliderValue] = useState(false)
  const [joystickNudge, setJoystickNudge] = useState(true)

  const [mode, setMode] = useState<TravelMode>('both')
  const [activeTypeChips, setActiveTypeChips] = useState<EscapeFilterChip[]>([])
  const [showResultFilters, setShowResultFilters] = useState(false)
  const [tripSpan, setTripSpan] = useState<TripSpan>('daytrip')
  const [tripSpanTouched, setTripSpanTouched] = useState(false)
  const [dismissedIds, setDismissedIds] = useState<string[]>([])
  const [savedIds, setSavedIds] = useState<string[]>([])

  const [data, setData] = useState<SunnyEscapesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [demo, setDemo] = useState(true)
  const [openCard, setOpenCard] = useState<number | null>(0)
  const [openFastest, setOpenFastest] = useState(false)

  const [selectedCity, setSelectedCity] = useState<string>('Basel')
  const [gpsOrigin, setGpsOrigin] = useState<{ lat: number; lon: number; name: string } | null>(null)
  const [originMode, setOriginMode] = useState<'manual' | 'gps'>('manual')
  const [locating, setLocating] = useState(false)

  const [queryMaxH, setQueryMaxH] = useState(maxH)

  const [expandedScoreDetails, setExpandedScoreDetails] = useState<Record<string, boolean>>({})

  const requestCtrlRef = useRef<AbortController | null>(null)
  const resultsRef = useRef<HTMLElement | null>(null)

  const manualOrigin = useMemo(
    () => MANUAL_ORIGIN_CITIES.find(city => city.name === selectedCity) || MANUAL_ORIGIN_CITIES[0],
    [selectedCity]
  )
  const origin = originMode === 'gps' && gpsOrigin ? gpsOrigin : manualOrigin

  const dayFocus: DayFocus = tripSpan === 'plus1day' ? 'tomorrow' : 'today'
  const topEscape = data?.escapes?.[0] ?? null
  const fastestEscape = data?.fastest_escape ?? null
  const originSunMin = data?.origin_conditions.sunshine_min ?? 0
  const fastestTravel = fastestEscape ? getBestTravel(fastestEscape) : null
  const fastestGainMin = fastestEscape ? Math.max(0, fastestEscape.sun_score.sunshine_forecast_min - originSunMin) : 0
  const originTempC = extractTemp(data?.origin_conditions.description || '') ?? 0
  const originFomoPct = data ? Math.round(data.origin_conditions.sun_score * 100) : 0

  const sliderTravelToPos = useCallback((travelH: number, center: number) => {
    if (travelH <= center) {
      const denom = Math.max(0.001, center - MIN_TRAVEL_H)
      return -100 + ((travelH - MIN_TRAVEL_H) / denom) * 100
    }
    const denom = Math.max(0.001, MAX_TRAVEL_H - center)
    return ((travelH - center) / denom) * 100
  }, [])

  const sliderPosToTravel = useCallback((pos: number, center: number) => {
    if (pos <= 0) {
      const ratio = (pos + 100) / 100
      return MIN_TRAVEL_H + ratio * (center - MIN_TRAVEL_H)
    }
    const ratio = pos / 100
    return center + ratio * (MAX_TRAVEL_H - center)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setQueryMaxH(maxH), 200)
    return () => clearTimeout(t)
  }, [maxH])

  const travelWindowH = useMemo(() => {
    if (maxH <= JOYSTICK_CENTER_H) {
      const ratio = (maxH - MIN_TRAVEL_H) / (JOYSTICK_CENTER_H - MIN_TRAVEL_H)
      return 0.5 + clamp(ratio, 0, 1) * 0.5
    }
    return 1
  }, [maxH])

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
          max_travel_h: String(queryMaxH),
          travel_window_h: String(Number(travelWindowH.toFixed(2))),
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
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') console.error(err)
      } finally {
        if (requestCtrlRef.current === ctrl) setLoading(false)
      }
    }

    run()
  }, [queryMaxH, travelWindowH, mode, demo, tripSpan, origin.lat, origin.lon, origin.name, originMode])

  useEffect(() => () => {
    requestCtrlRef.current?.abort()
  }, [])

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

  const handleSliderChange = (posRaw: number) => {
    setJoystickNudge(false)
    const nextTravel = quantizeHour(sliderPosToTravel(posRaw, JOYSTICK_CENTER_H))
    const snappedPos = sliderTravelToPos(nextTravel, JOYSTICK_CENTER_H)
    setSliderPos(snappedPos)
    setMaxH(nextTravel)
    navigator.vibrate?.(3)
  }

  const sliderThumbPct = ((sliderPos + 100) / 2)
  const centerPct = 50
  const fillStart = Math.min(sliderThumbPct, centerPct)
  const fillWidth = Math.abs(sliderThumbPct - centerPct)

  const fallbackNotice = data?._meta?.fallback_notice || ''
  const resultRows = data?.escapes || []

  const topBestTravel = topEscape ? getBestTravel(topEscape) : null
  const topSunMin = topEscape?.sun_score.sunshine_forecast_min ?? 0
  const sunGainMin = Math.max(0, topSunMin - originSunMin)

  const toggleTypeChip = (chip: EscapeFilterChip) => {
    setActiveTypeChips(prev => prev.includes(chip) ? prev.filter(x => x !== chip) : [...prev, chip])
  }

  const toggleSaved = (id: string) => {
    setSavedIds(prev => prev.includes(id) ? prev.filter(v => v !== id) : [...prev, id])
  }

  const dismissSuggestion = (id: string) => {
    setDismissedIds(prev => prev.includes(id) ? prev : [...prev, id])
    setSavedIds(prev => prev.filter(v => v !== id))
  }

  const jumpToBestDetails = () => {
    setOpenCard(0)
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
    return typed.filter(escape => !dismissedIds.includes(escape.destination.id))
  }, [activeTypeChips, dismissedIds, resultRows, originSunMin])

  const visibleRows = useMemo(() => filteredRows.slice(0, 5), [filteredRows])

  useEffect(() => {
    if (!visibleRows.length) {
      setOpenCard(null)
      return
    }
    setOpenCard(0)
  }, [visibleRows.length])

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
            {originSentences[0] || `Forecast in ${origin.name}: ${originTempC}° · ${weatherLabel(data?.origin_conditions.description)}`}
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
          <section className="fomo-card p-3.5 sm:p-4 mb-3">
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
                  {sunGainMin > 0 && (
                    <p className="text-[12px] font-semibold text-emerald-600 mt-1">☀️ +{formatSunHours(sunGainMin)} more sun than {origin.name}</p>
                  )}
                  <div className="mt-1.5">
                    <p className="text-[18px] leading-none font-semibold text-amber-600 inline-flex items-center gap-1.5">
                      <Sun className="w-4 h-4 text-amber-500" strokeWidth={1.9} />
                      <span style={{ fontFamily: 'DM Mono, monospace' }}>{formatSunHours(topEscape.sun_score.sunshine_forecast_min)}</span>
                    </p>
                    {topBestTravel && (
                      <p className="mt-1 text-[12px] text-slate-500 inline-flex items-center gap-1">
                        <IconForMode mode={topBestTravel.mode} />
                        {formatTravelClock(topBestTravel.min / 60)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

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

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-600">
                <span className="font-medium">{origin.name}</span>
                <span className="inline-flex items-center gap-1">
                  <span>{timelineOriginPreview}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace' }}>{formatSunHours(originSunMin)}</span>
                </span>
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
                <span className="inline-flex items-center gap-1">
                  <span>{timelineEmojiPreview(topEscape.sun_timeline, dayFocus)}</span>
                  <span style={{ fontFamily: 'DM Mono, monospace' }}>{formatSunHours(topEscape.sun_score.sunshine_forecast_min)}</span>
                </span>
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
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.13em] text-slate-500 font-semibold">Travel joystick</p>
              <p className="text-[22px] font-semibold text-slate-900 leading-tight" style={{ fontFamily: 'DM Mono, monospace' }}>
                {formatTravelClock(maxH)} <span className="text-[13px] text-slate-500">±{formatTravelClock(travelWindowH)}</span>
              </p>
            </div>
            <p className="text-[11px] text-slate-500">Push left or right</p>
          </div>

          <div
            className="relative h-14"
            onMouseEnter={() => setShowSliderValue(true)}
            onMouseLeave={() => !isDraggingSlider && setShowSliderValue(false)}
          >
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 rounded-full bg-slate-200" />
            {fillWidth > 0.3 && (
              <div
                className={`absolute top-1/2 -translate-y-1/2 h-1 rounded-full ${sliderThumbPct < centerPct ? 'bg-sky-300' : 'bg-amber-300'}`}
                style={{ left: `${fillStart}%`, width: `${fillWidth}%` }}
              />
            )}
            <div className="absolute top-1/2 -translate-y-1/2 w-[2px] h-2 rounded-full bg-slate-400" style={{ left: '50%' }} />

            {(showSliderValue || isDraggingSlider) && (
              <div
                className="absolute -top-0.5 -translate-x-1/2 rounded-full border border-slate-200 bg-white px-2.5 h-7 inline-flex items-center text-[11px] text-slate-800"
                style={{ left: `${sliderThumbPct}%`, fontFamily: 'DM Mono, monospace' }}
              >
                {formatTravelClock(maxH)}
              </div>
            )}

            <input
              type="range"
              min={-100}
              max={100}
              step={1}
              value={sliderPos}
              onChange={e => handleSliderChange(Number(e.target.value))}
              onPointerDown={() => {
                setIsDraggingSlider(true)
                setShowSliderValue(true)
                setJoystickNudge(false)
              }}
              onPointerUp={() => {
                setIsDraggingSlider(false)
                setShowSliderValue(false)
              }}
              onBlur={() => {
                setIsDraggingSlider(false)
                setShowSliderValue(false)
              }}
              className={`center-slider ${joystickNudge ? 'joystick-nudge' : ''}`}
              aria-label="Travel time slider"
            />
          </div>

          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
            <span>1h ±30m</span>
            <span className="text-slate-500" style={{ fontFamily: 'DM Mono, monospace' }}>2h ±1h</span>
            <span>3h ±1h</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400">
            <span>← closer</span>
            <span>more options →</span>
          </div>
        </section>

        {fastestEscape && (
          <article className="fomo-card border-l-[3px] border-l-amber-400 overflow-hidden mb-3">
            <button
              type="button"
              onClick={() => setOpenFastest(v => !v)}
              className="w-full text-left px-3.5 pt-3.5 pb-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">⚡ Fastest escape</p>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${openFastest ? 'rotate-180' : ''}`} />
              </div>
              <div className="mt-1.5 flex items-start gap-3">
                <ScoreRing score={fastestEscape.sun_score.score} size={40} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[15px] font-semibold text-slate-900 truncate">{fastestEscape.destination.name}</h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">{fastestEscape.destination.region} · {fastestEscape.destination.altitude_m.toLocaleString()}m · {FLAG[fastestEscape.destination.country]}</p>
                      <div className="mt-1.5 text-[11px] text-slate-500 inline-flex items-center gap-1">
                        <span>{Math.round(fastestEscape.weather_now?.temp_c ?? 0)}°</span>
                        <span>{weatherEmoji(fastestEscape.weather_now?.summary)}</span>
                        <span>{weatherLabel(fastestEscape.weather_now?.summary)}</span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-end gap-2 text-right">
                      <p className="text-[20px] leading-none text-amber-600 inline-flex items-center gap-1 font-semibold" style={{ fontFamily: 'DM Mono, monospace' }}>
                        <Sun className="w-4 h-4 text-amber-500" strokeWidth={1.9} />
                        {formatSunHours(fastestEscape.sun_score.sunshine_forecast_min)}
                      </p>
                      {fastestTravel && (
                        <p className="text-[15px] leading-none text-slate-600 inline-flex items-center gap-1 font-medium" style={{ fontFamily: 'DM Mono, monospace' }}>
                          <IconForMode mode={fastestTravel.mode} />
                          {formatTravelClock(fastestTravel.min / 60)}
                        </p>
                      )}
                    </div>
                  </div>
                  {fastestGainMin > 0 && (
                    <p className="mt-1 text-[11px] text-emerald-600 font-semibold">+{formatSunHours(fastestGainMin)} vs {origin.name}</p>
                  )}
                </div>
              </div>
            </button>

            <div className={`grid transition-all duration-200 ease-out ${openFastest ? 'grid-rows-[1fr] border-t border-slate-200' : 'grid-rows-[0fr]'}`}>
              <div className="overflow-hidden">
                <div className="px-3.5 py-3 space-y-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                    <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold mb-1.5">Detailed weather</p>
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
                      <span className="inline-flex items-center gap-1">
                        <Thermometer className="w-3.5 h-3.5" strokeWidth={1.8} />
                        {Math.round(fastestEscape.weather_now?.temp_c ?? 0)}°C
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Cloud className="w-3.5 h-3.5" strokeWidth={1.8} />
                        {fastestEscape.conditions}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Sun className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.8} />
                        {fastestEscape.sun_score.low_cloud_cover_pct}% low cloud
                      </span>
                    </div>
                  </div>

                  {fastestEscape.travel.train && (
                    <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold mb-1.5">Live train info</p>
                      <div className="flex flex-wrap gap-2 text-[11px] text-slate-700">
                        <span className="inline-flex items-center gap-1">
                          <TrainFront className="w-3.5 h-3.5" strokeWidth={1.8} />
                          {formatTravelClock(fastestEscape.travel.train.duration_min / 60)}
                        </span>
                        {typeof fastestEscape.travel.train.changes === 'number' && (
                          <span className="text-slate-500">
                            {fastestEscape.travel.train.changes} change{fastestEscape.travel.train.changes === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {fastestEscape.plan.length > 0 && (
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold mb-1.5">Trip plan</p>
                      <div className="space-y-1">
                        {fastestEscape.plan.map((step, idx) => (
                          <p key={idx} className="text-[12px] text-slate-700 leading-snug">{step.replace(/[📍🥾🍽️💡]/g, '').trim()}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {fastestEscape.links.google_maps && (
                      <a
                        href={fastestEscape.links.google_maps}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800"
                      >
                        <MapPinned className="w-3.5 h-3.5" strokeWidth={1.8} />
                        Navigate
                      </a>
                    )}
                    {fastestEscape.links.sbb && (
                      <a
                        href={fastestEscape.links.sbb}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-[11px] font-semibold hover:bg-slate-50"
                      >
                        <TrainFront className="w-3.5 h-3.5" strokeWidth={1.8} />
                        SBB timetable
                      </a>
                    )}
                    <a
                      href={buildWhatsAppHref(fastestEscape)}
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
        )}

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
              <span className="text-[11px] text-slate-500" style={{ fontFamily: 'DM Mono, monospace' }}>{visibleRows.length}</span>
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

          {savedIds.length > 0 && (
            <p className="mb-2 text-[11px] text-emerald-700 inline-flex items-center gap-1">
              <Heart className="w-3.5 h-3.5" strokeWidth={1.8} fill="currentColor" /> {savedIds.length} saved
            </p>
          )}

          {visibleRows.length === 0 && !loading && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center">
              <p className="text-[14px] text-slate-700">No better escapes than {origin.name} in this joystick range.</p>
              <p className="text-[12px] text-slate-500 mt-1">Push the joystick right for broader options.</p>
            </div>
          )}

          <div className={`space-y-2.5 transition-opacity duration-150 ${(loading || isDraggingSlider) ? 'opacity-60' : 'opacity-100'}`}>
            {visibleRows.map((escape, index) => {
              const bestTravel = getBestTravel(escape)
              const isOpen = openCard === index
              const scoreBreakdown = escape.sun_score.score_breakdown
              const showBreakdown = Boolean(expandedScoreDetails[escape.destination.id])
              const gainMin = Math.max(0, escape.sun_score.sunshine_forecast_min - originSunMin)

              return (
                <article
                  key={escape.destination.id}
                  className="fomo-card overflow-hidden"
                  style={{ animation: `cardIn 180ms ease-out ${Math.min(index * 60, 240)}ms both` }}
                >
                  <div className="px-3.5 pt-3.5 pb-2.5">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenCard(prev => prev === index ? null : index)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-start gap-3">
                          <ScoreRing score={escape.sun_score.score} size={40} />

                          <div className="flex-1 min-w-0">
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

                              <div className="shrink-0 text-right">
                                <div className="inline-flex items-end gap-2">
                                  <p className="text-[20px] leading-none text-amber-600 inline-flex items-center gap-1 font-semibold" style={{ fontFamily: 'DM Mono, monospace' }}>
                                    <Sun className="w-4 h-4 text-amber-500" strokeWidth={1.9} />
                                    {formatSunHours(escape.sun_score.sunshine_forecast_min)}
                                  </p>
                                  {bestTravel && (
                                    <p className="text-[15px] leading-none text-slate-600 inline-flex items-center gap-1 font-medium" style={{ fontFamily: 'DM Mono, monospace' }}>
                                      <IconForMode mode={bestTravel.mode} />
                                      {formatTravelClock(bestTravel.min / 60)}
                                    </p>
                                  )}
                                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                                </div>
                                {gainMin > 0 && (
                                  <p className="mt-1 text-[11px] text-emerald-600 font-semibold">+{formatSunHours(gainMin)} vs {origin.name}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </button>

                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => toggleSaved(escape.destination.id)}
                          className={`w-8 h-8 rounded-full border inline-flex items-center justify-center transition ${
                            savedIds.includes(escape.destination.id)
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-600'
                              : 'border-slate-200 bg-white text-slate-500 hover:text-slate-700'
                          }`}
                          aria-label={savedIds.includes(escape.destination.id) ? 'Unsave escape' : 'Save escape'}
                        >
                          <Heart className="w-3.5 h-3.5" strokeWidth={1.9} fill={savedIds.includes(escape.destination.id) ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissSuggestion(escape.destination.id)}
                          className="w-8 h-8 rounded-full border border-slate-200 bg-white text-slate-500 inline-flex items-center justify-center hover:text-slate-700"
                          aria-label="Don't suggest again"
                        >
                          <X className="w-3.5 h-3.5" strokeWidth={1.9} />
                        </button>
                      </div>
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
                            </div>
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
                              <TrainFront className="w-3.5 h-3.5" strokeWidth={1.8} />
                              SBB timetable
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
