import { NextRequest, NextResponse } from 'next/server'
import { getRecentRequestLogs } from '@/lib/request-log'

export async function GET(request: NextRequest) {
  const limitRaw = Number(request.nextUrl.searchParams.get('limit') || 10)
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(50, Math.round(limitRaw))) : 10
  return NextResponse.json({
    logs: getRecentRequestLogs(limit),
  }, {
    headers: {
      'Cache-Control': 'no-store',
    },
  })
}

