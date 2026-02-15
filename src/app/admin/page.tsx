'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Activity, Download, RefreshCw } from 'lucide-react'
import { SunnyEscapesResponse, SunTimeline } from '@/lib/types'
import { formatSunHours } from '@/lib/format'

type SortMode = 'score' | 'sun' | 'name' | 'altitude'
type PageSizeMode = '50' | '100' | '200' | 'all'
type ForecastDay = 'today' | 'tomorrow'
type DestinationQuality = 'verified' | 'curated' | 'generated'
type AdminTypeChip = 'mountain' | 'town' | 'ski' | 'thermal' | 'lake'

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

export default function AdminDiagnosticsPage() {
  const [rows, setRows] = useState<Escape[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('score')
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
  const [meta, setMeta] = useState({
    liveSource: '',
    debugPath: '',
    cache: '',
    fallback: '',
    requestMs: '',
    responseAt: '',
    weatherFreshness: '',
    headers: {} as Record<string, string>,
  })
  const [originMeta, setOriginMeta] = useState<{ name: string; lat: number; lon: number } | null>(null)
  const [logs, setLogs] = useState<RequestLogRow[]>([])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const p = new URLSearchParams({
        lat: '47.5596',
        lon: '7.5886',
        max_travel_h: '4.5',
        mode: 'both',
        ga: 'false',
        limit: '5000',
        demo: 'false',
        admin: 'true',
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
        'x-fomo-request-ms',
      ].forEach(h => {
        const val = res.headers.get(h)
        if (val) headersObj[h] = val
      })

      setRows(payload.escapes || [])
      setOriginMeta(payload._meta?.origin || null)
      setMeta({
        liveSource: res.headers.get('x-fomo-live-source') || '',
        debugPath: res.headers.get('x-fomo-debug-live-path') || '',
        cache: res.headers.get('x-fomo-response-cache') || '',
        fallback: res.headers.get('x-fomo-live-fallback') || '',
        requestMs: res.headers.get('x-fomo-request-ms') || '',
        responseAt: payload._meta?.generated_at || '',
        weatherFreshness: payload._meta?.weather_data_freshness || '',
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

    filtered.sort((a, b) => {
      if (sortMode === 'sun') return daySunMin(b) - daySunMin(a)
      if (sortMode === 'name') return a.destination.name.localeCompare(b.destination.name, 'de-CH')
      if (sortMode === 'altitude') return b.destination.altitude_m - a.destination.altitude_m
      return b.sun_score.score - a.sun_score.score
    })

    return filtered
  }, [rows, activeCountries, activeQualities, activeTypeChips, sortMode, forecastDay, search])

  const pageSize = pageSizeMode === 'all' ? filteredSorted.length : Number(pageSizeMode)
  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / Math.max(1, pageSize)))
  const pagedRows = useMemo(() => {
    if (pageSizeMode === 'all') return filteredSorted
    const start = (page - 1) * pageSize
    return filteredSorted.slice(start, start + pageSize)
  }, [filteredSorted, page, pageSize, pageSizeMode])

  useEffect(() => {
    setPage(1)
  }, [search, forecastDay, sortMode, activeCountries, activeQualities, activeTypeChips, pageSizeMode])

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

    const header = ['name', 'country', 'quality', 'lat', 'lon', 'altitude_m', 'fomo_score_pct', 'sunshine_min', 'temp_c', 'condition']
    const lines = filteredSorted.map(r => [
      r.destination.name,
      r.destination.country,
      r.destination.quality ?? 'generated',
      r.destination.lat,
      r.destination.lon,
      r.destination.altitude_m,
      Math.round(r.sun_score.score * 100),
      daySunMin(r),
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
          Showing {filteredSorted.length} destinations
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

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto_auto] gap-3 rounded-xl border border-slate-200 bg-white p-3 mb-3">
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
            <select value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)} className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white">
              <option value="score">FOMO score</option>
              <option value="sun">Sunshine</option>
              <option value="name">Name</option>
              <option value="altitude">Altitude</option>
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
            </p>
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
          <table className="w-full min-w-[1180px] text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Compare</th>
                <th className="text-left px-3 py-2 font-semibold">Name</th>
                <th className="text-left px-3 py-2 font-semibold">Country</th>
                <th className="text-left px-3 py-2 font-semibold">Quality</th>
                <th className="text-right px-3 py-2 font-semibold">Altitude</th>
                <th className="text-right px-3 py-2 font-semibold">Sun</th>
                <th className="text-right px-3 py-2 font-semibold">FOMO</th>
                <th className="text-right px-3 py-2 font-semibold">Temp</th>
                <th className="text-left px-3 py-2 font-semibold">Conditions</th>
                <th className="text-left px-3 py-2 font-semibold">Timeline</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-slate-500">Loading live diagnostics...</td>
                </tr>
              ) : filteredSorted.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-3 py-6 text-center text-slate-500">No destinations for current filters.</td>
                </tr>
              ) : (
                pagedRows.map((row) => {
                  const isExpanded = expandedId === row.destination.id
                  const daySunMin = forecastDay === 'today' ? row.sun_score.sunshine_forecast_min : Math.round((row.tomorrow_sun_hours || 0) * 60)
                  const dayPrefix = forecastDay === 'today'
                    ? new Date().toISOString().slice(0, 10)
                    : (() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10) })()
                  const hourly = (row.admin_hourly || []).filter(h => h.time.startsWith(dayPrefix)).slice(0, 24)
                  const selected = selectedCompare.includes(row.destination.id)

                  return (
                    <>
                      <tr
                        key={row.destination.id}
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
                        <td className={`px-3 py-2.5 text-right font-semibold ${scoreColor(row.sun_score.score)}`}>{Math.round(row.sun_score.score * 100)}%</td>
                        <td className="px-3 py-2.5 text-right text-slate-700">{Math.round(row.weather_now?.temp_c ?? 0)}°C</td>
                        <td className="px-3 py-2.5 text-slate-600 max-w-[260px] truncate" title={row.weather_now?.summary || row.conditions}>
                          {row.weather_now?.summary || row.conditions}
                        </td>
                        <td className="px-3 py-2.5"><MiniTimeline timeline={row.sun_timeline} day={forecastDay} /></td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-50/70 border-t border-slate-100">
                          <td colSpan={10} className="px-3 py-3">
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
                    </>
                  )
                })
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
