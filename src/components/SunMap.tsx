'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  ZoomControl,
  useMap,
} from 'react-leaflet'
import { ChevronDown, ExternalLink, Loader2, LocateFixed, Sun } from 'lucide-react'
import { divIcon } from 'leaflet'
import { destinations } from '@/data/destinations'
import MapLegend from '@/components/MapLegend'
import { Button } from '@/components/ui'

export type MapDay = 'today' | 'tomorrow'

export type OriginSeed = {
  name: string
  lat: number
  lon: number
  kind: 'manual' | 'gps' | 'default'
}

type SunMapProps = {
  initialOrigin: OriginSeed
  initialDay?: MapDay
  origin?: OriginSeed
  mapDay?: MapDay
  onOriginChange?: (origin: OriginSeed) => void
  originOptions?: OriginSeed[]
}

type ApiEscapeRow = {
  destination: {
    id: string
    name: string
    lat: number
    lon: number
    region: string
    country: 'CH' | 'DE' | 'FR' | 'IT'
    sbb_name?: string | null
  }
  sun_score?: { score?: number; sunshine_forecast_min?: number }
  tomorrow_sun_hours?: number
  travel?: {
    car?: { duration_min?: number }
    train?: { duration_min?: number }
  }
  links?: {
    sbb?: string
  }
}

type ApiPayload = {
  escapes?: ApiEscapeRow[]
}

type MapRow = {
  id: string
  name: string
  region: string
  country: 'CH' | 'DE' | 'FR' | 'IT'
  lat: number
  lon: number
  sunScore: number
  markerScore: number
  activeSunHours: number
  todaySunHours: number
  tomorrowSunHours: number
  carMin: number | null
  trainMin: number | null
  bestTravelMin: number | null
  sbbHref?: string
}

export const MAP_ORIGIN_CITIES: OriginSeed[] = [
  { name: 'Aarau', lat: 47.3925, lon: 8.0442, kind: 'manual' },
  { name: 'Baden', lat: 47.4738, lon: 8.3077, kind: 'manual' },
  { name: 'Basel', lat: 47.5596, lon: 7.5886, kind: 'manual' },
  { name: 'Bern', lat: 46.948, lon: 7.4474, kind: 'manual' },
  { name: 'Biel/Bienne', lat: 47.1368, lon: 7.2468, kind: 'manual' },
  { name: 'Binningen', lat: 47.5327, lon: 7.5692, kind: 'manual' },
  { name: 'Frauenfeld', lat: 47.5552, lon: 8.8988, kind: 'manual' },
  { name: 'Luzern', lat: 47.0502, lon: 8.3093, kind: 'manual' },
  { name: 'Olten', lat: 47.3505, lon: 7.9032, kind: 'manual' },
  { name: 'Schaffhausen', lat: 47.6973, lon: 8.6349, kind: 'manual' },
  { name: 'Solothurn', lat: 47.2088, lon: 7.537, kind: 'manual' },
  { name: 'St. Gallen', lat: 47.4245, lon: 9.3767, kind: 'manual' },
  { name: 'Thun', lat: 46.7579, lon: 7.627, kind: 'manual' },
  { name: 'Winterthur', lat: 47.4988, lon: 8.7237, kind: 'manual' },
  { name: 'Zug', lat: 47.1662, lon: 8.5155, kind: 'manual' },
  { name: 'Zurich', lat: 47.3769, lon: 8.5417, kind: 'manual' },
]

const SWISS_HEAT_BOUNDS = {
  latMin: 45.72,
  latMax: 47.98,
  lonMin: 5.8,
  lonMax: 10.72,
}

