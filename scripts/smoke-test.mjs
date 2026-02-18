#!/usr/bin/env node

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000'
const buckets = [
  { min: 0, max: 1 },
  { min: 1, max: 1.5 },
  { min: 1.5, max: 2 },
  { min: 2, max: 3 },
  { min: 3, max: 6.5 },
]

const cases = [
  { name: 'Basel Today', lat: 47.5596, lon: 7.5886, origin: 'Basel', trip_span: 'daytrip' },
  { name: 'Basel Tomorrow', lat: 47.5596, lon: 7.5886, origin: 'Basel', trip_span: 'plus1day' },
  { name: 'Zurich Today', lat: 47.3769, lon: 8.5417, origin: 'Zurich', trip_span: 'daytrip' },
  { name: 'Bern Today', lat: 46.948, lon: 7.4474, origin: 'Bern', trip_span: 'daytrip' },
]

const failures = []

function fail(msg) {
  failures.push(msg)
  console.error(`FAIL: ${msg}`)
}

function bucketLabel(bucket) {
  return `${bucket.min}-${bucket.max}h`
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    // keep null; caller handles
  }
  return { res, json, text }
}

async function runBucketChecks() {
  for (const tc of cases) {
    for (const bucket of buckets) {
      const params = new URLSearchParams({
        lat: String(tc.lat),
        lon: String(tc.lon),
        origin_name: tc.origin,
        origin_kind: 'manual',
        mode: 'both',
        trip_span: tc.trip_span,
        demo: 'false',
        travel_min_h: String(bucket.min),
        travel_max_h: String(bucket.max),
        max_travel_h: '6.5',
        limit: '15',
      })
      const url = `${BASE_URL}/api/v1/sunny-escapes?${params.toString()}`
      const { res, json, text } = await fetchJson(url)

      if (res.status !== 200) {
        const snippet = (text || '').replace(/\s+/g, ' ').slice(0, 220)
        fail(`${tc.name} ${bucketLabel(bucket)} status ${res.status}${snippet ? ` :: ${snippet}` : ''}`)
        continue
      }
      if (!json || typeof json !== 'object') {
        fail(`${tc.name} ${bucketLabel(bucket)} non-JSON response`)
        continue
      }

      const tier = json?._meta?.result_tier
      if (!tier) {
        fail(`${tc.name} ${bucketLabel(bucket)} missing _meta.result_tier`)
      }

      const headerTier = res.headers.get('x-fomo-result-tier')
      if (!headerTier) {
        fail(`${tc.name} ${bucketLabel(bucket)} missing X-FOMO-Result-Tier header`)
      }

      const escapes = Array.isArray(json.escapes) ? json.escapes : []
      if (escapes.length < 1) {
        fail(`${tc.name} ${bucketLabel(bucket)} returned 0 escapes`)
      }

      const bucketMeta = (json?._meta?.bucket_counts || []).find((b) => b.min_h === bucket.min && b.max_h === bucket.max)
      const destinationCount = bucketMeta?.destination_count ?? bucketMeta?.raw_count ?? 0
      if (destinationCount < 1) {
        fail(`${tc.name} ${bucketLabel(bucket)} destination_count=0 (bucket should be geographically reachable)`)
      }

      const top = escapes[0]?.destination?.name || '-'
      console.log(`${tc.name} ${bucketLabel(bucket)} -> ${escapes.length} escapes, tier=${tier}, top=${top}`)

      if (!text || text.length < 2) {
        fail(`${tc.name} ${bucketLabel(bucket)} empty body`)
      }
    }
  }
}

async function runModelPolicyCheck() {
  const checks = [
    { label: 'CH', lat: 47.5596, lon: 7.5886, origin: 'Basel' },
    { label: 'DE-border', lat: 47.75, lon: 7.85, origin: 'Basel' },
  ]

  for (const c of checks) {
    const params = new URLSearchParams({
      lat: String(c.lat),
      lon: String(c.lon),
      origin_name: c.origin,
      origin_kind: 'manual',
      mode: 'both',
      trip_span: 'daytrip',
      demo: 'false',
      max_travel_h: '4.5',
      travel_min_h: '0',
      travel_max_h: '6.5',
      limit: '100',
      admin: 'true',
      admin_all: 'true',
    })

    const url = `${BASE_URL}/api/v1/sunny-escapes?${params.toString()}`
    const { res, json } = await fetchJson(url)
    if (res.status !== 200 || !json) {
      const snippet = (json ? JSON.stringify(json) : '').slice(0, 220)
      fail(`${c.label} model policy check failed with status ${res.status}${snippet ? ` :: ${snippet}` : ''}`)
      continue
    }

    const models = new Set((json.escapes || []).map((e) => e.weather_model).filter(Boolean))
    if (c.label === 'CH' && !models.has('meteoswiss_seamless')) {
      fail('CH model policy missing meteoswiss_seamless in response rows')
    }
    if (!models.has('best_match')) {
      fail(`${c.label} model policy missing best_match in response rows`)
    }

    console.log(`${c.label} models: ${Array.from(models).sort().join(', ') || 'none'}`)
  }
}

async function main() {
  console.log(`Running smoke test against ${BASE_URL}`)
  await runBucketChecks()
  await runModelPolicyCheck()

  if (failures.length > 0) {
    console.error(`\nSmoke test failed (${failures.length} issue${failures.length === 1 ? '' : 's'}).`)
    process.exit(1)
  }

  console.log('\nSmoke test passed.')
}

main().catch((err) => {
  console.error('Smoke test crashed:', err)
  process.exit(1)
})
