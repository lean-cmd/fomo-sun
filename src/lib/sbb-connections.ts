export type SbbConnection = {
  id: string
  category: string
  line: string
  departure_time: string
  arrival_time: string
  departure_hhmm: string
  arrival_hhmm: string
  duration_min: number
  platform?: string
  transfers: number
  sbb_url: string
  note?: string
}

const CACHE_TTL_MS = 5 * 60 * 1000
const API_TIMEOUT_MS = 7_000
const BASE = 'https://transport.opendata.ch/v1/connections'

const cache = new Map<string, { expires_at: number; rows: SbbConnection[] }>()

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function durationToMin(durationRaw: string | undefined) {
  if (!durationRaw) return 0
  const m = durationRaw.match(/(\d{1,2}):(\d{2}):(\d{2})$/)
  if (!m) return 0
  const hh = Number(m[1] || 0)
  const mm = Number(m[2] || 0)
  return hh * 60 + mm
}

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
}

function encodeSbbUrl(from: string, to: string, departureIso?: string) {
  const p = new URLSearchParams({ from, to })
  if (departureIso) {
    const d = new Date(departureIso)
    p.set('date', d.toISOString().slice(0, 10))
    p.set('time', d.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' }))
  }
  return `https://www.sbb.ch/en/timetable.html?${p.toString()}`
}

function lineAndCategory(products: string[] | undefined) {
  const full = String(products?.[0] || '').trim()
  if (!full) return { category: 'Rail', line: 'Rail' }
  const [cat, ...rest] = full.split(' ')
  return {
    category: cat || 'Rail',
    line: rest.length ? `${cat} ${rest.join(' ')}` : full,
  }
}

function seedFrom(value: string) {
  return value.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0)
}

function pseudo(min: number, max: number, seed: number) {
  const x = Math.sin(seed) * 10000
  const n = x - Math.floor(x)
  return Math.round(min + (max - min) * n)
}

function mockConnections(from: string, to: string, limit: number): SbbConnection[] {
  const now = Date.now()
  const seedBase = seedFrom(`${from}|${to}`)
  return Array.from({ length: clamp(limit, 1, 6) }).map((_, idx) => {
    const seed = seedBase + idx * 19
    const offsetMin = 14 + idx * pseudo(18, 34, seed)
    const depart = new Date(now + offsetMin * 60_000)
    const duration = pseudo(36, 122, seed + 7)
    const arrive = new Date(depart.getTime() + duration * 60_000)
    const categories = ['IC', 'IR', 'RE', 'S']
    const category = categories[seed % categories.length]
    const lineNo = pseudo(2, 39, seed + 4)
    const transfers = category === 'IC' ? 0 : (seed % 3 === 0 ? 1 : 0)
    const platform = String(pseudo(3, 18, seed + 11))

    return {
      id: `mock-${idx}-${depart.getTime()}`,
      category,
      line: `${category} ${lineNo}`,
      departure_time: depart.toISOString(),
      arrival_time: arrive.toISOString(),
      departure_hhmm: hhmm(depart.toISOString()),
      arrival_hhmm: hhmm(arrive.toISOString()),
      duration_min: duration,
      platform,
      transfers,
      sbb_url: encodeSbbUrl(from, to, depart.toISOString()),
      note: transfers > 0 ? 'then bus / local transfer' : undefined,
    }
  })
}

export async function getNextConnections(
  from: string,
  to: string,
  limit = 3,
  opts?: { demo?: boolean }
): Promise<SbbConnection[]> {
  const safeFrom = from.trim() || 'Basel'
  const safeTo = to.trim()
  if (!safeTo) return []

  const safeLimit = clamp(limit, 1, 6)
  const key = `${safeFrom.toLowerCase()}|${safeTo.toLowerCase()}|${safeLimit}|${opts?.demo ? 1 : 0}`
  const now = Date.now()
  const cached = cache.get(key)
  if (cached && cached.expires_at > now) return cached.rows

  if (opts?.demo) {
    const rows = mockConnections(safeFrom, safeTo, safeLimit)
    cache.set(key, { expires_at: now + CACHE_TTL_MS, rows })
    return rows
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), API_TIMEOUT_MS)
  try {
    const p = new URLSearchParams({ from: safeFrom, to: safeTo, limit: String(safeLimit) })
    const res = await fetch(`${BASE}?${p.toString()}`, {
      signal: controller.signal,
      next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error(`sbb-http-${res.status}`)
    const payload = await res.json()
    const rows: SbbConnection[] = (Array.isArray(payload?.connections) ? payload.connections : [])
      .slice(0, safeLimit)
      .map((c: any, idx: number) => {
        const depIso = String(c?.from?.departure || c?.from?.prognosis?.departure || '')
        const arrIso = String(c?.to?.arrival || c?.to?.prognosis?.arrival || '')
        if (!depIso || !arrIso) return null

        const meta = lineAndCategory(Array.isArray(c?.products) ? c.products : undefined)
        const transfers = Number.isFinite(c?.transfers) ? Number(c.transfers) : 0
        return {
          id: String(c?.service?.regular || c?.service?.ir || `${idx}-${depIso}`),
          category: meta.category,
          line: meta.line,
          departure_time: depIso,
          arrival_time: arrIso,
          departure_hhmm: hhmm(depIso),
          arrival_hhmm: hhmm(arrIso),
          duration_min: durationToMin(String(c?.duration || '')),
          platform: c?.from?.platform ? String(c.from.platform) : undefined,
          transfers,
          sbb_url: encodeSbbUrl(safeFrom, safeTo, depIso),
        } satisfies SbbConnection
      })
      .filter((r: SbbConnection | null): r is SbbConnection => Boolean(r))

    if (!rows.length) throw new Error('sbb-empty')
    cache.set(key, { expires_at: now + CACHE_TTL_MS, rows })
    return rows
  } catch (err) {
    if ((err as { name?: string })?.name === 'AbortError') throw new Error('sbb-timeout')
    throw err
  } finally {
    clearTimeout(timeout)
  }
}
