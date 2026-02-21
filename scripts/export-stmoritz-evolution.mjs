import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const React = require('react')
const { renderToStaticMarkup } = require('react-dom/server')
const ts = require('typescript')

const ROOT = process.cwd()
const outDir = path.join(ROOT, 'public', 'stamps', 'evolution')
fs.mkdirSync(outDir, { recursive: true })

const versions = [
  { id: 'v101-redesign', commit: 'd530c34' },
  { id: 'v1-0-2', commit: '51f506d' },
  { id: 'v1-0-3', commit: '3878a6e' },
  { id: 'v1-0-3a', commit: '8b20043' },
  { id: 'v1-0-3b', commit: '663f015' },
]

const props = {
  name: 'St. Moritz',
  destinationId: 'st-moritz',
  altitude: 1822,
  region: 'Engadin, GR',
  type: 'ski',
  country: 'CH',
  types: ['mountain', 'lake', 'town'],
  description: 'Iconic Engadin alpine resort with ski pistes and winter sports.',
  planTemplate: 'Arrive via scenic train | Lake walk | Ski and alpine terrace',
  tourismTags: ['ski', 'alpine', 'winter'],
  tourismHighlights: ['Engadin slopes', 'Snow panorama', 'Mountain village'],
}

for (const version of versions) {
  const source = execSync(`git show ${version.commit}:src/components/DestinationStamp.tsx`, {
    cwd: ROOT,
    encoding: 'utf8',
  })

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
      skipLibCheck: true,
    },
  }).outputText

  const mod = { exports: {} }
  const fn = new Function('exports', 'module', 'require', '__filename', '__dirname', transpiled)
  fn(mod.exports, mod, require, 'DestinationStamp.tsx', ROOT)
  const DestinationStamp = mod.exports.DestinationStamp
  if (typeof DestinationStamp !== 'function') {
    throw new Error(`Could not load DestinationStamp from ${version.commit}`)
  }

  const svgBody = renderToStaticMarkup(React.createElement(DestinationStamp, props))
  const svg = svgBody.startsWith('<?xml')
    ? svgBody
    : `<?xml version="1.0" encoding="UTF-8"?>\n${svgBody}`

  fs.writeFileSync(path.join(outDir, `stmoritz-${version.id}.svg`), svg)
}

console.log(`Exported ${versions.length} St. Moritz stamp versions to ${outDir}`)
