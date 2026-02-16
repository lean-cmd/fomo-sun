import { NextRequest, NextResponse } from 'next/server'
import { getNextConnections } from '@/lib/sbb-connections'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const from = (sp.get('from') || 'Basel').trim().slice(0, 80)
  const to = (sp.get('to') || '').trim().slice(0, 80)
  const limit = Math.max(1, Math.min(6, Number(sp.get('limit') || '3')))
  const demo = sp.get('demo') === 'true'
  const dayFocus = sp.get('day_focus') === 'tomorrow' ? 'tomorrow' : 'today'
  const departureAtParam = (sp.get('departure_at') || '').trim()

  if (!to) {
    return NextResponse.json({ error: 'Missing destination.' }, { status: 400 })
  }

  let departureAt = departureAtParam
  if (!departureAt && dayFocus === 'tomorrow') {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    departureAt = `${yyyy}-${mm}-${dd}T07:00`
  }

  try {
    const connections = await getNextConnections(from, to, limit, { demo, departureAt })
    return NextResponse.json(
      {
        from,
        to,
        day_focus: dayFocus,
        source: demo ? 'mock' : 'sbb-live',
        generated_at: new Date().toISOString(),
        connections,
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'X-FOMO-SBB-Source': demo ? 'mock' : 'transport-opendata',
        },
      }
    )
  } catch (err) {
    const msg = String((err as { message?: string })?.message || err || '')
    return NextResponse.json(
      { error: 'Unable to load connections', code: msg || 'sbb-error' },
      { status: 502 }
    )
  }
}
