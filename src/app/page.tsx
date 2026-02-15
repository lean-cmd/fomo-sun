'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Car,
  Clock3,
  ChevronDown,
  Cloud,
  Info,
  LocateFixed,
  MapPinned,
  Mountain,
  Share2,
  Sun,
  Thermometer,
  TrainFront,
} from 'lucide-react'
import {
  DaylightWindow,
  DestinationType,
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

type CitySeed = { name: string; lat: number; lon: number }

const MIN_TRAVEL_H = 0.5
const MAX_TRAVEL_H = 4.5

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

const TYPES: { id: DestinationType; label: string }[] = [
  { id: 'nature', label: 'Nature' },
  { id: 'viewpoint', label: 'Views' },
  { id: 'town', label: 'Town' },
  { id: 'lake', label: 'Lake' },
  { id: 'family', label: 'Family' },
  { id: 'food', label: 'Food' },
  { id: 'thermal', label: 'Thermal' },
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

function extractTemp(summary?: string) {
  if (!summary) return null
  const m = summary.match(/(-?\d+)\s*°c/i)
  return m ? Number(m[1]) : null
}

function formatGainTag(gainMin: number, originMin: number, originName: string) {
  if (gainMin <= 0) return `vs ${originName}`
  const gainLabel = formatSunHours(gainMin)
  if (originMin <= 0) return `+${gainLabel} vs ${originName}`

  const gainPct = Math.round((gainMin / originMin) * 100)
  if (gainPct >= 100) {
    const ratio = (gainMin + originMin) / originMin
    const ratioRounded = ratio >= 10 ? Math.round(ratio) : Math.round(ratio * 10) / 10
    const ratioLabel = Number.isInteger(ratioRounded) ? `${ratioRounded}x` : `${ratioRounded.toFixed(1)}x`
    return `+${gainLabel} · ${ratioLabel} vs ${originName}`
  }
  return `+${gainLabel} (+${gainPct}%) vs ${originName}`
}

function parseComparisonLine(text: string) {
  const parts = text.split('|').map(x => x.trim())
  if (parts.length < 2) return ''
  return parts[1]
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
        <span className="text-[12px] font-semibold text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>{pct}</span>
        <span className="text-[6px] tracking-[0.16em] text-amber-600 font-semibold">TM</span>
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
  if (!segments.length) return '☁️☁️⛅☀️'
  const slotCount = 8
  const slots: string[] = []
  for (const seg of segments) {
    const icon = seg.condition === 'sun' ? '☀️' : seg.condition === 'partial' ? '⛅' : seg.condition === 'night' ? '🌙' : '☁️'
    const n = Math.max(1, Math.round((seg.pct / 100) * slotCount))
    for (let i = 0; i < n; i += 1) slots.push(icon)
  }
  return slots.slice(0, slotCount).join('')
}

function IconForMode({ mode }: { mode: 'car' | 'train' }) {
  return mode === 'car'
    ? <Car className="w-4 h-4" strokeWidth={1.8} />
    : <TrainFront className="w-4 h-4" strokeWidth={1.8} />
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
  const [centerH, setCenterH] = useState(2)
  const [sliderPos, setSliderPos] = useState(0)
  const [isDraggingSlider, setIsDraggingSlider] = useState(false)
  const [showSliderValue, setShowSliderValue] = useState(false)

  const [mode, setMode] = useState<TravelMode>('both')
  const [ga, setGA] = useState(false)
  const [types, setTypes] = useState<DestinationType[]>([])
  const [tripSpan, setTripSpan] = useState<TripSpan>('daytrip')
  const [tripSpanTouched, setTripSpanTouched] = useState(false)

  const [data, setData] = useState<SunnyEscapesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [demo, setDemo] = useState(true)
  const [openCard, setOpenCard] = useState<number | null>(0)
  const [openSetting, setOpenSetting] = useState<'mode' | 'filters' | null>(null)

  const [selectedCity, setSelectedCity] = useState<string>('Basel')
  const [gpsOrigin, setGpsOrigin] = useState<{ lat: number; lon: number; name: string } | null>(null)
  const [originMode, setOriginMode] = useState<'manual' | 'gps'>('manual')
  const [locating, setLocating] = useState(false)

  const [hasSetOptimal, setHasSetOptimal] = useState(false)
  const [optimalHint, setOptimalHint] = useState(false)
  const [showOptimalInfo, setShowOptimalInfo] = useState(false)
  const [queryMaxH, setQueryMaxH] = useState(maxH)

  const [sentenceIdx, setSentenceIdx] = useState(0)
  const [sentenceVisible, setSentenceVisible] = useState(true)

  const [expandedScoreDetails, setExpandedScoreDetails] = useState<Record<string, boolean>>({})

  const requestCtrlRef = useRef<AbortController | null>(null)
  const snapPulseRef = useRef<number | null>(null)

  const manualOrigin = useMemo(
    () => MANUAL_ORIGIN_CITIES.find(city => city.name === selectedCity) || MANUAL_ORIGIN_CITIES[0],
    [selectedCity]
  )
  const origin = originMode === 'gps' && gpsOrigin ? gpsOrigin : manualOrigin

  const dayFocus: DayFocus = tripSpan === 'plus1day' ? 'tomorrow' : 'today'
  const topEscape = data?.escapes?.[0] ?? null
  const fastestEscape = data?.fastest_escape ?? null
  const originSunMin = data?.origin_conditions.sunshine_min ?? 0
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
          mode,
          ga: String(ga),
          limit: '5',
          demo: String(demo),
          trip_span: tripSpan,
          origin_kind: originMode,
          origin_name: origin.name,
        })
        if (types.length) p.set('types', types.join(','))
        const res = await fetch(`/api/v1/sunny-escapes?${p.toString()}`, { signal: ctrl.signal })
        const payload: SunnyEscapesResponse = await res.json()
        setData(payload)

        if (!hasSetOptimal && payload.optimal_travel_h) {
          const center = clamp(quantizeHour(payload.optimal_travel_h), 1.25, 3.25)
          setCenterH(center)
          setMaxH(center)
          setSliderPos(0)
          setHasSetOptimal(true)
          setOptimalHint(true)
        }
      } catch (err) {
        if ((err as Error)?.name !== 'AbortError') console.error(err)
      } finally {
        if (requestCtrlRef.current === ctrl) setLoading(false)
      }
    }

    run()
  }, [queryMaxH, mode, ga, types, demo, tripSpan, origin.lat, origin.lon, origin.name, originMode, hasSetOptimal])

  useEffect(() => () => {
    requestCtrlRef.current?.abort()
    if (snapPulseRef.current !== null) {
      window.clearTimeout(snapPulseRef.current)
    }
  }, [])

  useEffect(() => {
    if (!optimalHint) return
    const t = setTimeout(() => setOptimalHint(false), 2500)
    return () => clearTimeout(t)
  }, [optimalHint])

  useEffect(() => {
    if (!data || tripSpanTouched) return
    const hour = new Date().getHours()
    if (hour >= 17 || data.sunset.is_past || data.sunset.minutes_until <= 30) {
      setTripSpan('plus1day')
    }
  }, [data, tripSpanTouched])

  useEffect(() => {
    if (!data?.escapes?.length) {
      setOpenCard(null)
      return
    }
    setOpenCard(0)
  }, [data?.escapes])

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
    if (originSentences.length <= 1) return
    const timer = window.setInterval(() => {
      setSentenceVisible(false)
      window.setTimeout(() => {
        setSentenceIdx(prev => (prev + 1) % originSentences.length)
        setSentenceVisible(true)
      }, 300)
    }, 4000)
    return () => window.clearInterval(timer)
  }, [originSentences.length])

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
        setHasSetOptimal(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000 }
    )
  }

  const selectManualCity = (name: string) => {
    setSelectedCity(name)
    setOriginMode('manual')
    setHasSetOptimal(false)
  }

  const handleSliderChange = (posRaw: number) => {
    const nextTravel = quantizeHour(sliderPosToTravel(posRaw, centerH))
    const snappedPos = sliderTravelToPos(nextTravel, centerH)
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
  const sunGainTag = formatGainTag(sunGainMin, originSunMin, origin.name)

  const toggleType = (t: DestinationType) => {
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  const timelineOriginPreview = timelineEmojiPreview(data?.origin_timeline, dayFocus)

  const buildWhatsAppHref = (escape: EscapeCard) => {
    const bestTravel = getBestTravel(escape)
    const travelText = bestTravel ? `${bestTravel.min} min by ${bestTravel.mode}` : 'short drive'
    const destinationSun = formatSunHours(escape.sun_score.sunshine_forecast_min)
    const destinationSky = timelineEmojiPreview(escape.sun_timeline, dayFocus)
    const shareText = [
      `☀️ FOMO Sun escape idea`,
      '',
      `${origin.name} (${originFomoPct}%) → ${escape.destination.name} (${Math.round(escape.sun_score.score * 100)}%)`,
      `${travelText} · ${destinationSun} sun · ${parseComparisonLine(escape.conditions) || sunGainTag}`,
      '',
      `${origin.name}: ${timelineOriginPreview}`,
      `${escape.destination.name}: ${destinationSky}`,
      '',
      `Plan: ${escape.plan[0]}`,
      escape.links.google_maps || '',
      '',
      `Find your sunny escape: https://fomosun.com`,
    ].filter(Boolean).join('\n')

    return `https://wa.me/?text=${encodeURIComponent(shareText)}`
  }

  return (
    <div className="min-h-screen bg-slate-50 fomo-grid-bg">
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
                onClick={() => { setTripSpan('daytrip'); setTripSpanTouched(true); setHasSetOptimal(false) }}
                className={`px-2.5 h-7 rounded-full text-[10px] font-semibold transition ${tripSpan === 'daytrip' ? 'bg-white text-slate-900' : 'text-slate-500'}`}
              >
                Today
              </button>
              <button
                onClick={() => { setTripSpan('plus1day'); setTripSpanTouched(true); setHasSetOptimal(false) }}
                className={`px-2.5 h-7 rounded-full text-[10px] font-semibold transition ${tripSpan === 'plus1day' ? 'bg-white text-slate-900' : 'text-slate-500'}`}
              >
                Tomorrow
              </button>
            </div>
          </div>

          <button
            onClick={() => { setDemo(v => !v); setHasSetOptimal(false) }}
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
          <p className={`text-[13px] text-slate-700 transition-opacity duration-300 ${sentenceVisible ? 'opacity-100' : 'opacity-0'}`}>
            {originSentences[sentenceIdx] || `Forecast in ${origin.name}: ${originTempC}° · ${weatherLabel(data?.origin_conditions.description)}`}
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
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3.5 sm:p-4 mb-3">
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
                  <p className="mt-1.5 text-[12px] text-slate-700 inline-flex items-center gap-1.5 flex-wrap">
                    <Sun className="w-3.5 h-3.5 text-amber-500" strokeWidth={1.8} />
                    <span style={{ fontFamily: 'DM Mono, monospace' }}>{formatSunHours(topEscape.sun_score.sunshine_forecast_min)}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-amber-700 font-semibold">{sunGainTag}</span>
                  </p>
                </div>
              </div>

              <a
                href={buildWhatsAppHref(topEscape)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-11 rounded-full border border-slate-200 px-3 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Share2 className="w-3.5 h-3.5" strokeWidth={1.8} />
                Share
              </a>
            </div>

            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
              <SunTimelineBar
                timeline={topEscape.sun_timeline}
                dayFocus={dayFocus}
                sunWindow={data?.sun_window}
                showNowMarker
                travelMin={topBestTravel?.min}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {topEscape.links.google_maps && (
                <a
                  href={topEscape.links.google_maps}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl bg-slate-900 text-white text-[11px] font-semibold hover:bg-slate-800"
                >
                  <MapPinned className="w-3.5 h-3.5" strokeWidth={1.8} />
                  Navigate
                </a>
              )}
              {topEscape.links.sbb && (
                <a
                  href={topEscape.links.sbb}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl bg-white border border-slate-200 text-slate-700 text-[11px] font-semibold hover:bg-slate-50"
                >
                  <TrainFront className="w-3.5 h-3.5" strokeWidth={1.8} />
                  SBB timetable
                </a>
              )}
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm p-3.5 sm:p-4 mb-3">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.13em] text-slate-500 font-semibold">Travel time</p>
              <p className="text-[22px] font-semibold text-slate-900 leading-tight" style={{ fontFamily: 'DM Mono, monospace' }}>
                {formatTravelClock(maxH)}
              </p>
            </div>
            <button
              type="button"
              className="text-[11px] text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
              onClick={() => setShowOptimalInfo(v => !v)}
            >
              Optimal?
            </button>
          </div>

          {showOptimalInfo && (
            <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
              Center mark is the recommended sweet spot for net sun after travel.
            </div>
          )}

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
              }}
              onPointerUp={() => {
                setIsDraggingSlider(false)
                setShowSliderValue(false)
              }}
              onBlur={() => {
                setIsDraggingSlider(false)
                setShowSliderValue(false)
              }}
              className="center-slider"
              aria-label="Travel time slider"
            />
          </div>

          <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
            <span>30 min</span>
            <span className="text-slate-500" style={{ fontFamily: 'DM Mono, monospace' }}>~{formatTravelClock(centerH)}</span>
            <span>4h 30</span>
          </div>
          <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-400">
            <span>← closer</span>
            <span>more options →</span>
          </div>

          {optimalHint && <p className="mt-1 text-[10px] text-amber-700">Auto-centered on current optimal range</p>}

          <div className="mt-3 grid grid-cols-1 gap-2">
            <button
              onClick={() => setOpenSetting(prev => prev === 'mode' ? null : 'mode')}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-left text-[12px] font-medium text-slate-700 inline-flex items-center justify-between"
            >
              <span>Travel mode: {mode === 'both' ? 'Car + Train' : mode === 'car' ? 'Car' : 'Train'}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${openSetting === 'mode' ? 'rotate-180' : ''}`} />
            </button>
            {openSetting === 'mode' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
                <div className="inline-flex rounded-full border border-slate-200 bg-white p-0.5">
                  {([
                    ['car', 'Car'],
                    ['both', 'Car + Train'],
                    ['train', 'Train'],
                  ] as [TravelMode, string][]).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setMode(key)}
                      className={`h-8 px-3 rounded-full text-[11px] font-semibold ${mode === key ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {(mode === 'train' || mode === 'both') && (
                  <label className="mt-2 inline-flex items-center gap-2 text-[11px] text-slate-600">
                    <input
                      type="checkbox"
                      checked={ga}
                      onChange={e => setGA(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-300 accent-amber-500"
                    />
                    I have a GA travelcard
                  </label>
                )}
              </div>
            )}

            <button
              onClick={() => setOpenSetting(prev => prev === 'filters' ? null : 'filters')}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-left text-[12px] font-medium text-slate-700 inline-flex items-center justify-between"
            >
              <span>Filters: {types.length ? `${types.length} selected` : 'All'}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${openSetting === 'filters' ? 'rotate-180' : ''}`} />
            </button>
            {openSetting === 'filters' && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 flex flex-wrap gap-1.5">
                {TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => toggleType(type.id)}
                    className={`h-8 px-3 rounded-full border text-[11px] font-medium ${types.includes(type.id) ? 'bg-amber-50 border-amber-300 text-amber-700' : 'bg-white border-slate-200 text-slate-600'}`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        {fastestEscape && (
          <section className="rounded-2xl border border-slate-200 border-l-[3px] border-l-amber-400 bg-white shadow-sm p-3.5 mb-3">
            <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">Fastest escape</p>
            <div className="mt-1.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>
                  {fastestEscape.destination.name}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {(() => {
                    const travel = getBestTravel(fastestEscape)
                    const gain = Math.max(0, fastestEscape.sun_score.sunshine_forecast_min - originSunMin)
                    return `${travel ? `${travel.min} min by ${travel.mode}` : 'short hop'} · ${formatSunHours(fastestEscape.sun_score.sunshine_forecast_min)} sun · +${formatSunHours(gain)} vs ${origin.name}`
                  })()}
                </p>
              </div>
              <ScoreRing score={fastestEscape.sun_score.score} size={36} />
            </div>
          </section>
        )}

        <section>
          <div className="flex items-baseline justify-between mb-2.5">
            <h2 className="text-[16px] font-semibold text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>
              Sunny escapes
            </h2>
            <span className="text-[11px] text-slate-500" style={{ fontFamily: 'DM Mono, monospace' }}>{resultRows.length}</span>
          </div>

          {resultRows.length === 0 && !loading && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center">
              <p className="text-[14px] text-slate-700">No matches in this travel window.</p>
              <p className="text-[12px] text-slate-500 mt-1">Try expanding your travel time.</p>
            </div>
          )}

          <div className={`space-y-2.5 transition-opacity duration-150 ${(loading || isDraggingSlider) ? 'opacity-60' : 'opacity-100'}`}>
            {resultRows.map((escape, index) => {
              const bestTravel = getBestTravel(escape)
              const isOpen = openCard === index
              const scorePct = Math.round(escape.sun_score.score * 100)
              const comparisonText = parseComparisonLine(escape.conditions)
              const scoreBreakdown = escape.sun_score.score_breakdown
              const showBreakdown = Boolean(expandedScoreDetails[escape.destination.id])

              return (
                <article
                  key={escape.destination.id}
                  className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden"
                  style={{ animation: `cardIn 180ms ease-out ${Math.min(index * 60, 240)}ms both` }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenCard(prev => prev === index ? null : index)}
                    className="w-full text-left px-3.5 pt-3.5 pb-2.5"
                  >
                    <div className="flex items-start gap-3">
                      <ScoreRing score={escape.sun_score.score} size={40} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="text-[15px] font-semibold text-slate-900 truncate">{escape.destination.name}</h3>
                            <p className="text-[11px] text-slate-500 mt-0.5">{escape.destination.region} · {escape.destination.altitude_m.toLocaleString()}m · {FLAG[escape.destination.country]}</p>
                          </div>

                          <div className="text-right">
                            <p className="text-[20px] leading-none text-slate-900" style={{ fontFamily: 'DM Mono, monospace' }}>
                              {formatSunHours(escape.sun_score.sunshine_forecast_min)}
                            </p>
                            {bestTravel && (
                              <p className="mt-1 text-[11px] text-slate-500 inline-flex items-center gap-1 justify-end">
                                <IconForMode mode={bestTravel.mode} />
                                {bestTravel.min} min
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-1.5 text-[11px] text-amber-700 font-semibold">{comparisonText || `${scorePct}% score`}</div>
                      </div>
                    </div>

                    <div className="mt-2.5">
                      <SunTimelineBar
                        timeline={escape.sun_timeline}
                        dayFocus={dayFocus}
                        sunWindow={data?.sun_window}
                        showNowMarker={false}
                        compact
                      />
                    </div>
                  </button>

                  <div className={`grid transition-all duration-200 ease-out ${isOpen ? 'grid-rows-[1fr] border-t border-slate-200' : 'grid-rows-[0fr]'}`}>
                    <div className="overflow-hidden">
                      <div className="px-3.5 py-3 space-y-3">
                        <div className="flex items-center gap-3 text-[11px] text-slate-600 flex-wrap">
                          <span className="inline-flex items-center gap-1">
                            <Thermometer className="w-3.5 h-3.5" strokeWidth={1.8} />
                            {Math.round(escape.weather_now?.temp_c ?? 0)}°C
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Cloud className="w-3.5 h-3.5" strokeWidth={1.8} />
                            {weatherLabel(escape.weather_now?.summary)}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Mountain className="w-3.5 h-3.5" strokeWidth={1.8} />
                            {escape.destination.altitude_m.toLocaleString()}m
                          </span>
                        </div>

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
                            className="inline-flex items-center gap-1.5 h-11 px-3 rounded-xl border border-slate-200 bg-white text-slate-700 text-[11px] font-semibold hover:bg-slate-50"
                          >
                            <Share2 className="w-3.5 h-3.5" strokeWidth={1.8} />
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
