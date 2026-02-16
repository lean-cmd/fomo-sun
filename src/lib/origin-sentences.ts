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
  sun_gain: string
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

function shortName(name: string, max = 12) {
  if (name.length <= max) return name
  const first = name.split(/[ ,/-]/)[0]
  return first.length > 2 ? first : name.slice(0, max)
}

export function buildOriginSentences(input: OriginSentenceInput) {
  const badOrigin = hasBadOrigin(input.condition, input.origin_score_pct)
  const city = shortName(input.city, 12)
  const best = shortName(input.best_escape_name, 13)

  const base = [
    `${city}: ${input.sun_hours_today}. ${best} has ${input.best_escape_sun}.`,
    `${best} is sunny. ${city} isn't.`,
    `FOMO score for staying: ${input.origin_score_pct}%.`,
    `${input.sun_gain} of sunshine you're missing now.`,
    `${best}: ${input.best_escape_sun}, ${input.travel_time} away.`,
    `${input.sun_hours_today} vs ${input.best_escape_sun}. Clear math.`,
    `Fog ceiling ~800m. ${best} at ${input.altitude_m}m.`,
    `The sun called. It's in ${best}.`,
    `Grey skies, warm coat, zero excuses.`,
    `This is your sign to leave.`,
    `Sunshine is ${input.travel_time} away.`,
    `Your ceiling is someone else's floor.`,
    `${best} beats ${city} right now.`,
    `${city} waits. ${best} shines.`,
    `${input.best_score_pct}% at ${best}. ${input.origin_score_pct}% in ${city}.`,
    `Live forecast says: go higher.`,
    `${input.temp_c}° in ${city}. Better above the cloud.`,
    `${best} has the edge today.`,
  ]

  const fogOnly = [
    `The fog in ${city} won't lift today.`,
    `The Mittelland is grey. The Jura isn't.`,
    `Everyone above 1000m is in the sun.`,
    `${city} stays under cloud. ${best} clears.`,
  ]

  const sentences = badOrigin ? [...base, ...fogOnly] : base
  const shortEnough = sentences.filter(line => line.length <= 50)
  const pool = shortEnough.length >= 15 ? shortEnough : sentences
  return seededShuffle(pool, `${input.city}|${input.best_escape_name}|${input.condition}`).slice(0, 20)
}
