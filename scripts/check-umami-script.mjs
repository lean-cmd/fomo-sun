#!/usr/bin/env node

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const key = token.slice(2)
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) {
      args[key] = 'true'
      continue
    }
    args[key] = value
    i += 1
  }
  return args
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const url = args.url || process.env.BASE_URL || 'http://localhost:3000'
  const expectedScriptUrl = args['expect-script-url'] || process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL || ''
  const expectedWebsiteId = args['expect-website-id'] || process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID || ''

  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status} ${res.statusText}`)
  }

  const html = await res.text()
  const hasScriptId = html.includes('umami-analytics')
  const hasDataWebsiteAttr = html.includes('data-website-id')
  const hasExpectedScript = expectedScriptUrl ? html.includes(expectedScriptUrl) : true
  const hasExpectedWebsiteId = expectedWebsiteId ? html.includes(expectedWebsiteId) : true

  if (!hasScriptId || !hasDataWebsiteAttr || !hasExpectedScript || !hasExpectedWebsiteId) {
    throw new Error(
      [
        'Umami tracker check failed.',
        `  has umami id: ${hasScriptId}`,
        `  has data-website-id attr: ${hasDataWebsiteAttr}`,
        `  has expected script url: ${hasExpectedScript}`,
        `  has expected website id: ${hasExpectedWebsiteId}`,
      ].join('\n'),
    )
  }

  console.log('Umami tracker script detected in HTML response.')
}

main().catch(err => {
  console.error(err.message || String(err))
  process.exit(1)
})
