import Link from 'next/link'
import { destinations } from '@/data/destinations'
import { Destination } from '@/lib/types'
import { enrichDestination } from '@/lib/tourism/enrichDestination'
import { DestinationStamp, type StampType } from '@/components/DestinationStamp'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 24
const COUNTRY_ORDER: Array<'CH' | 'DE' | 'FR' | 'IT' | 'LI'> = ['CH', 'DE', 'FR', 'IT', 'LI']

type SearchInput = {
  country?: string
  q?: string
  page?: string
}

function stampTypeFromDestination(destination: Destination): StampType {
  const typeSet = new Set(destination.types || [])
  if (typeSet.has('thermal')) return 'thermal'
  if (typeSet.has('lake')) return 'lake'
  if (typeSet.has('town')) return 'town'
  if (typeSet.has('viewpoint')) return 'viewpoint'
  if (typeSet.has('mountain')) return destination.altitude_m >= 1400 ? 'ski' : 'mountain'
  return 'default'
}

function toQuery(country: string, q: string, page: number) {
  const sp = new URLSearchParams()
  if (country && country !== 'all') sp.set('country', country)
  if (q) sp.set('q', q)
  if (page > 1) sp.set('page', String(page))
  return `/admin/stamps${sp.toString() ? `?${sp.toString()}` : ''}`
}

async function enrichVisibleDestinations(rows: Destination[]) {
  const fallbackCatalog = destinations.map((row) => ({
    id: row.id,
    name: row.name,
    lat: row.lat,
    lon: row.lon,
    region: row.region,
    country: row.country,
    types: row.types,
    description: row.description,
    plan_template: row.plan_template,
    maps_name: row.maps_name,
  }))

  const out = new Map<string, Awaited<ReturnType<typeof enrichDestination>>>()
  const concurrency = Math.min(6, Math.max(1, rows.length))
  let cursor = 0

  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (true) {
      const idx = cursor
      cursor += 1
      if (idx >= rows.length) break
      const row = rows[idx]
      try {
        const tourism = await enrichDestination({
          id: row.id,
          name: row.name,
          lat: row.lat,
          lon: row.lon,
          region: row.region,
          country: row.country,
          types: row.types,
          description: row.description,
          plan_template: row.plan_template,
          maps_name: row.maps_name,
        }, {
          catalog: fallbackCatalog,
        })
        out.set(row.id, tourism)
      } catch {
        out.set(row.id, {
          description_short: `${row.name} · ${row.region}`,
          description_long: row.description || `${row.name} in ${row.region}`,
          highlights: [],
          tags: row.types || [],
          hero_image: '',
          official_url: '',
          pois_nearby: [],
          source: 'fallback',
        })
      }
    }
  }))

  return out
}

export default async function StampGalleryPage({
  searchParams,
}: {
  searchParams?: SearchInput
}) {
  const country = (searchParams?.country || 'all').toUpperCase()
  const q = (searchParams?.q || '').trim()
  const pageRaw = Number(searchParams?.page || '1')
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1

  const filtered = destinations.filter((row) => {
    const countryMatch = country === 'ALL' || row.country === country
    if (!countryMatch) return false
    if (!q) return true
    const hay = `${row.name} ${row.region} ${row.country} ${row.id} ${(row.types || []).join(' ')}`.toLowerCase()
    return hay.includes(q.toLowerCase())
  })

  const total = filtered.length
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, pages)
  const start = (safePage - 1) * PAGE_SIZE
  const visible = filtered.slice(start, start + PAGE_SIZE)
  const tourismById = await enrichVisibleDestinations(visible)

  const countryCounts = COUNTRY_ORDER.map((c) => ({
    code: c,
    count: destinations.filter((row) => row.country === c).length,
  }))

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 fomo-grid-bg">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="fomo-font-display text-xl sm:text-2xl font-semibold text-slate-900">
              Stamp Gallery
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Swiss vintage poster language: condensed title typography, colorful lithograph palette, scenic landscape layers, and perforated stamp framing.
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Tourism cues are enriched from Discover Swiss when available (fallback: geo.admin.ch or curated catalog).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-xs text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline">
              Back to admin
            </Link>
            <Link href="/" className="text-xs text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline">
              Back to app
            </Link>
          </div>
        </div>

        <form method="get" className="rounded-xl border border-slate-200 bg-white p-3 mb-3 grid grid-cols-1 lg:grid-cols-[220px_1fr_auto] gap-2">
          <label className="text-xs text-slate-600 flex items-center gap-2">
            Country
            <select name="country" defaultValue={country.toLowerCase()} className="border border-slate-200 rounded-md px-2 py-1 text-xs bg-white">
              <option value="all">All countries</option>
              {countryCounts.map((entry) => (
                <option key={entry.code} value={entry.code.toLowerCase()}>
                  {entry.code} ({entry.count})
                </option>
              ))}
            </select>
          </label>
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search destination, region, canton..."
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200"
          />
          <button className="inline-flex items-center justify-center rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            Apply
          </button>
        </form>

        <div className="mb-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 flex flex-wrap items-center justify-between gap-2">
          <p className="fomo-font-mono text-xs text-slate-600">
            Showing {total ? start + 1 : 0}-{Math.min(start + PAGE_SIZE, total)} of {total} stamps
          </p>
          <div className="inline-flex items-center gap-2 text-xs">
            <Link
              href={toQuery(country, q, Math.max(1, safePage - 1))}
              className={`rounded-md border px-2 py-1 ${safePage <= 1 ? 'pointer-events-none border-slate-100 text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              Prev
            </Link>
            <span className="text-slate-500">Page {safePage} / {pages}</span>
            <Link
              href={toQuery(country, q, Math.min(pages, safePage + 1))}
              className={`rounded-md border px-2 py-1 ${safePage >= pages ? 'pointer-events-none border-slate-100 text-slate-300' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              Next
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {visible.map((row) => {
            const tourism = tourismById.get(row.id)
            const highlights = tourism?.highlights?.slice(0, 2) || []
            return (
              <article key={row.id} className="rounded-xl border border-slate-200 bg-white p-2.5">
                <DestinationStamp
                  name={row.name}
                  destinationId={row.id}
                  altitude={row.altitude_m}
                  region={row.region}
                  type={stampTypeFromDestination(row)}
                  country={row.country}
                  types={row.types}
                  description={tourism?.description_long || tourism?.description_short || row.description || ''}
                  planTemplate={row.plan_template}
                  tourismTags={tourism?.tags || []}
                  tourismHighlights={tourism?.highlights || []}
                  className="w-full h-auto"
                />
                <div className="mt-2">
                  <p className="text-[12px] font-semibold text-slate-800 leading-tight">{row.name}</p>
                  <p className="text-[10px] text-slate-500">{row.region} · {row.country} · {row.altitude_m}m</p>
                  <p className="mt-1 text-[10px] text-slate-600 line-clamp-2">
                    {tourism?.description_short || row.description || `${row.name} · ${row.region}`}
                  </p>
                  {highlights.length > 0 && (
                    <p className="mt-1 text-[10px] text-amber-700 line-clamp-2">{highlights.join(' · ')}</p>
                  )}
                  <p className="mt-1 text-[9px] uppercase tracking-[0.08em] text-slate-400">
                    tourism source: {tourism?.source || 'fallback'}
                  </p>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </main>
  )
}
