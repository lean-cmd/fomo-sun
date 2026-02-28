import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, MapPinned } from 'lucide-react'

const SunMap = dynamic(() => import('@/components/SunMap'), {
  ssr: false,
  loading: () => (
    <div className="h-[calc(100dvh-62px)] w-full animate-pulse bg-slate-900/5" />
  ),
})

type SearchParamsInput = Record<string, string | string[] | undefined>

type OriginSeed = {
  name: string
  lat: number
  lon: number
  kind: 'manual' | 'gps' | 'default'
}

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

export default function MapPage({ searchParams }: { searchParams?: SearchParamsInput }) {
  const params = searchParams || {}
  const initialOrigin: OriginSeed = {
    name: parseText(params.origin, 'Basel'),
    lat: parseNumber(params.lat, 47.5596),
    lon: parseNumber(params.lon, 7.5886),
    kind: parseOriginKind(params.origin_kind),
  }

  return (
    <div className="bg-[#0f1d36]">
      <header className="sticky top-0 z-40 border-b border-slate-200/20 bg-[#182845]/95 backdrop-blur">
        <div className="mx-auto grid h-[62px] w-full max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-3">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-200/90 transition hover:text-white"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>
          </div>

          <div className="inline-flex items-center gap-2 text-slate-100">
            <MapPinned className="h-4 w-4 text-amber-300" />
            <h1 className="text-[14px] font-semibold tracking-[0.02em]">Sunshine Map</h1>
          </div>

          <div className="text-right text-[11px] font-medium text-slate-300/90">
            Origin: <span className="text-slate-100">{initialOrigin.name}</span>
          </div>
        </div>
      </header>

      <main className="h-[calc(100dvh-62px)] w-full">
        <SunMap initialOrigin={initialOrigin} />
      </main>
    </div>
  )
}
