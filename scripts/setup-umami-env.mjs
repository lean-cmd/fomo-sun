#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

function usage() {
  console.log(
    [
      'Usage:',
      '  node scripts/setup-umami-env.mjs --host https://analytics.example.com --website-id <uuid> [--domains fomosun.com,www.fomosun.com]',
      '',
      'Writes/updates .env.local with NEXT_PUBLIC_UMAMI_* variables.',
    ].join('\n'),
  )
}

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

function normalizeHost(raw) {
  if (!raw) return ''
  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  return withProtocol.replace(/\/+$/, '')
}

function upsertEnv(filePath, updates) {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : ''
  const lines = existing ? existing.split(/\r?\n/) : []
  const keys = new Set(Object.keys(updates))
  const seen = new Set()
  const next = []

  for (const line of lines) {
    const eq = line.indexOf('=')
    if (eq <= 0) {
      if (line.trim() !== '' || next.length > 0) next.push(line)
      continue
    }

    const key = line.slice(0, eq).trim()
    if (!keys.has(key)) {
      next.push(line)
      continue
    }

    if (seen.has(key)) continue
    next.push(`${key}=${updates[key]}`)
    seen.add(key)
  }

  for (const key of keys) {
    if (!seen.has(key)) next.push(`${key}=${updates[key]}`)
  }

  fs.writeFileSync(filePath, `${next.join('\n').replace(/\n+$/g, '')}\n`, 'utf8')
}

const args = parseArgs(process.argv.slice(2))

if (args.help === 'true' || args.h === 'true') {
  usage()
  process.exit(0)
}

const host = normalizeHost(args.host || '')
const websiteId = (args['website-id'] || '').trim()
const domains = (args.domains || '').trim()

if (!host || !websiteId) {
  usage()
  console.error('\nError: --host and --website-id are required.')
  process.exit(1)
}

const updates = {
  NEXT_PUBLIC_UMAMI_SCRIPT_URL: `${host}/script.js`,
  NEXT_PUBLIC_UMAMI_WEBSITE_ID: websiteId,
  NEXT_PUBLIC_UMAMI_HOST_URL: host,
}

if (domains) {
  updates.NEXT_PUBLIC_UMAMI_DOMAINS = domains
}

const envPath = path.resolve(process.cwd(), '.env.local')
upsertEnv(envPath, updates)

console.log(`Updated ${envPath}`)
for (const [key, value] of Object.entries(updates)) {
  console.log(`  ${key}=${value}`)
}
