'use client'

import { useState, useEffect, useCallback } from 'react'
import { SunnyEscapesResponse, TravelMode, DestinationType, SunTimeline } from '@/lib/types'

// ── SVG Icons (no emoji) ──────────────────────────────────────────────
function CarIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M3.375 14.25V5.625m0 0h4.5m-4.5 0H3.375" />
    </svg>
  )
}
function TrainIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-18v18M3.6 9h16.8M3.6 15h16.8" />
    </svg>
  )
}
function BothIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  )
}
function FilterIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" />
    </svg>
  )
}
function MapIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
    </svg>
  )
}
function CameraIcon({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" />
    </svg>
  )
}
function ChevDown({ className = 'w-3.5 h-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

// ── Score Ring ─────────────────────────────────────────────────────────
function ScoreRing({ score, size = 48 }: { score: number; size?: number }) {
  const pct = Math.round(score * 100)
  const r = (size - 8) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score)
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f59e0b" strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold text-slate-800"
        style={{ fontFamily: 'Sora, sans-serif' }}>{pct}</span>
    </div>
  )
}

// ── Sunshine Timeline ─────────────────────────────────────────────────
function SunTimelineBar({ timeline }: { timeline: SunTimeline }) {
  const bgClass: Record<string, string> = {
    sun: 'tl-sun', partial: 'tl-partial', cloud: 'tl-cloud', night: 'tl-night',
  }
  return (
    <div className="px-4 pb-3 space-y-1">
      {(['today', 'tomorrow'] as const).map(day => (
        <div key={day} className="flex items-center gap-1.5">
          <span className="text-[9px] text-slate-400 w-[44px] text-right flex-shrink-0 font-medium capitalize">{day}</span>
          <div className="flex-1 h-[14px] rounded bg-slate-100 flex overflow-hidden">
            {timeline[day].map((seg, i) => (
              <div key={i} className={`h-full ${bgClass[seg.condition]}`} style={{ width: `${seg.pct}%` }} />
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-between text-[8px] text-slate-300 pl-[50px]">
        <span>8</span><span>10</span><span>12</span><span>14</span><span>16</span><span>18</span>
      </div>
    </div>
  )
}

// ── Data ───────────────────────────────────────────────────────────────
const FLAG: Record<string, string> = { CH: '🇨🇭', DE: '🇩🇪', FR: '🇫🇷' }
const TYPES: { id: DestinationType; label: string }[] = [
  { id: 'nature', label: 'Nature' },
  { id: 'viewpoint', label: 'Views' },
  { id: 'town', label: 'Town' },
  { id: 'lake', label: 'Lake' },
  { id: 'family', label: 'Family' },
  { id: 'food', label: 'Food & Wine' },
  { id: 'thermal', label: 'Thermal' },
]

function badgeClass(c: string) {
  return c === 'high' ? 'badge-high' : c === 'medium' ? 'badge-medium' : c === 'low' ? 'badge-low' : 'badge-uncertain'
}

const modeLabels: Record<TravelMode, string> = { car: 'Car', train: 'Train', both: 'Car + Train' }

// ── Main Page ─────────────────────────────────────────────────────────
export default function Home() {
  const [maxH, setMaxH] = useState(2)
  const [mode, setMode] = useState<TravelMode>('both')
  const [ga, setGA] = useState(false)
  const [types, setTypes] = useState<DestinationType[]>([])
  const [data, setData] = useState<SunnyEscapesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [openCard, setOpenCard] = useState<number | null>(null)
  const [openSetting, setOpenSetting] = useState<string | null>(null)

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

  const toggleSetting = (id: string) =>
    setOpenSetting(prev => prev === id ? null : id)

  const filterSummary = types.length === 0 ? 'All types' : types.length <= 2 ? types.map(t => TYPES.find(x => x.id === t)?.label).join(', ') : `${types.length} selected`

  return (
    <>
      {/* ══════ HERO ══════ */}
      <section className="hero-bg pt-9 pb-14 px-4 relative">
        <div className="fog-w1 absolute top-10 left-0 w-full h-8 bg-gradient-to-r from-transparent via-slate-400/[.18] to-transparent rounded-full blur-[18px] pointer-events-none" />
        <div className="fog-w2 absolute top-[60px] left-[8%] w-4/5 h-6 bg-gradient-to-r from-transparent via-slate-400/[.12] to-transparent rounded-full blur-[14px] pointer-events-none" />

        <div className="relative z-10 max-w-xl mx-auto text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-3.5">
            <div className="sun-anim w-9 h-9 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 flex-shrink-0" />
            <div className="text-[28px] font-extrabold tracking-tight text-slate-800" style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-1px' }}>
              FOMO <span className="text-amber-500">Sun</span>
            </div>
          </div>

          {/* Tagline */}
          <p className="text-[15px] text-slate-500 italic" style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
            Stop chasing clouds. Find sun.
          </p>

          {/* Origin conditions */}
          {data?.origin_conditions && (
            <div className="mt-3.5 inline-flex items-center gap-1.5 bg-white/60 backdrop-blur-sm rounded-full px-3.5 py-1.5 text-[11px] text-slate-500">
              <span className="w-[5px] h-[5px] rounded-full bg-slate-400" />
              Basel now: {data.origin_conditions.description}
            </div>
          )}

          {/* FOMO stat */}
          {data?.max_sun_hours_today && (
            <div className="mt-4 inline-flex items-center gap-2.5 bg-white rounded-xl px-4 py-2 shadow-sm">
              <div className="w-[18px] h-[18px] rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex-shrink-0" />
              <span className="text-xl font-bold text-amber-500" style={{ fontFamily: 'Sora, sans-serif' }}>
                {data.max_sun_hours_today}h
              </span>
              <span className="text-[11px] text-slate-400 leading-tight text-left">
                of sun today<br />above the fog
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ══════ CONTROLS ══════ */}
      <section className="max-w-xl mx-auto px-4 -mt-7 relative z-20">
        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-hidden">

          {/* Slider - always visible */}
          <div className="px-5 pt-[18px] pb-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-[1.2px] text-slate-400">Travel time</span>
              <span className="text-[22px] font-bold text-amber-500 tabular-nums" style={{ fontFamily: 'Sora, sans-serif' }}>{maxH}h</span>
            </div>
            <input type="range" min={1} max={4} step={0.5} value={maxH}
              onChange={e => setMaxH(parseFloat(e.target.value))} />
            <div className="flex justify-between text-[9px] text-slate-300 mt-1 px-0.5">
              <span>1h</span><span>2h</span><span>3h</span><span>4h</span>
            </div>
          </div>

          {/* Travel mode - collapsible */}
          <button
            onClick={() => toggleSetting('mode')}
            className="setting-toggle w-full flex items-center justify-between px-5 py-3 border-t border-slate-100 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <CarIcon className="w-[18px] h-[18px] text-slate-400" />
              <span className="text-[13px] font-medium text-slate-800">Travel mode</span>
              <span className="text-[12px] text-slate-400">{modeLabels[mode]}</span>
            </div>
            <ChevDown className={`w-3.5 h-3.5 text-slate-300 transition-transform ${openSetting === 'mode' ? 'rotate-180' : ''}`} />
          </button>
          {openSetting === 'mode' && (
            <div className="px-5 pb-4">
              <div className="flex gap-1.5">
                {([['car', 'Car', CarIcon], ['train', 'Train', TrainIcon], ['both', 'Both', BothIcon]] as [TravelMode, string, typeof CarIcon][]).map(([m, l, Icon]) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[12px] font-medium border transition-all
                      ${mode === m ? 'mode-btn-active' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                    <Icon className="w-4 h-4" /> {l}
                  </button>
                ))}
              </div>
              {(mode === 'train' || mode === 'both') && (
                <label className="flex items-center gap-1.5 mt-2.5 text-[11px] text-slate-500 cursor-pointer select-none">
                  <input type="checkbox" checked={ga} onChange={e => setGA(e.target.checked)}
                    className="rounded border-slate-300 accent-amber-500 w-3.5 h-3.5" />
                  I have a GA travelcard
                </label>
              )}
            </div>
          )}

          {/* Filters - collapsible */}
          <button
            onClick={() => toggleSetting('filter')}
            className="setting-toggle w-full flex items-center justify-between px-5 py-3 border-t border-slate-100 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <FilterIcon className="w-[18px] h-[18px] text-slate-400" />
              <span className="text-[13px] font-medium text-slate-800">Filters</span>
              <span className="text-[12px] text-slate-400">{filterSummary}</span>
            </div>
            <ChevDown className={`w-3.5 h-3.5 text-slate-300 transition-transform ${openSetting === 'filter' ? 'rotate-180' : ''}`} />
          </button>
          {openSetting === 'filter' && (
            <div className="px-5 pb-4">
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map(t => (
                  <button key={t.id} onClick={() => toggleType(t.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium border-[1.5px] transition-all select-none
                      ${types.includes(t.id) ? 'chip-active' : 'chip-inactive'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ══════ RESULTS ══════ */}
      <section className="max-w-xl mx-auto px-4 mt-5 pb-16">
        {loading ? (
          <div className="text-center py-16">
            <div className="sun-anim w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 mx-auto" />
            <p className="mt-4 text-sm text-slate-400">Finding sunshine...</p>
          </div>
        ) : data?.escapes?.length ? (
          <>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[16px] font-bold text-slate-800" style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-0.3px' }}>
                Your sunny escapes
              </h2>
              <span className="text-[11px] text-slate-400">{data.escapes.length} found</span>
            </div>

            <div className="space-y-2.5">
              {data.escapes.map((e, i) => (
                <div key={e.destination.id} className={`escape-card anim-in d${i+1} cursor-pointer`}
                  onClick={() => setOpenCard(openCard === i ? null : i)}>
                  <div className="p-3.5 sm:p-4 flex gap-3 items-start">
                    <ScoreRing score={e.sun_score.score} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[11px]">{FLAG[e.destination.country]}</span>
                        <span className="font-semibold text-[14px] text-slate-800">{e.destination.name}</span>
                        <span className={`text-[8px] font-semibold uppercase tracking-[.5px] px-1.5 py-0.5 rounded-full ${badgeClass(e.sun_score.confidence)}`}>
                          {e.sun_score.confidence}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{e.destination.region} · {e.destination.altitude_m.toLocaleString()} m</p>
                      <div className="flex gap-2.5 mt-1.5">
                        {e.travel.car && (
                          <span className="flex items-start gap-1 text-[11px] text-slate-500">
                            <CarIcon className="w-[13px] h-[13px] text-slate-400 mt-0.5" />
                            <strong className="text-slate-700">{e.travel.car.duration_min} min</strong>
                          </span>
                        )}
                        {e.travel.train && (
                          <span className="flex items-start gap-1 text-[11px] text-slate-500">
                            <TrainIcon className="w-[13px] h-[13px] text-slate-400 mt-0.5" />
                            <strong className="text-slate-700">{e.travel.train.duration_min} min</strong>
                            {e.travel.train.changes !== undefined && <span className="text-slate-300">{e.travel.train.changes}×</span>}
                            {e.travel.train.ga_included && <span className="text-[8px] bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded font-semibold">GA</span>}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevDown className={`w-3.5 h-3.5 text-slate-300 flex-shrink-0 self-center transition-transform ${openCard === i ? 'rotate-180' : ''}`} />
                  </div>

                  {/* Sunshine timeline */}
                  {e.sun_timeline && <SunTimelineBar timeline={e.sun_timeline} />}

                  {/* Expanded section */}
                  {openCard === i && (
                    <div className="border-t border-slate-50 bg-slate-50/50 px-4 py-3.5 anim-in">
                      <p className="text-[9px] font-semibold uppercase tracking-[1.2px] text-slate-400 mb-2">Trip plan</p>
                      <div className="space-y-1.5">
                        {e.plan.map((step, j) => (
                          <div key={j} className="flex gap-2 items-start">
                            <span className="flex-shrink-0 w-[18px] h-[18px] rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[9px] font-bold mt-0.5">
                              {j + 1}
                            </span>
                            <span className="text-[12px] text-slate-500 leading-snug">{step}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-1.5 mt-3">
                        {e.links.google_maps && (
                          <a href={e.links.google_maps} target="_blank" rel="noopener noreferrer"
                            onClick={ev => ev.stopPropagation()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-800 text-white text-[11px] font-semibold hover:bg-slate-700 transition-colors">
                            <MapIcon /> Navigate
                          </a>
                        )}
                        {e.links.sbb && (
                          <a href={e.links.sbb} target="_blank" rel="noopener noreferrer"
                            onClick={ev => ev.stopPropagation()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-red-600 text-white text-[11px] font-semibold hover:bg-red-500 transition-colors">
                            <TrainIcon className="w-3.5 h-3.5" /> SBB
                          </a>
                        )}
                        {e.links.webcam && (
                          <a href={e.links.webcam} target="_blank" rel="noopener noreferrer"
                            onClick={ev => ev.stopPropagation()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white text-slate-500 border border-slate-200 text-[11px] font-semibold hover:bg-slate-50 transition-colors">
                            <CameraIcon /> Webcam
                          </a>
                        )}
                      </div>
                      <button onClick={ev => {
                          ev.stopPropagation()
                          const txt = `${e.destination.name} (${e.destination.region})\nSun score: ${Math.round(e.sun_score.score*100)}%\n${e.travel.car ? `Car: ${e.travel.car.duration_min} min ` : ''}${e.travel.train ? `Train: ${e.travel.train.duration_min} min` : ''}\n${e.plan.join(' > ')}\n\nfomosun.com`
                          navigator.clipboard?.writeText(txt)
                        }}
                        className="w-full mt-2 py-1.5 text-[10px] text-slate-400 hover:text-slate-600 transition-colors">
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
            <p className="text-base text-slate-500 mb-1">No sunny escapes found</p>
            <p className="text-xs text-slate-400">Try increasing your travel time or removing filters</p>
          </div>
        )}
      </section>
    </>
  )
}
