'use client'

import Link from 'next/link'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Download, RefreshCw } from 'lucide-react'
import { SunnyEscapesResponse, SunTimeline } from '@/lib/types'
import { formatSunHours } from '@/lib/format'

type SortMode = 'score' | 'sun' | 'net' | 'name' | 'country' | 'quality' | 'altitude' | 'temp' | 'car' | 'train' | 'model' | 'tier'
type PageSizeMode = '50' | '100' | '200' | 'all'
type ForecastDay = 'today' | 'tomorrow'
type DestinationQuality = 'verified' | 'curated' | 'generated'
type AdminTypeChip = 'mountain' | 'town' | 'ski' | 'thermal' | 'lake'
type WeatherSourceMode = 'meteoswiss' | 'openmeteo' | 'meteoswiss_api'
type AdminTravelMode = 'both' | 'car' | 'train'

const ADMIN_ORIGIN_CITIES = [
  { name: 'Basel', lat: 47.5596, lon: 7.5886 },
  { name: 'Zurich', lat: 47.3769, lon: 8.5417 },
  { name: 'Bern', lat: 46.948, lon: 7.4474 },
  { name: 'Luzern', lat: 47.0502, lon: 8.3093 },
  { name: 'Olten', lat: 47.3505, lon: 7.9032 },
] as const

const ADMIN_TYPE_CHIPS: { id: AdminTypeChip; label: string }[] = [
  { id: 'mountain', label: '⛰️ Mountain' },
  { id: 'town', label: '🏘️ Town' },
  { id: 'ski', label: '🏔️ Ski' },
  { id: 'thermal', label: '♨️ Thermal' },
  { id: 'lake', label: '🌊 Lake' },
]

type Escape = SunnyEscapesResponse['escapes'][number]

type RequestLogRow = {
  id: string
  at: string
  path: string
  query: string
  duration_ms: number
  status: number
  live_source: 'open-meteo' | 'mock'
  live_path: string
  fallback?: string
  cache_hit: boolean
}

function timelineClass(condition: string) {
  if (condition === 'sun') return 'tl-sun'
  if (condition === 'partial') return 'tl-partial'
  if (condition === 'night') return 'tl-night'
  return 'tl-cloud'
}

function MiniTimeline({ timeline, day }: { timeline: SunTimeline; day: ForecastDay }) {
  const segments = day === 'today' ? (timeline?.today || []) : (timeline?.tomorrow || [])
  const total = Math.max(1, segments.reduce((sum, seg) => sum + seg.pct, 0))
  return (
    <div className="fomo-timeline h-5 min-w-[180px]">
      {segments.map((seg, idx) => (
        <div key={idx} className={`tl-seg ${timelineClass(seg.condition)}`} style={{ width: `${(seg.pct / total) * 100}%` }} />
      ))}
    </div>
  )
}

function hourCellClass(sunMin: number) {
  if (sunMin >= 45) return 'bg-amber-400'
  if (sunMin >= 15) return 'bg-amber-200'
  return 'bg-slate-300'
}

function scoreColor(score: number) {
  if (score >= 0.85) return 'text-red-500'
  if (score >= 0.7) return 'text-orange-500'
  if (score >= 0.55) return 'text-amber-600'
  return 'text-slate-500'
}

function tierPillClass(tier?: string) {
  if (tier === 'strict') return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  if (tier === 'relaxed') return 'bg-yellow-100 text-yellow-800 border-yellow-200'
  if (tier === 'any_sun') return 'bg-amber-100 text-amber-800 border-amber-200'
  return 'bg-rose-100 text-rose-700 border-rose-200'
}

function formatTravelHm(durationMin?: number | null) {
  if (!Number.isFinite(durationMin ?? NaN)) return '-'
  const rounded = Math.max(0, Math.round(durationMin as number))
  const h = Math.floor(rounded / 60)
  const m = rounded % 60
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}

