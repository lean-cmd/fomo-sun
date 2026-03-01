'use client'

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  ZoomControl,
  useMapEvents,
  useMap,
} from 'react-leaflet'
import { ExternalLink, Loader2, LocateFixed, Sun } from 'lucide-react'
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
  onOpenDestinationCard?: (payload: {
    destinationId: string
    bucketLabels: string[]
    originName: string
    day: MapDay
  }) => void
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
  net_sun_min?: number
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
  _meta?: {
    result_tier?: string
  }
  origin_conditions?: {
    sunshine_min?: number
  }
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
  netSunMin: number | null
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
  { id: 'quick', label: '1h', minH: 0, maxH: 1, hours: 1 },
  { id: 'short-a', label: '1.5h', minH: 1, maxH: 1.5, hours: 1.5 },
  { id: 'short-b', label: '2h', minH: 1.5, maxH: 2, hours: 2 },
  { id: 'mid', label: '3h', minH: 2, maxH: 3, hours: 3 },
  { id: 'long', label: '6.5h', minH: 3, maxH: 6.5, hours: 6.5 },
] as const
const COLOR_LOW: [number, number, number] = [148, 163, 184] // grey
const COLOR_MID: [number, number, number] = [96, 165, 250] // light blue
const COLOR_SUNNY: [number, number, number] = [254, 240, 138] // pale yellow
const COLOR_VERY_SUNNY: [number, number, number] = [250, 204, 21] // strong yellow
const COLOR_BEST_80: [number, number, number] = [202, 138, 4] // deep golden yellow

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function toFinite(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function scoreColor(score: number) {
  if (score > 0.8) return '#ca8a04'
  if (score > 0.6) return '#facc15'
  if (score >= 0.3) return '#60a5fa'
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
  const kmPerDegLat = 111.32
  const kmPerDegLon = 111.32 * Math.cos((originLat * Math.PI) / 180)
  const insideBottomKm = ringKm * 0.93
  const latOffset = insideBottomKm / kmPerDegLat
  const lonNudgeKm = (idx - 2) * 1.15
  const lonOffset = lonNudgeKm / Math.max(25, kmPerDegLon)
  const lat = clamp(originLat - latOffset, SWISS_HEAT_BOUNDS.latMin, SWISS_HEAT_BOUNDS.latMax)
  const lon = clamp(originLon + lonOffset, SWISS_HEAT_BOUNDS.lonMin, SWISS_HEAT_BOUNDS.lonMax)
  return [lat, lon] as [number, number]
}

function travelRingLabelIcon(label: string, km: number) {
  return divIcon({
    className: 'fomo-map-ring-label',
    html: `<span style="position:relative;left:50%;transform:translateX(-50%);display:inline-block;font-size:9px;font-weight:600;color:rgba(51,65,85,.82);line-height:1;letter-spacing:.01em;white-space:nowrap;text-shadow:0 1px 2px rgba(255,255,255,.95),0 0 2px rgba(255,255,255,.9)">${label} · ${Math.round(km)}km</span>`,
    iconSize: [0, 0],
    iconAnchor: [0, 0],
  })
}

function bucketWinnerSunIcon(score: number, winCount: number) {
  const size = winCount > 1 ? 26 : 22
  const glow = score > 0.8 ? 'rgba(202,138,4,.52)' : score > 0.6 ? 'rgba(250,204,21,.48)' : 'rgba(96,165,250,.42)'
  const core = scoreColor(score)
  return divIcon({
    className: 'fomo-map-bucket-sun',
    html: `<span style="position:relative;display:inline-grid;place-items:center;width:${size}px;height:${size}px;border-radius:999px;background:radial-gradient(circle at 32% 30%, #fffbe6 0 28%, ${core} 58%, #ca8a04 100%);border:1.3px solid rgba(255,255,255,.95);color:rgba(120,53,15,.95);font-size:${winCount > 1 ? 14 : 13}px;font-weight:700;line-height:1;box-shadow:0 0 0 2px ${glow},0 4px 12px rgba(15,23,42,.25)">☀</span>`,
    iconSize: [size, size],
    iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
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
    const sunshadePane = map.getPane('sunshade-pane')
    const travelRingPane = map.getPane('travel-ring-pane')
    if (sunshadePane) sunshadePane.style.pointerEvents = 'none'
    if (travelRingPane) travelRingPane.style.pointerEvents = 'none'
  }, [map])

  return null
}

function MapZoomSync({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMapEvents({
    zoomend: () => onZoomChange(map.getZoom()),
  })

  useEffect(() => {
    onZoomChange(map.getZoom())
  }, [map, onZoomChange])

  return null
}

export default function SunMap({
  initialOrigin,
  initialDay = 'today',
  origin: controlledOrigin,
  mapDay: controlledMapDay,
  onOriginChange,
  onOpenDestinationCard,
}: SunMapProps) {
  const [originState, setOriginState] = useState<OriginSeed>(initialOrigin)
  const [mapDayState, setMapDayState] = useState<MapDay>(initialDay)
  const origin = controlledOrigin ?? originState
  const mapDay = controlledMapDay ?? mapDayState
  const [showSunHoursOverlay, setShowSunHoursOverlay] = useState(true)
  const [showTravelRings, setShowTravelRings] = useState(true)
  const [legendCollapsed, setLegendCollapsed] = useState(true)
  const [locatingMe, setLocatingMe] = useState(false)
  const [rowsById, setRowsById] = useState<Record<string, ApiEscapeRow>>({})
  const [apiResultTier, setApiResultTier] = useState<string | null>(null)
  const [originSunMin, setOriginSunMin] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [mapZoom, setMapZoom] = useState(8)

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
      setApiResultTier(typeof payload._meta?.result_tier === 'string' ? payload._meta.result_tier : null)
      setOriginSunMin(toFinite(payload.origin_conditions?.sunshine_min) ?? 0)
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
      const netSunMin = toFinite(api?.net_sun_min)
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
        netSunMin,
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

  const hasTenPctBetterOption = useMemo(() => {
    const rows = Object.values(rowsById)
    if (rows.length === 0) return false
    const originReference = Math.max(0, originSunMin)
    return rows.some((row) => {
      const netSunMin = toFinite(row.net_sun_min)
      if (!Number.isFinite(netSunMin ?? NaN)) return false
      const candidate = Number(netSunMin)
      if (originReference <= 0) return candidate > 0
      return candidate >= originReference * 1.1
    })
  }, [originSunMin, rowsById])

  const showHomeBestOrb = useMemo(() => {
    if (loading) return false
    if (Object.keys(rowsById).length === 0) return false
    if (apiResultTier === 'best_available') return true
    return !hasTenPctBetterOption
  }, [apiResultTier, hasTenPctBetterOption, loading, rowsById])

  const bucketWinnersByDestinationId = useMemo(() => {
    const byDestination = new Map<string, string[]>()
    for (const bucket of TRAVEL_RING_BUCKETS) {
      const minMin = Math.round(bucket.minH * 60)
      const maxMin = Math.round(bucket.maxH * 60)
      const rows = markerRows
        .filter((row) => Number.isFinite(row.bestTravelMin ?? NaN))
        .filter((row) => {
          const travelMin = Number(row.bestTravelMin)
          return travelMin >= minMin && travelMin <= maxMin
        })
        .filter((row) => row.activeSunHours > 0)
      if (rows.length === 0) continue
      const best = [...rows].sort((a, b) => {
        const aNet = Number.isFinite(a.netSunMin ?? NaN) ? Number(a.netSunMin) : a.activeSunHours * 60
        const bNet = Number.isFinite(b.netSunMin ?? NaN) ? Number(b.netSunMin) : b.activeSunHours * 60
        if (bNet !== aNet) return bNet - aNet
        if (b.markerScore !== a.markerScore) return b.markerScore - a.markerScore
        if (b.activeSunHours !== a.activeSunHours) return b.activeSunHours - a.activeSunHours
        return (a.bestTravelMin ?? Infinity) - (b.bestTravelMin ?? Infinity)
      })[0]
      if (!best) continue
      const labels = byDestination.get(best.id) || []
      labels.push(bucket.label)
      byDestination.set(best.id, labels)
    }
    return byDestination
  }, [markerRows])
  const selectedBucketWins = useMemo(
    () => (selectedRow ? (bucketWinnersByDestinationId.get(selectedRow.id) || []) : []),
    [bucketWinnersByDestinationId, selectedRow]
  )

  const statusOffsetClass = selectedRow ? 'bottom-[210px] md:bottom-3' : 'bottom-3'
  const overlayZoomFactor = clamp((mapZoom - 6) / 4, 0, 1)

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f3efe4]">
      <MapContainer
        center={[46.8, 8.2]}
        zoom={8}
        minZoom={6}
        maxZoom={16}
        maxBounds={[[45.5, 5.2], [48.2, 11.25]]}
        maxBoundsViscosity={0.68}
        zoomControl={false}
        className="h-full w-full"
      >
        <EnsureMapPanes />
        <MapZoomSync onZoomChange={setMapZoom} />
        <ZoomControl position="bottomright" />
        <TileLayer
          url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg"
          attribution="&copy; swisstopo"
        />
        {showSunHoursOverlay && overlayRows.map((row) => {
          const normalized = clamp(row.activeSunHours / Math.max(4, overlayMaxHours), 0, 1)
          const radiusScale = 1.18 - overlayZoomFactor * 0.26
          const radiusCoreM = (9000 + normalized * 16000) * radiusScale
          const radiusHaloM = radiusCoreM * 1.62
          const color = sunHoursColor(row.activeSunHours, overlayMaxHours)
          const opacityScale = 0.52 + overlayZoomFactor * 0.9
          return (
            <Fragment key={`overlay-${row.id}`}>
              <Circle
                center={[row.lat, row.lon]}
                radius={radiusHaloM}
                interactive={false}
                pane="sunshade-pane"
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: (0.004 + normalized * 0.024) * opacityScale,
                  opacity: 0,
                  weight: 0,
                }}
              />
              <Circle
                center={[row.lat, row.lon]}
                radius={radiusCoreM}
                interactive={false}
                pane="sunshade-pane"
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: (0.009 + normalized * 0.045) * opacityScale,
                  opacity: 0,
                  weight: 0,
                }}
              />
            </Fragment>
          )
        })}
        <RecenterOnOrigin lat={origin.lat} lon={origin.lon} />

        {showHomeBestOrb && (
          <>
            <CircleMarker
              center={[origin.lat, origin.lon]}
              radius={24}
              pane="origin-pane"
              interactive={false}
              pathOptions={{
                color: '#ca8a04',
                fillColor: '#fde68a',
                fillOpacity: 0.2,
                opacity: 0,
                weight: 0,
              }}
            />
            <CircleMarker
              center={[origin.lat, origin.lon]}
              radius={16}
              pane="origin-pane"
              interactive={false}
              pathOptions={{
                color: '#facc15',
                fillColor: '#fef08a',
                fillOpacity: 0.34,
                opacity: 0,
                weight: 0,
              }}
            />
          </>
        )}

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

        {showTravelRings && TRAVEL_RING_BUCKETS.map((ring) => {
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
        {showTravelRings && TRAVEL_RING_BUCKETS.map((ring, idx) => {
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
          (() => {
            const bucketWins = bucketWinnersByDestinationId.get(row.id) || []
            if (bucketWins.length > 0) {
              return (
                <Marker
                  key={row.id}
                  position={[row.lat, row.lon]}
                  pane="destination-pane"
                  icon={bucketWinnerSunIcon(row.markerScore, bucketWins.length)}
                  bubblingMouseEvents={false}
                  eventHandlers={{
                    mousedown: (event) => {
                      event.originalEvent.stopPropagation()
                    },
                    click: () => {
                      setSelectedId(row.id)
                      onOpenDestinationCard?.({
                        destinationId: row.id,
                        bucketLabels: bucketWins,
                        originName: origin.name,
                        day: mapDay,
                      })
                    },
                  }}
                />
              )
            }

            return (
              <CircleMarker
                key={row.id}
                center={[row.lat, row.lon]}
                radius={7.2}
                pane="destination-pane"
                bubblingMouseEvents={false}
                pathOptions={{
                  color: '#ffffff',
                  fillColor: scoreColor(row.markerScore),
                  fillOpacity: 0.96,
                  weight: 1.5,
                }}
                eventHandlers={{
                  mousedown: (event) => {
                    event.originalEvent.stopPropagation()
                  },
                  click: () => {
                    setSelectedId(row.id)
                    onOpenDestinationCard?.({
                      destinationId: row.id,
                      bucketLabels: [],
                      originName: origin.name,
                      day: mapDay,
                    })
                  },
                }}
              />
            )
          })()
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
              onClick={() => setShowTravelRings(prev => !prev)}
              size="sm"
              variant={showTravelRings ? 'primary' : 'neutral'}
              title="Show travel range rings"
            >
              Rings
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

        {legendCollapsed ? (
          <button
            type="button"
            onClick={() => setLegendCollapsed(false)}
            className="pointer-events-auto absolute bottom-3 left-3 rounded-full border border-slate-200 bg-white/92 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600 shadow-[0_8px_18px_rgba(15,23,42,0.12)] backdrop-blur hover:text-slate-800"
            aria-label="Expand map legend"
          >
            Legend
          </button>
        ) : (
          <div className="pointer-events-auto absolute bottom-3 left-3">
            <MapLegend
              className="max-w-[250px]"
              day={mapDay}
              overlayVisible={showSunHoursOverlay}
              minHours={overlayMinHours}
              maxHours={overlayMaxHours}
              travelRingLabels={TRAVEL_RING_BUCKETS.map((ring) => ring.label)}
              showHomeBestOrb={showHomeBestOrb}
              hasBucketSunMarkers={bucketWinnersByDestinationId.size > 0}
              showTravelRings={showTravelRings}
            />
            <button
              type="button"
              onClick={() => setLegendCollapsed(true)}
              className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-white/92 text-[11px] font-semibold text-slate-500 hover:text-slate-700"
              aria-label="Minimize map legend"
            >
              −
            </button>
          </div>
        )}

        <div className={`pointer-events-auto absolute right-3 ${statusOffsetClass} z-[520] rounded-lg border border-slate-200 bg-white/92 px-2.5 py-2 text-[10px] text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.12)] backdrop-blur`}>
          <div className="inline-flex items-center gap-1.5 text-[10px] text-slate-600">
            {loading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Loading…</span>
              </>
            ) : (
              <span>{markerRows.length} destinations · {error ? 'fallback' : 'live'}</span>
            )}
          </div>
        </div>

        {selectedRow && (
          <div className="pointer-events-auto absolute inset-x-3 bottom-[76px] rounded-2xl border border-slate-200 bg-white/96 p-3 text-slate-800 shadow-xl backdrop-blur md:inset-x-auto md:right-3 md:w-[260px] md:bottom-[76px]">
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
              <p>{mapDay === 'tomorrow' ? 'Tomorrow' : 'Today'} sun: <span className="font-semibold text-slate-800">{formatHourValue(selectedRow.activeSunHours)}</span></p>
              <p>Sun score: <span className="font-semibold text-slate-800">{Math.round(selectedRow.markerScore * 100)}%</span></p>
              <p>Travel from {origin.name}: <span className="font-semibold text-slate-800">{formatTravelLabel(selectedRow)}</span></p>
              {selectedBucketWins.length > 0 && (
                <p className="text-[11px] font-semibold text-amber-700">Best in: {selectedBucketWins.join(' · ')}</p>
              )}
              {selectedRow.sbbHref ? (
                <a
                  href={selectedRow.sbbHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-700 hover:text-amber-800"
                >
                  Open SBB
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <p className="text-[11px] text-slate-500">No SBB timetable link for this destination.</p>
              )}
              {onOpenDestinationCard && (
                <button
                  type="button"
                  onClick={() => onOpenDestinationCard({
                    destinationId: selectedRow.id,
                    bucketLabels: selectedBucketWins,
                    originName: origin.name,
                    day: mapDay,
                  })}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-slate-700 hover:text-slate-900"
                >
                  Open destination card
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
