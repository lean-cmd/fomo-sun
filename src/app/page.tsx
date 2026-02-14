'use client'

import { useState, useEffect, useCallback } from 'react'
import { SunnyEscapesResponse, TravelMode, DestinationType } from '@/lib/types'
import { CarIcon, TrainIcon, BothIcon, FilterIcon, MapIcon, CameraIcon, ChevronDown } from '@/components/Icons'
import SunTimeline, { computeMaxSunHours } from '@/components/SunTimeline'

const TYPES: { id: DestinationType; label: string }[] = [
  { id: 'nature', label: 'Nature' },
  { id: 'viewpoint', label: 'Views' },
  { id: 'town', label: 'Town' },
  { id: 'lake', label: 'Lake' },
  { id: 'family', label: 'Family' },
  { id: 'food', label: 'Food & Wine' },
  { id: 'thermal', label: 'Thermal' },
]

const FLAG: Record<string, string> = { CH: '🇨🇭', DE: '🇩🇪', FR: '🇫🇷' }

const MODE_LABELS: Record<TravelMode, string> = {
  car: 'Car',
  train: 'Train',
  both: 'Car + Train',
}

function badgeClass(c: string) {
  return c === 'high' ? 'badge-high' : c === 'medium' ? 'badge-medium' : c === 'low' ? 'badge-low' : 'badge-uncertain'
}

function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const pct = Math.round(score * 100)
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score)
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f59e0b" strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-gray-800"
        style={{ fontFamily: 'Sora, sans-serif' }}>{pct}</span>
    </div>
  )
}

