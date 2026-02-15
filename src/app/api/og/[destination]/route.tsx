import { ImageResponse } from 'next/og'
import { destinations } from '@/data/destinations'

export const runtime = 'edge'

function fmtSun(min: number) {
  if (!Number.isFinite(min) || min <= 0) return '0min'
  const rounded = Math.round(min / 15) * 15
  if (rounded < 60) return `${rounded}min`
  const hh = Math.floor(rounded / 60)
  const rem = rounded % 60
  if (rem === 0) return `${hh}h`
  if (rem === 15) return `${hh}¼h`
  if (rem === 30) return `${hh}½h`
  return `${hh}¾h`
}

function ringColor(score: number) {
  if (score >= 90) return '#ef4444'
  if (score >= 75) return '#f97316'
  return '#f59e0b'
}

export async function GET(
  request: Request,
  { params }: { params: { destination: string } }
) {
  const url = new URL(request.url)
  const slug = decodeURIComponent(params.destination || '').toLowerCase()
  const score = Math.max(0, Math.min(100, Number(url.searchParams.get('score') || '86')))
  const sunMin = Math.max(0, Number(url.searchParams.get('sun') || '300'))

  const destination = destinations.find(d => d.id.toLowerCase() === slug)
    || destinations.find(d => d.name.toLowerCase().replace(/\s+/g, '-') === slug)

  const title = destination?.name || 'FOMO Sun'
  const region = destination ? `${destination.region} · ${destination.country}` : 'Switzerland'

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '52px',
          background: 'linear-gradient(135deg,#fff4d6 0%,#fed7aa 48%,#fdba74 100%)',
          color: '#1e293b',
          fontFamily: 'DM Sans, Inter, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 28, height: 28, borderRadius: 999, background: '#f59e0b', boxShadow: '0 0 24px rgba(245,158,11,.35)' }} />
            <div style={{ fontWeight: 800, fontSize: 34, letterSpacing: '-0.03em' }}>FOMO Sun</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 98,
                height: 98,
                borderRadius: 999,
                border: `8px solid ${ringColor(score)}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(255,255,255,.72)',
                fontSize: 30,
                fontWeight: 800,
              }}
            >
              {Math.round(score)}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>FOMO™</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 0.95 }}>{title}</div>
          <div style={{ fontSize: 30, color: '#475569', fontWeight: 600 }}>{region}</div>
          <div style={{ marginTop: 8, fontSize: 44, fontWeight: 700, color: '#7c2d12' }}>{fmtSun(sunMin)} sun today</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 24, color: '#92400e', fontWeight: 600 }}>Escape the fog → fomosun.com</div>
          <div style={{ fontSize: 16, color: '#64748b' }}>Live sunshine score and travel-aware ranking</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
