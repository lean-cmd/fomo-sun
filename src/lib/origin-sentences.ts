type OriginSentenceInput = {
  city: string
  condition: string
  temp_c: number
  sun_hours_today: string
  sun_hours_tomorrow: string
  best_escape_name: string
  best_escape_sun: string
  travel_time: string
  altitude_m: number
  origin_score_pct: number
  best_score_pct: number
}

function seededShuffle<T>(items: T[], seedRaw: string) {
  const arr = [...items]
  let seed = 0
  for (const ch of seedRaw) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0
  for (let i = arr.length - 1; i > 0; i--) {
    seed = (1664525 * seed + 1013904223) >>> 0
    const j = seed % (i + 1)
    const tmp = arr[i]
    arr[i] = arr[j]
    arr[j] = tmp
  }
  return arr
}

function hasBadOrigin(condition: string, originScorePct: number) {
  const c = condition.toLowerCase()
  if (originScorePct <= 38) return true
  return c.includes('fog') || c.includes('cloud') || c.includes('overcast') || c.includes('low cloud')
}

export function buildOriginSentences(input: OriginSentenceInput) {
  const badOrigin = hasBadOrigin(input.condition, input.origin_score_pct)
  const all = [
    `${input.city} forecast: ${input.sun_hours_today} of sun. ${input.best_escape_name} has ${input.best_escape_sun}.`,
    `Current conditions in ${input.city}: ${input.temp_c}°, ${input.condition}.`,
    `${input.condition} in ${input.city}. ${input.best_escape_name} is ${input.travel_time} away with ${input.best_escape_sun} of sun.`,
    `${input.city}: ${input.sun_hours_today} of sun today. ${input.best_escape_name} has ${input.best_escape_sun}.`,
    `Right now in ${input.city}: ${input.temp_c}°. ${input.best_escape_name} is sunnier.`,
    `${input.best_escape_name}: ${input.best_escape_sun} of sunshine, ${input.travel_time} from ${input.city}.`,
    `${input.sun_hours_today} of sun in ${input.city}. ${input.best_escape_name} has ${input.best_escape_sun}.`,
    `${input.city} tomorrow: ${input.sun_hours_tomorrow} of sun. Or drive ${input.travel_time} for ${input.best_escape_sun} today.`,
    `Satellite trend: more sun above 1,000m. ${input.best_escape_name} is at ${input.altitude_m}m.`,
    `${input.city} score: ${input.origin_score_pct}%. ${input.best_escape_name}: ${input.best_score_pct}%.`,
  ]

  const badWeatherOnly = [
    `The fog in ${input.city} may not lift today. ${input.best_escape_name} is already sunny.`,
    `Inversion likely in ${input.city}. ${input.best_escape_name} is above it.`,
    `Visibility in ${input.city}: low. Sunshine in ${input.best_escape_name}: high.`,
    `${input.temp_c}° in ${input.city}. ${input.best_escape_name} is warmer and brighter.`,
    `Every minute in ${input.city} cloud is a minute of ${input.best_escape_name} sun you are missing.`,
  ]

  const sentences = badOrigin ? [...all, ...badWeatherOnly] : all
  return seededShuffle(sentences, `${input.city}|${input.best_escape_name}|${input.condition}`).slice(0, 20)
}

