'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { ChevronDown } from 'lucide-react'
import { MAP_ORIGIN_CITIES, type MapDay, type OriginSeed } from '@/components/SunMap'

const SunMap = dynamic(() => import('@/components/SunMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-slate-100" />
  ),
})

function FomoGlyph({ className = 'w-[42px] h-3.5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 38 16" className={className} aria-label="FOMO logo" role="img">
      <g fill="#334155" className="fomo-wordmark-letters">
        <text x="0.2" y="12.3" fontSize="11.6">F</text>
        <text x="13.2" y="12.3" fontSize="11.6">M</text>
      </g>
      <g fill="#f59e0b" stroke="#f59e0b" strokeLinecap="round" strokeWidth="1">
        <circle cx="7.8" cy="7.9" r="2.6" />
        <path d="M7.8 2.2v1.4M7.8 12.2v1.4M2.5 7.9h1.4M11.7 7.9h1.4M4 4.2l0.9 0.9M10.7 10.9l0.9 0.9M11.6 4.2l-0.9 0.9M4.9 10.9l-0.9 0.9" />
        <circle cx="24.4" cy="7.9" r="2.6" />
        <path d="M24.4 2.2v1.4M24.4 12.2v1.4M19.1 7.9h1.4M28.3 7.9h1.4M20.6 4.2l0.9 0.9M27.3 10.9l0.9 0.9M28.2 4.2l-0.9 0.9M21.5 10.9l-0.9 0.9" />
      </g>
    </svg>
  )
}

function FomoWordmark({ className = 'w-[118px] h-[26px]' }: { className?: string }) {
  return <FomoGlyph className={className} />
}

export default function MapPageClient({
  initialOrigin,
  initialDay,
}: {
  initialOrigin: OriginSeed
  initialDay: MapDay
}) {
  const [origin, setOrigin] = useState<OriginSeed>(initialOrigin)
  const [mapDay, setMapDay] = useState<MapDay>(initialDay)

  const cityOptions = useMemo(() => {
    const byName = new Map<string, OriginSeed>(MAP_ORIGIN_CITIES.map(item => [item.name, item]))
    if (!byName.has(origin.name)) byName.set(origin.name, origin)
    return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [origin])

  return (
    <div className="min-h-screen fomo-warm-bg fomo-grid-bg">
      <header className="fomo-page-header sticky top-0 z-40 backdrop-blur">
        <div className="max-w-xl mx-auto px-3 h-[62px] grid grid-cols-[1fr_auto_1fr] items-center">
          <div className="min-w-0">
            <div className="relative inline-flex items-center min-w-0 max-w-[120px] text-slate-500">
              <select
                value={origin.name}
                onChange={(event) => {
                  const selected = cityOptions.find(city => city.name === event.target.value)
                  if (!selected) return
                  setOrigin(selected)
                }}
                className="h-7 pl-1 pr-5 bg-transparent text-[11px] font-medium text-right text-slate-500 appearance-none focus:outline-none focus:text-slate-700 cursor-pointer"
                aria-label="Select origin city"
              >
                {cityOptions.map(city => (
                  <option key={city.name} value={city.name}>{city.name}</option>
                ))}
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center pointer-events-none">
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.8} />
              </div>
            </div>
          </div>

          <div className="relative justify-self-center flex items-center h-full">
            <FomoWordmark className="w-[94px] h-[24px]" />
            <p className="absolute left-1/2 -translate-x-1/2 top-[42px] text-[10px] uppercase tracking-[0.13em] text-slate-500 font-semibold whitespace-nowrap text-center">
              Sun map
              <sup className="ml-0.5 align-super text-[7px] tracking-[0.08em]">TM</sup>
            </p>
          </div>

          <div className="flex justify-end items-center">
            <div className="inline-flex items-center gap-1 text-[10.5px]">
              <button
                onClick={() => setMapDay('today')}
                className={`px-1 py-0.5 transition ${mapDay === 'today' ? 'text-slate-800 font-semibold underline decoration-amber-300 decoration-2 underline-offset-4' : 'text-slate-500 font-medium hover:text-slate-700'}`}
              >
                Today
              </button>
              <span className="text-slate-300">/</span>
              <button
                onClick={() => setMapDay('tomorrow')}
                className={`px-1 py-0.5 transition ${mapDay === 'tomorrow' ? 'text-slate-800 font-semibold underline decoration-amber-300 decoration-2 underline-offset-4' : 'text-slate-500 font-medium hover:text-slate-700'}`}
              >
                Tomorrow
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl px-3 pb-5 pt-3">
        <section className="fomo-card overflow-hidden border border-slate-200">
          <div className="h-[calc(100dvh-92px)] min-h-[520px] w-full">
            <SunMap
              initialOrigin={initialOrigin}
              initialDay={initialDay}
              origin={origin}
              mapDay={mapDay}
              onOriginChange={setOrigin}
            />
          </div>
        </section>
      </main>
    </div>
  )
}
