type MapLegendProps = {
  className?: string
  day: 'today' | 'tomorrow'
  overlayVisible: boolean
  minHours: number
  maxHours: number
  travelRingLabels: string[]
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
        <Row color="#b45309" label="Best 80+ (> 0.80)" />
        <Row color="#facc15" label="Best (> 0.60)" />
        <Row color="#3b82f6" label="Medium (0.30 – 0.60)" />
        <Row color="#94a3b8" label="Worst (< 0.30)" />
        <Row color="#020617" label="Your origin" />
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
                background: 'linear-gradient(90deg, rgb(148 163 184), rgb(59 130 246), rgb(254 240 138), rgb(250 204 21), rgb(180 83 9))',
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
