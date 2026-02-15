'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { SunnyEscapesResponse, SunTimeline } from '@/lib/types'

type SortMode = 'score' | 'sun' | 'name' | 'altitude'
type LimitMode = '25' | '50' | '100' | 'all'

type Escape = SunnyEscapesResponse['escapes'][number]

function MiniTimeline({ timeline }: { timeline: SunTimeline }) {
  const today = timeline?.today || []
  const total = Math.max(1, today.reduce((sum, seg) => sum + seg.pct, 0))
  return (
    <div className="tl-bar min-w-[180px]">
      {today.map((seg, idx) => {
        const c = seg.condition === 'sun'
          ? 'tl-sun'
          : seg.condition === 'partial'
            ? 'tl-partial'
            : seg.condition === 'night'
              ? 'tl-night-soft'
              : 'tl-cloud'
        return <div key={idx} className={c} style={{ width: `${(seg.pct / total) * 100}%` }} />
      })}
    </div>
  )
}

export default function AdminDiagnosticsPage() {
  const [rows, setRows] = useState<Escape[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('score')
  const [limitMode, setLimitMode] = useState<LimitMode>('50')
  const [activeCountries, setActiveCountries] = useState<Record<string, boolean>>({ CH: true, DE: true, FR: true, IT: true })
  const [meta, setMeta] = useState({ liveSource: '', debugPath: '', cache: '' })

  useEffect(() => {
    let mounted = true
    const run = async () => {
      setLoading(true)
      setError('')
      try {
        const p = new URLSearchParams({
          lat: '47.5596',
          lon: '7.5886',
          max_travel_h: '4.5',
          mode: 'both',
          ga: 'false',
          limit: '500',
          demo: 'false',
          admin: 'true',
        })
        const res = await fetch(`/api/v1/sunny-escapes?${p.toString()}`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`API ${res.status}`)
        const payload: SunnyEscapesResponse = await res.json()
        if (!mounted) return
        setRows(payload.escapes || [])
        setMeta({
          liveSource: res.headers.get('x-fomo-live-source') || '',
          debugPath: res.headers.get('x-fomo-debug-live-path') || '',
          cache: res.headers.get('x-fomo-response-cache') || '',
        })
      } catch (err) {
        if (!mounted) return
        setError(String((err as Error)?.message || err))
      } finally {
        if (mounted) setLoading(false)
      }
    }
    run()
    return () => { mounted = false }
  }, [])

  const byCountryCount = useMemo(() => {
    const out: Record<string, number> = { CH: 0, DE: 0, FR: 0, IT: 0 }
    for (const r of rows) {
      out[r.destination.country] = (out[r.destination.country] || 0) + 1
    }
    return out
  }, [rows])

  const filteredSorted = useMemo(() => {
    const filtered = rows.filter(r => activeCountries[r.destination.country] !== false)
    filtered.sort((a, b) => {
      if (sortMode === 'sun') return b.sun_score.sunshine_forecast_min - a.sun_score.sunshine_forecast_min
      if (sortMode === 'name') return a.destination.name.localeCompare(b.destination.name, 'de-CH')
      if (sortMode === 'altitude') return b.destination.altitude_m - a.destination.altitude_m
      return b.sun_score.score - a.sun_score.score
    })

    if (limitMode === 'all') return filtered
    return filtered.slice(0, Number(limitMode))
  }, [rows, activeCountries, sortMode, limitMode])

  const toggleCountry = (country: string) => {
    setActiveCountries(prev => ({ ...prev, [country]: !prev[country] }))
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900" style={{ fontFamily: 'Sora' }}>Forecast Diagnostics</h1>
            <p className="text-sm text-slate-500 mt-1">Live weather cross-check for all destinations.</p>
          </div>
          <Link href="/" className="text-xs text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline">Back to app</Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 rounded-xl border border-slate-200 bg-white p-3 mb-4">
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
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            Sort
            <select value={sortMode} onChange={e => setSortMode(e.target.value as SortMode)} className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white">
              <option value="score">FOMO score</option>
              <option value="sun">Sunshine min</option>
              <option value="name">Name</option>
              <option value="altitude">Altitude</option>
            </select>
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            Limit
            <select value={limitMode} onChange={e => setLimitMode(e.target.value as LimitMode)} className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white">
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="all">All</option>
            </select>
          </label>
        </div>

        <div className="text-xs text-slate-500 mb-2">
          Source: <strong>{meta.liveSource || 'unknown'}</strong> · Debug path: <strong>{meta.debugPath || 'unknown'}</strong> · Cache: <strong>{meta.cache || 'unknown'}</strong>
        </div>

        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">{error}</div>}

        <div className="rounded-xl border border-slate-200 bg-white overflow-auto">
          <table className="w-full min-w-[1080px] text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="text-left px-3 py-2 font-semibold">Name</th>
                <th className="text-left px-3 py-2 font-semibold">Country</th>
                <th className="text-right px-3 py-2 font-semibold">Altitude</th>
                <th className="text-right px-3 py-2 font-semibold">Sun min</th>
                <th className="text-right px-3 py-2 font-semibold">FOMO</th>
                <th className="text-right px-3 py-2 font-semibold">Temp</th>
                <th className="text-left px-3 py-2 font-semibold">Conditions</th>
                <th className="text-left px-3 py-2 font-semibold">Timeline</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">Loading live diagnostics...</td>
                </tr>
              ) : filteredSorted.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-slate-500">No destinations for current filters.</td>
                </tr>
              ) : (
                filteredSorted.map((r) => (
                  <tr key={r.destination.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 font-medium text-slate-800">{r.destination.name}</td>
                    <td className="px-3 py-2.5 text-slate-600">{r.destination.country}</td>
                    <td className="px-3 py-2.5 text-right text-slate-600">{r.destination.altitude_m.toLocaleString()} m</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{r.sun_score.sunshine_forecast_min}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-amber-700">{Math.round(r.sun_score.score * 100)}%</td>
                    <td className="px-3 py-2.5 text-right text-slate-700">{Math.round(r.weather_now?.temp_c ?? 0)}°C</td>
                    <td className="px-3 py-2.5 text-slate-600 max-w-[260px] truncate" title={r.weather_now?.summary || r.conditions}>
                      {r.weather_now?.summary || r.conditions}
                    </td>
                    <td className="px-3 py-2.5"><MiniTimeline timeline={r.sun_timeline} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}
