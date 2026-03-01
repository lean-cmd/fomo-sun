'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Circle,
  CircleMarker,
  MapContainer,
  Popup,
  Rectangle,
  TileLayer,
  WMSTileLayer,
  ZoomControl,
  useMap,
} from 'react-leaflet'
import { ExternalLink, Loader2, LocateFixed, Route, Sun, Zap } from 'lucide-react'
import { destinations } from '@/data/destinations'
import MapLegend from '@/components/MapLegend'
import { Button, Select } from '@/components/ui'

type MapDay = 'today' | 'tomorrow'

type OriginSeed = {
  name: string
  lat: number
  lon: number
  kind: 'manual' | 'gps' | 'default'
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

type HeatCell = {
  id: string
  bounds: [[number, number], [number, number]]
  hours: number
}

const MAP_ORIGIN_CITIES: OriginSeed[] = [
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

const HEAT_GRID_LAT_STEP = 0.2
const HEAT_GRID_LON_STEP = 0.22
const DEFAULT_OVERLAY_MAX_HOURS = 10
const TRAVEL_RING_KM_PER_HOUR = 52
const TRAVEL_RING_BUCKETS = [
  { label: '1h', hours: 1 },
  { label: '1.5h', hours: 1.5 },
  { label: '2h', hours: 2 },
  { label: '3h', hours: 3 },
  { label: '6.5h', hours: 6.5 },
] as const
const COLOR_LOW: [number, number, number] = [148, 163, 184]
const COLOR_MED: [number, number, number] = [250, 204, 21]
const COLOR_HIGH: [number, number, number] = [34, 197, 94]

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function toFinite(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function scoreColor(score: number) {
  if (score > 0.6) return '#22c55e'
  if (score >= 0.3) return '#facc15'
  return '#94a3b8'
}

function mixColor(a: [number, number, number], b: [number, number, number], t: number) {
  const clamped = clamp(t, 0, 1)
  const mix = (idx: number) => Math.round(a[idx] + (b[idx] - a[idx]) * clamped)
  return `rgb(${mix(0)} ${mix(1)} ${mix(2)})`
}

function sunHoursColor(hours: number, maxHours: number) {
  const normalized = clamp(hours / Math.max(4, maxHours), 0, 1)
  if (normalized <= 0.5) return mixColor(COLOR_LOW, COLOR_MED, normalized * 2)
  return mixColor(COLOR_MED, COLOR_HIGH, (normalized - 0.5) * 2)
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

function quickDistanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const avgLatRad = ((aLat + bLat) / 2) * (Math.PI / 180)
  const kmPerDegLat = 110.574
  const kmPerDegLon = 111.32 * Math.cos(avgLatRad)
  const dLat = (bLat - aLat) * kmPerDegLat
  const dLon = (bLon - aLon) * kmPerDegLon
  return Math.sqrt(dLat * dLat + dLon * dLon)
}

function buildHeatCells(rows: MapRow[], maxHours: number): HeatCell[] {
  const points = rows
    .filter(row => Number.isFinite(row.activeSunHours))
    .map(row => ({ lat: row.lat, lon: row.lon, value: row.activeSunHours }))

  if (points.length < 5) return []

  const cells: HeatCell[] = []
  const { latMin, latMax, lonMin, lonMax } = SWISS_HEAT_BOUNDS

  for (let lat = latMin; lat < latMax; lat += HEAT_GRID_LAT_STEP) {
    for (let lon = lonMin; lon < lonMax; lon += HEAT_GRID_LON_STEP) {
      const centerLat = lat + HEAT_GRID_LAT_STEP / 2
      const centerLon = lon + HEAT_GRID_LON_STEP / 2

      let weightedValueSum = 0
      let weightSum = 0

      for (const point of points) {
        const distKm = Math.max(4, quickDistanceKm(centerLat, centerLon, point.lat, point.lon))
        if (distKm > 240) continue
        const weight = 1 / (distKm * distKm)
        weightedValueSum += point.value * weight
        weightSum += weight
      }

      if (weightSum <= 0) continue

      const hours = clamp(weightedValueSum / weightSum, 0, maxHours)
      cells.push({
        id: `${lat.toFixed(2)}:${lon.toFixed(2)}`,
        bounds: [[lat, lon], [lat + HEAT_GRID_LAT_STEP, lon + HEAT_GRID_LON_STEP]],
        hours,
      })
    }
  }

  return cells
}

function RecenterOnOrigin({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()

  useEffect(() => {
    map.setView([lat, lon], map.getZoom(), { animate: true })
  }, [lat, lon, map])

  return null
}

export default function SunMap({ initialOrigin, initialDay = 'today' }: { initialOrigin: OriginSeed; initialDay?: MapDay }) {
  const [origin, setOrigin] = useState<OriginSeed>(initialOrigin)
  const [mapDay, setMapDay] = useState<MapDay>(initialDay)
  const [showSunHoursOverlay, setShowSunHoursOverlay] = useState(true)
  const [showTravelRings, setShowTravelRings] = useState(true)
  const [showSunshine, setShowSunshine] = useState(false)
  const [showRadiation, setShowRadiation] = useState(false)
  const [locatingMe, setLocatingMe] = useState(false)
  const [rowsById, setRowsById] = useState<Record<string, ApiEscapeRow>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    setOrigin(initialOrigin)
  }, [initialOrigin])

  useEffect(() => {
    setMapDay(initialDay)
  }, [initialDay])

  const originChoices = useMemo(() => {
    const byName = new Map<string, OriginSeed>(MAP_ORIGIN_CITIES.map(item => [item.name, item]))
    if (!byName.has(initialOrigin.name)) byName.set(initialOrigin.name, initialOrigin)
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [initialOrigin])

  const centerOnMyLocation = useCallback(() => {
    if (!navigator.geolocation || locatingMe) return
    setLocatingMe(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setOrigin({
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
  }, [locatingMe])

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

  const heatCells = useMemo(
    () => buildHeatCells(markerRows, overlayMaxHours),
    [markerRows, overlayMaxHours]
  )

  const selectedRow = useMemo(
    () => markerRows.find(row => row.id === selectedId) || null,
    [markerRows, selectedId]
  )

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
        <ZoomControl position="bottomright" />
        <TileLayer
          url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg"
          attribution="&copy; swisstopo"
        />
        {showSunHoursOverlay && heatCells.map(cell => (
          <Rectangle
            key={cell.id}
            bounds={cell.bounds}
            interactive={false}
            pathOptions={{
              color: sunHoursColor(cell.hours, overlayMaxHours),
              fillColor: sunHoursColor(cell.hours, overlayMaxHours),
              fillOpacity: 0.28,
              weight: 0,
            }}
          />
        ))}
        {showSunshine && (
          <WMSTileLayer
            url="https://wms.geo.admin.ch/"
            layers="ch.meteoschweiz.messwerte-sonnenscheindauer-10min"
            format="image/png"
            transparent
            opacity={0.58}
          />
        )}
        {showRadiation && (
          <WMSTileLayer
            url="https://wms.geo.admin.ch/"
            layers="ch.meteoschweiz.messwerte-globalstrahlung-10min"
            format="image/png"
            transparent
            opacity={0.46}
          />
        )}
        <RecenterOnOrigin lat={origin.lat} lon={origin.lon} />

        <CircleMarker
          center={[origin.lat, origin.lon]}
          radius={8.2}
          pathOptions={{
            color: '#1d4ed8',
            fillColor: '#3b82f6',
            fillOpacity: 0.95,
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

        {showTravelRings && TRAVEL_RING_BUCKETS.map((ring) => (
          <Circle
            key={`ring-${ring.label}`}
            center={[origin.lat, origin.lon]}
            radius={ring.hours * TRAVEL_RING_KM_PER_HOUR * 1000}
            interactive={false}
            pathOptions={{
              color: '#64748b',
              weight: ring.hours >= 3 ? 1.2 : 1,
              opacity: 0.25,
              dashArray: '6 8',
              fillOpacity: 0,
            }}
          />
        ))}

        {markerRows.map(row => (
          <CircleMarker
            key={row.id}
            center={[row.lat, row.lon]}
            radius={5.8}
            pathOptions={{
              color: '#f8fafc',
              fillColor: scoreColor(row.markerScore),
              fillOpacity: 0.95,
              weight: 1.1,
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
          <div className="inline-flex items-center gap-1 text-[10.5px]">
            <button
              type="button"
              onClick={() => {
                setMapDay('today')
                setShowSunHoursOverlay(true)
              }}
              className={`px-1 py-0.5 transition ${mapDay === 'today' ? 'text-slate-800 font-semibold underline decoration-amber-300 decoration-2 underline-offset-4' : 'text-slate-500 font-medium hover:text-slate-700'}`}
            >
              Today
            </button>
            <span className="text-slate-300">/</span>
            <button
              type="button"
              onClick={() => {
                setMapDay('tomorrow')
                setShowSunHoursOverlay(true)
              }}
              className={`px-1 py-0.5 transition ${mapDay === 'tomorrow' ? 'text-slate-800 font-semibold underline decoration-amber-300 decoration-2 underline-offset-4' : 'text-slate-500 font-medium hover:text-slate-700'}`}
            >
              Tomorrow
            </button>
          </div>
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
              onClick={() => setShowSunshine(prev => !prev)}
              size="sm"
              variant={showSunshine ? 'primary' : 'neutral'}
            >
              <Sun className="h-3 w-3" />
              Sun
            </Button>
            <Button
              onClick={() => setShowRadiation(prev => !prev)}
              size="sm"
              variant={showRadiation ? 'primary' : 'neutral'}
            >
              <Zap className="h-3 w-3" />
              Radiation
            </Button>
            <Button
              onClick={() => setShowTravelRings(prev => !prev)}
              size="sm"
              variant={showTravelRings ? 'primary' : 'neutral'}
              title="Travel bucket rings"
            >
              <Route className="h-3 w-3" />
              Rings
            </Button>
          </div>
        </div>

        <div className="pointer-events-auto absolute right-3 top-3 flex flex-col items-end gap-1.5">
          <Select
            value={origin.name}
            onChange={(event) => {
              const selected = originChoices.find(city => city.name === event.target.value)
              if (!selected) return
              setOrigin(selected)
            }}
            shellClassName="min-w-0 max-w-[120px] rounded-lg border border-slate-200 bg-white/92 shadow-[0_8px_18px_rgba(15,23,42,0.12)] backdrop-blur text-slate-500"
            className="h-7 pl-1 text-right"
            aria-label="Select origin city"
          >
            {originChoices.map(city => (
              <option key={city.name} value={city.name} className="text-slate-900">
                {city.name}
              </option>
            ))}
          </Select>
          <Button
            onClick={centerOnMyLocation}
            disabled={locatingMe}
            size="sm"
            variant="neutral"
            className="bg-white/92 shadow-[0_8px_18px_rgba(15,23,42,0.12)] backdrop-blur disabled:opacity-60"
          >
            <LocateFixed className="h-3 w-3" />
            {locatingMe ? 'Locating…' : 'Center me'}
          </Button>
        </div>

        <MapLegend
          className="absolute bottom-3 left-3 max-w-[250px]"
          day={mapDay}
          overlayVisible={showSunHoursOverlay}
          minHours={overlayMinHours}
          maxHours={overlayMaxHours}
          showTravelRings={showTravelRings}
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
