'use client'

/**
 * Sunshine timeline bar for destination cards.
 * Shows today + tomorrow forecast as colored bar segments.
 * 
 * Segments: sun (gold), partial (light gold), cloud (grey), night (dark grey)
 * In production this will use real hourly forecast data.
 * For now, generates plausible mock data based on sun score.
 */

interface TimelineSegment {
  type: 'sun' | 'partial' | 'cloud' | 'night'
  pct: number
}

function seededUnit(seed: number) {
  const x = Math.sin(seed * 12_345.6789) * 43758.5453
  return x - Math.floor(x)
}

function generateTimeline(sunScore: number, dayOffset: number): TimelineSegment[] {
  // Night is always ~15% (roughly 17:00-19:00 in winter)
  const nightPct = 15
  const dayPct = 100 - nightPct

  const normalizedScore = Math.max(0, Math.min(1, sunScore))
  const scoreSeed = Math.round(normalizedScore * 10_000)
  const jitter = seededUnit(scoreSeed + dayOffset * 97)
  const cloudFirst = seededUnit(scoreSeed + dayOffset * 131) > 0.5

  // Higher sun score = more sun segments
  const base = normalizedScore + (dayOffset === 1 ? (jitter * 0.15 - 0.05) : 0) // deterministic slight variation for tomorrow
  const clamped = Math.max(0, Math.min(1, base))

  const sunPct = Math.round(dayPct * clamped * 0.7)
  const partialPct = Math.round(dayPct * clamped * 0.2)
  const cloudPct = dayPct - sunPct - partialPct

  // Distribute segments somewhat randomly
  const segments: TimelineSegment[] = []

  if (cloudPct > 5 && cloudFirst) {
    segments.push({ type: 'cloud', pct: Math.round(cloudPct * 0.6) })
  }

  if (sunPct > 10) {
    segments.push({ type: 'sun', pct: Math.round(sunPct * 0.55) })
  }

  if (partialPct > 3) {
    segments.push({ type: 'partial', pct: partialPct })
  }

  if (sunPct > 10) {
    segments.push({ type: 'sun', pct: sunPct - Math.round(sunPct * 0.55) })
  }

  if (cloudPct > 5) {
    const remaining = cloudPct - (segments[0]?.type === 'cloud' ? segments[0].pct : 0)
    if (remaining > 2) segments.push({ type: 'cloud', pct: remaining })
  }

  segments.push({ type: 'night', pct: nightPct })

  // Normalize to 100%
  const total = segments.reduce((s, seg) => s + seg.pct, 0)
  if (total !== 100) {
    const diff = 100 - total
    const largestIdx = segments.reduce((maxI, seg, i, arr) => seg.pct > arr[maxI].pct ? i : maxI, 0)
    segments[largestIdx].pct += diff
  }

  return segments.filter(s => s.pct > 0)
}

const segmentClass: Record<string, string> = {
  sun: 'tl-sun',
  partial: 'tl-partial',
  cloud: 'tl-cloud',
  night: 'tl-night',
}

export default function SunTimeline({ sunScore }: { sunScore: number }) {
  const today = generateTimeline(sunScore, 0)
  const tomorrow = generateTimeline(sunScore, 1)

  return (
    <div className="px-4 pb-3 space-y-1">
      {[
        { label: 'Today', segments: today },
        { label: 'Tomorrow', segments: tomorrow },
      ].map(row => (
        <div key={row.label} className="flex items-center gap-1.5">
          <span className="text-[9px] font-medium text-gray-400 w-[44px] text-right flex-shrink-0">
            {row.label}
          </span>
          <div className="flex-1 h-[13px] rounded bg-gray-100 flex overflow-hidden">
            {row.segments.map((seg, i) => (
              <div
                key={i}
                className={segmentClass[seg.type]}
                style={{ width: `${seg.pct}%` }}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="flex justify-between text-[8px] text-gray-300 pl-[50px]">
        <span>8</span><span>10</span><span>12</span><span>14</span><span>16</span><span>18</span>
      </div>
    </div>
  )
}

/** Compute max sun hours for the FOMO stat in the hero */
export function computeMaxSunHours(topScore: number): string {
  // Approximate: 10 daylight hours in winter, multiply by top score
  const hours = (10 * topScore).toFixed(1)
  return hours
}
