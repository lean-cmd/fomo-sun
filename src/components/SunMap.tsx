'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  WMSTileLayer,
  ZoomControl,
  useMap,
} from 'react-leaflet'
import { ChevronDown, ExternalLink, Loader2, Sun, Zap } from 'lucide-react'
import { destinations } from '@/data/destinations'
import MapLegend from '@/components/MapLegend'

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
  sun_score?: { score?: number }
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
  carMin: number | null
  trainMin: number | null
  bestTravelMin: number | null
  sbbHref?: string
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

function toFinite(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function scoreColor(score: number) {
  if (score > 0.6) return '#22c55e'
  if (score >= 0.3) return '#facc15'
  return '#94a3b8'
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

function fallbackSbbUrl(originName: string, destinationSbbName?: string | null) {
  if (!destinationSbbName) return undefined
  const params = new URLSearchParams({
    von: originName,
    nach: destinationSbbName,
    moment: 'DEPARTURE',
  })
  return `https://www.sbb.ch/en?${params.toString()}`
}

function RecenterOnOrigin({ lat, lon }: { lat: number; lon: number }) {
  const map = useMap()

  useEffect(() => {
    map.setView([lat, lon], map.getZoom(), { animate: true })
  }, [lat, lon, map])

  return null
}

export default function SunMap({ initialOrigin }: { initialOrigin: OriginSeed }) {
  const [origin, setOrigin] = useState<OriginSeed>(initialOrigin)
  const [showSunshine, setShowSunshine] = useState(true)
  const [showRadiation, setShowRadiation] = useState(false)
  const [rowsById, setRowsById] = useState<Record<string, ApiEscapeRow>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    setOrigin(initialOrigin)
  }, [initialOrigin])

  const originChoices = useMemo(() => {
    const byName = new Map<string, OriginSeed>(MAP_ORIGIN_CITIES.map(item => [item.name, item]))
    if (!byName.has(initialOrigin.name)) byName.set(initialOrigin.name, initialOrigin)
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [initialOrigin])

  const fetchScoredDestinations = useCallback(async (signal: AbortSignal) => {
    setLoading(true)
    setError(null)

    const buildUrl = (demo: boolean) => {
      const params = new URLSearchParams({
        lat: String(origin.lat),
        lon: String(origin.lon),
        origin_name: origin.name,
        origin_kind: origin.kind,
        mode: 'both',
        trip_span: 'daytrip',
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
  }, [origin.kind, origin.lat, origin.lon, origin.name])

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
      const score = toFinite(api?.sun_score?.score) ?? 0
      return {
        id: dest.id,
        name: dest.name,
        region: dest.region,
        country: dest.country,
        lat: dest.lat,
        lon: dest.lon,
        sunScore: Math.max(0, Math.min(1, score)),
        carMin,
        trainMin,
        bestTravelMin: Number.isFinite(bestTravelMin) ? bestTravelMin : null,
        sbbHref: api?.links?.sbb || fallbackSbbUrl(origin.name, dest.sbb_name),
      }
    })
  }, [origin.name, rowsById])

  const selectedRow = useMemo(
    () => markerRows.find(row => row.id === selectedId) || null,
    [markerRows, selectedId]
  )

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#102648]">
      <MapContainer
        center={[46.8, 8.2]}
        zoom={8}
        minZoom={6}
        maxZoom={16}
        zoomControl={false}
        className="h-full w-full"
      >
        <ZoomControl position="bottomright" />
        <TileLayer
          url="https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg"
          attribution="&copy; swisstopo"
        />
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
          radius={8}
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

        {markerRows.map(row => (
          <CircleMarker
            key={row.id}
            center={[row.lat, row.lon]}
            radius={5.6}
            pathOptions={{
              color: '#f8fafc',
              fillColor: scoreColor(row.sunScore),
              fillOpacity: 0.92,
              weight: 1.2,
            }}
            eventHandlers={{
              click: () => setSelectedId(row.id),
            }}
          >
            <Popup>
              <div className="min-w-[170px] space-y-1 text-[12px]">
                <p className="text-[13px] font-semibold text-slate-900">{row.name}</p>
                <p className="text-slate-600">{row.region} · {row.country}</p>
                <p className="text-slate-700">Sun score: {Math.round(row.sunScore * 100)}%</p>
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
        <div className="pointer-events-auto absolute left-3 top-3 flex max-w-[78vw] flex-wrap items-center gap-1.5 rounded-xl border border-white/20 bg-slate-900/75 p-1.5 backdrop-blur">
          <button
            type="button"
            onClick={() => setShowSunshine(prev => !prev)}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition ${
              showSunshine ? 'bg-amber-400 text-slate-900' : 'bg-slate-100/10 text-slate-100'
            }`}
          >
            <Sun className="h-3.5 w-3.5" />
            Sunshine
          </button>
          <button
            type="button"
            onClick={() => setShowRadiation(prev => !prev)}
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold transition ${
              showRadiation ? 'bg-amber-300 text-slate-900' : 'bg-slate-100/10 text-slate-100'
            }`}
          >
            <Zap className="h-3.5 w-3.5" />
            Radiation
          </button>
        </div>

        <div className="pointer-events-auto absolute right-3 top-3">
          <div className="relative inline-flex items-center rounded-xl border border-white/20 bg-slate-900/75 pr-2.5 backdrop-blur">
            <select
              value={origin.name}
              onChange={(event) => {
                const selected = originChoices.find(city => city.name === event.target.value)
                if (!selected) return
                setOrigin(selected)
              }}
              className="h-8 rounded-xl bg-transparent pl-2.5 pr-6 text-[11px] font-semibold text-slate-100 focus:outline-none"
            >
              {originChoices.map(city => (
                <option key={city.name} value={city.name} className="text-slate-900">
                  {city.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 h-3.5 w-3.5 text-slate-300" />
          </div>
        </div>

        <MapLegend className="absolute bottom-3 left-3 hidden md:block" />

        <div className="pointer-events-auto absolute bottom-3 right-3 rounded-lg border border-white/20 bg-slate-900/70 px-2.5 py-1.5 text-[11px] text-slate-100 backdrop-blur">
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
          <div className="pointer-events-auto md:hidden absolute inset-x-3 bottom-3 rounded-2xl border border-slate-200/20 bg-[#0e1c34]/92 p-3 text-slate-100 shadow-xl backdrop-blur">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[15px] font-semibold">{selectedRow.name}</p>
                <p className="text-[11px] text-slate-300">{selectedRow.region} · {selectedRow.country}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-md border border-slate-500/50 px-2 py-0.5 text-[11px] text-slate-200"
              >
                Close
              </button>
            </div>
            <div className="mt-2 space-y-1 text-[12px]">
              <p>Sun score: <span className="font-semibold text-amber-300">{Math.round(selectedRow.sunScore * 100)}%</span></p>
              <p>Travel from {origin.name}: {formatTravelLabel(selectedRow)}</p>
              {selectedRow.sbbHref ? (
                <a
                  href={selectedRow.sbbHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-amber-200"
                >
                  Open SBB
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <p className="text-[11px] text-slate-400">No SBB timetable link for this destination.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
