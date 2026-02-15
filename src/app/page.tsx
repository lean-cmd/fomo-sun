'use client'

import { useState, useEffect, useCallback } from 'react'
import { SunnyEscapesResponse, TravelMode, DestinationType, SunTimeline } from '@/lib/types'

// ── Icons ─────────────────────────────────────────────────────────────
const CarI = ({ c = 'w-4 h-4' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 0 1-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 0 0-3.213-9.193 2.056 2.056 0 0 0-1.58-.86H14.25M3.375 14.25V5.625m0 0h4.5m-4.5 0H3.375" /></svg>
const TrainI = ({ c = 'w-4 h-4' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-18v18M3.6 9h16.8M3.6 15h16.8" /></svg>
const BothI = ({ c = 'w-4 h-4' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg>
const FilterI = ({ c = 'w-4 h-4' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3c2.755 0 5.455.232 8.083.678.533.09.917.556.917 1.096v1.044a2.25 2.25 0 0 1-.659 1.591l-5.432 5.432a2.25 2.25 0 0 0-.659 1.591v2.927a2.25 2.25 0 0 1-1.244 2.013L9.75 21v-6.568a2.25 2.25 0 0 0-.659-1.591L3.659 7.409A2.25 2.25 0 0 1 3 5.818V4.774c0-.54.384-1.006.917-1.096A48.32 48.32 0 0 1 12 3Z" /></svg>
const MapI = ({ c = 'w-3.5 h-3.5' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" /></svg>
const CamI = ({ c = 'w-3.5 h-3.5' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0Z" /></svg>
const ChevD = ({ c = 'w-3.5 h-3.5' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
const LocI = ({ c = 'w-4 h-4' }: { c?: string }) => <svg className={c} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
const WaIcon = ({ c = 'w-3 h-3' }: { c?: string }) => <svg className={c} viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.625.846 5.059 2.284 7.034L.789 23.492a.5.5 0 00.612.616l4.573-1.46A11.942 11.942 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-2.239 0-4.326-.726-6.02-1.956a.5.5 0 00-.417-.07l-3.063.978.998-3.003a.5.5 0 00-.063-.426A9.946 9.946 0 012 12C2 6.486 6.486 2 12 2s10 4.486 10 10-4.486 10-10 10z"/></svg>

const FLAG: Record<string, string> = { CH: '🇨🇭', DE: '🇩🇪', FR: '🇫🇷' }
const TYPES: { id: DestinationType; label: string }[] = [
  { id: 'nature', label: 'Nature' }, { id: 'viewpoint', label: 'Views' }, { id: 'town', label: 'Town' },
  { id: 'lake', label: 'Lake' }, { id: 'family', label: 'Family' }, { id: 'food', label: 'Food & Wine' }, { id: 'thermal', label: 'Thermal' },
]
const modeLbl: Record<TravelMode, string> = { car: 'Car', train: 'Train', both: 'Car + Train' }
function fmtMin(m: number) { const h = Math.floor(m / 60); return h > 0 ? `${h}h ${m % 60}m` : `${m}m` }
function fmtTravelHours(h: number) {
  const hh = Math.floor(h)
  const mm = Math.round((h - hh) * 60)
  if (mm === 0) return `${hh}h`
  return `${hh}h ${mm}m`
}

type EscapeCard = SunnyEscapesResponse['escapes'][number]

// ── FOMOscore Ring ────────────────────────────────────────────────────
function ScoreRing({ score, size = 48, onTap }: { score: number; size?: number; onTap?: () => void }) {
  const pct = Math.round(score * 100), r = (size - 8) / 2, circ = 2 * Math.PI * r
  return (
    <button onClick={e => { e.stopPropagation(); onTap?.() }} aria-label={`FOMOscore ${pct}%`}
      className="relative flex-shrink-0 cursor-pointer" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={4} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f59e0b" strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - score)} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-[13px] font-bold text-slate-800" style={{ fontFamily: 'Sora' }}>{pct}</span>
        <span className="text-[6px] font-bold text-amber-500 uppercase tracking-wider mt-[1px]">fomo</span>
      </span>
    </button>
  )
}

// ── Mini Score Ring for hero trust cards ──────────────────────────────
function MiniRing({ score, size = 36, stroke: strokeColor = '#f59e0b' }: { score: number; size?: number; stroke?: string }) {
  const pct = Math.round(score * 100), r = (size - 6) / 2, circ = 2 * Math.PI * r
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={3} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={strokeColor} strokeWidth={3}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - score)} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="text-[10px] font-bold text-slate-700" style={{ fontFamily: 'Sora' }}>{pct}</span>
      </span>
    </div>
  )
}

// ── Timeline Bar ──────────────────────────────────────────────────────
function SunBar({ timeline, demo, label }: { timeline: SunTimeline; demo: boolean; label?: string }) {
  const h = demo ? 10.17 : new Date().getHours() + new Date().getMinutes() / 60
  const nowPct = Math.max(0, Math.min(85, ((h - 8) / 10) * 85))
  return (
    <div className="space-y-1">
      {(['today', 'tomorrow'] as const).map(day => (
        <div key={day} className="flex items-center gap-1.5">
          <span className="text-[9px] text-slate-400 w-[44px] text-right flex-shrink-0 font-medium capitalize">
            {day === 'today' && label ? label : day}
          </span>
          <div className="tl-bar">
            {timeline[day].map((seg, i) => (
              <div key={i} className={`h-full tl-${seg.condition}`} style={{ width: `${seg.pct}%` }} />
            ))}
            {day === 'today' && h >= 8 && h <= 18 && <div className="tl-now" style={{ left: `${nowPct}%` }} />}
          </div>
        </div>
      ))}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
export default function Home() {
  const [maxH, setMaxH] = useState(2)
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
  const [hasSetOptimal, setHasSetOptimal] = useState(false)
  const [optimalHint, setOptimalHint] = useState(false)
  const [optimalH, setOptimalH] = useState<number | null>(null)

  const night = data ? data.sunset.is_past && !demo : false
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
      const d: SunnyEscapesResponse = await res.json()
      setData(d)
      if (!hasSetOptimal && d.optimal_travel_h) {
        const normalizedOpt = Math.round(Math.min(4.5, Math.max(1, d.optimal_travel_h)) * 4) / 4
        setMaxH(normalizedOpt)
        setOptimalH(normalizedOpt)
        setHasSetOptimal(true)
        setOptimalHint(true)
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [maxH, mode, ga, types, demo, origin.lat, origin.lon, hasSetOptimal])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (scorePopup === null) return
    const h = () => setScorePopup(null)
    document.addEventListener('click', h); return () => document.removeEventListener('click', h)
  }, [scorePopup])
  useEffect(() => {
    if (!optimalHint) return
    const t = setTimeout(() => setOptimalHint(false), 2200)
    return () => clearTimeout(t)
  }, [optimalHint])

  const detectLocation = async () => {
    if (!navigator.geolocation) return
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&count=1&language=en&format=json`)
          const d = await r.json()
          setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: d?.results?.[0]?.name || `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}` })
        } catch { setUserLoc({ lat: pos.coords.latitude, lon: pos.coords.longitude, name: `${pos.coords.latitude.toFixed(2)}, ${pos.coords.longitude.toFixed(2)}` }) }
        setLocating(false); setHasSetOptimal(false); setOptimalH(null)
      },
      () => setLocating(false), { enableHighAccuracy: false, timeout: 8000 }
    )
  }

  const toggleType = (t: DestinationType) => setTypes(p => p.includes(t) ? p.filter(x => x !== t) : [...p, t])
  const toggleSetting = (id: string) => setOpenSetting(p => p === id ? null : id)
  const filterSummary = types.length === 0 ? 'All types' : types.length <= 2 ? types.map(t => TYPES.find(x => x.id === t)?.label).join(', ') : `${types.length} selected`
  const currentTime = demo ? '10:10' : new Date().toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
  const markerOptH = optimalH ?? data?.optimal_travel_h ?? 2.5
  const optPct = ((markerOptH - 1) / 3.5) * 100
  const topEscape = data?.escapes?.[0] ?? null
  const originFomoPct = data ? Math.round(data.origin_conditions.sun_score * 100) : 0
  const originSunMin = data?.origin_conditions.sunshine_min ?? 0
  const topSunMin = topEscape?.sun_score.sunshine_forecast_min ?? 0
  const sunGainMin = Math.max(0, topSunMin - originSunMin)
  const sunGainPct = originSunMin > 0 ? Math.round((sunGainMin / originSunMin) * 100) : 0
  const sunsetLine = data
    ? data.sunset.is_past
      ? `Sunset already passed`
      : `Sunset ${data.sunset.time} (${fmtMin(data.sunset.minutes_until)})`
    : ''
  const windowMinH = Math.max(0.5, maxH - 0.5)
  const windowMaxH = maxH + 0.5
  const topTravelMin = topEscape
    ? Math.min(topEscape.travel.car?.duration_min ?? Infinity, topEscape.travel.train?.duration_min ?? Infinity)
    : Infinity
  const topTravelText = Number.isFinite(topTravelMin) ? fmtMin(topTravelMin) : 'n/a'

  // v15: WhatsApp share includes fomosun.com link for virality
  const buildWhatsAppHref = (escape: EscapeCard) => {
    const bestTravelMin = Math.min(escape.travel.car?.duration_min ?? Infinity, escape.travel.train?.duration_min ?? Infinity)
    const bestTravel = Number.isFinite(bestTravelMin) ? fmtMin(bestTravelMin) : 'n/a'
    const shareText = [
      `☀️ FOMO Sun: escape the fog!`,
      ``,
      `${origin.name} (${originFomoPct}%) → ${escape.destination.name} (${Math.round(escape.sun_score.score * 100)}%)`,
      `${bestTravel} away · ${escape.conditions}`,
      ``,
      `Plan: ${escape.plan[0]}`,
      escape.links.google_maps || '',
      ``,
      `Find your sunny escape: https://fomosun.com`,
    ].filter(Boolean).join('\n')
    return `https://wa.me/?text=${encodeURIComponent(shareText)}`
  }
  const topWhatsAppHref = topEscape ? buildWhatsAppHref(topEscape) : '#'

  return (
    <div className={night ? 'night' : ''}>
      {/* ══════ HERO ══════ */}
      <section className={`${night ? 'hero-night' : 'hero-day'} pt-7 sm:pt-8 pb-12 sm:pb-14 px-4 relative`}>
        {!night && <>
          <div className="fog-w1 absolute top-10 left-0 w-full h-8 bg-gradient-to-r from-transparent via-slate-400/[.18] to-transparent rounded-full blur-[18px] pointer-events-none" />
          <div className="fog-w2 absolute top-[60px] left-[8%] w-4/5 h-6 bg-gradient-to-r from-transparent via-slate-400/[.12] to-transparent rounded-full blur-[14px] pointer-events-none" />
        </>}

        <button onClick={() => { setDemo(!demo); setHasSetOptimal(false); setOptimalH(null) }}
          className={`absolute top-3 right-3 z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium border backdrop-blur-sm transition-all
            ${demo ? 'bg-amber-500/10 border-amber-400/30 text-amber-600' : night ? 'bg-white/10 border-white/20 text-white/60' : 'bg-white/60 border-slate-200 text-slate-500'}`}>
          <span className={`w-2 h-2 rounded-full ${demo ? 'bg-amber-500' : 'bg-slate-400'}`} />
          {demo ? 'Demo' : 'Live'}
        </button>

        <div className="relative z-10 max-w-xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            {night
              ? <div className="moon-anim w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-slate-300 via-slate-200 to-slate-400 flex-shrink-0" />
              : <div className="sun-anim w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 flex-shrink-0" />
            }
            <div className={`text-[25px] sm:text-[28px] font-extrabold ${night ? 'text-white' : 'text-slate-800'}`}
              style={{ fontFamily: 'Sora', letterSpacing: '-1px' }}>
              FOMO <span className={night ? 'text-amber-400' : 'text-amber-500'}>Sun</span>
            </div>
          </div>

          <p className={`text-[14px] sm:text-[15px] italic ${night ? 'text-slate-400' : 'text-slate-500'}`}
            style={{ fontFamily: 'Playfair Display, Georgia, serif' }}>
            {night ? 'Plan tomorrow\'s escape ☀️' : 'Stop chasing clouds. Find sun. ☀️'}
          </p>

          {/* v15: Trust split cards with FOMO score rings + integrated WhatsApp */}
          {data && topEscape && (
            <div className="mt-3 sm:mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-left">
              {/* Origin / Fog card */}
              <div className={`rounded-xl px-3 py-2.5 ${night ? 'bg-white/10' : 'bg-white/75 backdrop-blur-sm'}`}>
                <div className="flex items-start gap-2.5">
                  <MiniRing score={data.origin_conditions.sun_score} size={36} stroke="#94a3b8" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[8.5px] sm:text-[9px] uppercase tracking-[1px] font-semibold ${night ? 'text-slate-400' : 'text-slate-500'}`}>Now in {origin.name}</p>
                    <p className={`text-[11px] sm:text-[12px] mt-0.5 font-medium ${night ? 'text-slate-200' : 'text-slate-700'}`}>{data.origin_conditions.description}</p>
                    <p className={`text-[9px] sm:text-[9.5px] mt-0.5 ${night ? 'text-slate-500' : 'text-slate-400'}`}>{currentTime} · {sunsetLine}</p>
                    <p className={`text-[9px] sm:text-[9.5px] mt-0.5 ${night ? 'text-slate-500' : 'text-slate-400'}`}>
                      Forecast: {origin.name} · {data.origin_conditions.sunshine_min} min sun · FOMO {originFomoPct}%
                    </p>
                    <p className={`text-[8.5px] sm:text-[9px] mt-0.5 ${night ? 'text-slate-600' : 'text-slate-400'}`}>
                      Up to {data.max_sun_hours_today}h above fog today
                    </p>
                  </div>
                </div>
                {data.origin_timeline && (
                  <div className={`mt-2 rounded-md px-2.5 py-2 ${night ? 'bg-white/5' : 'bg-white/70'}`}>
                    <SunBar timeline={data.origin_timeline} demo={demo} />
                  </div>
                )}
              </div>

              {/* Best escape card */}
              <div className={`rounded-xl px-3 py-2.5 ${night ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50/80 border border-amber-200/50 backdrop-blur-sm'}`}>
                <div className="flex items-start gap-2.5">
                  <MiniRing score={topEscape.sun_score.score} size={36} stroke="#f59e0b" />
                  <div className="flex-1 min-w-0">
                    <p className={`text-[8.5px] sm:text-[9px] uppercase tracking-[1px] font-semibold ${night ? 'text-amber-400/80' : 'text-amber-700/70'}`}>Best escape now</p>
                    <p className={`text-[11px] sm:text-[12px] mt-0.5 font-semibold ${night ? 'text-white' : 'text-slate-800'}`}>
                      {topEscape.destination.name}
                    </p>
                    <p className={`text-[9px] sm:text-[9.5px] mt-0.5 ${night ? 'text-slate-400' : 'text-slate-500'}`}>{topTravelText} · {topEscape.destination.region}</p>
                    <p className="mt-1">
                      {sunGainMin > 0 ? (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[8.5px] sm:text-[9px] font-semibold ${night ? 'bg-emerald-500/20 text-emerald-300' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                          +{sunGainMin} min ({sunGainPct}%) vs {origin.name}
                        </span>
                      ) : (
                        <span className={`text-[8.5px] sm:text-[9px] ${night ? 'text-slate-500' : 'text-slate-500'}`}>
                          Best confidence option in this travel window
                        </span>
                      )}
                    </p>
                    <a href={topWhatsAppHref} target="_blank" rel="noopener noreferrer"
                      className={`wa-btn mt-1.5 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[8.5px] sm:text-[9px] font-semibold transition-all ${night ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30' : 'bg-white text-emerald-700 shadow-sm hover:shadow'}`}>
                      <WaIcon c="w-3 h-3" /> Share this escape
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* ══════ CONTROLS ══════ */}
      <section className="max-w-xl mx-auto px-4 -mt-6 sm:-mt-7 relative z-20">
        <div className={`rounded-2xl shadow-lg border overflow-visible ${night ? 'bg-slate-800 border-slate-700 shadow-black/20' : 'bg-white border-slate-100 shadow-slate-200/50'}`}>

          <div className="px-4 sm:px-5 pt-3.5 sm:pt-4 pb-2 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 text-[13px]">
              <LocI c="w-[16px] h-[16px] text-amber-500" />
              <span className={`font-medium ${night ? 'text-slate-200' : 'text-slate-700'}`}>{origin.name}</span>
              {userLoc && <button onClick={() => { setUserLoc(null); setHasSetOptimal(false) }} className="text-[10px] text-slate-400 hover:text-slate-600">(reset)</button>}
            </div>
            <button onClick={detectLocation} disabled={locating}
              className={`relative flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-medium border transition-all
                ${locating ? 'bg-amber-50 border-amber-200 text-amber-500' : night ? 'bg-slate-700 border-slate-600 text-slate-300' : 'bg-white border-slate-200 text-slate-500 hover:border-amber-300'}`}>
              {locating && <span className="loc-pulse relative w-2 h-2 rounded-full bg-amber-500" />}
              <LocI c="w-3 h-3" /> {locating ? 'Locating...' : 'Use my location'}
            </button>
          </div>

          <div className="px-4 sm:px-5 pt-2 pb-3.5 sm:pb-4">
            <div className="flex justify-between items-baseline mb-2">
              <span className={`text-[10px] font-semibold uppercase tracking-[1.2px] ${night ? 'text-slate-500' : 'text-slate-400'}`}>Travel time</span>
              <span className="text-[20px] sm:text-[22px] font-bold text-amber-500 tabular-nums" style={{ fontFamily: 'Sora' }}>{fmtTravelHours(maxH)}</span>
            </div>
            <div className="relative">
              <input type="range" min={1} max={4.5} step={0.25} value={maxH} onChange={e => setMaxH(parseFloat(e.target.value))} />
              {data && <div className={`opt-mark ${optimalHint ? 'opt-pop' : ''}`} style={{ left: `${optPct}%` }} />}
            </div>
            {!night && (
              <div className="mt-1 inline-flex items-center rounded-full px-2.5 py-1 text-[8.5px] sm:text-[9px] bg-sky-50 text-sky-700 border border-sky-100">
                Active window: {fmtTravelHours(windowMinH)} to {fmtTravelHours(windowMaxH)} (±30m)
              </div>
            )}
            {!night && (
              <div className="mt-1.5 flex items-center justify-between text-[8.5px] sm:text-[9px] text-slate-400">
                <span>Less time</span><span className="font-medium text-slate-500">Net sun optimized</span><span>More options</span>
              </div>
            )}
            {optimalHint && !night && (
              <p className="mt-1 text-[10px] text-sky-600 font-medium">Auto-jumped to optimal net-sun range</p>
            )}
            <div className={`flex justify-between text-[8.5px] sm:text-[9px] mt-1 px-0.5 ${night ? 'text-slate-600' : 'text-slate-300'}`}>
              <span>1h</span><span>2h</span><span>3h</span><span>4h</span><span>4h 30m</span>
            </div>
          </div>

          <button onClick={() => toggleSetting('mode')} className={`setting-toggle w-full flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 border-t cursor-pointer ${night ? 'border-slate-700' : 'border-slate-100'}`}>
            <div className="flex items-center gap-2">
              <CarI c={`w-[18px] h-[18px] ${night ? 'text-slate-500' : 'text-slate-400'}`} />
              <span className={`text-[13px] font-medium ${night ? 'text-slate-200' : 'text-slate-800'}`}>Travel mode</span>
              <span className={`text-[12px] ${night ? 'text-slate-500' : 'text-slate-400'}`}>{modeLbl[mode]}</span>
            </div>
            <ChevD c={`w-3.5 h-3.5 ${night ? 'text-slate-600' : 'text-slate-300'} transition-transform ${openSetting === 'mode' ? 'rotate-180' : ''}`} />
          </button>
          {openSetting === 'mode' && (
            <div className="px-5 pb-4">
              <div className="flex gap-1.5">
                {([['car','Car',CarI],['train','Train',TrainI],['both','Both',BothI]] as [TravelMode,string,typeof CarI][]).map(([m,l,Ic]) => (
                  <button key={m} onClick={() => setMode(m)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-[12px] font-medium border transition-all
                      ${mode === m ? 'mode-btn-active' : night ? 'bg-slate-700 text-slate-300 border-slate-600' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'}`}>
                    <Ic c="w-4 h-4" /> {l}
                  </button>
                ))}
              </div>
              {(mode === 'train' || mode === 'both') && (
                <label className={`flex items-center gap-1.5 mt-2.5 text-[11px] cursor-pointer select-none ${night ? 'text-slate-400' : 'text-slate-500'}`}>
                  <input type="checkbox" checked={ga} onChange={e => setGA(e.target.checked)} className="rounded border-slate-300 accent-amber-500 w-3.5 h-3.5" />
                  I have a GA travelcard
                </label>
              )}
            </div>
          )}

          <button onClick={() => toggleSetting('filter')} className={`setting-toggle w-full flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 border-t cursor-pointer ${night ? 'border-slate-700' : 'border-slate-100'}`}>
            <div className="flex items-center gap-2">
              <FilterI c={`w-[18px] h-[18px] ${night ? 'text-slate-500' : 'text-slate-400'}`} />
              <span className={`text-[13px] font-medium ${night ? 'text-slate-200' : 'text-slate-800'}`}>Filters</span>
              <span className={`text-[12px] ${night ? 'text-slate-500' : 'text-slate-400'}`}>{filterSummary}</span>
            </div>
            <ChevD c={`w-3.5 h-3.5 ${night ? 'text-slate-600' : 'text-slate-300'} transition-transform ${openSetting === 'filter' ? 'rotate-180' : ''}`} />
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
      <section className="max-w-xl mx-auto px-4 mt-4 sm:mt-5 pb-14 sm:pb-16">
        <p className={`text-[11px] sm:text-[12px] font-medium mb-2 ${night ? 'text-slate-500' : 'text-slate-500'}`}>Fine tune & discover more escapes</p>
        {loading ? (
          <div className="text-center py-16">
            <div className="sun-anim w-10 h-10 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 mx-auto" />
            <p className={`mt-4 text-sm ${night ? 'text-slate-500' : 'text-slate-400'}`}>Finding sunshine...</p>
          </div>
        ) : data?.escapes?.length ? (
          <>
            <div className="flex items-baseline justify-between mb-3">
              <h2 className={`text-[16px] font-bold ${night ? 'text-white' : 'text-slate-800'}`} style={{ fontFamily: 'Sora', letterSpacing: '-0.3px' }}>
                {night ? 'Tomorrow\'s sunny escapes' : 'Your sunny escapes'}
              </h2>
              <span className={`text-[11px] ${night ? 'text-slate-500' : 'text-slate-400'}`}>{data.escapes.length} found</span>
            </div>

            <div className="space-y-2">
              {data.escapes.map((e, i) => (
                <div key={e.destination.id}
                  className={`escape-card anim-in d${Math.min(i+1,5)} cursor-pointer rounded-[14px] border ${night ? 'bg-slate-800 border-slate-700' : 'border-slate-100'}`}
                  onClick={() => { setOpenCard(openCard === i ? null : i); setScorePopup(null) }}>
                  <div className="p-3 sm:p-4 flex gap-2.5 sm:gap-3 items-start">
                    <div className="score-wrap" onClick={ev => ev.stopPropagation()}>
                      <ScoreRing score={e.sun_score.score} onTap={() => setScorePopup(scorePopup === i ? null : i)} />
                      {scorePopup === i && (
                        <div className="score-popup">
                          <p className="text-[11px] font-semibold text-amber-500">{Math.round(e.sun_score.score * 100)}% FOMOscore</p>
                          <p className="text-[10px] text-slate-500 mt-0.5">Clear-sky daylight expected.</p>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-[11px]">{FLAG[e.destination.country]}</span>
                        <span className={`font-semibold text-[13.5px] sm:text-[14px] ${night ? 'text-white' : 'text-slate-800'}`}>{e.destination.name}</span>
                      </div>
                      <p className={`text-[10.5px] sm:text-[11px] mt-0.5 ${night ? 'text-slate-500' : 'text-slate-400'}`}>{e.destination.region} · {e.destination.altitude_m.toLocaleString()} m</p>
                      <p className="text-[10px] sm:text-[10.5px] text-amber-600/90 mt-1 leading-snug font-medium">☀️ {e.conditions}</p>
                      {night && (
                        <p className="text-[9px] sm:text-[9.5px] text-amber-500/70 mt-0.5">Tomorrow: {e.tomorrow_sun_hours}h of sun forecast</p>
                      )}
                      {/* v15: removed globe/net-sun-min line -- was confusing for users */}
                      <div className="flex items-center gap-2.5 mt-1.5">
                        {e.travel.car && <span className={`flex items-center gap-1 text-[11px] ${night ? 'text-slate-400' : 'text-slate-500'}`}><CarI c="w-[13px] h-[13px] text-slate-400" /><strong className={night ? 'text-slate-300' : 'text-slate-700'}>{e.travel.car.duration_min} min</strong></span>}
                        {e.travel.train && <span className={`flex items-center gap-1 text-[11px] ${night ? 'text-slate-400' : 'text-slate-500'}`}><TrainI c="w-[13px] h-[13px] text-slate-400" /><strong className={night ? 'text-slate-300' : 'text-slate-700'}>{e.travel.train.duration_min} min</strong>{e.travel.train.changes !== undefined && <span className="text-slate-400">{e.travel.train.changes}×</span>}{e.travel.train.ga_included && <span className="text-[8px] bg-emerald-50 text-emerald-600 px-1 py-0.5 rounded font-semibold">GA</span>}</span>}
                      </div>
                      {/* v15: WhatsApp button with icon, visually integrated */}
                      <div className="mt-2">
                        <a href={buildWhatsAppHref(e)} target="_blank" rel="noopener noreferrer"
                          onClick={ev => ev.stopPropagation()}
                          className={`wa-btn inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[9px] font-semibold transition-all ${night ? 'bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25' : 'bg-white text-emerald-700 shadow-sm border border-emerald-100 hover:shadow hover:border-emerald-200'}`}>
                          <WaIcon c="w-3 h-3" /> Share via WhatsApp
                        </a>
                      </div>
                    </div>
                    <ChevD c={`w-3.5 h-3.5 flex-shrink-0 self-center transition-transform ${night ? 'text-slate-600' : 'text-slate-300'} ${openCard === i ? 'rotate-180' : ''}`} />
                  </div>

                  {/* v15: timeline bars always visible, improved colors in CSS */}
                  <div className="px-4 pb-3">
                    {e.sun_timeline && <SunBar timeline={e.sun_timeline} demo={demo} />}
                    <div className="flex justify-between text-[8px] text-slate-300 pl-[50px] mt-0.5">
                      <span>8</span><span>10</span><span>12</span><span>14</span><span>16</span><span>18</span>
                    </div>
                  </div>

                  {openCard === i && (
                    <div className={`border-t px-4 py-3.5 anim-in rounded-b-[14px] ${night ? 'border-slate-700 bg-slate-900/50' : 'border-slate-100 bg-slate-50/50'}`}>
                      <p className={`text-[9px] font-semibold uppercase tracking-[1.2px] mb-2 ${night ? 'text-slate-500' : 'text-slate-400'}`}>Trip plan</p>
                      <div className="space-y-1.5">
                        {e.plan.map((step, j) => (
                          <div key={j} className="flex gap-2 items-start">
                            <span className="flex-shrink-0 w-[18px] h-[18px] rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[9px] font-bold mt-0.5">{j+1}</span>
                            <span className={`text-[12px] leading-snug ${night ? 'text-slate-400' : 'text-slate-500'}`}>{step}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-1.5 mt-3">
                        {e.links.google_maps && <a href={e.links.google_maps} target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-slate-800 text-white text-[11px] font-semibold hover:bg-slate-700 transition-colors"><MapI /> Navigate</a>}
                        {e.links.sbb && <a href={e.links.sbb} target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-red-600 text-white text-[11px] font-semibold hover:bg-red-500 transition-colors"><TrainI c="w-3.5 h-3.5" /> SBB</a>}
                        {e.links.webcam && <a href={e.links.webcam} target="_blank" rel="noopener noreferrer" onClick={ev => ev.stopPropagation()} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg bg-white text-slate-500 border border-slate-200 text-[11px] font-semibold hover:bg-slate-50 transition-colors"><CamI /> Webcam</a>}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-16">
            <p className={`text-base mb-1 ${night ? 'text-slate-400' : 'text-slate-500'}`}>No sunny escapes found</p>
            <p className={`text-xs ${night ? 'text-slate-600' : 'text-slate-400'}`}>Try increasing travel time or removing filters</p>
          </div>
        )}
      </section>
    </div>
  )
}