function dayStringInZurich(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

export default function AdminDiagnosticsPage() {
  const [rows, setRows] = useState<Escape[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('score')
  const [sortDesc, setSortDesc] = useState(true)
  const [pageSizeMode, setPageSizeMode] = useState<PageSizeMode>('50')
  const [forecastDay, setForecastDay] = useState<ForecastDay>('today')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [selectedCompare, setSelectedCompare] = useState<string[]>([])
  const [activeCountries, setActiveCountries] = useState<Record<string, boolean>>({ CH: true, DE: true, FR: true, IT: true })
  const [activeTypeChips, setActiveTypeChips] = useState<AdminTypeChip[]>([])
  const [activeQualities, setActiveQualities] = useState<Record<DestinationQuality, boolean>>({
    verified: true,
    curated: true,
    generated: true,
  })
  const [page, setPage] = useState(1)
  const [weatherSource, setWeatherSource] = useState<WeatherSourceMode>('openmeteo')
  const [adminOrigin, setAdminOrigin] = useState<string>('Basel')
  const [adminMode, setAdminMode] = useState<AdminTravelMode>('both')
  const weatherSourceInitRef = useRef(false)
  const [meta, setMeta] = useState({
    liveSource: '',
    debugPath: '',
    cache: '',
    fallback: '',
    resultTier: '',
    requestMs: '',
    responseAt: '',
    weatherFreshness: '',
    weatherSource: '',
    modelPolicy: '',
    candidateCount: '',
    livePoolCount: '',
    headers: {} as Record<string, string>,
  })
  const [originMeta, setOriginMeta] = useState<{ name: string; lat: number; lon: number } | null>(null)
  const [originSnapshot, setOriginSnapshot] = useState<{
    name: string
    sunTodayMin: number
    sunTomorrowMin: number
    score: number
    tempC: number
    summary: string
    timeline: SunTimeline
  } | null>(null)
  const [logs, setLogs] = useState<RequestLogRow[]>([])
  const [bucketCounts, setBucketCounts] = useState<NonNullable<SunnyEscapesResponse['_meta']['bucket_counts']>>([])

  const handleSortChange = (next: SortMode) => {
    if (sortMode === next) {
      setSortDesc(prev => !prev)
      return
    }
    setSortMode(next)
    setSortDesc(!(next === 'name' || next === 'country' || next === 'quality' || next === 'car' || next === 'train'))
  }
  const sortArrow = (mode: SortMode) => (sortMode === mode ? (sortDesc ? '↓' : '↑') : '')

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const selectedOrigin = ADMIN_ORIGIN_CITIES.find(city => city.name === adminOrigin) || ADMIN_ORIGIN_CITIES[0]
      const p = new URLSearchParams({
        lat: String(selectedOrigin.lat),
        lon: String(selectedOrigin.lon),
        origin_name: selectedOrigin.name,
        origin_kind: 'manual',
        max_travel_h: '6.5',
        travel_min_h: '0',
        travel_max_h: '6.5',
        mode: adminMode,
        ga: 'false',
        limit: '5000',
        demo: 'false',
        admin: 'true',
        admin_all: 'true',
        trip_span: forecastDay === 'tomorrow' ? 'plus1day' : 'daytrip',
        weather_source: weatherSource,
      })
      const res = await fetch(`/api/v1/sunny-escapes?${p.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`API ${res.status}`)
      const payload: SunnyEscapesResponse = await res.json()

      const headersObj: Record<string, string> = {}
      ;[
        'x-fomo-live-source',
        'x-fomo-debug-live-path',
        'x-fomo-response-cache',
        'x-fomo-live-fallback',
        'x-fomo-candidate-count',
        'x-fomo-live-pool-count',
        'x-fomo-result-tier',
        'x-fomo-weather-source',
        'x-fomo-weather-model-policy',
        'x-fomo-request-ms',
      ].forEach(h => {
        const val = res.headers.get(h)
        if (val) headersObj[h] = val
      })

      setRows(payload.escapes || [])
      setBucketCounts(payload._meta?.bucket_counts || [])
      setOriginMeta(payload._meta?.origin || null)
      const tempMatch = payload.origin_conditions.description.match(/(-?\d+)\s*°c/i)
      setOriginSnapshot({
        name: payload._meta?.origin?.name || 'Origin',
        sunTodayMin: payload.origin_conditions.sunshine_min,
        sunTomorrowMin: Math.max(0, Math.round((payload.tomorrow_sun_hours || 0) * 60)),
        score: payload.origin_conditions.sun_score,
        tempC: tempMatch ? Number(tempMatch[1]) : 0,
        summary: payload.origin_conditions.description,
        timeline: payload.origin_timeline,
      })
      setMeta({
        liveSource: res.headers.get('x-fomo-live-source') || '',
        debugPath: res.headers.get('x-fomo-debug-live-path') || '',
        cache: res.headers.get('x-fomo-response-cache') || '',
        fallback: res.headers.get('x-fomo-live-fallback') || '',
        resultTier: res.headers.get('x-fomo-result-tier') || payload._meta?.result_tier || '',
        requestMs: res.headers.get('x-fomo-request-ms') || '',
        responseAt: payload._meta?.generated_at || '',
        weatherFreshness: payload._meta?.weather_data_freshness || '',
        weatherSource: res.headers.get('x-fomo-weather-source') || '',
        modelPolicy: res.headers.get('x-fomo-weather-model-policy') || '',
        candidateCount: res.headers.get('x-fomo-candidate-count') || '',
        livePoolCount: res.headers.get('x-fomo-live-pool-count') || '',
        headers: headersObj,
      })
    } catch (err) {
      setError(String((err as Error)?.message || err))
    } finally {
      setLoading(false)
    }
  }

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/v1/diagnostics/logs?limit=10', { cache: 'no-store' })
      if (!res.ok) return
      const payload = await res.json()
      setLogs(Array.isArray(payload?.logs) ? payload.logs : [])
    } catch {
      // ignore diagnostics panel failures
    }
  }

  useEffect(() => {
    fetchData()
    fetchLogs()
    const timer = window.setInterval(fetchLogs, 6000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!weatherSourceInitRef.current) {
      weatherSourceInitRef.current = true
      return
    }
    fetchData()
  }, [weatherSource, forecastDay, adminOrigin, adminMode])

  const byCountryCount = useMemo(() => {
    const out: Record<string, number> = { CH: 0, DE: 0, FR: 0, IT: 0 }
    for (const r of rows) out[r.destination.country] = (out[r.destination.country] || 0) + 1
    return out
  }, [rows])

  const byTypeCount = useMemo(() => {
    const out: Record<AdminTypeChip, number> = { mountain: 0, town: 0, ski: 0, thermal: 0, lake: 0 }
    for (const r of rows) {
      const typeSet = new Set(r.destination.types || [])
      if (typeSet.has('mountain')) out.mountain += 1
      if (typeSet.has('town')) out.town += 1
      if (typeSet.has('thermal')) out.thermal += 1
      if (typeSet.has('lake')) out.lake += 1
      if (typeSet.has('mountain') && r.destination.altitude_m >= 1200) out.ski += 1
    }
    return out
  }, [rows])

  const byQualityCount = useMemo(() => {
    const out: Record<DestinationQuality, number> = { verified: 0, curated: 0, generated: 0 }
    for (const r of rows) {
      const quality = (r.destination.quality ?? 'generated') as DestinationQuality
      out[quality] = (out[quality] || 0) + 1
    }
    return out
  }, [rows])

  const filteredSorted = useMemo(() => {
    const daySunMin = (r: Escape) => (
      forecastDay === 'today'
        ? r.sun_score.sunshine_forecast_min
        : Math.max(0, Math.round((r.tomorrow_sun_hours || 0) * 60))
    )
    const dayNetSunMin = (r: Escape) => {
      if (Number.isFinite(r.net_sun_min)) return Math.max(0, r.net_sun_min)
      const bestTravelMin = Math.min(
        r.travel?.car?.duration_min ?? Number.POSITIVE_INFINITY,
        r.travel?.train?.duration_min ?? Number.POSITIVE_INFINITY
      )
      if (!Number.isFinite(bestTravelMin)) return 0
      return Math.max(0, daySunMin(r) - Math.round(bestTravelMin))
    }
    const selectedQualities = Object.entries(activeQualities)
      .filter(([, enabled]) => enabled)
      .map(([quality]) => quality as DestinationQuality)

    const filtered = rows
      .filter(r => activeCountries[r.destination.country] !== false)
      .filter(r => selectedQualities.includes((r.destination.quality ?? 'generated') as DestinationQuality))
      .filter(r => {
        if (activeTypeChips.length === 0) return true
        const typeSet = new Set(r.destination.types || [])
        return activeTypeChips.some((chip) => {
          if (chip === 'ski') return typeSet.has('mountain') && r.destination.altitude_m >= 1200
          return typeSet.has(chip)
        })
      })
      .filter(r => {
        if (!search.trim()) return true
        const q = search.trim().toLowerCase()
        return (
          r.destination.name.toLowerCase().includes(q)
          || r.destination.region.toLowerCase().includes(q)
          || r.destination.country.toLowerCase().includes(q)
        )
      })

    const rowSort = (a: Escape, b: Escape) => {
      const aCar = a.travel?.car?.duration_min ?? Number.POSITIVE_INFINITY
      const bCar = b.travel?.car?.duration_min ?? Number.POSITIVE_INFINITY
      const aTrain = a.travel?.train?.duration_min ?? Number.POSITIVE_INFINITY
      const bTrain = b.travel?.train?.duration_min ?? Number.POSITIVE_INFINITY
      if (sortMode === 'sun') return daySunMin(a) - daySunMin(b)
      if (sortMode === 'net') return dayNetSunMin(a) - dayNetSunMin(b)
      if (sortMode === 'name') return a.destination.name.localeCompare(b.destination.name, 'de-CH')
      if (sortMode === 'country') return a.destination.country.localeCompare(b.destination.country, 'de-CH')
      if (sortMode === 'quality') return String(a.destination.quality ?? 'generated').localeCompare(String(b.destination.quality ?? 'generated'), 'de-CH')
      if (sortMode === 'altitude') return a.destination.altitude_m - b.destination.altitude_m
      if (sortMode === 'temp') return (a.weather_now?.temp_c ?? 0) - (b.weather_now?.temp_c ?? 0)
      if (sortMode === 'car') return aCar - bCar
      if (sortMode === 'train') return aTrain - bTrain
      if (sortMode === 'model') return String(a.weather_model ?? '').localeCompare(String(b.weather_model ?? ''), 'de-CH')
      if (sortMode === 'tier') return String(a.tier_eligibility ?? '').localeCompare(String(b.tier_eligibility ?? ''), 'de-CH')
      return a.sun_score.score - b.sun_score.score
    }

    filtered.sort((a, b) => {
      const cmp = rowSort(a, b)
      return sortDesc ? -cmp : cmp
    })

    return filtered
  }, [rows, activeCountries, activeQualities, activeTypeChips, sortMode, sortDesc, forecastDay, search])

  const pageSize = pageSizeMode === 'all' ? filteredSorted.length : Number(pageSizeMode)
  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / Math.max(1, pageSize)))
  const pagedRows = useMemo(() => {
    if (pageSizeMode === 'all') return filteredSorted
    const start = (page - 1) * pageSize
    return filteredSorted.slice(start, start + pageSize)
  }, [filteredSorted, page, pageSize, pageSizeMode])

  useEffect(() => {
    setPage(1)
  }, [search, forecastDay, sortMode, sortDesc, activeCountries, activeQualities, activeTypeChips, pageSizeMode])

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const stats = useMemo(() => {
    const list = filteredSorted
    const total = list.length
    const sunny = list.filter(r => r.sun_score.score > 0.7).length
    const avgTemp = total ? Math.round(list.reduce((s, r) => s + (r.weather_now?.temp_c ?? 0), 0) / total) : 0
    return { total, sunny, avgTemp }
  }, [filteredSorted])

  const bucketSummary = useMemo(() => {
    return bucketCounts.map((bucket) => {
      const label = bucket.max_h >= 6.5
        ? `${bucket.min_h}-${bucket.max_h}h`
        : `${bucket.min_h}-${bucket.max_h}h`
      return {
        ...bucket,
        label,
        strict: bucket.strict_count ?? bucket.count,
        atLeast: bucket.at_least_count ?? bucket.count,
        raw: bucket.raw_count ?? bucket.count,
        destinationCount: bucket.destination_count ?? bucket.raw_count ?? bucket.count,
        resultTier: bucket.result_tier ?? 'best_available',
      }
    })
  }, [bucketCounts])

  const healthState = useMemo(() => {
    if (!meta.liveSource) return { ok: false, label: 'Unknown' }
    if (meta.liveSource === 'open-meteo' && !meta.fallback) return { ok: true, label: 'Open-Meteo live' }
    return { ok: false, label: meta.fallback ? `Fallback (${meta.fallback})` : meta.liveSource }
  }, [meta])

  const compareRows = useMemo(
    () => filteredSorted.filter(r => selectedCompare.includes(r.destination.id)).slice(0, 3),
    [filteredSorted, selectedCompare]
  )

  const toggleCountry = (country: string) => setActiveCountries(prev => ({ ...prev, [country]: !prev[country] }))
  const toggleTypeChip = (chip: AdminTypeChip) => {
    setActiveTypeChips(prev => prev.includes(chip) ? prev.filter(x => x !== chip) : [...prev, chip])
  }
  const toggleQuality = (quality: DestinationQuality) => setActiveQualities(prev => ({ ...prev, [quality]: !prev[quality] }))

  const toggleCompare = (id: string) => {
    setSelectedCompare(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      if (prev.length >= 3) return [...prev.slice(1), id]
      return [...prev, id]
    })
  }

  const exportCsv = () => {
    const daySunMin = (r: Escape) => (
      forecastDay === 'today'
        ? r.sun_score.sunshine_forecast_min
        : Math.max(0, Math.round((r.tomorrow_sun_hours || 0) * 60))
    )
    const dayNetSunMin = (r: Escape) => {
      if (Number.isFinite(r.net_sun_min)) return Math.max(0, r.net_sun_min)
      const bestTravelMin = Math.min(
        r.travel?.car?.duration_min ?? Number.POSITIVE_INFINITY,
        r.travel?.train?.duration_min ?? Number.POSITIVE_INFINITY
      )
      if (!Number.isFinite(bestTravelMin)) return 0
      return Math.max(0, daySunMin(r) - Math.round(bestTravelMin))
    }

    const header = ['name', 'country', 'quality', 'lat', 'lon', 'altitude_m', 'fomo_score_pct', 'sunshine_min', 'net_sun_min', 'travel_car_min', 'travel_train_min', 'temp_c', 'condition']
    const lines = filteredSorted.map(r => [
      r.destination.name,
      r.destination.country,
      r.destination.quality ?? 'generated',
      r.destination.lat,
      r.destination.lon,
      r.destination.altitude_m,
      Math.round(r.sun_score.score * 100),
      daySunMin(r),
      dayNetSunMin(r),
      Number.isFinite(r.travel?.car?.duration_min) ? Math.round(r.travel?.car?.duration_min as number) : '',
      Number.isFinite(r.travel?.train?.duration_min) ? Math.round(r.travel?.train?.duration_min as number) : '',
      Math.round(r.weather_now?.temp_c ?? 0),
      r.weather_now?.summary || r.conditions,
    ])

    const csv = [header, ...lines]
      .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `fomo-diagnostics-${forecastDay}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 fomo-grid-bg">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-semibold text-slate-900" style={{ fontFamily: 'Sora, sans-serif' }}>
              Forecast Diagnostics
            </h1>
            <p className="text-sm text-slate-500 mt-1">Founder view for live ranking quality and API reliability.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { fetchData(); fetchLogs() }}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </button>
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline">Back to app</Link>
          </div>
        </div>

        <p className="text-xs text-slate-600 mb-3" style={{ fontFamily: 'DM Mono, monospace' }}>
          API rows: {rows.length} · visible after filters: {filteredSorted.length}
          {meta.resultTier ? ` · tier ${meta.resultTier}` : ''}
          {meta.candidateCount ? ` · candidates ${meta.candidateCount}` : ''}
          {meta.livePoolCount ? ` · live pool ${meta.livePoolCount}` : ''}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Total</p>
            <p className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'DM Mono, monospace' }}>{stats.total}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Sunny &gt;70</p>
            <p className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'DM Mono, monospace' }}>{stats.sunny}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Avg temp</p>
            <p className="text-lg font-semibold text-slate-900" style={{ fontFamily: 'DM Mono, monospace' }}>{stats.avgTemp}°C</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500">Data freshness</p>
            <p className="text-[11px] font-medium text-slate-700 truncate" title={meta.weatherFreshness || meta.responseAt}>
              {meta.weatherFreshness || meta.responseAt || '-'}
            </p>
          </div>
        </div>

        {bucketSummary.length > 0 && (
          <section className="rounded-xl border border-slate-200 bg-white p-3 mb-3">
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold mb-2">Bucket coverage (API)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {bucketSummary.map((bucket) => (
                <div key={bucket.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                  <p className="text-[11px] font-semibold text-slate-800" style={{ fontFamily: 'DM Mono, monospace' }}>{bucket.label}</p>
                  <p className="text-base font-semibold text-slate-900 leading-tight" style={{ fontFamily: 'DM Mono, monospace' }}>
                    {bucket.count}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    in range {bucket.destinationCount}
                  </p>
                  <span className={`mt-1 inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${tierPillClass(bucket.resultTier)}`}>
                    {bucket.resultTier}
                  </span>
                  <p className="text-[10px] text-slate-500">
                    strict {bucket.strict} · ≥origin {bucket.atLeast} · raw {bucket.raw}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto_auto_auto_auto] gap-3 rounded-xl border border-slate-200 bg-white p-3 mb-3">
          <div className="flex flex-wrap gap-2 items-center">
            {(['CH', 'DE', 'FR', 'IT'] as const).map(c => (
              <button
                key={c}
                onClick={() => toggleCountry(c)}
                disabled={!byCountryCount[c]}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${activeCountries[c] ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-500 border-slate-200'} ${!byCountryCount[c] ? 'opacity-40 cursor-not-allowed' : ''}`}
              >
                {c} ({byCountryCount[c] || 0})
              </button>
            ))}

            <div className="ml-1 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1">
              <span className={`inline-block w-2 h-2 rounded-full ${healthState.ok ? 'bg-emerald-500' : 'bg-amber-500'}`} />
              <span className="text-xs text-slate-600 font-medium">{healthState.label}</span>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            Sort
            <select value={sortMode} onChange={e => handleSortChange(e.target.value as SortMode)} className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white">
              <option value="score">FOMO score</option>
              <option value="sun">Sunshine</option>
              <option value="net">Net sun</option>
              <option value="name">Name</option>
              <option value="country">Country</option>
              <option value="quality">Quality</option>
              <option value="altitude">Altitude</option>
              <option value="temp">Temperature</option>
              <option value="car">Car travel</option>
              <option value="train">Train travel</option>
              <option value="model">Model</option>
              <option value="tier">Tier eligibility</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            Origin
            <select value={adminOrigin} onChange={e => setAdminOrigin(e.target.value)} className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white">
              {ADMIN_ORIGIN_CITIES.map(city => (
                <option key={city.name} value={city.name}>{city.name}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            Mode
            <select value={adminMode} onChange={e => setAdminMode(e.target.value as AdminTravelMode)} className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white">
              <option value="both">Car + Train</option>
              <option value="car">Car</option>
              <option value="train">Train</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            Page size
            <select value={pageSizeMode} onChange={e => setPageSizeMode(e.target.value as PageSizeMode)} className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white">
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="all">All rows</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            Weather source
            <select value={weatherSource} onChange={e => setWeatherSource(e.target.value as WeatherSourceMode)} className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white">
              <option value="openmeteo">Open-Meteo only</option>
              <option value="meteoswiss">MeteoSwiss model for CH</option>
              <option value="meteoswiss_api">MeteoSwiss OGD origin + model forecast</option>
            </select>
          </label>

          <button onClick={exportCsv} className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <Download className="w-3.5 h-3.5" /> Export CSV
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3 mb-3">
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search destination or region"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
          />

          <div className="inline-flex p-1 rounded-full border border-slate-200 bg-white">
            <button onClick={() => setForecastDay('today')} className={`px-3 py-1 rounded-full text-xs font-semibold ${forecastDay === 'today' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Today</button>
            <button onClick={() => setForecastDay('tomorrow')} className={`px-3 py-1 rounded-full text-xs font-semibold ${forecastDay === 'tomorrow' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}>Tomorrow</button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3 mb-3 space-y-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold mb-2">Quality filters</p>
            <div className="flex flex-wrap gap-2">
              {(['verified', 'curated', 'generated'] as DestinationQuality[]).map(quality => (
                <button
                  key={quality}
                  onClick={() => toggleQuality(quality)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${activeQualities[quality] ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
                >
                  {quality} ({byQualityCount[quality] || 0})
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.12em] text-slate-500 font-semibold mb-2">Type filters</p>
            <div className="flex flex-wrap gap-2">
              {ADMIN_TYPE_CHIPS.map(type => (
                <button
                  key={type.id}
                  onClick={() => toggleTypeChip(type.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${activeTypeChips.includes(type.id) ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200'}`}
                >
                  {type.label} ({byTypeCount[type.id] || 0})
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-3 mb-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs text-slate-500 mb-2">
              Origin: <strong>{originMeta?.name || 'Basel'}</strong> ({(originMeta?.lat ?? 47.5596).toFixed(2)}, {(originMeta?.lon ?? 7.5886).toFixed(2)})
              {meta.requestMs && <span> · request {meta.requestMs}ms</span>}
              {meta.weatherSource && <span> · source {meta.weatherSource}</span>}
              {meta.modelPolicy && <span> · model {meta.modelPolicy}</span>}
              {meta.resultTier && <span> · tier {meta.resultTier}</span>}
            </p>
            <div className={`mb-2 inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.liveSource === 'mock' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
              {meta.liveSource === 'mock' ? 'DEMO MODE' : 'LIVE DATA'}
            </div>
            <details>
              <summary className="text-xs font-semibold text-slate-700 cursor-pointer">Response headers</summary>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-600">
                {Object.entries(meta.headers).map(([k, v]) => (
                  <div key={k} className="rounded border border-slate-100 px-2 py-1">
                    <span className="font-semibold text-slate-700">{k}</span>: {v}
                  </div>
                ))}
              </div>
            </details>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500 font-semibold mb-2">Recent API logs</p>
            <div className="space-y-2 max-h-[220px] overflow-auto pr-1">
              {logs.length === 0 ? (
                <p className="text-xs text-slate-500">No request logs yet.</p>
              ) : logs.map(log => (
                <div key={log.id} className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2 text-[11px] text-slate-600">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-slate-700">{new Date(log.at).toLocaleTimeString('de-CH')}</span>
                    <span className="inline-flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      {log.duration_ms}ms
                    </span>
                  </div>
                  <p className="mt-0.5">{log.live_source} · {log.live_path}{log.cache_hit ? ' · cache hit' : ''}</p>
                  {log.fallback && <p className="text-amber-700">fallback: {log.fallback}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {compareRows.length >= 2 && (
          <section className="rounded-xl border border-slate-200 bg-white p-3 mb-3">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500 font-semibold mb-2">Comparison mode</p>
            <div className="space-y-2">
              {compareRows.map(row => (
                <div key={row.destination.id} className="grid grid-cols-[160px_1fr] items-center gap-2">
                  <div className="text-xs text-slate-700 font-medium truncate">{row.destination.name}</div>
                  <MiniTimeline timeline={row.sun_timeline} day={forecastDay} />
                </div>
              ))}
            </div>
          </section>
        )}

        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

        <div className="rounded-xl border border-slate-200 bg-white overflow-auto">
          <table className="w-full min-w-[1320px] text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Compare</th>
                <th className="text-left px-3 py-2 font-semibold">
                  <button type="button" onClick={() => handleSortChange('name')} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Name {sortArrow('name')}
                  </button>
                </th>
                <th className="text-left px-3 py-2 font-semibold">
                  <button type="button" onClick={() => handleSortChange('country')} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Country {sortArrow('country')}
                  </button>
                </th>
                <th className="text-left px-3 py-2 font-semibold">
                  <button type="button" onClick={() => handleSortChange('quality')} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Quality {sortArrow('quality')}
                  </button>
                </th>
                <th className="text-right px-3 py-2 font-semibold">
                  <button type="button" onClick={() => handleSortChange('altitude')} className="w-full inline-flex items-center justify-end gap-1 hover:text-slate-900">
                    Altitude {sortArrow('altitude')}
                  </button>
                </th>
                <th className="text-right px-3 py-2 font-semibold">
                  <button type="button" onClick={() => handleSortChange('sun')} className="w-full inline-flex items-center justify-end gap-1 hover:text-slate-900">
                    Sun {sortArrow('sun')}
                  </button>
                </th>
                <th className="text-right px-3 py-2 font-semibold">
                  <button type="button" onClick={() => handleSortChange('net')} className="w-full inline-flex items-center justify-end gap-1 hover:text-slate-900">
                    Net sun {sortArrow('net')}
                  </button>
                </th>
                <th className="text-right px-3 py-2 font-semibold">
                  <button type="button" onClick={() => handleSortChange('car')} className="w-full inline-flex items-center justify-end gap-1 hover:text-slate-900">
                    Car (from origin) {sortArrow('car')}
                  </button>
                </th>
                <th className="text-right px-3 py-2 font-semibold">
                  <button type="button" onClick={() => handleSortChange('train')} className="w-full inline-flex items-center justify-end gap-1 hover:text-slate-900">
                    Train (from origin) {sortArrow('train')}
                  </button>
                </th>
                <th className="text-right px-3 py-2 font-semibold">
                  <button type="button" onClick={() => handleSortChange('score')} className="w-full inline-flex items-center justify-end gap-1 hover:text-slate-900">
                    FOMO {sortArrow('score')}
                  </button>
                </th>
                <th className="text-right px-3 py-2 font-semibold">
                  <button type="button" onClick={() => handleSortChange('temp')} className="w-full inline-flex items-center justify-end gap-1 hover:text-slate-900">
                    Temp {sortArrow('temp')}
                  </button>
                </th>
                <th className="text-left px-3 py-2 font-semibold">
                  <button type="button" onClick={() => handleSortChange('model')} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Model {sortArrow('model')}
                  </button>
                </th>
                <th className="text-left px-3 py-2 font-semibold">
                  <button type="button" onClick={() => handleSortChange('tier')} className="inline-flex items-center gap-1 hover:text-slate-900">
                    Tier {sortArrow('tier')}
                  </button>
                </th>
                <th className="text-left px-3 py-2 font-semibold">Conditions</th>
                <th className="text-left px-3 py-2 font-semibold">Timeline</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={15} className="px-3 py-6 text-center text-slate-500">Loading live diagnostics...</td>
                </tr>
              ) : filteredSorted.length === 0 ? (
                <tr>
                  <td colSpan={15} className="px-3 py-6 text-center text-slate-500">No destinations for current filters.</td>
                </tr>
              ) : (
                <>
                  {originSnapshot && (
                    <tr className="border-t border-amber-200 bg-amber-50/70">
                      <td className="px-3 py-2.5 text-slate-500">-</td>
                      <td className="px-3 py-2.5 font-semibold text-slate-900">{originSnapshot.name} (origin)</td>
                      <td className="px-3 py-2.5 text-slate-600">CH</td>
                      <td className="px-3 py-2.5 text-slate-600">origin</td>
                      <td className="px-3 py-2.5 text-right text-slate-500">-</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{formatSunHours(forecastDay === 'today' ? originSnapshot.sunTodayMin : originSnapshot.sunTomorrowMin)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{formatSunHours(forecastDay === 'today' ? originSnapshot.sunTodayMin : originSnapshot.sunTomorrowMin)}</td>
                      <td className="px-3 py-2.5 text-right text-slate-500">-</td>
                      <td className="px-3 py-2.5 text-right text-slate-500">-</td>
                      <td className={`px-3 py-2.5 text-right font-semibold ${scoreColor(originSnapshot.score)}`}>{Math.round(originSnapshot.score * 100)}%</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{originSnapshot.tempC}°C</td>
                      <td className="px-3 py-2.5 text-slate-500">origin</td>
                      <td className="px-3 py-2.5 text-slate-500">-</td>
                      <td className="px-3 py-2.5 text-slate-600 max-w-[260px] truncate" title={originSnapshot.summary}>{originSnapshot.summary}</td>
                      <td className="px-3 py-2.5"><MiniTimeline timeline={originSnapshot.timeline} day={forecastDay} /></td>
                    </tr>
                  )}
                  {pagedRows.map((row) => {
                  const isExpanded = expandedId === row.destination.id
                  const daySunMin = forecastDay === 'today' ? row.sun_score.sunshine_forecast_min : Math.round((row.tomorrow_sun_hours || 0) * 60)
                  const dayNetSunMin = (() => {
                    if (forecastDay === 'today') return Math.max(0, row.net_sun_min)
                    const bestTravelMin = Math.min(
                      row.travel?.car?.duration_min ?? Number.POSITIVE_INFINITY,
                      row.travel?.train?.duration_min ?? Number.POSITIVE_INFINITY
                    )
                    if (!Number.isFinite(bestTravelMin)) return 0
                    return Math.max(0, daySunMin - Math.round(bestTravelMin))
                  })()
                  const dayPrefix = dayStringInZurich(forecastDay === 'today' ? 0 : 1)
                  const hourly = (row.admin_hourly || []).filter(h => h.time.startsWith(dayPrefix)).slice(0, 24)
                  const selected = selectedCompare.includes(row.destination.id)

                  return (
                    <Fragment key={row.destination.id}>
                      <tr
                        className="border-t border-slate-100 hover:bg-slate-50/60 cursor-pointer"
                        onClick={() => setExpandedId(prev => prev === row.destination.id ? null : row.destination.id)}
                      >
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected}
                            onClick={e => e.stopPropagation()}
                            onChange={() => toggleCompare(row.destination.id)}
                            className="w-3.5 h-3.5 rounded border-slate-300 accent-slate-900"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-800">{row.destination.name}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.destination.country}</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.destination.quality ?? 'generated'}</td>
                        <td className="px-3 py-2.5 text-right text-slate-600">{row.destination.altitude_m.toLocaleString()} m</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{formatSunHours(daySunMin)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{formatSunHours(dayNetSunMin)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{formatTravelHm(row.travel?.car?.duration_min)}</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{formatTravelHm(row.travel?.train?.duration_min)}</td>
                        <td className={`px-3 py-2.5 text-right font-semibold ${scoreColor(row.sun_score.score)}`}>{Math.round(row.sun_score.score * 100)}%</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{Math.round(row.weather_now?.temp_c ?? 0)}°C</td>
                        <td className="px-3 py-2.5 text-slate-600">{row.weather_model || '-'}</td>
                        <td className="px-3 py-2.5">
                          <span className={`inline-flex rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${tierPillClass(row.tier_eligibility)}`}>
                            {row.tier_eligibility || '-'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600 max-w-[260px] truncate" title={row.weather_now?.summary || row.conditions}>
                          {row.weather_now?.summary || row.conditions}
                        </td>
                        <td className="px-3 py-2.5"><MiniTimeline timeline={row.sun_timeline} day={forecastDay} /></td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-t border-slate-100">
                          <td colSpan={15} className="px-3 py-3">
                            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-3">
                              <div>
                                <p className="text-[11px] font-semibold text-slate-700 mb-1">Hourly sunshine breakdown</p>
                                <div className="grid grid-cols-24 gap-1">
                                  {hourly.length
                                    ? hourly.map((h, idx) => (
                                      <div key={idx} title={`${h.time.slice(11, 16)} · ${h.sunshine_min}min sun`} className={`h-4 rounded ${hourCellClass(h.sunshine_min)}`} />
                                    ))
                                    : Array.from({ length: 24 }).map((_, idx) => <div key={idx} className="h-4 rounded bg-slate-200" />)}
                                </div>
                                <div className="mt-1.5 flex justify-between text-[10px] text-slate-500" style={{ fontFamily: 'DM Mono, monospace' }}>
                                  {['00', '04', '08', '12', '16', '20', '24'].map(label => <span key={label}>{label}</span>)}
                                </div>
                                <div className="mt-2 text-[11px] text-slate-600">
                                  Cloud {Math.round(row.sun_score.low_cloud_cover_pct)}% · Temp {Math.round(row.weather_now?.temp_c ?? 0)}°C
                                </div>
                              </div>

                              <div>
                                <p className="text-[11px] font-semibold text-slate-700 mb-1">Links</p>
                                <div className="space-y-1 text-[11px]">
                                  {row.links.google_maps && <a href={row.links.google_maps} target="_blank" rel="noopener noreferrer" className="text-sky-700 hover:underline block">Google Maps</a>}
                                  {row.links.sbb && <a href={row.links.sbb} target="_blank" rel="noopener noreferrer" className="text-red-700 hover:underline block">SBB Timetable</a>}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
                </>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
          <span>
            Showing {filteredSorted.length === 0 ? 0 : (pageSizeMode === 'all' ? filteredSorted.length : ((page - 1) * pageSize + 1))}-
            {pageSizeMode === 'all' ? filteredSorted.length : Math.min(page * pageSize, filteredSorted.length)} of {filteredSorted.length} destinations
          </span>
          {pageSizeMode !== 'all' && (
            <div className="inline-flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-2.5 py-1 rounded-md border border-slate-200 bg-white disabled:opacity-50"
              >
                Prev
              </button>
              <span style={{ fontFamily: 'DM Mono, monospace' }}>
                {page}/{totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-2.5 py-1 rounded-md border border-slate-200 bg-white disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
