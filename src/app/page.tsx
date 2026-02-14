'use client'

import { useState, useEffect, useCallback } from 'react'
import { SunnyEscapesResponse, TravelMode, DestinationType, SunTimeline } from '@/lib/types'

// ── SVG Icons ─────────────────────────────────────────────────────────
const CarI = ({ c = 'w-4 h-4' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M3.375 14.25V5.625m0 0h4.5m-4.5 0H3.375" /></svg>
const TrainI = ({ c = 'w-4 h-4' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-18v18M3.6 9h16.8M3.6 15h16.8" /></svg>
const BothI = ({ c = 'w-4 h-4' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
const FilterI = ({ c = 'w-4 h-4' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" /></svg>
const MapI = ({ c = 'w-3.5 h-3.5' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" /></svg>
const CamI = ({ c = 'w-3.5 h-3.5' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg>
const ChevD = ({ c = 'w-3.5 h-3.5' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
const LocI = ({ c = 'w-4 h-4' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>

// ── Helpers ───────────────────────────────────────────────────────────
const FLAG: Record<string, string> = { CH: '🇨🇭', DE: '🇩🇪', FR: '🇫🇷' }
const TYPES: { id: DestinationType; label: string }[] = [
  { id: 'nature', label: 'Nature' }, { id: 'viewpoint', label: 'Views' },
  { id: 'town', label: 'Town' }, { id: 'lake', label: 'Lake' },
  { id: 'family', label: 'Family' }, { id: 'food', label: 'Food & Wine' },
  { id: 'thermal', label: 'Thermal' },
]
const modeLbl: Record<TravelMode, string> = { car: 'Car', train: 'Train', both: 'Car + Train' }
function fmtMin(m: number) { const h = Math.floor(m / 60); return h > 0 ? `${h}h ${m % 60}m` : `${m}m` }

// ── FOMOscore Ring ────────────────────────────────────────────────────
function ScoreRing({ score, size = 48, onTap }: { score: number; size?: number; onTap?: () => void }) {
  const pct = Math.round(score * 100)
  const r = (size - 8) / 2, circ = 2 * Math.PI * r, offset = circ * (1 - score)
  return (
    <button onClick={e => { e.stopPropagation(); onTap?.() }} aria-label={`FOMOscore ${pct}%`}
      className="relative flex-shrink-0 cursor-pointer" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f59e0b" strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[13px] font-bold text-slate-800" style={{ fontFamily: 'Sora, sans-serif' }}>{pct}</span>
        <span className="text-[6.5px] font-bold text-amber-500 uppercase tracking-wider mt-[1px]">fomo</span>
      </span>
    </button>
  )
}

// ── Sun Timeline ──────────────────────────────────────────────────────
function SunBar({ timeline, demo }: { timeline: SunTimeline; demo: boolean }) {
  const h = demo ? 10.17 : new Date().getHours() + new Date().getMinutes() / 60
  const nowPct = Math.max(0, Math.min(85, ((h - 8) / 10) * 85))
  return (
    <div className="px-4 pb-3 space-y-1">
      {(['today', 'tomorrow'] as const).map(day => (
        <div key={day} className="flex items-center gap-1.5">
          <span className="text-[9px] text-slate-400 w-[44px] text-right flex-shrink-0 font-medium capitalize">{day}</span>
          <div className="tl-bar">
            {timeline[day].map((seg, i) => (
              <div key={i} className={`h-full tl-${seg.condition} rounded-[2px]`} style={{ width: `${seg.pct}%` }} />
            ))}
            {day === 'today' && h >= 8 && h <= 18 && <div className="tl-now" style={{ left: `${nowPct}%` }} />}
          </div>
        </div>
      ))}
      <div className="flex justify-between text-[8px] text-slate-300 pl-[50px]">
        <span>8</span><span>10</span><span>12</span><span>14</span><span>16</span><span>18</span>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
export default function Home() {
  const [maxH, setMaxH] = useState(2.5)
  const [mode, setMode] = useState<TravelMode>('both')
  const [ga, setGA] = useState(false)
  const [types, setTypes] = useState<DestinationType[]>([])
  const [data, setData] = useState<SunnyEscapesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [openCard, setOpenCard] = useState<number | null>(null)
  const [openSetting, setOpenSetting] = useState<string | null>(null)
  const [demo, setDemo] = useState(true)
  const [scorePopup, setScorePopup] = useState<number | null>(null)
  const [userLoc, setUserLoc] = useState<{ lat: number; lon: number; name: string } | null>(null)
  const [locating, setLocating] = useState(false)

  const nightMode = data ? data.sunset.is_past && !demo : false
  const origin = userLoc || { lat: 47.5596, lon: 7.5886, name: 'Basel' }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const p = new URLSearchParams({
        lat: String(origin.lat), lon: String(origin.lon),
        max_travel_h: String(maxH), mode, ga: String(ga), limit: '6', demo: String(demo),
      })
      if (types.length) p.set('types', types.join(','))
      const res = await fetch(`/api/v1/sunny-escapes?${p}`)
      setData(await res.json())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [maxH, mode, ga, types, demo, origin.lat, origin.lon])

  useEffect(() => { load() }, [load])

  // Close popup on outside click
  useEffect(() => {
    if (scorePopup === null) return
    const h = () => setScorePopup(null)
    document.addEventListener('click', h)
    return () => document.removeEventListener('click', h)
  }, [scorePopup])

  const detectLocation = async () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        // Reverse geocode with Open-Meteo geocoding (free, no key)
        try {
          const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?latitude=${latitude}&longitude=${longitude}&count=1&language=en&format=json`)
          const d = await r.json()
          const name = d?.results?.[0]?.name || `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`
          setUserLoc({ lat: latitude, lon: longitude, name })
        } catch {
          setUserLoc({ lat: latitude, lon: longitude, name: `${latitude.toFixed(2)}, ${longitude.toFixed(2)}` })
        }
        setLocating(false)
      },
      () => setLocating(false),
      { enableHighAccuracy: false, timeout: 8000 }
    )
  }

  const toggleType = (t: DestinationType) => setTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  const toggleSetting = (id: string) => setOpenSetting(prev => prev === id ? null : id)
  const filterSummary = types.length === 0 ? 'All types' : types.length <= 2 ? types.map(t => TYPES.find(x => x.id === t)?.label).join(', ') : `${types.length} selected`
  const currentTime = demo ? '10:10' : new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      {/* ══════ HERO ══════ */}
      <section className={`${nightMode ? 'hero-night' : 'hero-day'} pt-8 pb-14 px-4 relative`}>
        {!nightMode && <>
          <div className="fog-w1 absolute top-10 left-0 w-full h-8 bg-gradient-to-r from-transparent via-slate-400/[.18] to-transparent rounded-full blur-[18px] pointer-events-none" />
          <div className="fog-w2 absolute top-[60px] left-[8%] w-4/5 h-6 bg-gradient-to-r from-transparent via-slate-400/[.12] to-transparent rounded-full blur-[14px] pointer-events-none" />
        </>}

        {/* Demo toggle */}
        <button onClick={() => setDemo(!demo)}
          className={`absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium border backdrop-blur-sm transition-all
            ${demo ? 'bg-amber-500/10 border-amber-400/30 text-amber-600' : nightMode ? 'bg-white/10 border-white/20 text-white/60' : 'bg-white/60 border-slate-200 text-slate-500'}`}>
          <span className={`w-2 h-2 rounded-full ${demo ? 'bg-amber-500' : 'bg-slate-400'}`} />
          {demo ? 'Demo' : 'Live'}
        </button>

        <div className="relative z-10 max-w-xl mx-auto text-center">
          {/* Logo with sun */}
          <div className="flex items-center justify-center gap-2 mb-2.5">
            {nightMode
              ? <div className="moon-anim w-10 h-10 rounded-full bg-gradient-to-br from-slate-300 via-slate-200 to-slate-400 flex-shrink-0" />
              : <div className="sun-anim w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 flex-shrink-0 flex items-center justify-center text-lg">☀️</div>
            }
            <div className={`text-[30px] font-extrabold ${nightMode ? 'text-white' : 'text-slate-800'}`}
              style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-1px' }}>
              FOMO <span className={nightMode ? 'text-amber-400' : 'text-amber-500'}>Sun</span>
            </div>
          </div>

          <p className={`text-[15px] italic ${nightMode ? 'text-slate-400' : 'text-slate-500'}`}
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
            {nightMode ? 'The sun will be back.' : 'Stop chasing clouds. Find sun.'}
          </p>

          {/* Status pills */}
          {data && (
            <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] ${nightMode ? 'bg-white/10 text-slate-400' : 'bg-white/60 backdrop-blur-sm text-slate-500'}`}>
                🕐 {currentTime}
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] ${nightMode ? 'bg-white/10 text-slate-400' : 'bg-white/60 backdrop-blur-sm text-slate-500'}`}>
                <span className="w-[5px] h-[5px] rounded-full bg-slate-400" />
                {origin.name}: {data.origin_conditions.description}
              </span>
              {!data.sunset.is_past && (
                <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] ${nightMode ? 'bg-white/10 text-slate-400' : 'bg-white/60 backdrop-blur-sm text-slate-500'}`}>
                  🌅 Sunset {data.sunset.time} ({fmtMin(data.sunset.minutes_until)})
                </span>
              )}
            </div>
          )}

          {/* FOMO stat */}
          {data && (
            <div className={`mt-4 inline-flex items-center gap-2.5 rounded-xl px-5 py-2.5 shadow-sm ${nightMode ? 'bg-white/10' : 'bg-white'}`}>
              {nightMode ? (
                <>
                  <span className="text-xl">🌤</span>
                  <span className="text-2xl font-bold text-amber-400" style={{ fontFamily: 'Sora' }}>{data.tomorrow_sun_hours}h</span>
                  <span className="text-[11px] text-slate-400 leading-tight text-left">of sun forecast<br />tomorrow</span>
                </>
              ) : (
                <>
                  <span className="text-xl">☀️</span>
                  <span className="text-2xl font-bold text-amber-500" style={{ fontFamily: 'Sora' }}>{data.max_sun_hours_today}h</span>
                  <span className="text-[11px] text-slate-400 leading-tight text-left">of sun today<br />above the fog</span>
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ══════ CONTROLS ══════ */}
      <section className="max-w-xl mx-auto px-4 -mt-7 relative z-20">
        <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-100 overflow-visible">

          {/* Location bar */}
          <div className="px-5 pt-4 pb-2 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 text-[13px]">
              <LocI c="w-[16px] h-[16px] text-amber-500" />
              <span className="font-medium text-slate-700">{origin.name}</span>
              {userLoc && (
                <button onClick={() => setUserLoc(null)} className="text-[10px] text-slate-400 hover:text-slate-600">
                  (reset to Basel)
                </button>
              )}
            </div>
            <button onClick={detectLocation} disabled={locating}
              className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium border transition-all
                ${locating ? 'bg-amber-50 border-amber-200 text-amber-500' : 'bg-white border-slate-200 text-slate-500 hover:border-amber-300 hover:text-amber-600'}`}>
              {locating && <span className="loc-pulse relative w-2 h-2 rounded-full bg-amber-500" />}
              <LocI c="w-3 h-3" />
              {locating ? 'Locating...' : 'Use my location'}
            </button>
          </div>

          {/* Slider */}
          <div className="px-5 pt-2 pb-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-[10px] font-semibold uppercase tracking-[1.2px] text-slate-400">Travel time</span>
              <span className="text-[22px] font-bold text-amber-500 tabular-nums" style={{ fontFamily: 'Sora' }}>{maxH}h</span>
            </div>
            <input type="range" min={1} max={4} step={0.5} value={maxH} onChange={e => setMaxH(parseFloat(e.target.value))} />
            <div className="flex justify-between text-[9px] text-slate-300 mt-1 px-0.5"><span>1h</span><span>2h</span><span>3h</span><span>4h</span></div>
          </div>

          {/* Travel mode - collapsible */}
          <button onClick={() => toggleSetting('mode')} className="setting-toggle w-full flex items-center justify-between px-5 py-3 border-t border-slate-100 cursor-pointer">
            <div className="flex items-center gap-2">
              <CarI c="w-[18px] h-[18px] text-slate-400" />
              <span className="text-[13px] font-medium text-slate-800">Travel mode</span>
              <span className="text-[12px] text-slate-400">{modeLbl[mode]}</span>
            </div>
            <ChevD c={`w-3.5 h-3.5 text-slate-300 transition-transform ${openSetting === 'mode' ? 'rotate-180' : ''}`} />
          </button>
          {openSetting === 'mode' && (
            <div className="px-5 pb-4">
              <div className="flex gap-1.5">
                {([['car','Car',CarI],['train','Train',TrainI],['both','Both',BothI]] as [TravelMode,string,typeof CarI][]).map(([m,l,Icon]) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[12px] font-medium border transition-all
                      ${mode === m ? 'mode-btn-active' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                    <Icon c="w-4 h-4" /> {l}
                  </button>
                ))}
              </div>
              {(mode === 'train' || mode === 'both') && (
                <label className="flex items-center gap-1.5 mt-2.5 text-[11px] text-slate-500 cursor-pointer select-none">
                  <input type="checkbox" checked={ga} onChange={e => setGA(e.target.checked)} className="rounded border-slate-300 accent-amber-500 w-3.5 h-3.5" />
                  I have a GA travelcard
                </label>
              )}
            </div>
          )}

          {/* Filters */}
          <button onClick={() => toggleSetting('filter')} className="setting-toggle w-full flex items-center justify-between px-5 py-3 border-t border-slate-100 cursor-pointer">
            <div className="flex items-center gap-2">
              <FilterI c="w-[18px] h-[18px] text-slate-400" />
              <span className="text-[13px] font-medium text-slate-800">Filters</span>
              <span className="text-[12px] text-slate-400">{filterSummary}</span>
            </div>
            <ChevD c={`w-3.5 h-3.5 text-slate-300 transition-transform ${openSetting === 'filter' ? 'rotate-180' : ''}`} />
          </button>
          {openSetting === 'filter' && (
            <div className="px-5 pb-4">
              <div className="flex flex-wrap gap-1.5">
                {TYPES.map(t => (
                  <button key={t.id} onClick={() => toggleType(t.id)}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-medium border-[1.5px] transition-all select-none ${types.includes(t.id) ? 'chip-active' : 'chip-inactive'}`}>
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
            <div className="sun-anim w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 mx-auto flex items-center justify-center text-lg">☀️</div>
            <p className="mt-4 text-sm text-slate-400">Finding sunshine...</p>
          </div>
        ) : data?.escapes?.length ? (
          <>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[16px] font-bold text-slate-800" style={{ fontFamily: 'Sora', letterSpacing: '-0.3px' }}>
                {nightMode ? 'Tomorrow\'s sunny escapes' : 'Your sunny escapes'}
              </h2>
              <span className="text-[11px] text-slate-400">{data.escapes.length} found</span>
            </div>

            <div className="space-y-2.5">
              {data.escapes.map((e, i) => (
                <div key={e.destination.id} className={`escape-card anim-in d${Math.min(i + 1, 5)} cursor-pointer rounded-[14px] border border-slate-100`}
                  onClick={() => { setOpenCard(openCard === i ? null : i); setScorePopup(null) }}>
                  <div className="p-3.5 sm:p-4 flex gap-3 items-start">
                    {/* FOMOscore with popup - properly positioned */}
                    <div className="score-wrap" onClick={ev => ev.stopPropagation()}>
                      <ScoreRing score={e.sun_score.score} onTap={() => setScorePopup(scorePopup === i ? null : i)} />
                      {scorePopup === i && (
                        <div className="score-popup">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className="text-sm">☀️</span>
                            <span className="text-[13px] font-bold text-amber-500">{Math.round(e.sun_score.score * 100)}% FOMOscore</span>
                          </div>
                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            Expected share of clear-sky daylight at this destination. Higher = more sunshine, fewer clouds.
                          </p>
                          <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-400">
                            <span>☀️ {e.sun_score.sunshine_forecast_min} min sunshine</span>
                            <span>·</span>
                            <span>☁️ {e.sun_score.low_cloud_cover_pct}% cloud</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[11px]">{FLAG[e.destination.country]}</span>
                        <span className="font-semibold text-[14px] text-slate-800">{e.destination.name}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">{e.destination.region} · {e.destination.altitude_m.toLocaleString()} m</p>

                      {/* Inline sunshine info with comparison */}
                      <p className="text-[10.5px] text-amber-600/90 mt-1 leading-snug font-medium">
                        ☀️ {e.conditions}
                      </p>

                      <div className="flex gap-2.5 mt-1.5">
                        {e.travel.car && (
                          <span className="flex items-start gap-1 text-[11px] text-slate-500">
                            <CarI c="w-[13px] h-[13px] text-slate-400 mt-0.5" />
                            <strong className="text-slate-700">{e.travel.car.duration_min} min</strong>
                          </span>
                        )}
                        {e.travel.train && (
                          <span className="flex items-start gap-1 text-[11px] text-slate-500">
                            <TrainI c="w-[13px] h-[13px] text-slate-400 mt-0.5" />
                            <strong className="text-slate-700">{e.travel.train.duration_min} min</strong>
                            {e.travel.train.changes !== undefined && <span className="text-slate-300">{e.travel.train.changes}×</span>}
                            {e.travel.train.ga_included && <span className="text-[8px] bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded font-semibold">GA</span>}
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevD c={`w-3.5 h-3.5 text-slate-300 flex-shrink-0 self-center transition-transform ${openCard === i ? 'rotate-180' : ''}`} />
                  </div>

                  {e.sun_timeline && <SunBar timeline={e.sun_timeline} demo={demo} />}

                  {/* Expanded detail */}
                  {openCard === i && (
                    <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-3.5 anim-in rounded-b-[14px]">
                      <p className="text-[9px] font-semibold uppercase tracking-[1.2px] text-slate-400 mb-2">Trip plan</p>
                      <div className="space-y-1.5">
                        {e.plan.map((step, j) => (
                          <div key={j} className="flex gap-2 items-start">
                            <span className="flex-shrink-0 w-[18px] h-[18px] rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[9px] font-bold mt-0.5">{j+1}</span>
                            <span className="text-[12px] text-slate-500 leading-snug">{step}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-1.5 mt-3">
                        {e.links.google_maps && (
                          <a href={e.links.google_maps} target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-800 text-white text-[11px] font-semibold hover:bg-slate-700 transition-colors">
                            <MapI /> Navigate
                          </a>
                        )}
                        {e.links.sbb && (
                          <a href={e.links.sbb} target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-red-600 text-white text-[11px] font-semibold hover:bg-red-500 transition-colors">
                            <TrainI c="w-3.5 h-3.5" /> SBB
                          </a>
                        )}
                        {e.links.webcam && (
                          <a href={e.links.webcam} target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()}
                            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white text-slate-500 border border-slate-200 text-[11px] font-semibold hover:bg-slate-50 transition-colors">
                            <CamI /> Webcam
                          </a>
                        )}
                      </div>
                      <button onClick={ev => {
                          ev.stopPropagation()
                          navigator.clipboard?.writeText(`☀️ ${e.destination.name} (${e.destination.region})\nFOMOscore: ${Math.round(e.sun_score.score*100)}%\n${e.conditions}\n${e.plan.join(' > ')}\n\nfomosun.com`)
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
