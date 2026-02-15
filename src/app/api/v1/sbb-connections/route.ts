import { NextRequest, NextResponse } from 'next/server'
import { getNextConnections } from '@/lib/sbb-connections'

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const from = (sp.get('from') || 'Basel').trim().slice(0, 80)
  const to = (sp.get('to') || '').trim().slice(0, 80)
  const limit = Math.max(1, Math.min(6, Number(sp.get('limit') || '3')))
  const demo = sp.get('demo') === 'true'

  if (!to) {
    return NextResponse.json({ error: 'Missing destination.' }, { status: 400 })
  }

  try {
    const connections = await getNextConnections(from, to, limit, { demo })
    return NextResponse.json(
      {
        from,
        to,
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
