type MapLegendProps = {
  className?: string
  day: 'today' | 'tomorrow'
  overlayVisible: boolean
  minHours: number
  maxHours: number
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
        <Row color="#22c55e" label="High (> 0.60)" />
        <Row color="#facc15" label="Medium (0.30 – 0.60)" />
        <Row color="#94a3b8" label="Low (< 0.30)" />
        <Row color="#3b82f6" label="Your origin" />
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
                background: 'linear-gradient(90deg, hsl(214 86% 35%), hsl(170 86% 42%), hsl(130 86% 48%), hsl(88 86% 52%), hsl(44 86% 60%))',
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
    </div>
  )
}
