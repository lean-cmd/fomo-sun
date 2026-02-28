import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, MapPinned, Sun } from 'lucide-react'

const SunMap = dynamic(() => import('@/components/SunMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse bg-slate-100" />
  ),
})

type SearchParamsInput = Record<string, string | string[] | undefined>

type OriginSeed = {
  name: string
  lat: number
  lon: number
  kind: 'manual' | 'gps' | 'default'
}
type MapDay = 'today' | 'tomorrow'

function parseNumber(value: string | string[] | undefined, fallback: number) {
  const parsed = Number(Array.isArray(value) ? value[0] : value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseText(value: string | string[] | undefined, fallback: string) {
  const raw = Array.isArray(value) ? value[0] : value
  const normalized = String(raw || '').trim()
  return normalized || fallback
}

function parseOriginKind(value: string | string[] | undefined): OriginSeed['kind'] {
  const raw = parseText(value, 'default').toLowerCase()
  if (raw === 'gps') return 'gps'
  if (raw === 'manual') return 'manual'
  return 'default'
}

function parseMapDay(value: string | string[] | undefined): MapDay {
  const raw = parseText(value, 'today').toLowerCase()
  return raw === 'tomorrow' ? 'tomorrow' : 'today'
}

export default function MapPage({ searchParams }: { searchParams?: SearchParamsInput }) {
  const params = searchParams || {}
  const initialOrigin: OriginSeed = {
    name: parseText(params.origin, 'Basel'),
    lat: parseNumber(params.lat, 47.5596),
    lon: parseNumber(params.lon, 7.5886),
    kind: parseOriginKind(params.origin_kind),
  }
  const initialDay = parseMapDay(params.day)

  return (
    <div className="min-h-screen fomo-warm-bg fomo-grid-bg">
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 backdrop-blur">
        <div className="mx-auto grid h-[62px] w-full max-w-xl grid-cols-[1fr_auto_1fr] items-center px-3">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-600 transition hover:text-slate-900"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
          </div>

          <div className="inline-flex items-center gap-2 text-slate-900">
            <MapPinned className="h-4 w-4 text-amber-600" />
            <h1 className="text-[14px] font-semibold tracking-[0.02em]">Sunshine Map</h1>
          </div>

          <div className="text-right text-[10px] font-semibold text-slate-500">
            {initialDay === 'tomorrow' ? 'Tomorrow mode' : 'Today mode'}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl px-3 pb-5 pt-3">
        <section className="fomo-card overflow-hidden border border-slate-200">
          <div className="border-b border-slate-200/80 bg-white/80 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-semibold text-slate-800">
                Live Swiss sunshine map
              </p>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-700">
                <Sun className="h-3 w-3" />
                {initialDay}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">
              Origin: <span className="font-semibold text-slate-700">{initialOrigin.name}</span> · Toggle layers to compare station measurements and sun-hour forecast coverage.
            </p>
          </div>
          <div className="h-[calc(100dvh-182px)] min-h-[500px] w-full">
            <SunMap initialOrigin={initialOrigin} initialDay={initialDay} />
          </div>
        </section>
      </main>
    </div>
  )
}
