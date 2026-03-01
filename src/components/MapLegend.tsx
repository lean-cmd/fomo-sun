type MapLegendProps = {
  className?: string
  day: 'today' | 'tomorrow'
  overlayVisible: boolean
  minHours: number
  maxHours: number
  travelRingLabels: string[]
  showHomeBestOrb?: boolean
  hasBucketSunMarkers?: boolean
}

function Row({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-700">
      <span
        className="h-2.5 w-2.5 rounded-full ring-1 ring-white/40"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  )
}

export default function MapLegend({
  className = '',
  day,
  overlayVisible,
  minHours,
  maxHours,
  travelRingLabels,
  showHomeBestOrb = false,
  hasBucketSunMarkers = false,
}: MapLegendProps) {
  const safeMin = Number.isFinite(minHours) ? Math.max(0, Math.round(minHours * 10) / 10) : 0
  const safeMax = Number.isFinite(maxHours) ? Math.max(safeMin + 0.5, Math.round(maxHours * 10) / 10) : 10

  return (
    <div
      className={`pointer-events-auto rounded-xl border border-slate-200 bg-white/92 px-3 py-2 text-slate-800 shadow-[0_8px_18px_rgba(15,23,42,0.12)] backdrop-blur ${className}`}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
        Sun Score
      </p>
      <div className="space-y-1.5">
        <Row color="#ca8a04" label="Best 80+ (> 0.80)" />
        <Row color="#facc15" label="Best (> 0.60)" />
        <Row color="#60a5fa" label="Medium (0.30 – 0.60)" />
        <Row color="#94a3b8" label="Worst (< 0.30)" />
        <Row color="#020617" label="Your origin" />
        {hasBucketSunMarkers && (
          <div className="flex items-center gap-2 text-[11px] text-slate-700">
            <span className="inline-grid h-3.5 w-3.5 place-items-center rounded-full bg-[radial-gradient(circle_at_32%_30%,#fffbe6_0_28%,#facc15_58%,#ca8a04_100%)] text-[9px] leading-none text-amber-900 ring-1 ring-white/70">☀</span>
            <span>Best in travel bucket</span>
          </div>
        )}
        {showHomeBestOrb && (
          <div className="flex items-center gap-2 text-[11px] text-slate-700">
            <span className="h-3.5 w-3.5 rounded-full bg-amber-200/90 ring-2 ring-amber-400/70" />
            <span>Home currently strongest</span>
          </div>
        )}
      </div>
      <div className="mt-2.5 border-t border-slate-200 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
          {day === 'tomorrow' ? 'Tomorrow' : 'Today'} Sun Hours Overlay
        </p>
        {overlayVisible ? (
          <>
            <div
              className="mt-1.5 h-2.5 w-full rounded-full ring-1 ring-slate-200"
              style={{
                background: 'linear-gradient(90deg, rgb(148 163 184), rgb(96 165 250), rgb(254 240 138), rgb(250 204 21), rgb(202 138 4))',
              }}
            />
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-600">
              <span>{safeMin.toFixed(1)}h</span>
              <span>{safeMax.toFixed(1)}h</span>
            </div>
          </>
        ) : (
          <p className="mt-1 text-[10px] text-slate-500">Overlay hidden</p>
        )}
      </div>
      <div className="mt-2.5 border-t border-slate-200 pt-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
          Travel rings
        </p>
        <p className="mt-1 text-[10px] text-slate-500">
          Rough ranges from origin: {travelRingLabels.join(' · ')}
        </p>
      </div>
    </div>
  )
}
