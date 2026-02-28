type MapLegendProps = {
  className?: string
}

function Row({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-100/95">
      <span
        className="h-2.5 w-2.5 rounded-full ring-1 ring-white/40"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  )
}

export default function MapLegend({ className = '' }: MapLegendProps) {
  return (
    <div
      className={`pointer-events-auto rounded-xl border border-white/20 bg-slate-900/70 px-3 py-2 backdrop-blur ${className}`}
    >
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-200">
        Sun Score
      </p>
      <div className="space-y-1.5">
        <Row color="#22c55e" label="High (> 0.60)" />
        <Row color="#facc15" label="Medium (0.30 – 0.60)" />
        <Row color="#94a3b8" label="Low (< 0.30)" />
        <Row color="#3b82f6" label="Your origin" />
      </div>
    </div>
  )
}