export default function Home() {
  const [maxH, setMaxH] = useState(2)
  const [mode, setMode] = useState<TravelMode>('both')
  const [ga, setGA] = useState(false)
  const [types, setTypes] = useState<DestinationType[]>([])
  const [data, setData] = useState<SunnyEscapesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [openCard, setOpenCard] = useState<number | null>(null)
  const [modeOpen, setModeOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({
        lat: '47.5596', lon: '7.5886',
        max_travel_h: String(maxH), mode, ga: String(ga), limit: '5',
      })
      if (types.length) p.set('types', types.join(','))
      const res = await fetch(`/api/v1/sunny-escapes?${p}`)
      setData(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [maxH, mode, ga, types])

  useEffect(() => { load() }, [load])

  const toggleType = (t: DestinationType) =>
    setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])

  const filterSummary = types.length ? types.map(t => TYPES.find(x => x.id === t)?.label).join(', ') : 'All types'
  const topScore = data?.escapes?.[0]?.sun_score.score ?? 0.7
  const maxSunH = computeMaxSunHours(topScore)

  return (
    <>
      {/* ===== HERO ===== */}
      <section className="hero-bg pt-9 pb-14 px-4 relative">
        <div className="fw1 absolute top-10 left-0 w-full h-8 bg-gradient-to-r from-transparent via-slate-400/[.18] to-transparent rounded-full blur-[18px] pointer-events-none" />
        <div className="fw2 absolute top-[60px] left-[8%] w-4/5 h-6 bg-gradient-to-r from-transparent via-slate-400/[.12] to-transparent rounded-full blur-[14px] pointer-events-none" />

        <div className="relative z-10 max-w-xl mx-auto text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <div className="sun-orb w-9 h-9 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 flex-shrink-0" />
            <div className="text-[28px] font-extrabold tracking-tight text-slate-900 leading-none"
              style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-1px' }}>
              FOMO <span className="text-amber-500">Sun</span>
            </div>
          </div>

          {/* Tagline */}
          <p className="text-[15px] text-slate-500 italic" style={{ fontFamily: "'Playfair Display', Georgia, serif" }}>
            Stop chasing clouds. Find sun.
          </p>

          {/* Origin pill */}
          {data?.origin_conditions && (
            <div className="mt-3.5 inline-flex items-center gap-1.5 bg-white/60 backdrop-blur-sm rounded-full px-3.5 py-1.5 text-[11px] text-slate-500">
              <span className="w-[5px] h-[5px] rounded-full bg-slate-400" />
              Basel now: {data.origin_conditions.description}
            </div>
          )}

          {/* FOMO sun hours stat */}
          <div className="mt-4 inline-flex items-center gap-2 bg-white rounded-xl px-4 py-2 shadow-[0_1px_4px_rgba(0,0,0,.04)]">
            <div className="w-[18px] h-[18px] rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex-shrink-0" />
            <span className="text-xl font-bold text-amber-500" style={{ fontFamily: 'Sora, sans-serif' }}>
              {maxSunH}h
            </span>
            <span className="text-[11px] text-gray-400 leading-tight text-left">
              of sun today<br />above the fog
            </span>
          </div>
        </div>
      </section>

      {/* ===== CONTROLS ===== */}
      <section className="max-w-[520px] mx-auto px-4 -mt-7 relative z-20">
        <div className="bg-white rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,.04),0_6px_20px_rgba(0,0,0,.04)] border border-gray-100 overflow-hidden">

          {/* Travel time - always visible */}
          <div className="px-5 pt-[18px] pb-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-[1.2px] text-gray-400">Travel time</span>
              <span className="text-[22px] font-bold text-amber-500" style={{ fontFamily: 'Sora, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
                {maxH}h
              </span>
            </div>
            <input type="range" min={1} max={4} step={0.5} value={maxH}
              onChange={e => setMaxH(parseFloat(e.target.value))} />
            <div className="flex justify-between text-[9px] text-gray-300 mt-1 px-0.5">
              <span>1h</span><span>2h</span><span>3h</span><span>4h</span>
            </div>
          </div>

          {/* Travel mode - collapsible */}
          <button
            className="flex items-center justify-between w-full px-5 py-3 border-t border-gray-50 hover:bg-gray-50/50 transition-colors"
            onClick={() => { setModeOpen(!modeOpen); setFilterOpen(false) }}
          >
            <div className="flex items-center gap-2">
              <CarIcon className="w-[18px] h-[18px] text-gray-400" />
              <span className="text-[13px] font-medium text-gray-800">Travel mode</span>
              <span className="text-[12px] text-gray-400">{MODE_LABELS[mode]}</span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-300 transition-transform ${modeOpen ? 'rotate-180' : ''}`} />
          </button>
          {modeOpen && (
            <div className="px-5 pb-4">
              <div className="flex gap-1.5">
                {([
                  ['car', 'Car', CarIcon],
                  ['train', 'Train', TrainIcon],
                  ['both', 'Both', BothIcon],
                ] as [TravelMode, string, typeof CarIcon][]).map(([m, label, Icon]) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[12px] font-medium transition-all border-[1.5px]
                    ${mode === m
                        ? 'bg-slate-900 text-white border-slate-900 shadow-[0_2px_6px_rgba(15,23,42,.15)]'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
              {(mode === 'train' || mode === 'both') && (
                <label className="flex items-center gap-1.5 mt-2.5 text-[11px] text-gray-500 cursor-pointer select-none">
                  <input type="checkbox" checked={ga} onChange={e => setGA(e.target.checked)}
                    className="w-3.5 h-3.5 accent-amber-500" />
                  I have a GA travelcard
                </label>
              )}
            </div>
          )}

          {/* Filters - collapsible */}
          <button
            className="flex items-center justify-between w-full px-5 py-3 border-t border-gray-50 hover:bg-gray-50/50 transition-colors"
            onClick={() => { setFilterOpen(!filterOpen); setModeOpen(false) }}
          >
            <div className="flex items-center gap-2">
              <FilterIcon className="w-[18px] h-[18px] text-gray-400" />
              <span className="text-[13px] font-medium text-gray-800">Filters</span>
              <span className="text-[12px] text-gray-400">{filterSummary}</span>
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-gray-300 transition-transform ${filterOpen ? 'rotate-180' : ''}`} />
          </button>
          {filterOpen && (
            <div className="px-5 pb-4">
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map(t => (
                  <button key={t.id} onClick={() => toggleType(t.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium transition-all border-[1.5px] select-none
                    ${types.includes(t.id)
                        ? 'bg-amber-50 text-amber-700 border-amber-300'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ===== RESULTS ===== */}
      <section className="max-w-[520px] mx-auto px-4 mt-5 pb-16">
        {loading ? (
          <div className="text-center py-16">
            <div className="sun-orb w-8 h-8 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 mx-auto animate-spin" />
            <p className="mt-3 text-sm text-gray-400">Finding sunshine...</p>
          </div>
        ) : data?.escapes?.length ? (
          <>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[16px] font-bold text-gray-800 tracking-tight" style={{ fontFamily: 'Sora, sans-serif' }}>
                Your sunny escapes
              </h2>
              <span className="text-[11px] text-gray-400">{data.escapes.length} found</span>
            </div>

            <div className="space-y-2.5">
              {data.escapes.map((e, i) => (
                <div key={e.destination.id}
                  className={`escape-card cursor-pointer anim-in d${i + 1}`}
                  onClick={() => setOpenCard(openCard === i ? null : i)}>
                  {/* Main row */}
                  <div className="flex gap-3 items-start p-3.5 sm:p-4">
                    <ScoreRing score={e.sun_score.score} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[11px]">{FLAG[e.destination.country]}</span>
                        <span className="font-semibold text-[14px] text-slate-900">{e.destination.name}</span>
                        <span className={`text-[8px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${badgeClass(e.sun_score.confidence)}`}>
                          {e.sun_score.confidence}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {e.destination.region} · {e.destination.altitude_m.toLocaleString()} m
                      </p>
                      <div className="flex items-start gap-2.5 mt-1.5">
                        {e.travel.car && (
                          <span className="flex items-start gap-1 text-[11px] text-gray-500">
                            <CarIcon className="w-[13px] h-[13px] text-gray-400 mt-0.5" />
                            <strong className="text-gray-800 font-semibold">{e.travel.car.duration_min} min</strong>
                          </span>
                        )}
                        {e.travel.train && (
                          <span className="flex items-start gap-1 text-[11px] text-gray-500">
                            <TrainIcon className="w-[13px] h-[13px] text-gray-400 mt-0.5" />
                            <strong className="text-gray-800 font-semibold">{e.travel.train.duration_min} min</strong>
                            {e.travel.train.changes !== undefined && (
                              <span className="text-gray-300">{e.travel.train.changes}×</span>
                            )}
                            {e.travel.train.ga_included && (
                              <span className="text-[8px] bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded font-semibold">GA</span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-300 flex-shrink-0 self-center transition-transform ${openCard === i ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Sunshine timeline bar */}
                  <SunTimeline sunScore={e.sun_score.score} />

                  {/* Expanded detail */}
                  {openCard === i && (
                    <div className="border-t border-gray-50 bg-gray-50/50 p-4 anim-in">
                      <p className="text-[9px] font-semibold uppercase tracking-[1.2px] text-gray-400 mb-2">Trip plan</p>
                      <div className="space-y-1.5">
                        {e.plan.map((step, j) => (
                          <div key={j} className="flex gap-2 items-start">
                            <span className="flex-shrink-0 w-[18px] h-[18px] rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[9px] font-bold mt-0.5">
                              {j + 1}
                            </span>
                            <span className="text-[12px] text-gray-600 leading-snug">{step}</span>
                          </div>
                        ))}
                      </div>

                      <div className="flex gap-1.5 mt-3.5">
                        {e.links.google_maps && (
                          <a href={e.links.google_maps} target="_blank" rel="noopener noreferrer"
                            onClick={ev => ev.stopPropagation()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-semibold bg-slate-900 text-white hover:bg-slate-800 transition-colors">
                            <MapIcon /> Navigate
                          </a>
                        )}
                        {e.links.sbb && (
                          <a href={e.links.sbb} target="_blank" rel="noopener noreferrer"
                            onClick={ev => ev.stopPropagation()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-semibold bg-red-600 text-white hover:bg-red-500 transition-colors">
                            <TrainIcon className="w-3.5 h-3.5" /> SBB
                          </a>
                        )}
                        {e.links.webcam && (
                          <a href={e.links.webcam} target="_blank" rel="noopener noreferrer"
                            onClick={ev => ev.stopPropagation()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[11px] font-semibold bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors">
                            <CameraIcon /> Webcam
                          </a>
                        )}
                      </div>

                      <button onClick={ev => {
                        ev.stopPropagation()
                        const txt = `${e.destination.name} (${e.destination.region})\nSun score: ${Math.round(e.sun_score.score * 100)}% ${e.sun_score.confidence}\n${e.travel.car ? `Car: ${e.travel.car.duration_min} min ` : ''}${e.travel.train ? `Train: ${e.travel.train.duration_min} min` : ''}\n${e.plan.join(' → ')}\n\nfomosun.com`
                        navigator.clipboard?.writeText(txt)
                      }}
                        className="w-full mt-2 py-1.5 text-[10px] text-gray-400 hover:text-gray-600 transition-colors">
                        Copy & share this escape
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-base text-gray-500 mb-1">No sunny escapes found</p>
            <p className="text-xs text-gray-400">Try increasing your travel time or removing filters</p>
          </div>
        )}
      </section>
    </>
  )
}