const DEFAULT_OVERLAY_MAX_HOURS = 10
const TRAVEL_RING_KM_PER_HOUR = 52
const TRAVEL_RING_BUCKETS = [
  { label: '1h', hours: 1 },
  { label: '1.5h', hours: 1.5 },
  { label: '2h', hours: 2 },
  { label: '3h', hours: 3 },
  { label: '6.5h', hours: 6.5 },
] as const
const COLOR_LOW: [number, number, number] = [148, 163, 184] // grey
const COLOR_MID: [number, number, number] = [59, 130, 246] // blue
const COLOR_SUNNY: [number, number, number] = [254, 240, 138] // pale yellow
const COLOR_VERY_SUNNY: [number, number, number] = [250, 204, 21] // strong yellow
const COLOR_BEST_80: [number, number, number] = [180, 83, 9] // darker orange

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function toFinite(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function scoreColor(score: number) {
  if (score > 0.8) return '#b45309'
  if (score > 0.6) return '#facc15'
  if (score >= 0.3) return '#3b82f6'
  return '#94a3b8'
}

function mixColor(a: [number, number, number], b: [number, number, number], t: number) {
  const clamped = clamp(t, 0, 1)
  const mix = (idx: number) => Math.round(a[idx] + (b[idx] - a[idx]) * clamped)
  return `rgb(${mix(0)} ${mix(1)} ${mix(2)})`
}

function sunHoursColor(hours: number, maxHours: number) {
  const normalized = clamp(hours / Math.max(4, maxHours), 0, 1)
  if (normalized <= 0.35) return mixColor(COLOR_LOW, COLOR_MID, normalized / 0.35)
  if (normalized <= 0.6) return mixColor(COLOR_MID, COLOR_SUNNY, (normalized - 0.35) / 0.25)
  if (normalized <= 0.8) return mixColor(COLOR_SUNNY, COLOR_VERY_SUNNY, (normalized - 0.6) / 0.2)
  return mixColor(COLOR_VERY_SUNNY, COLOR_BEST_80, (normalized - 0.8) / 0.2)
}

function formatTravelLabel(row: MapRow) {
  if (!Number.isFinite(row.bestTravelMin ?? NaN)) return 'Travel time unavailable'
  const rounded = Math.max(0, Math.round(Number(row.bestTravelMin)))
  const car = Number.isFinite(row.carMin ?? NaN) ? `${Math.round(Number(row.carMin))}m car` : null
  const train = Number.isFinite(row.trainMin ?? NaN) ? `${Math.round(Number(row.trainMin))}m train` : null
  const modes = [car, train].filter(Boolean).join(' · ')
  if (!modes) return `${rounded} min`
  return `${rounded} min best (${modes})`
}

function formatHourValue(hours: number) {
  if (!Number.isFinite(hours)) return '—'
  return `${Math.round(hours * 10) / 10}h`
}

function fallbackSbbUrl(originName: string, destinationSbbName?: string | null) {
  if (!destinationSbbName) return undefined
  const params = new URLSearchParams({
    von: originName,
    nach: destinationSbbName,
    moment: 'DEPARTURE',
  })
  return `https://www.sbb.ch/en?${params.toString()}`
}

function ringLabelPosition(originLat: number, originLon: number, ringKm: number, idx: number) {
  const kmPerDegLon = 111.32 * Math.cos((originLat * Math.PI) / 180)
  const lonOffset = ringKm / Math.max(25, kmPerDegLon)
  const latNudge = (idx - 2) * 0.028
  const lat = clamp(originLat + latNudge, SWISS_HEAT_BOUNDS.latMin, SWISS_HEAT_BOUNDS.latMax)
  const lon = clamp(originLon + lonOffset + 0.02, SWISS_HEAT_BOUNDS.lonMin, SWISS_HEAT_BOUNDS.lonMax)
  return [lat, lon] as [number, number]
}

function travelRingLabelIcon(label: string, km: number) {
  return divIcon({
    className: 'fomo-map-ring-label',
    html: `<span style="display:inline-flex;align-items:center;border:1px solid rgba(51,65,85,.34);background:rgba(255,255,255,.76);padding:1px 6px;border-radius:999px;font-size:9px;font-weight:600;color:rgba(51,65,85,.86);line-height:1;white-space:nowrap;box-shadow:0 1px 4px rgba(15,23,42,.12)">${label} · ${Math.round(km)}km</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function RecenterOnOrigin({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()

  useEffect(() => {
    map.setView([lat, lon], map.getZoom(), { animate: true })
  }, [lat, lon, map])

  return null
}

function EnsureMapPanes() {
  const map = useMap()

  useEffect(() => {
    const ensurePane = (name: string, zIndex: number) => {
      if (map.getPane(name)) return
      const pane = map.createPane(name)
      pane.style.zIndex = String(zIndex)
    }
    ensurePane('sunshade-pane', 330)
    ensurePane('travel-ring-pane', 360)
    ensurePane('destination-pane', 430)
    ensurePane('origin-pane', 450)
  }, [map])

  return null
}

export default function SunMap({
  initialOrigin,
  initialDay = 'today',
  origin: controlledOrigin,
  mapDay: controlledMapDay,
  onOriginChange,
  originOptions,
}: SunMapProps) {
  const [originState, setOriginState] = useState<OriginSeed>(initialOrigin)
  const [mapDayState, setMapDayState] = useState<MapDay>(initialDay)
  const origin = controlledOrigin ?? originState
  const mapDay = controlledMapDay ?? mapDayState
  const [showSunHoursOverlay, setShowSunHoursOverlay] = useState(true)
  const [locatingMe, setLocatingMe] = useState(false)
  const [rowsById, setRowsById] = useState<Record<string, ApiEscapeRow>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const cityOptions = useMemo(() => {
    const source = originOptions && originOptions.length > 0 ? originOptions : MAP_ORIGIN_CITIES
    const byName = new Map<string, OriginSeed>(source.map(item => [item.name, item]))
    if (!byName.has(origin.name)) byName.set(origin.name, origin)
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [origin, originOptions])

  useEffect(() => {
    if (!controlledOrigin) setOriginState(initialOrigin)
  }, [controlledOrigin, initialOrigin])

  useEffect(() => {
    if (!controlledMapDay) setMapDayState(initialDay)
  }, [controlledMapDay, initialDay])

  const applyOrigin = useCallback((nextOrigin: OriginSeed) => {
    if (!controlledOrigin) setOriginState(nextOrigin)
    onOriginChange?.(nextOrigin)
  }, [controlledOrigin, onOriginChange])

  const centerOnMyLocation = useCallback(() => {
    if (!navigator.geolocation || locatingMe) return
    setLocatingMe(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyOrigin({
          name: 'Current location',
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          kind: 'gps',
        })
        setLocatingMe(false)
      },
      () => {
        setLocatingMe(false)
      },
      { enableHighAccuracy: false, timeout: 7000 }
    )
  }, [applyOrigin, locatingMe])

  const fetchScoredDestinations = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError(null)

    const tripSpan = mapDay === 'tomorrow' ? 'plus1day' : 'daytrip'

    const buildUrl = (demo: boolean) => {
      const params = new URLSearchParams({
        lat: String(origin.lat),
        lon: String(origin.lon),
        origin_name: origin.name,
        origin_kind: origin.kind,
        mode: 'both',
        trip_span: tripSpan,
        max_travel_h: '6.5',
        limit: '500',
        admin: 'true',
        admin_all: 'true',
        demo: String(demo),
      })
      return `/api/v1/sunny-escapes?${params.toString()}`
    }

    try {
      let response = await fetch(buildUrl(false), { signal })
      if (!response.ok) response = await fetch(buildUrl(true), { signal })
      if (!response.ok) throw new Error(`API request failed (${response.status})`)
      const payload: ApiPayload = await response.json()
      const escapes = Array.isArray(payload.escapes) ? payload.escapes : []
      const nextById: Record<string, ApiEscapeRow> = {}
      for (const row of escapes) {
        if (!row?.destination?.id) continue
        nextById[row.destination.id] = row
      }
      setRowsById(nextById)
    } catch (err) {
      if (signal.aborted) return
      const message = err instanceof Error ? err.message : 'Failed to load map data'
      setError(message)
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [mapDay, origin.kind, origin.lat, origin.lon, origin.name])

  useEffect(() => {
    const ctrl = new AbortController()
    void fetchScoredDestinations(ctrl.signal)
    return () => ctrl.abort()
  }, [fetchScoredDestinations])

  const markerRows = useMemo<MapRow[]>(() => {
    return destinations.map(dest => {
      const api = rowsById[dest.id]
      const carMin = toFinite(api?.travel?.car?.duration_min)
      const trainMin = toFinite(api?.travel?.train?.duration_min)
      const bestTravelMin = Math.min(
        Number.isFinite(carMin ?? NaN) ? Number(carMin) : Infinity,
        Number.isFinite(trainMin ?? NaN) ? Number(trainMin) : Infinity
      )
      const todaySunHours = clamp((toFinite(api?.sun_score?.sunshine_forecast_min) ?? 0) / 60, 0, 12)
      const tomorrowSunHours = clamp(toFinite(api?.tomorrow_sun_hours) ?? Math.max(todaySunHours - 0.3, 0), 0, 12)
      const activeSunHours = mapDay === 'tomorrow' ? tomorrowSunHours : todaySunHours
      const todayScore = clamp(toFinite(api?.sun_score?.score) ?? (todaySunHours / DEFAULT_OVERLAY_MAX_HOURS), 0, 1)
      const markerScore = mapDay === 'today'
        ? todayScore
        : clamp(activeSunHours / DEFAULT_OVERLAY_MAX_HOURS, 0, 1)

      return {
        id: dest.id,
        name: dest.name,
        region: dest.region,
        country: dest.country,
        lat: dest.lat,
        lon: dest.lon,
        sunScore: todayScore,
        markerScore,
        activeSunHours,
        todaySunHours,
        tomorrowSunHours,
        carMin,
        trainMin,
        bestTravelMin: Number.isFinite(bestTravelMin) ? bestTravelMin : null,
        sbbHref: api?.links?.sbb || fallbackSbbUrl(origin.name, dest.sbb_name),
      }
    })
  }, [mapDay, origin.name, rowsById])

  const activeSunValues = useMemo(
    () => markerRows.map(row => row.activeSunHours).filter(value => Number.isFinite(value) && value > 0),
    [markerRows]
  )

  const overlayMinHours = useMemo(
    () => (activeSunValues.length === 0 ? 0 : Math.floor(Math.min(...activeSunValues) * 2) / 2),
    [activeSunValues]
  )

  const overlayMaxHours = useMemo(() => {
    if (activeSunValues.length === 0) return DEFAULT_OVERLAY_MAX_HOURS
    const maxValue = Math.max(...activeSunValues)
    return clamp(Math.ceil(maxValue * 2) / 2, 6, 12)
  }, [activeSunValues])

  const overlayRows = useMemo(
    () => markerRows
      .filter(row => Number.isFinite(row.activeSunHours) && row.activeSunHours > 0)
      .sort((a, b) => a.activeSunHours - b.activeSunHours),
    [markerRows]
  )

  const selectedRow = useMemo(
    () => markerRows.find(row => row.id === selectedId) || null,
    [markerRows, selectedId]
  )

  const citySelectorOffsetClass = selectedRow ? 'bottom-[178px] md:bottom-3' : 'bottom-3'

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f3efe4]">
      <MapContainer
        center={[46.8, 8.2]}
        zoom={8}
        minZoom={6}
        maxZoom={16}
        preferCanvas
        maxBounds={[[45.5, 5.2], [48.2, 11.25]]}
        maxBoundsViscosity={0.68}
        zoomControl={false}
        className="h-full w-full"
      >
        <EnsureMapPanes />
        <ZoomControl position="bottomright" />
        <TileLayer
          url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg"
          attribution="&copy; swisstopo"
        />
        {showSunHoursOverlay && overlayRows.map((row) => {
          const normalized = clamp(row.activeSunHours / Math.max(4, overlayMaxHours), 0, 1)
          const radiusM = 10000 + normalized * 22000
          const color = sunHoursColor(row.activeSunHours, overlayMaxHours)
          return (
            <Circle
              key={`overlay-${row.id}`}
              center={[row.lat, row.lon]}
              radius={radiusM}
              interactive={false}
              pane="sunshade-pane"
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.03 + normalized * 0.1,
                opacity: 0.06 + normalized * 0.12,
                weight: 0.32,
              }}
            />
          )
        })}
        <RecenterOnOrigin lat={origin.lat} lon={origin.lon} />

        <CircleMarker
          center={[origin.lat, origin.lon]}
          radius={8.2}
          pane="origin-pane"
          pathOptions={{
            color: '#0f172a',
            fillColor: '#020617',
            fillOpacity: 0.96,
            weight: 2,
          }}
        >
          <Popup>
            <div className="space-y-1 text-[12px]">
              <p className="font-semibold text-slate-900">{origin.name}</p>
              <p className="text-slate-600">Your selected origin</p>
            </div>
          </Popup>
        </CircleMarker>

        {TRAVEL_RING_BUCKETS.map((ring) => {
          const ringKm = ring.hours * TRAVEL_RING_KM_PER_HOUR
          return (
            <Circle
              key={`ring-${ring.label}`}
              center={[origin.lat, origin.lon]}
              radius={ringKm * 1000}
              interactive={false}
              pane="travel-ring-pane"
              pathOptions={{
                color: '#334155',
                weight: ring.hours >= 3 ? 1.55 : 1.35,
                opacity: 0.38,
                dashArray: '4 6',
                fillOpacity: 0,
              }}
            />
          )
        })}
        {TRAVEL_RING_BUCKETS.map((ring, idx) => {
          const ringKm = ring.hours * TRAVEL_RING_KM_PER_HOUR
          return (
            <Marker
              key={`ring-label-${ring.label}`}
              position={ringLabelPosition(origin.lat, origin.lon, ringKm, idx)}
              icon={travelRingLabelIcon(ring.label, ringKm)}
              interactive={false}
              keyboard={false}
            />
          )
        })}

        {markerRows.map(row => (
          <CircleMarker
            key={row.id}
            center={[row.lat, row.lon]}
            radius={6.4}
            pane="destination-pane"
            pathOptions={{
              color: '#ffffff',
              fillColor: scoreColor(row.markerScore),
              fillOpacity: 0.96,
              weight: 1.5,
            }}
            eventHandlers={{
              click: () => setSelectedId(row.id),
            }}
          >
            <Popup>
              <div className="min-w-[190px] space-y-1 text-[12px]">
                <p className="text-[13px] font-semibold text-slate-900">{row.name}</p>
                <p className="text-slate-600">{row.region} · {row.country}</p>
                <p className="text-slate-700">Sun score: {Math.round(row.sunScore * 100)}%</p>
                <p className="text-slate-700">
                  {mapDay === 'tomorrow' ? 'Tomorrow sun' : 'Today sun'}: {formatHourValue(row.activeSunHours)}
                </p>
                <p className="text-slate-700">From {origin.name}: {formatTravelLabel(row)}</p>
                {row.sbbHref ? (
                  <a
                    href={row.sbbHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900"
                  >
                    Open SBB
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <p className="text-[11px] text-slate-500">SBB link unavailable</p>
                )}
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>

      <div className="pointer-events-none absolute inset-0 z-[500]">
        <div className="pointer-events-auto absolute left-3 top-3 flex max-w-[90vw] flex-col gap-1.5 rounded-xl border border-slate-200 bg-white/92 px-2.5 py-2 shadow-[0_8px_18px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              onClick={() => setShowSunHoursOverlay(prev => !prev)}
              size="sm"
              variant={showSunHoursOverlay ? 'primary' : 'neutral'}
              title="Interpolated sun hours overlay"
            >
              <Sun className="h-3 w-3" />
              Overlay
            </Button>
            <Button
              onClick={centerOnMyLocation}
              disabled={locatingMe}
              size="sm"
              variant="neutral"
              className="bg-white/92 disabled:opacity-60"
            >
              <LocateFixed className="h-3 w-3" />
              {locatingMe ? 'Locating…' : 'Center me'}
            </Button>
          </div>
        </div>

        <MapLegend
          className="absolute bottom-3 left-3 max-w-[250px]"
          day={mapDay}
          overlayVisible={showSunHoursOverlay}
          minHours={overlayMinHours}
          maxHours={overlayMaxHours}
          travelRingLabels={TRAVEL_RING_BUCKETS.map((ring) => ring.label)}
        />

        <div className="pointer-events-auto absolute bottom-3 right-3 rounded-lg border border-slate-200 bg-white/90 px-2.5 py-1.5 text-[11px] text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.12)] backdrop-blur">
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading…
            </span>
          ) : (
            <span>
              {markerRows.length} destinations · {error ? 'fallback/error mode' : 'live'}
            </span>
          )}
        </div>

        <div className={`pointer-events-auto absolute left-1/2 z-[520] -translate-x-1/2 ${citySelectorOffsetClass}`}>
          <div className="relative inline-flex items-center min-w-[172px] max-w-[86vw] rounded-full border border-slate-300/90 bg-white/92 pl-3 pr-7 py-1.5 shadow-[0_8px_18px_rgba(15,23,42,0.12)] backdrop-blur">
            <select
              value={origin.name}
              onChange={(event) => {
                const selected = cityOptions.find(city => city.name === event.target.value)
                if (!selected) return
                applyOrigin(selected)
              }}
              className="w-full appearance-none bg-transparent text-[11px] font-medium text-slate-700 focus:outline-none"
              aria-label="Select origin city"
            >
              {cityOptions.map(city => (
                <option key={city.name} value={city.name}>{city.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" strokeWidth={1.8} />
          </div>
        </div>

        {selectedRow && (
          <div className="pointer-events-auto absolute inset-x-3 bottom-3 rounded-2xl border border-slate-200 bg-white/96 p-3 text-slate-800 shadow-xl backdrop-blur md:hidden">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[15px] font-semibold">{selectedRow.name}</p>
                <p className="text-[11px] text-slate-500">{selectedRow.region} · {selectedRow.country}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-md border border-slate-300 px-2 py-0.5 text-[11px] text-slate-600"
              >
                Close
              </button>
            </div>
            <div className="mt-2 space-y-1 text-[12px]">
              <p>Today sun: <span className="font-semibold text-slate-800">{formatHourValue(selectedRow.todaySunHours)}</span></p>
              <p>Tomorrow sun: <span className="font-semibold text-slate-800">{formatHourValue(selectedRow.tomorrowSunHours)}</span></p>
              <p>Travel from {origin.name}: {formatTravelLabel(selectedRow)}</p>
              {selectedRow.sbbHref ? (
                <a
                  href={selectedRow.sbbHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-700"
                >
                  Open SBB
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <p className="text-[11px] text-slate-500">No SBB timetable link for this destination.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
