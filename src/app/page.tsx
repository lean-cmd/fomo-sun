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
  Plus,
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
const MAX_TRAVEL_H = 6.5
const JOYSTICK_MAX_PX = 42

const TRAVEL_BANDS = [
  { id: 'quick', label: '0-60min', minH: 0, maxH: 1, maxLabel: '1h' },
  { id: 'short-a', label: '1h-1.5h', minH: 1, maxH: 1.5, maxLabel: '1h30' },
  { id: 'short-b', label: '1.5h-2h', minH: 1.5, maxH: 2, maxLabel: '2h' },
  { id: 'mid', label: '2h-3h', minH: 2, maxH: 3, maxLabel: '3h' },
  { id: 'long', label: '3h-6.5h', minH: 3, maxH: 6.5, maxLabel: '6h30' },
] as const

const DEMO_BASEL_HERO = {
  name: 'Basel',
  lat: 47.5596,
  lon: 7.5886,
  region: 'Basel-Stadt',
  altitude_m: 260,
} as const

const DEMO_ST_MORITZ = {
  id: 'st-moritz',
  name: 'St. Moritz',
  region: 'Engadin, GR',
  country: 'CH' as const,
  lat: 46.497,
  lon: 9.838,
  altitude_m: 1822,
  types: ['mountain', 'lake'] as const,
  plan_template: 'Slope session | Lake walk | Alpine terrace',
  maps_name: 'St. Moritz',
  sbb_name: 'St. Moritz',
}

const MANUAL_ORIGIN_CITIES: CitySeed[] = [
  { name: 'Aarau', lat: 47.3925, lon: 8.0442 },
  { name: 'Baden', lat: 47.4738, lon: 8.3077 },
  { name: 'Basel', lat: 47.5596, lon: 7.5886 },
  { name: 'Bern', lat: 46.948, lon: 7.4474 },
  { name: 'Biel/Bienne', lat: 47.1368, lon: 7.2468 },
  { name: 'Binningen', lat: 47.5327, lon: 7.5692 },
  { name: 'Frauenfeld', lat: 47.5552, lon: 8.8988 },
  { name: 'Luzern', lat: 47.0502, lon: 8.3093 },
  { name: 'Olten', lat: 47.3505, lon: 7.9032 },
  { name: 'Schaffhausen', lat: 47.6973, lon: 8.6349 },
  { name: 'Solothurn', lat: 47.2088, lon: 7.537 },
  { name: 'St. Gallen', lat: 47.4245, lon: 9.3767 },
  { name: 'Thun', lat: 46.7579, lon: 7.627 },
  { name: 'Winterthur', lat: 47.4988, lon: 8.7237 },
  { name: 'Zug', lat: 47.1662, lon: 8.5155 },
  { name: 'Zurich', lat: 47.3769, lon: 8.5417 },
].sort((a, b) => a.name.localeCompare(b.name))

const SWISS_CITY_FALLBACKS: CitySeed[] = [
  ...MANUAL_ORIGIN_CITIES,
  { name: 'Fribourg', lat: 46.8065, lon: 7.161 },
  { name: 'Geneva', lat: 46.2044, lon: 6.1432 },
  { name: 'Lausanne', lat: 46.5197, lon: 6.6323 },
  { name: 'Lugano', lat: 46.0037, lon: 8.9511 },
  { name: 'Neuchâtel', lat: 46.9896, lon: 6.9293 },
  { name: 'Sion', lat: 46.233, lon: 7.3606 },
].sort((a, b) => a.name.localeCompare(b.name))

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
const ZURICH_TZ = 'Europe/Zurich'
const ZURICH_CLOCK_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  timeZone: ZURICH_TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function zurichClockParts(date = new Date()) {
  const parts = ZURICH_CLOCK_FORMATTER.formatToParts(date)
  const lookup: Record<string, string> = {}
  for (const part of parts) {
    if (part.type === 'literal') continue
    lookup[part.type] = part.value
  }
  return {
    year: Number(lookup.year || '0'),
    month: Number(lookup.month || '1'),
    day: Number(lookup.day || '1'),
    hour: Number(lookup.hour || '0'),
    minute: Number(lookup.minute || '0'),
  }
}

