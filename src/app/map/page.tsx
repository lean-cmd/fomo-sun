import MapPageClient from '@/components/MapPageClient'

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

  return <MapPageClient initialOrigin={initialOrigin} initialDay={initialDay} />
}
