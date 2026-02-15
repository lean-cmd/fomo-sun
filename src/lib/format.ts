export function formatSunHours(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return '0min'

  const rounded = Math.max(0, Math.round(minutes / 15) * 15)
  if (rounded < 60) return `${rounded}min`

  const whole = Math.floor(rounded / 60)
  const rem = rounded % 60

  if (rem === 0) return `${whole}h`
  if (rem === 15) return `${whole}¼h`
  if (rem === 30) return `${whole}½h`
  if (rem === 45) return `${whole}¾h`

  // Should never hit due to 15-min rounding.
  return `${whole}h`
}

export function splitSunHours(minutes: number): { value: string; unit: 'h' | 'min' } {
  const formatted = formatSunHours(minutes)
  if (formatted.endsWith('min')) {
    return { value: formatted.replace('min', ''), unit: 'min' }
  }
  return { value: formatted.replace('h', ''), unit: 'h' }
}

export function formatTravelClock(hours: number): string {
  const hh = Math.floor(hours)
  const mm = Math.round((hours - hh) * 60)
  if (mm <= 0) return `${hh}h`
  return `${hh}h ${String(mm).padStart(2, '0')}`
}