function zurichDayKey(date = new Date()) {
  const p = zurichClockParts(date)
  return `${String(p.year).padStart(4, '0')}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`
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

function isSwissBounds(lat: number, lon: number) {
  return lat >= 45.8 && lat <= 47.9 && lon >= 5.9 && lon <= 10.5
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
    <svg viewBox="0 0 38 16" className={className} aria-label="FOMO logo" role="img">
      <g fill="#334155" style={{ fontFamily: 'Jost, DM Sans, sans-serif', fontWeight: 700, letterSpacing: 0.7 }}>
        <text x="0.2" y="12.3" fontSize="11.6">F</text>
        <text x="13.2" y="12.3" fontSize="11.6">M</text>
      </g>
      <g fill="#f59e0b" stroke="#f59e0b" strokeLinecap="round" strokeWidth="1">
        <circle cx="7.8" cy="7.9" r="2.6" />
        <path d="M7.8 2.2v1.4M7.8 12.2v1.4M2.5 7.9h1.4M11.7 7.9h1.4M4 4.2l0.9 0.9M10.7 10.9l0.9 0.9M11.6 4.2l-0.9 0.9M4.9 10.9l-0.9 0.9" />
        <circle cx="24.4" cy="7.9" r="2.6" />
        <path d="M24.4 2.2v1.4M24.4 12.2v1.4M19.1 7.9h1.4M28.3 7.9h1.4M20.6 4.2l0.9 0.9M27.3 10.9l0.9 0.9M28.2 4.2l-0.9 0.9M21.5 10.9l-0.9 0.9" />
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

function splitSunLabel(minutes: number): { major: string; fraction: string; unit: 'h' | 'min' } {
  const formatted = formatSunHours(minutes)
  if (formatted.endsWith('min')) {
    return {
      major: formatted.replace('min', ''),
      fraction: '',
      unit: 'min',
    }
  }
  const match = formatted.match(/^(\d+)([¼½¾]?)(h)$/)
  if (match) {
    return {
      major: match[1],
      fraction: match[2] || '',
      unit: 'h',
    }
  }
  return { major: formatted.replace('h', ''), fraction: '', unit: 'h' }
}

function parseHHMMToHour(value?: string) {
  if (!value) return null
  const match = value.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hh = Number(match[1])
  const mm = Number(match[2])
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null
  return clamp(hh + mm / 60, 0, 23.99)
}

function buildLocalTourismUrl(city: string) {
  const q = encodeURIComponent(city || 'Switzerland')
  return `https://www.myswitzerland.com/en-ch/search/?q=${q}`
}

function buildLocalCalendarUrl(city: string) {
  const q = encodeURIComponent(`${city} events calendar`)
  return `https://www.google.com/search?q=${q}`
}

function SunTimelineBar({
  timeline,
  dayFocus,
  sunWindow,
  showNowMarker = false,
  travelMin,
  travelMode,
  travelStartHour,
  travelUntilHour,
  arrivalMarkerHour,
  leaveByHour,
  compact = false,
  showTicks = !compact,
  label,
  sunLabel,
  inBarSunLabel,
  subLabel,
}: {
  timeline: SunTimeline
  dayFocus: DayFocus
  sunWindow?: { today: DaylightWindow; tomorrow: DaylightWindow }
  showNowMarker?: boolean
  travelMin?: number
  travelMode?: 'car' | 'train'
  travelStartHour?: number
  travelUntilHour?: number
  arrivalMarkerHour?: number
  leaveByHour?: number
  compact?: boolean
  showTicks?: boolean
  label?: string
  sunLabel?: string
  inBarSunLabel?: string
  subLabel?: string
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
  const defaultTravelStartHour = dayFocus === 'tomorrow'
    ? Math.max(7, win.start_hour)
    : nowHour
  const effectiveTravelStartHour = travelStartHour !== undefined && Number.isFinite(travelStartHour)
    ? clamp(travelStartHour, 0, 24)
    : defaultTravelStartHour
  const travelEndHour = (() => {
    if (travelUntilHour !== undefined && Number.isFinite(travelUntilHour) && travelUntilHour > effectiveTravelStartHour) {
      return clamp(travelUntilHour, effectiveTravelStartHour, 24)
    }
    if (travelMin && Number.isFinite(travelMin) && travelMin > 0) {
      return clamp(effectiveTravelStartHour + travelMin / 60, effectiveTravelStartHour, 24)
    }
    return effectiveTravelStartHour
  })()
  const travelStartPct = clamp((effectiveTravelStartHour / 24) * 100, 0, 100)
  const travelWidthPct = clamp(((travelEndHour - effectiveTravelStartHour) / 24) * 100, 0, 100 - travelStartPct)
  const arrivalMarkerPct = arrivalMarkerHour !== undefined && Number.isFinite(arrivalMarkerHour)
    ? clamp((arrivalMarkerHour / 24) * 100, 0, 100)
    : null
  const leaveByPct = leaveByHour !== undefined && Number.isFinite(leaveByHour)
    ? clamp((leaveByHour / 24) * 100, 0, 100)
    : null

  return (
    <div className="flex items-center gap-2">
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
          {inBarSunLabel && (
            <span className="tl-bar-value" title={inBarSunLabel}>
              <Sun className="w-3 h-3 shrink-0" strokeWidth={1.9} />
              <span>{inBarSunLabel}</span>
            </span>
          )}

          {showNowMarker && <div className="tl-now" style={{ left: `${nowPct}%` }} />}
          {leaveByPct !== null && <div className="tl-leave-by" style={{ left: `${leaveByPct}%` }} />}
          {arrivalMarkerPct !== null && <div className="tl-arrival" style={{ left: `${arrivalMarkerPct}%` }} />}
          {travelMin && travelWidthPct > 0 && (
            <div className="tl-travel-overlay" style={{ left: `${travelStartPct}%`, width: `${travelWidthPct}%` }}>
              {travelMode === 'train' ? (
                <TrainFront className="tl-travel-icon" strokeWidth={1.8} />
              ) : (
                <Car className="tl-travel-icon" strokeWidth={1.8} />
              )}
            </div>
          )}
        </div>
        {showTicks && (
          <div className="tl-hour-strip" aria-hidden="true">
            {TIMELINE_TICKS.map(hour => (
              <span key={hour} className="tl-hour-tick" style={{ left: `${(hour / 24) * 100}%` }}>
                <i />
                <em>{hour}</em>
              </span>
            ))}
          </div>
        )}
      </div>
      {sunLabel && (
        <span className={`w-[74px] inline-flex flex-col items-end justify-center text-right tabular-nums ${compact ? 'min-h-[20px]' : 'min-h-7'}`}>
          <span className="inline-flex items-center gap-1">
            <Sun className="w-3 h-3 text-amber-500 shrink-0" strokeWidth={1.9} />
            <span className="text-[11px] text-slate-600">{sunLabel}</span>
          </span>
          {subLabel && <span className="text-[10px] leading-none text-slate-500 mt-0.5">{subLabel}</span>}
        </span>
      )}
    </div>
  )
}

function TimelineComparisonBlock({
  originTimeline,
  destinationTimeline,
  dayFocus,
  sunWindow,
  originLabel,
  destinationLabel,
  originSunLabel,
  destinationSunLabel,
  travelMin,
  travelMode,
  travelStartHour,
  travelUntilHour,
  destinationSubLabel,
  destinationShowTicks = false,
  inlineSunLabels = false,
  showNowMarker,
}: {
  originTimeline: SunTimeline
  destinationTimeline: SunTimeline
  dayFocus: DayFocus
  sunWindow?: { today: DaylightWindow; tomorrow: DaylightWindow }
  originLabel: string
  destinationLabel: string
  originSunLabel: string
  destinationSunLabel: string
  travelMin?: number
  travelMode?: 'car' | 'train'
  travelStartHour?: number
  travelUntilHour?: number
  destinationSubLabel?: string
  destinationShowTicks?: boolean
  inlineSunLabels?: boolean
  showNowMarker?: boolean
}) {
  const win = normalizeWindow(sunWindow?.[dayFocus])
  const now = new Date()
  const nowHour = now.getHours() + now.getMinutes() / 60
  const defaultTravelStartHour = dayFocus === 'tomorrow'
    ? Math.max(7, win.start_hour)
    : nowHour
  const effectiveTravelStartHour = travelStartHour !== undefined && Number.isFinite(travelStartHour)
    ? clamp(travelStartHour, 0, 24)
    : defaultTravelStartHour
  const effectiveTravelEndHour = (() => {
    if (travelUntilHour !== undefined && Number.isFinite(travelUntilHour) && travelUntilHour > effectiveTravelStartHour) {
      return clamp(travelUntilHour, effectiveTravelStartHour, 24)
    }
    if (travelMin && Number.isFinite(travelMin) && travelMin > 0) {
      return clamp(effectiveTravelStartHour + travelMin / 60, effectiveTravelStartHour, 24)
    }
    return effectiveTravelStartHour
  })()
  const hasTravelWindow = Boolean(
    travelMin
    && Number.isFinite(travelMin)
    && travelMin > 0
    && effectiveTravelEndHour > effectiveTravelStartHour
  )
  const placeTravelOnOrigin = true

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 space-y-0.5">
      <SunTimelineBar
        timeline={originTimeline}
        dayFocus={dayFocus}
        sunWindow={sunWindow}
        showNowMarker={showNowMarker}
        travelMin={placeTravelOnOrigin && hasTravelWindow ? travelMin : undefined}
        travelMode={placeTravelOnOrigin && hasTravelWindow ? travelMode : undefined}
        travelStartHour={placeTravelOnOrigin && hasTravelWindow ? effectiveTravelStartHour : undefined}
        travelUntilHour={placeTravelOnOrigin && hasTravelWindow ? effectiveTravelEndHour : undefined}
        leaveByHour={dayFocus === 'tomorrow' && placeTravelOnOrigin && hasTravelWindow ? effectiveTravelStartHour : undefined}
        label={originLabel}
        sunLabel={inlineSunLabels ? undefined : originSunLabel}
        inBarSunLabel={inlineSunLabels ? originSunLabel : undefined}
        compact
      />
      <SunTimelineBar
        timeline={destinationTimeline}
        dayFocus={dayFocus}
        sunWindow={sunWindow}
        showNowMarker={showNowMarker}
        label={destinationLabel}
        sunLabel={inlineSunLabels ? undefined : destinationSunLabel}
        inBarSunLabel={inlineSunLabels ? destinationSunLabel : undefined}
        travelMin={!placeTravelOnOrigin && hasTravelWindow ? travelMin : undefined}
        travelMode={!placeTravelOnOrigin && hasTravelWindow ? travelMode : undefined}
        travelStartHour={!placeTravelOnOrigin && hasTravelWindow ? effectiveTravelStartHour : undefined}
        travelUntilHour={!placeTravelOnOrigin && hasTravelWindow ? effectiveTravelEndHour : undefined}
        arrivalMarkerHour={placeTravelOnOrigin && hasTravelWindow ? effectiveTravelEndHour : undefined}
        subLabel={destinationSubLabel}
        showTicks={destinationShowTicks}
        compact
      />
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

function IconForMode({ mode, className = 'w-4 h-4' }: { mode: 'car' | 'train'; className?: string }) {
  return mode === 'car'
    ? <Car className={className} strokeWidth={1.8} />
    : <TrainFront className={className} strokeWidth={1.8} />
}

function SunPlusIcon({ className = 'w-[13px] h-[13px]' }: { className?: string }) {
  return (
    <span className={`relative inline-flex shrink-0 ${className}`} aria-hidden="true">
      <Sun className="w-full h-full text-emerald-600" strokeWidth={1.9} />
      <Plus className="absolute -right-[3px] -top-[3px] w-[8px] h-[8px] text-emerald-600 bg-white rounded-full" strokeWidth={2.4} />
    </span>
  )
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
  const [rangeIndex, setRangeIndex] = useState(2)
  const [previewRangeIndex, setPreviewRangeIndex] = useState<number | null>(null)
  const [joyX, setJoyX] = useState(0)
  const [isJoystickActive, setIsJoystickActive] = useState(false)
  const [joystickNudge, setJoystickNudge] = useState(true)
  const [joystickErrorShake, setJoystickErrorShake] = useState(false)
  const [joystickNotice, setJoystickNotice] = useState('')
  const [hasJoystickInteracted, setHasJoystickInteracted] = useState(false)

  const [mode, setMode] = useState<TravelMode>('both')
  const [activeTypeChips, setActiveTypeChips] = useState<EscapeFilterChip[]>([])
  const [showResultFilters, setShowResultFilters] = useState(false)
  const [showMoreResults, setShowMoreResults] = useState(false)
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
  const [originDataSource, setOriginDataSource] = useState<'meteoswiss' | 'open-meteo' | 'mock' | ''>('')
  const [liveDataSource, setLiveDataSource] = useState<'open-meteo' | 'mock' | ''>('')
  const [forceRefreshNonce, setForceRefreshNonce] = useState(0)

  const [selectedCity, setSelectedCity] = useState<string>('Basel')
  const [gpsOrigin, setGpsOrigin] = useState<{ lat: number; lon: number; name: string } | null>(null)
  const [originMode, setOriginMode] = useState<'manual' | 'gps'>('manual')
  const [locating, setLocating] = useState(false)
  const [showDebug, setShowDebug] = useState(false)

  const [expandedScoreDetails, setExpandedScoreDetails] = useState<Record<string, boolean>>({})
  const [trainPreviewById, setTrainPreviewById] = useState<Record<string, { loading: boolean; rows: TrainConnectionPreview[]; error?: boolean }>>({})

  const requestCtrlRef = useRef<AbortController | null>(null)
  const originSelectRef = useRef<HTMLSelectElement | null>(null)
  const resultsRef = useRef<HTMLElement | null>(null)
  const joystickZoneRef = useRef<HTMLDivElement | null>(null)
  const joyAnimRef = useRef<number | null>(null)
  const joyPosRef = useRef(0)
  const joyVelRef = useRef(0)
  const joyPrevTsRef = useRef(0)
  const joyPrevXRef = useRef(0)
  const joystickPointerRef = useRef<number | null>(null)
  const joystickDirRef = useRef<'left' | 'right' | null>(null)
  const joyBaseRangeRef = useRef(2)
  const previewRangeRef = useRef<number | null>(null)
  const joystickErrorTimerRef = useRef<number | null>(null)
  const joystickNoticeTimerRef = useRef<number | null>(null)
  const autoGeoAttemptedRef = useRef(false)
  const midnightRefreshDayRef = useRef<string>('')
  const lastForceTokenRef = useRef(0)

  const manualOrigin = useMemo(
    () => MANUAL_ORIGIN_CITIES.find(city => city.name === selectedCity) || MANUAL_ORIGIN_CITIES[0],
    [selectedCity]
  )
  const origin = originMode === 'gps' && gpsOrigin ? gpsOrigin : manualOrigin
  const effectiveRangeIndex = previewRangeIndex ?? rangeIndex
  const activeBand = TRAVEL_BANDS[effectiveRangeIndex]
  const maxH = activeBand.maxH

  const dayFocus: DayFocus = tripSpan === 'plus1day' ? 'tomorrow' : 'today'
  const fastestEscape = data?.fastest_escape ?? null
  const warmestEscape = data?.warmest_escape ?? null
  const originSunMin = data?.origin_conditions.sunshine_min ?? 0

  const bucketCountMap = useMemo(() => {
    const map = new Map<string, { count: number; destinationCount: number; tier?: string }>()
    for (const bucket of data?._meta?.bucket_counts || []) {
      map.set(bucket.id, {
        count: bucket.count,
        destinationCount: bucket.destination_count ?? bucket.raw_count ?? bucket.count,
        tier: bucket.result_tier,
      })
    }
    return map
  }, [data?._meta?.bucket_counts])

  const isBandAvailable = useCallback((_bandIndex: number) => true, [])

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

  const showJoystickNoResults = useCallback((bandLabel: string, dir: 'left' | 'right') => {
    setHasJoystickInteracted(true)
    setJoystickNudge(false)
    setJoystickErrorShake(true)
    pulseJoystick(dir, 0.56)
    setJoystickNotice(`Unfortunately no sunny escapes in ${bandLabel}.`)
    if (joystickErrorTimerRef.current !== null) {
      window.clearTimeout(joystickErrorTimerRef.current)
    }
    joystickErrorTimerRef.current = window.setTimeout(() => {
      setJoystickErrorShake(false)
      joystickErrorTimerRef.current = null
    }, 280)
    if (joystickNoticeTimerRef.current !== null) {
      window.clearTimeout(joystickNoticeTimerRef.current)
    }
    joystickNoticeTimerRef.current = window.setTimeout(() => {
      setJoystickNotice('')
      joystickNoticeTimerRef.current = null
    }, 1800)
  }, [pulseJoystick])

  const stepJoystickRange = useCallback((dir: 'left' | 'right') => {
    setHasJoystickInteracted(true)
    setJoystickNudge(false)
    const delta = dir === 'left' ? -1 : 1
    const next = clamp(rangeIndex + delta, 0, TRAVEL_BANDS.length - 1)
    if (next === rangeIndex) {
      pulseJoystick(dir, 0.58)
      return
    }
    if (!isBandAvailable(next)) {
      showJoystickNoResults(TRAVEL_BANDS[next].label, dir)
      return
    }
    joystickDirRef.current = dir
    previewRangeRef.current = null
    setPreviewRangeIndex(null)
    setRangeIndex(next)
    pulseJoystick(dir)
  }, [isBandAvailable, pulseJoystick, rangeIndex, showJoystickNoResults])

  const setJoystickRange = useCallback((targetIndex: number) => {
    setHasJoystickInteracted(true)
    const next = clamp(targetIndex, 0, TRAVEL_BANDS.length - 1)
    if (next === rangeIndex) {
      pulseJoystick(next === 0 ? 'right' : 'left', 0.5)
      return
    }
    const dir = next > rangeIndex ? 'right' : 'left'
    if (!isBandAvailable(next)) {
      showJoystickNoResults(TRAVEL_BANDS[next].label, dir)
      return
    }
    joystickDirRef.current = dir
    previewRangeRef.current = null
    setPreviewRangeIndex(null)
    setRangeIndex(next)
    setJoystickNudge(false)
    pulseJoystick(dir, 0.64)
  }, [isBandAvailable, pulseJoystick, rangeIndex, showJoystickNoResults])

  const joyFromPointerX = useCallback((clientX: number) => {
    const el = joystickZoneRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const center = rect.left + rect.width / 2
    return clamp((clientX - center) / JOYSTICK_MAX_PX, -1, 1)
  }, [])

  const onJoystickPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    setHasJoystickInteracted(true)
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
    if (finalIndex !== rangeIndex && !isBandAvailable(finalIndex)) {
      const dir: 'left' | 'right' = finalIndex > rangeIndex ? 'right' : 'left'
      showJoystickNoResults(TRAVEL_BANDS[finalIndex].label, dir)
      previewRangeRef.current = null
      setPreviewRangeIndex(null)
      startJoystickSpringBack()
      return
    }
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

  useEffect(() => {
    requestCtrlRef.current?.abort()
    const ctrl = new AbortController()
    requestCtrlRef.current = ctrl
    setLoading(true)

    const run = async () => {
      try {
        const useWideInitialWindow = !hasJoystickInteracted
        const reqMaxTravelH = MAX_TRAVEL_H
        const shouldForceRefresh = forceRefreshNonce > lastForceTokenRef.current
        const p = new URLSearchParams({
          lat: String(origin.lat),
          lon: String(origin.lon),
          max_travel_h: String(reqMaxTravelH),
          mode,
          limit: '15',
          demo: String(demo),
          trip_span: tripSpan,
          origin_kind: originMode,
          origin_name: origin.name,
        })
        if (shouldForceRefresh) {
          p.set('force', 'true')
          lastForceTokenRef.current = forceRefreshNonce
        }
        if (useWideInitialWindow) {
          p.set('travel_min_h', String(MIN_TRAVEL_H))
          p.set('travel_max_h', String(MAX_TRAVEL_H))
        } else {
          p.set('travel_min_h', String(activeBand.minH))
          p.set('travel_max_h', String(activeBand.maxH))
        }
        const res = await fetch(`/api/v1/sunny-escapes?${p.toString()}`, { signal: ctrl.signal })
        const originSourceHeader = (res.headers.get('X-FOMO-Origin-Source') || '').toLowerCase()
        const liveSourceHeader = (res.headers.get('X-FOMO-Live-Source') || '').toLowerCase()
        const payload: SunnyEscapesResponse = await res.json()
        setData(payload)
        setOriginDataSource(
          originSourceHeader === 'meteoswiss' || originSourceHeader === 'open-meteo' || originSourceHeader === 'mock'
            ? (originSourceHeader as 'meteoswiss' | 'open-meteo' | 'mock')
            : ''
        )
        setLiveDataSource(liveSourceHeader === 'open-meteo' || liveSourceHeader === 'mock' ? (liveSourceHeader as 'open-meteo' | 'mock') : '')
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
  }, [activeBand.maxH, activeBand.minH, forceRefreshNonce, hasJoystickInteracted, mode, demo, tripSpan, origin.lat, origin.lon, origin.name, originMode])

  useEffect(() => () => {
    requestCtrlRef.current?.abort()
    stopJoystickAnim()
    if (joystickErrorTimerRef.current !== null) {
      window.clearTimeout(joystickErrorTimerRef.current)
      joystickErrorTimerRef.current = null
    }
    if (joystickNoticeTimerRef.current !== null) {
      window.clearTimeout(joystickNoticeTimerRef.current)
      joystickNoticeTimerRef.current = null
    }
  }, [stopJoystickAnim])

  useEffect(() => {
    if (!joystickNudge) return
    const t = setTimeout(() => setJoystickNudge(false), 4500)
    return () => clearTimeout(t)
  }, [joystickNudge])

  useEffect(() => {
    if (!data || tripSpanTouched) return
    const { hour } = zurichClockParts()
    if (hour >= 20) {
      setTripSpan('plus1day')
      return
    }
    if (hour < 17) return

    const bestTodayGain = (data.escapes || []).reduce((best, escape) => {
      const gain = Math.max(0, escape.sun_score.sunshine_forecast_min - data.origin_conditions.sunshine_min)
      return Math.max(best, gain)
    }, 0)
    if (bestTodayGain < 30) {
      setTripSpan('plus1day')
    }
  }, [data, tripSpanTouched])

  useEffect(() => {
    if (!data?._meta?.request_id) return
    setTaglineIndex(prev => (prev + 1) % HEADER_TAGLINES.length)
  }, [data?._meta?.request_id])

  const resolveOriginFromCoords = useCallback(async (lat: number, lon: number) => {
    try {
      const fallbackName = fallbackNearestCity(lat, lon)
      const r = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${lat}&longitude=${lon}&count=8&language=en&format=json`)
      const payload = await r.json()
      return pickNearestCityName(payload) || fallbackName
    } catch {
      return fallbackNearestCity(lat, lon)
    }
  }, [])

  const detectLocation = async () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        const nearest = await resolveOriginFromCoords(lat, lon)
        setGpsOrigin({ lat, lon, name: nearest })
        setOriginMode('gps')
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000 }
    )
  }

  useEffect(() => {
    if (autoGeoAttemptedRef.current) return
    autoGeoAttemptedRef.current = true
    if (!navigator.geolocation) return

    navigator.geolocation.getCurrentPosition(
      async pos => {
        const lat = pos.coords.latitude
        const lon = pos.coords.longitude
        if (!isSwissBounds(lat, lon)) return
        const nearest = await resolveOriginFromCoords(lat, lon)
        setGpsOrigin({ lat, lon, name: nearest })
        setOriginMode('gps')
      },
      () => {
        // Silently keep Basel/manual fallback.
      },
      { enableHighAccuracy: false, timeout: 5000 }
    )
  }, [resolveOriginFromCoords])

  const selectManualCity = (name: string) => {
    setSelectedCity(name)
    setOriginMode('manual')
  }

  const openOriginPicker = useCallback(() => {
    const el = originSelectRef.current
    if (!el) return
    el.focus()
    try {
      const withPicker = el as HTMLSelectElement & { showPicker?: () => void }
      if (typeof withPicker.showPicker === 'function') {
        withPicker.showPicker()
      } else {
        el.click()
      }
    } catch {
      el.click()
    }
  }, [])

  const fallbackNotice = data?._meta?.fallback_notice || ''
  const escapeRawSunMinutes = useCallback((escape: EscapeCard) => {
    if (dayFocus === 'tomorrow') {
      const tomorrowMin = Math.round((escape.tomorrow_sun_hours ?? 0) * 60)
      if (tomorrowMin > 0) return tomorrowMin
    }
    return escape.sun_score.sunshine_forecast_min
  }, [dayFocus])
  const escapeNetSunMinutes = useCallback((escape: EscapeCard) => {
    if (Number.isFinite(escape.net_sun_min)) return Math.max(0, Math.round(escape.net_sun_min))
    return escapeRawSunMinutes(escape)
  }, [escapeRawSunMinutes])
  const resultRows = data?.escapes || []
  const resultTier = data?._meta?.result_tier
  const isDemoModeActive = demo || data?._meta?.demo_mode || liveDataSource === 'mock'
  const forceQuickDemoBaselHero = isDemoModeActive && activeBand.id === 'quick'
  const forceLongDemoStMoritzHero = isDemoModeActive && activeBand.id === 'long'
  const stayHomeCityName = forceQuickDemoBaselHero ? DEMO_BASEL_HERO.name : origin.name
  const stayHomeLat = forceQuickDemoBaselHero ? DEMO_BASEL_HERO.lat : origin.lat
  const stayHomeLon = forceQuickDemoBaselHero ? DEMO_BASEL_HERO.lon : origin.lon
  const stayHomeTourismUrl = buildLocalTourismUrl(stayHomeCityName)
  const stayHomeCalendarUrl = buildLocalCalendarUrl(stayHomeCityName)
  const heroDayFocus: DayFocus = dayFocus
  const originTomorrowMin = Math.round((data?.tomorrow_sun_hours ?? 0) * 60)
  const heroOriginSunMin = dayFocus === 'tomorrow' ? originTomorrowMin : originSunMin
  const defaultHeroEscape = resultRows[0] ?? fastestEscape ?? warmestEscape ?? null
  const isBaselOrigin = forceQuickDemoBaselHero || /\bbasel\b/i.test(origin.name)
  const hasTenPctBetterOption = resultRows.some((escape) => {
    const candidateSunMin = escapeNetSunMinutes(escape)
    if (heroOriginSunMin <= 0) return candidateSunMin > 0
    return candidateSunMin >= heroOriginSunMin * 1.1
  })
  const shouldStayHomeHero = Boolean(data) && !loading && (forceQuickDemoBaselHero || resultRows.length === 0 || !hasTenPctBetterOption)
  const stayHomeHero = useMemo<EscapeCard | null>(() => {
    if (!shouldStayHomeHero || !data) return null
    const sunMin = heroOriginSunMin
    const fallbackScore = clamp(data.origin_conditions.sun_score || 0.55, 0, 1)
    const base = defaultHeroEscape
    const fallbackBreakdown = {
      net_sun_pct: Math.round(fallbackScore * 100),
      sunshine_pct: Math.round(fallbackScore * 100),
      cloud_pct: Math.round((1 - fallbackScore) * 100),
      altitude_bonus_pct: 0,
      gain_pct: 0,
    }
    if (base) {
      return {
        ...base,
        rank: 1,
        destination: {
          ...base.destination,
          id: isBaselOrigin ? 'basel' : `stay-home-${toSlug(stayHomeCityName || 'home')}`,
          name: stayHomeCityName,
          region: isBaselOrigin ? DEMO_BASEL_HERO.region : 'Home Base',
          country: 'CH',
          lat: stayHomeLat,
          lon: stayHomeLon,
          altitude_m: isBaselOrigin ? DEMO_BASEL_HERO.altitude_m : Math.max(200, Math.round(base.destination.altitude_m * 0.75)),
          types: ['town', 'lake'],
          plan_template: 'Stay local | Walk in the sun | Terrace break',
          maps_name: `${stayHomeCityName}, Switzerland`,
          sbb_name: stayHomeCityName,
        },
        sun_score: {
          ...base.sun_score,
          score: fallbackScore,
          sunshine_forecast_min: sunMin,
          altitude_bonus: 0,
          score_breakdown: {
            ...(base.sun_score.score_breakdown || fallbackBreakdown),
            altitude_bonus_pct: 0,
            gain_pct: 0,
          },
        },
        conditions: `${sunMin} min sunshine | no nearby option offers 10% more sun`,
        net_sun_min: sunMin,
        optimal_departure: undefined,
        tier_eligibility: 'best_available',
        weather_now: {
          ...base.weather_now,
          summary: data.origin_conditions.description || base.weather_now.summary,
        },
        tourism: {
          ...base.tourism,
          description_short: `Stay in ${stayHomeCityName}`,
          description_long: `${stayHomeCityName} is already at the top today. No destination in this range offers at least 10% more net sunshine after travel.`,
          highlights: [
            `${stayHomeCityName} is already one of the strongest sun picks today`,
            'Skip travel and keep your full daylight window',
            'Perfect timing for a local walk, terrace, or town event',
          ],
          tags: ['town', 'local', 'sun'],
          official_url: stayHomeTourismUrl,
        },
        travel: {},
        plan: [
          `Stay in ${stayHomeCityName}`,
          'Use the local sunny window and stay flexible',
          'Explore what is happening in town today',
          'Skip travel and keep your net sun minutes',
        ],
        links: {
          google_maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stayHomeCityName}, Switzerland`)}`,
        },
        sun_timeline: data.origin_timeline,
        tomorrow_sun_hours: data.tomorrow_sun_hours,
      }
    }
    return {
      rank: 1,
      destination: {
        id: isBaselOrigin ? 'basel' : `stay-home-${toSlug(stayHomeCityName || 'home')}`,
        name: stayHomeCityName,
        region: isBaselOrigin ? DEMO_BASEL_HERO.region : 'Home Base',
        country: 'CH',
        lat: stayHomeLat,
        lon: stayHomeLon,
        altitude_m: isBaselOrigin ? DEMO_BASEL_HERO.altitude_m : 420,
        types: ['town', 'lake'],
        plan_template: 'Stay local | Walk in the sun | Terrace break',
        maps_name: `${stayHomeCityName}, Switzerland`,
        sbb_name: stayHomeCityName,
      },
      sun_score: {
        score: fallbackScore,
        confidence: 'medium',
        sunshine_forecast_min: sunMin,
        low_cloud_cover_pct: 35,
        altitude_bonus: 0,
        data_freshness: 'live',
        score_breakdown: fallbackBreakdown,
      },
      conditions: `${sunMin} min sunshine | no nearby option offers 10% more sun`,
      net_sun_min: sunMin,
      tier_eligibility: 'best_available',
      weather_now: {
        summary: data.origin_conditions.description || 'Local sun window available',
        temp_c: 0,
      },
      tourism: {
        description_short: `Stay in ${stayHomeCityName}`,
        description_long: `${stayHomeCityName} is already your best sun play today. No destination in this range beats it by at least 10% net sun.`,
        highlights: [
          'Stay local and keep full daylight',
          'No meaningful net-sun gain from travel today',
          'Great chance to rediscover your own town',
        ],
        tags: ['town', 'local', 'sun'],
        hero_image: '',
        official_url: stayHomeTourismUrl,
        pois_nearby: [],
        source: 'fallback',
      },
      travel: {},
      plan: [
        `Stay in ${stayHomeCityName}`,
        'Enjoy the sunniest local window',
        'Check local events and tourism ideas nearby',
        'Skip travel and keep your net sun',
      ],
      links: {
        google_maps: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${stayHomeCityName}, Switzerland`)}`,
      },
      sun_timeline: data.origin_timeline,
      tomorrow_sun_hours: data.tomorrow_sun_hours,
    }
  }, [data, defaultHeroEscape, heroOriginSunMin, isBaselOrigin, shouldStayHomeHero, stayHomeCityName, stayHomeLat, stayHomeLon, stayHomeTourismUrl])
  const forcedDemoStMoritzHero = useMemo<EscapeCard | null>(() => {
    if (!forceLongDemoStMoritzHero || !data) return null
    const existing = resultRows.find((escape) => escape.destination.id === DEMO_ST_MORITZ.id)
    if (existing) return existing
    const base = defaultHeroEscape ?? fastestEscape ?? warmestEscape ?? stayHomeHero
    if (!base) return null
    const seededTomorrowHours = Math.max(base.tomorrow_sun_hours ?? 0, 6.2)
    const seededSunMin = dayFocus === 'tomorrow'
      ? Math.max(Math.round(seededTomorrowHours * 60), Math.round((data.tomorrow_sun_hours ?? 0) * 60) + 60)
      : Math.max(base.sun_score.sunshine_forecast_min, heroOriginSunMin + 60)
    return {
      ...base,
      rank: 1,
      destination: {
        ...base.destination,
        id: DEMO_ST_MORITZ.id,
        name: DEMO_ST_MORITZ.name,
        region: DEMO_ST_MORITZ.region,
        country: DEMO_ST_MORITZ.country,
        lat: DEMO_ST_MORITZ.lat,
        lon: DEMO_ST_MORITZ.lon,
        altitude_m: DEMO_ST_MORITZ.altitude_m,
        types: [...DEMO_ST_MORITZ.types],
        plan_template: DEMO_ST_MORITZ.plan_template,
        maps_name: DEMO_ST_MORITZ.maps_name,
        sbb_name: DEMO_ST_MORITZ.sbb_name,
      },
      sun_score: {
        ...base.sun_score,
        sunshine_forecast_min: seededSunMin,
      },
      net_sun_min: Math.max(base.net_sun_min, seededSunMin - 180),
      conditions: `${seededSunMin} min sunshine | demo hero showcase`,
      tomorrow_sun_hours: seededTomorrowHours,
      tourism: {
        ...base.tourism,
        description_short: 'Iconic alpine sun in St. Moritz',
        description_long: 'Demo hero card fixed to St. Moritz so stamp design can be showcased in this bucket.',
        tags: Array.from(new Set([...(base.tourism?.tags || []), 'mountain', 'alps', 'ski'])),
      },
    }
  }, [data, dayFocus, defaultHeroEscape, fastestEscape, forceLongDemoStMoritzHero, heroOriginSunMin, resultRows, stayHomeHero, warmestEscape])
  const isStayHomeHero = !forceLongDemoStMoritzHero && shouldStayHomeHero && Boolean(stayHomeHero)
  const heroEscape = forceLongDemoStMoritzHero
    ? (forcedDemoStMoritzHero ?? defaultHeroEscape)
    : (isStayHomeHero ? stayHomeHero : defaultHeroEscape)

  const topBestTravel = heroEscape && !isStayHomeHero ? getBestTravel(heroEscape) : null
  const topRawSunMin = heroEscape
    ? (isStayHomeHero
      ? heroOriginSunMin
      : escapeRawSunMinutes(heroEscape))
    : 0
  const topComparableSunMin = heroEscape
    ? (isStayHomeHero ? heroOriginSunMin : escapeNetSunMinutes(heroEscape))
    : 0
  const resolvedTopRawSunMin = topRawSunMin
  const sunGainMin = Math.max(0, topComparableSunMin - heroOriginSunMin)
  const heroLeaveByHour = parseHHMMToHour(heroEscape?.optimal_departure)
  const heroSunBlockStartHour = heroLeaveByHour !== null && topBestTravel
    ? clamp(heroLeaveByHour + topBestTravel.min / 60 - 0.08, 0, 23.99)
    : null
  const dataUpdatedText = useMemo(() => {
    if (!lastUpdatedAt) return 'just now'
    const deltaMin = Math.max(0, Math.round((Date.now() - lastUpdatedAt.getTime()) / 60000))
    if (deltaMin <= 1) return 'just now'
    return `${deltaMin} min ago`
  }, [lastUpdatedAt, loading, data])
  const dataSourceLabel = useMemo(() => {
    if (demo || data?._meta?.demo_mode || liveDataSource === 'mock') return 'Demo forecast model'
    if (originDataSource === 'meteoswiss') return 'MeteoSwiss origin + Open-Meteo destinations'
    return 'Open-Meteo live forecast'
  }, [data?._meta?.demo_mode, demo, liveDataSource, originDataSource])
  const tierMessage = useMemo(() => {
    if (resultTier === 'any_sun') return 'Slim pickings today. These are your best bets.'
    if (resultTier === 'best_available') {
      if (dayFocus === 'today' && activeBand.id === 'long') {
        return 'Driving this far is not worth it today. Plan for tomorrow.'
      }
      return 'Few places beat your origin after travel time right now.'
    }
    return ''
  }, [activeBand.id, dayFocus, resultTier])

  const heroInfoLine = useMemo(() => {
    if (!heroEscape) return ''
    if (isStayHomeHero) {
      const dayLabel = heroDayFocus === 'today' ? 'today' : 'tomorrow'
      const city = compactLabel(stayHomeCityName, 14)
      const templates = [
        `Stay close to home ${dayLabel}. ${city} is already delivering one of the best sun windows you can get.`,
        `${city} is hard to beat ${dayLabel}: no destination in range gives at least 10% more net sun after travel.`,
        `No need to chase the forecast ${dayLabel}. ${city} wins on net sun, so keep your daylight and enjoy your own town.`,
      ]
      const idx = Math.abs((heroFlowTick + city.length) % templates.length)
      return templates[idx] || templates[0]
    }
    if (forceLongDemoStMoritzHero && heroEscape.destination.id === DEMO_ST_MORITZ.id) {
      return 'Demo hero: St. Moritz is pinned in this long-travel bucket to showcase the new stamp artwork.'
    }
    const travel = topBestTravel
      ? `${formatTravelClock(topBestTravel.min / 60)} by ${topBestTravel.mode}`
      : 'a short trip'
    const dayLabel = heroDayFocus === 'today' ? 'today' : 'tomorrow'
    const city = compactLabel(origin.name, 12)
    const gain = sunGainMin > 0 ? formatSunHours(sunGainMin) : ''
    const destination = heroEscape.destination.name
    const templates = sunGainMin > 0
      ? [
        `${destination} looks much brighter than ${city} ${dayLabel}. It’s about ${travel}.`,
        `${city} stays grey ${dayLabel}; ${destination} is your best escape. Plan roughly ${travel}.`,
        `${destination} gives you about ${gain} more sun than ${city}. It’s around ${travel}.`,
      ]
      : [
        `${destination} still looks like your best shot ${dayLabel}. It’s about ${travel}.`,
        `${city} and nearby spots look similar ${dayLabel}, but ${destination} remains the strongest option.`,
      ]
    const idx = Math.abs((heroFlowTick + heroEscape.destination.id.length) % templates.length)
    return templates[idx] || templates[0]
  }, [forceLongDemoStMoritzHero, heroEscape, heroDayFocus, heroFlowTick, isStayHomeHero, origin.name, stayHomeCityName, sunGainMin, topBestTravel])

  const toggleTypeChip = (chip: EscapeFilterChip) => {
    setActiveTypeChips(prev => prev.includes(chip) ? prev.filter(x => x !== chip) : [...prev, chip])
  }

  const jumpToBestDetails = () => {
    if (heroEscape && !isStayHomeHero) setOpenCardId(heroEscape.destination.id)
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }
  const isSunnyEscapeCandidate = useCallback((escape: EscapeCard) => {
    const candidateNetSunMin = escapeNetSunMinutes(escape)
    if (heroOriginSunMin <= 0) return candidateNetSunMin > 0
    return candidateNetSunMin >= heroOriginSunMin * 1.1
  }, [escapeNetSunMinutes, heroOriginSunMin])

  const filteredRows = useMemo(() => {
    const strictBetter = resultRows.filter(isSunnyEscapeCandidate)
    if (strictBetter.length === 0) return []
    const typed = activeTypeChips.length === 0
      ? strictBetter
      : strictBetter.filter((escape) => {
        const has = (t: 'mountain' | 'town' | 'thermal' | 'lake') => escape.destination.types.includes(t)
        return activeTypeChips.some((chip) => {
          if (chip === 'ski') return has('mountain') && escape.destination.altitude_m >= 1200
          return has(chip)
        })
      })
    return typed
  }, [activeTypeChips, isSunnyEscapeCandidate, resultRows])

  const displayLimit = showMoreResults ? 15 : 5
  const visibleRows = useMemo(() => filteredRows.slice(0, 15), [filteredRows])

  const displayRows = useMemo(() => {
    type Row = { escape: EscapeCard; badges: Array<'fastest' | 'warmest'> }
    const rows: Row[] = []
    const seen = new Set<string>()

    const pushRow = (escape: EscapeCard | null | undefined) => {
      if (!escape || seen.has(escape.destination.id) || !isSunnyEscapeCandidate(escape)) return false
      rows.push({ escape, badges: [] })
      seen.add(escape.destination.id)
      return true
    }

    for (const escape of visibleRows) {
      if (rows.length >= displayLimit) break
      pushRow(escape)
    }

    if (rows.length < 3) {
      if (fastestEscape) {
        if (!pushRow(fastestEscape)) {
          const row = rows.find(r => r.escape.destination.id === fastestEscape.destination.id)
          if (row && !row.badges.includes('fastest')) row.badges.push('fastest')
        }
      }
      if (warmestEscape) {
        if (!pushRow(warmestEscape)) {
          const row = rows.find(r => r.escape.destination.id === warmestEscape.destination.id)
          if (row && !row.badges.includes('warmest')) row.badges.push('warmest')
        }
      }
    }

    const fastestId = fastestEscape?.destination.id
    const warmestId = warmestEscape?.destination.id
    return rows.slice(0, displayLimit).map(row => {
      const badges = [...row.badges]
      if (fastestId && row.escape.destination.id === fastestId && !badges.includes('fastest')) badges.push('fastest')
      if (warmestId && row.escape.destination.id === warmestId && !badges.includes('warmest')) badges.push('warmest')
      return { ...row, badges }
    })
  }, [displayLimit, fastestEscape, isSunnyEscapeCandidate, visibleRows, warmestEscape])

  useEffect(() => {
    if (filteredRows.length <= 5 && showMoreResults) {
      setShowMoreResults(false)
    }
  }, [filteredRows.length, showMoreResults])

  useEffect(() => {
    if (!displayRows.length) {
      setOpenCardId(null)
      return
    }
    setOpenCardId(displayRows[0]?.escape.destination.id ?? null)
  }, [displayRows])

  const noResultsLead = dayFocus === 'today' && activeBand.id === 'long'
    ? 'Driving this far is not worth it today.'
    : 'No destinations in this travel range right now.'
  const noResultsHint = dayFocus === 'today' && activeBand.id === 'long'
    ? 'Plan for tomorrow or choose a shorter travel bucket.'
    : 'Try a wider travel bucket or switch to tomorrow.'

  useEffect(() => {
    const triggerMidnightRefresh = () => {
      const now = new Date()
      const dayKey = zurichDayKey(now)
      const clock = zurichClockParts(now)
      if (clock.hour === 0 && clock.minute <= 1 && midnightRefreshDayRef.current !== dayKey) {
        midnightRefreshDayRef.current = dayKey
        setForceRefreshNonce(v => v + 1)
      }
    }

    const nearMidnightTimer = window.setInterval(() => {
      const clock = zurichClockParts()
      if ((clock.hour === 23 && clock.minute >= 55) || (clock.hour === 0 && clock.minute <= 5)) {
        triggerMidnightRefresh()
      }
    }, 30_000)

    const coarseTimer = window.setInterval(() => {
      triggerMidnightRefresh()
    }, 5 * 60_000)

    return () => {
      window.clearInterval(nearMidnightTimer)
      window.clearInterval(coarseTimer)
    }
  }, [])

  const buildWhatsAppHref = (escape: EscapeCard, shareDay: DayFocus = dayFocus) => {
    const isTomorrowShare = shareDay === 'tomorrow'
    const isStayHomeShare = escape.destination.id === 'basel' || escape.destination.id.startsWith('stay-home-')
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
    const destinationNetSunMin = Math.max(0, Math.round(escape.net_sun_min))
    const originTimelinePreview = timelineEmojiPreview(data?.origin_timeline, shareDay)
    const destinationSky = timelineEmojiPreview(escape.sun_timeline, shareDay)
    const gainMin = Math.max(0, destinationNetSunMin - originComparisonMin)
    const shareText = [
      isStayHomeShare ? '🌤️ FOMO Sun: Stay local today' : '🌤️ FOMO Sun: Escape the fog!',
      '',
      `📍 ${escape.destination.name} (${escape.destination.altitude_m}m, ${escape.destination.region})`,
      `☀️ ${destinationSun} sun (${formatSunHours(destinationNetSunMin)} net) · FOMO ${Math.round(escape.sun_score.score * 100)}%`,
      travelText,
      '',
      `${origin.name}:    ${originTimelinePreview}`,
      `${escape.destination.name}: ${destinationSky}`,
      '',
      gainMin > 0
        ? `🟢 +${formatSunHours(gainMin)} more sun than ${origin.name} ☀️`
        : (isStayHomeShare
          ? `✅ Stay local: this is as good as it gets today in your range`
          : `No additional sun vs ${origin.name}`),
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
        <div className="max-w-xl mx-auto px-3 h-[62px] grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="min-w-0">
            <div className="relative inline-flex items-center min-w-0 max-w-[120px] text-slate-500">
              <select
                ref={originSelectRef}
                value={selectedCity}
                onChange={(e) => {
                  setSelectedCity(e.target.value)
                  setOriginMode('manual')
                }}
                className="h-7 pl-1 pr-5 bg-transparent text-[11px] font-medium text-right text-slate-500 appearance-none focus:outline-none focus:text-slate-700 cursor-pointer"
              >
                {MANUAL_ORIGIN_CITIES.map(city => (
                  <option key={city.name} value={city.name}>{city.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none">
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.8} />
              </div>
            </div>
          </div>

          <div className="relative justify-self-center flex items-center h-full">
            <FomoWordmark className="w-[94px] h-[24px]" />
            <p className="absolute left-1/2 -translate-x-1/2 top-[42px] text-[9px] leading-none text-slate-500 whitespace-nowrap text-center">
              {HEADER_TAGLINES[taglineIndex]}
            </p>
          </div>

          <div className="flex justify-end items-center">
            <div className="inline-flex items-center gap-1 text-[10.5px]">
              <button
                onClick={() => { setTripSpan('daytrip'); setTripSpanTouched(true) }}
                className={`px-1 py-0.5 transition ${tripSpan === 'daytrip' ? 'text-slate-800 font-semibold underline decoration-amber-300 decoration-2 underline-offset-4' : 'text-slate-500 font-medium hover:text-slate-700'}`}
              >
                Today
              </button>
              <span className="text-slate-300">/</span>
              <button
                onClick={() => { setTripSpan('plus1day'); setTripSpanTouched(true) }}
                className={`px-1 py-0.5 transition ${tripSpan === 'plus1day' ? 'text-slate-800 font-semibold underline decoration-amber-300 decoration-2 underline-offset-4' : 'text-slate-500 font-medium hover:text-slate-700'}`}
              >
                Tomorrow
              </button>
            </div>
          </div>
        </div >
      </header >

      <main className="max-w-xl mx-auto px-3 pt-3 sm:pt-4 pb-16">

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
                name={isStayHomeHero ? stayHomeCityName : heroEscape.destination.name}
                destinationId={isStayHomeHero && isBaselOrigin ? 'basel' : heroEscape.destination.id}
                altitude={heroEscape.destination.altitude_m}
                region={isStayHomeHero && isBaselOrigin ? DEMO_BASEL_HERO.region : heroEscape.destination.region}
                type={stampTypeFromDestination(heroEscape.destination)}
                country={heroEscape.destination.country}
                types={heroEscape.destination.types}
                description={heroEscape.tourism?.description_long || heroEscape.tourism?.description_short || heroEscape.destination.description || ''}
                planTemplate={heroEscape.destination.plan_template}
                tourismTags={heroEscape.tourism?.tags || []}
                tourismHighlights={heroEscape.tourism?.highlights || []}
                className="h-[102px] w-[90px] drop-shadow-[0_10px_20px_rgba(180,83,9,0.18)]"
              />
            </div>

            <div className="flex items-start justify-between gap-3 pr-[88px] sm:pr-[96px]">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500 font-semibold">
                  {isStayHomeHero
                    ? (heroDayFocus === 'today' ? 'Best move today' : 'Best move tomorrow')
                    : (heroDayFocus === 'today' ? 'Best escape today' : 'Best escape tomorrow')}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <h1 className="text-[19px] leading-tight font-semibold text-slate-900 truncate" style={{ fontFamily: 'Sora, sans-serif' }}>
                    {isStayHomeHero ? 'STAY HOME' : heroEscape.destination.name}
                  </h1>
                  {!isStayHomeHero && (
                    <span className="text-[11px] text-slate-500" style={{ fontFamily: 'DM Mono, monospace' }}>
                      {heroEscape.destination.altitude_m}m
                    </span>
                  )}
                  <span className="text-[11px] text-slate-500">
                    {isStayHomeHero
                      ? `${stayHomeCityName} · HOME`
                      : `${heroEscape.destination.region} · ${FLAG[heroEscape.destination.country]}`}
                  </span>
                </div>

                <p className="mt-1 text-[12px] text-slate-600">
                  {heroInfoLine}
                </p>
                {heroDayFocus === 'tomorrow' && heroEscape.optimal_departure && !isStayHomeHero && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Leave by <span className="font-semibold text-slate-700">{heroEscape.optimal_departure}</span> to catch full sun.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3">
              {isStayHomeHero ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2">
                  <SunTimelineBar
                    timeline={data?.origin_timeline || heroEscape.sun_timeline}
                    dayFocus={heroDayFocus}
                    sunWindow={data?.sun_window}
                    label={stayHomeCityName}
                    inBarSunLabel={formatSunHours(heroOriginSunMin)}
                    subLabel="As good as it gets"
                    showTicks
                    compact
                    showNowMarker={dayFocus === 'today'}
                  />
                </div>
              ) : (
                <TimelineComparisonBlock
                  originTimeline={data?.origin_timeline || heroEscape.sun_timeline}
                  destinationTimeline={heroEscape.sun_timeline}
                  dayFocus={heroDayFocus}
                  sunWindow={data?.sun_window}
                  originLabel={origin.name}
                  destinationLabel={heroEscape.destination.name}
                  originSunLabel={formatSunHours(heroOriginSunMin)}
                  destinationSunLabel={formatSunHours(resolvedTopRawSunMin)}
                  destinationSubLabel={heroDayFocus === 'today'
                    ? `Net ${formatSunHours(Math.max(0, heroEscape.net_sun_min))} from arrival`
                    : undefined}
                  travelMin={topBestTravel?.min}
                  travelMode={topBestTravel?.mode}
                  travelStartHour={heroDayFocus === 'tomorrow' ? (heroLeaveByHour ?? undefined) : undefined}
                  travelUntilHour={heroDayFocus === 'tomorrow' ? (heroSunBlockStartHour ?? undefined) : undefined}
                  destinationShowTicks
                  inlineSunLabels
                  showNowMarker={dayFocus === 'today'}
                />
              )}
            </div>

            <div className="mt-3 inline-flex items-center gap-4">
              <button
                type="button"
                onClick={jumpToBestDetails}
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600 hover:text-slate-900"
              >
                {isStayHomeHero ? 'See alternatives ↓' : 'Escape now ↓'}
              </button>
              <a
                href={buildWhatsAppHref(heroEscape, heroDayFocus)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600 hover:text-slate-900"
              >
                <WhatsAppIcon className="w-3.5 h-3.5" />
                {isStayHomeHero ? 'Share local plan ↗' : 'Share ↗'}
              </a>
              {isStayHomeHero ? (
                <>
                  <a
                    href={stayHomeTourismUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Explore {compactLabel(stayHomeCityName, 12)} ↗
                  </a>
                  <a
                    href={stayHomeCalendarUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600 hover:text-slate-900"
                  >
                    Local events ↗
                  </a>
                </>
              ) : (
                <a
                  href={heroEscape.tourism?.official_url || stayHomeTourismUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-600 hover:text-slate-900"
                >
                  Explore place ↗
                </a>
              )}
            </div>
          </section>
        )}

        <section className="mb-3 px-1.5">
          <div className="text-center mb-1.5">
            <p className="text-[10px] uppercase tracking-[0.13em] text-slate-500 font-semibold">Travel joystick™</p>
            <p className="text-[11px] text-slate-500">Flick left or right</p>
          </div>
          <div className="flex justify-center items-center gap-2">
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
              <div
                className={`fomo-joystick-knob ${joystickNudge ? 'joystick-knob-nudge' : ''}`}
                style={{ transform: `translateX(${joyX * JOYSTICK_MAX_PX}px)` }}
              />
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
          <p className="mt-1.5 text-[10px] text-slate-500 text-center" style={{ fontFamily: 'DM Mono, monospace' }}>
            Max travel {activeBand.maxLabel}
          </p>

          {joystickNotice && (
            <p className="mt-2 text-[11px] text-slate-500 text-center">{joystickNotice}</p>
          )}
        </section>

        <section ref={resultsRef}>
          <div className="flex items-baseline justify-between mb-2">
            <h2 className="text-[16px] font-semibold text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>
              Sunny escapes
            </h2>
            <div className="inline-flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowResultFilters(v => !v)}
                className={`h-8 px-2.5 rounded-full border text-[11px] font-medium inline-flex items-center gap-1.5 transition ${showResultFilters || activeTypeChips.length > 0
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
            </div>
          </div>

          <div className="grid grid-cols-5 gap-1 items-end -mx-px px-px -mb-px">
            {TRAVEL_BANDS.map((band, idx) => {
              const active = idx === effectiveRangeIndex
              const info = bucketCountMap.get(band.id)
              const destinationCount = info?.destinationCount ?? 0
              const sparse = hasJoystickInteracted && destinationCount === 0
              return (
                <button
                  key={band.id}
                  type="button"
                  onClick={() => setJoystickRange(idx)}
                  className={`h-9 px-1.5 rounded-t-lg rounded-b-none border inline-flex items-center justify-center text-[11px] whitespace-nowrap transition-colors ${active
                    ? '-mb-px border-amber-300 border-b-white bg-white text-amber-800 font-semibold shadow-[inset_0_2px_0_0_#f59e0b]'
                    : sparse
                      ? 'border-slate-200 bg-slate-100 text-slate-500'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-white'
                    }`}
                  style={{ fontFamily: 'DM Mono, monospace' }}
                  title={sparse ? `No sunny escapes currently in ${band.label}` : undefined}
                >
                  {band.label}
                </button>
              )
            })}
          </div>

          <div className="rounded-b-2xl rounded-t-none border border-slate-200 bg-white px-2.5 py-3 sm:px-3 sm:py-3.5">

          {showResultFilters && (
            <section id="result-filter-chips" className="mb-2.5 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-2 min-w-max">
                {TYPE_FILTER_CHIPS.map(chip => {
                  const active = activeTypeChips.includes(chip.id)
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => toggleTypeChip(chip.id)}
                      className={`h-8 px-3 rounded-full border text-[11px] font-medium whitespace-nowrap transition ${active
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

          {tierMessage && displayRows.length > 0 && (
            <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
              {tierMessage}
            </div>
          )}

          {displayRows.length === 0 && !loading && (
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center">
              <p className="text-[14px] text-slate-700">{noResultsLead}</p>
              <p className="text-[12px] text-slate-500 mt-1">{noResultsHint}</p>
            </div>
          )}

          <div className={`space-y-2.5 transition-opacity duration-200 ${loading ? 'opacity-65' : 'opacity-100'}`}>
            {displayRows.map(({ escape, badges }, index) => {
              const bestTravel = getBestTravel(escape)
              const isOpen = openCardId === escape.destination.id
              const scoreBreakdown = escape.sun_score.score_breakdown
              const showBreakdown = Boolean(expandedScoreDetails[escape.destination.id])
              const gainMin = Math.max(0, escapeNetSunMinutes(escape) - heroOriginSunMin)
              const originTimelineSunMin = dayFocus === 'tomorrow' ? heroOriginSunMin : originSunMin
              const escapeTimelineSunMin = dayFocus === 'tomorrow'
                ? (Math.round((escape.tomorrow_sun_hours ?? 0) * 60) || escape.sun_score.sunshine_forecast_min)
                : escape.sun_score.sunshine_forecast_min
              const escapeLeaveByHour = parseHHMMToHour(escape.optimal_departure)
              const escapeSunBlockStartHour = escapeLeaveByHour !== null && bestTravel
                ? clamp(escapeLeaveByHour + bestTravel.min / 60 - 0.08, 0, 23.99)
                : null
              const cardFlowAnimation = cardFlowDir === 'right'
                ? 'cardFlowRight 320ms cubic-bezier(0.22, 1, 0.36, 1)'
                : 'cardFlowLeft 320ms cubic-bezier(0.22, 1, 0.36, 1)'
              const badgeText = badges.includes('fastest') && badges.includes('warmest')
                ? 'FASTEST · WARMEST'
                : badges.includes('fastest')
                  ? 'FASTEST'
                  : badges.includes('warmest')
                    ? 'WARMEST'
                    : ''
              const badgeTone = badges.includes('warmest') && !badges.includes('fastest')
                ? 'bg-orange-100 text-orange-800 border-orange-300'
                : 'bg-amber-100 text-amber-800 border-amber-300'

              return (
                <article
                  key={`${escape.destination.id}-${cardFlowTick}`}
                  className={`fomo-card relative overflow-hidden ${badges.length > 0 ? 'border-l-[3px] border-l-amber-400' : ''}`}
                  style={{ animation: `${cardFlowAnimation} ${Math.min(index * 30, 120)}ms both` }}
                >
                  {badgeText && (
                    <span
                      className={`pointer-events-none absolute left-[-34px] top-[3px] -rotate-45 border py-[1px] px-0.5 text-[7px] font-semibold uppercase tracking-[0.02em] text-center ${badgeTone} ${badgeText.includes('·') ? 'w-[128px]' : 'w-[92px]'}`}
                    >
                      {badgeText}
                    </span>
                  )}
                  <div className="px-4 pt-4 pb-3">
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenCardId(prev => prev === escape.destination.id ? null : escape.destination.id)}
                        className="flex-1 text-left"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0 pt-1.5">
                            <h3 className="text-[15px] font-semibold text-slate-900 truncate">{escape.destination.name}</h3>
                            <p className="text-[11px] text-slate-500 mt-0.5">{escape.destination.region} · {escape.destination.altitude_m.toLocaleString()}m · {FLAG[escape.destination.country]}</p>
                            <div className="mt-1.5 text-[11px] text-slate-500 inline-flex items-center gap-1">
                              <span>{Math.round(escape.weather_now?.temp_c ?? 0)}°</span>
                              <span>{weatherEmoji(escape.weather_now?.summary)}</span>
                              <span>{weatherLabel(escape.weather_now?.summary)}</span>
                            </div>
                          </div>

                          <div className="shrink-0 pt-1 pr-0.5 text-right flex items-start justify-end min-w-[65px]">
                            <div className="grid grid-cols-[13px_auto] items-center gap-x-1.5 gap-y-1 justify-end">
                              <Sun className="w-[13px] h-[13px] text-amber-500 shrink-0" strokeWidth={1.9} />
                              <div className="text-right">
                                {(() => {
                                  const sun = splitSunLabel(escapeRawSunMinutes(escape))
                                  return (
                                    <span className="inline-flex items-baseline justify-end gap-[1px] tracking-tight text-amber-600 font-semibold leading-none">
                                      <span className="text-[21px] leading-[0.95]">{sun.major}</span>
                                      {sun.fraction ? (
                                        <sup className="text-[12px] leading-none text-amber-500 font-semibold relative -top-[0.08em]">{sun.fraction}</sup>
                                      ) : null}
                                      <span className="text-[12px] leading-none text-amber-500 font-medium">{sun.unit}</span>
                                    </span>
                                  )
                                })()}
                              </div>

                              <SunPlusIcon className="w-[13px] h-[13px]" />
                              <span className="text-[11px] leading-none text-emerald-600 font-semibold text-right">
                                +{formatSunHours(gainMin)}
                              </span>

                              {bestTravel && (
                                <>
                                  <IconForMode mode={bestTravel.mode} className="w-[13px] h-[13px] text-slate-500" />
                                  <span className="text-[12px] leading-none text-slate-600 font-semibold inline-flex items-baseline justify-end">
                                    {formatTravelClock(bestTravel.min / 60)}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                          <ChevronDown className={`w-4 h-4 text-slate-400 self-center transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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

                        <div>
                          <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold mb-1.5">Timeline comparison</p>
                          <TimelineComparisonBlock
                            originTimeline={data?.origin_timeline || escape.sun_timeline}
                            destinationTimeline={escape.sun_timeline}
                            dayFocus={dayFocus}
                            sunWindow={data?.sun_window}
                            originLabel={origin.name}
                            destinationLabel={escape.destination.name}
                            originSunLabel={formatSunHours(originTimelineSunMin)}
                            destinationSunLabel={formatSunHours(escapeTimelineSunMin)}
                            destinationSubLabel={dayFocus === 'today'
                              ? `Net ${formatSunHours(Math.max(0, escape.net_sun_min))} from arrival`
                              : undefined}
                            travelMin={bestTravel?.min}
                            travelMode={bestTravel?.mode}
                            travelStartHour={dayFocus === 'tomorrow' ? (escapeLeaveByHour ?? undefined) : undefined}
                            travelUntilHour={dayFocus === 'tomorrow' ? (escapeSunBlockStartHour ?? undefined) : undefined}
                            destinationShowTicks
                            inlineSunLabels
                            showNowMarker={dayFocus === 'today'}
                          />
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
                                    <p key={conn.id} className="text-[11px] text-slate-700">
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
                              <TrainFront className="w-3.5 h-3.5" />
                              SBB Timetable
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

          {filteredRows.length > 5 && (
            <div className="mt-2">
              <button
                type="button"
                onClick={() => setShowMoreResults(v => !v)}
                className="text-[11px] text-slate-500 hover:text-slate-700 underline underline-offset-2"
              >
                {showMoreResults
                  ? 'Show fewer'
                  : `Show more (${Math.max(0, Math.min(filteredRows.length, 15) - 5)} more)`}
              </button>
            </div>
          )}

          {loading && (
            <p className="mt-2 text-[11px] text-slate-500 inline-flex items-center gap-1">
              <Clock3 className="w-3.5 h-3.5 animate-spin" /> Updating forecast
            </p>
          )}

          <p className="mt-2 text-[10px] text-slate-500 inline-flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${dataUpdatedText === 'just now' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
            Data: {dataSourceLabel}
          </p>
          </div>
        </section>
      </main>

      <footer className="mt-4 pb-[calc(3rem+env(safe-area-inset-bottom))] border-t border-slate-100">
        <div className="max-w-xl mx-auto px-4 py-5">
          <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2.5 flex items-center justify-between gap-2">
            <a
              href="/admin"
              className="inline-flex h-8 items-center rounded-lg border border-amber-300 bg-amber-50 px-2.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 transition-colors"
            >
              Open Admin Panel
            </a>
            <button
              onClick={() => setShowDebug(v => !v)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] font-semibold text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors"
            >
              <SlidersHorizontal className="w-3 h-3" />
              {showDebug ? 'Hide Debug' : 'Debug'}
            </button>
          </div>

          {showDebug && (
            <div className="w-full mt-3 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
                <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">System Status</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] text-slate-500">
                  <div className="space-y-1">
                    <p>Source: <span className="text-slate-700">{dataSourceLabel}</span></p>
                    <p>Updated: <span className="text-slate-700">{dataUpdatedText}</span></p>
                  </div>
                  <div className="space-y-1">
                    <p>ID: <span className="text-slate-700 font-mono">{data?._meta?.request_id?.slice(0, 8) || 'none'}</span></p>
                    <p>Tier: <span className="text-slate-700">{resultTier || 'none'}</span></p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 text-[10px] text-slate-500 font-medium">
                  <button onClick={detectLocation} disabled={locating} className="hover:text-amber-600 transition-colors inline-flex items-center gap-1.5">
                    <LocateFixed className="w-3.5 h-3.5" strokeWidth={1.8} />
                    {locating ? 'Locating...' : 'Use my location'}
                  </button>
                  {originMode === 'gps' && (
                    <button onClick={() => setOriginMode('manual')} className="px-2 py-1 bg-slate-100 rounded-md hover:bg-slate-200 transition-colors">
                      Reset to Basel
                    </button>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 uppercase tracking-wider text-[9px]">Model</span>
                    <button
                      onClick={() => { setDemo(v => !v) }}
                      className={`live-toggle scale-[0.8] origin-center ${demo ? 'is-demo' : 'is-live'}`}
                      aria-label={`Switch to ${demo ? 'live' : 'demo'} mode`}
                    >
                      <span className={`live-toggle-label ${demo ? 'active' : ''}`}>Demo</span>
                      <span className={`live-toggle-label ${!demo ? 'active' : ''}`}>Live</span>
                      <span className={`live-toggle-thumb ${demo ? '' : 'on'}`} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-400">
                  <a href="/api/v1/sunny-escapes" className="hover:text-amber-600 transition-colors text-left">API Access</a>
                  <a href="/llms.txt" className="hover:text-amber-600 transition-colors text-left">llms.txt</a>
                  <span className="col-span-2 text-left">
                    Weather: <a href="https://www.meteoswiss.admin.ch" className="underline hover:text-amber-600 transition-colors">MeteoSwiss</a>
                  </span>
                  <span className="col-span-2 text-left">
                    Routing: <a href="https://opentransportdata.swiss" className="underline hover:text-amber-600 transition-colors">OJP</a>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </footer>
    </div>
  )
}
