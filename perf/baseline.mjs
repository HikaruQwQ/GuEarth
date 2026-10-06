import { closeSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, readSync, renameSync, statSync, writeFileSync } from 'fs'
import { join, relative } from 'path'
import { tmpdir } from 'os'
import vm from 'vm'

const userData = join(process.env.APPDATA ?? '', 'GuEarth')
const repo = process.cwd()
const out = []
const push = (line) => out.push(line)
const mb = (bytes) => (bytes / 1048576).toFixed(2)
const round = (value, digits = 2) => Number(value.toFixed(digits))
const target = join(repo, 'perf', 'baseline.md')

function flush() {
  try {
    writeFileSync(target, out.join('\n'), 'utf8')
  } catch {
    return
  }
}

function section(title, body) {
  push(title)
  push('')
  try {
    body()
  } catch (error) {
    push(`- section failed: ${error instanceof Error ? error.message : 'unknown'}`)
  }
  push('')
  flush()
}

function bench(label, fn, iterations = 3) {
  const samples = []
  for (let index = 0; index < iterations; index += 1) {
    const started = process.hrtime.bigint()
    fn()
    samples.push(Number(process.hrtime.bigint() - started) / 1e6)
  }
  samples.sort((a, b) => a - b)
  push(`- ${label}: median ${round(samples[Math.floor(samples.length / 2)])} ms (n=${iterations}, min ${round(samples[0])}, max ${round(samples[samples.length - 1])})`)
  return samples
}

function walk(root, budget = 200000) {
  const files = []
  const stack = [root]
  while (stack.length && files.length < budget) {
    const current = stack.pop()
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else files.push(full)
    }
  }
  return files
}

push('# GuEarth performance baseline')
push('')
push(`- captured: ${new Date().toISOString()}`)
push(`- platform: ${process.platform} ${process.arch}, node ${process.version}`)
push(`- userData: ${userData}`)
push('')

push('## 1. userData inventory')
push('')
const appFiles = ['settings.json', 'annotations.json', 'scenes.json', 'ai-settings.json', 'ai-chat-history.json', 'ai-memories.json', 'earthquakes.json']
push('| file | bytes |')
push('| --- | --- |')
for (const name of appFiles) {
  const path = join(userData, name)
  try {
    push(`| ${name} | ${statSync(path).size} |`)
  } catch {
    push(`| ${name} | missing |`)
  }
}
push('')

let allFiles = []
let walkMs = 0
bench('recursive walk of userData (stat every file)', () => {
  const started = process.hrtime.bigint()
  allFiles = walk(userData)
  walkMs = Number(process.hrtime.bigint() - started) / 1e6
}, 1)
push(`- files walked: ${allFiles.length}`)

const byDir = new Map()
let totalBytes = 0
for (const file of allFiles) {
  let size = 0
  try {
    size = statSync(file).size
  } catch {
    size = 0
  }
  totalBytes += size
  const key = relative(userData, file).split(/[\\/]/)[0]
  const bucket = byDir.get(key) ?? { count: 0, bytes: 0 }
  bucket.count += 1
  bucket.bytes += size
  byDir.set(key, bucket)
}
push(`- total: ${mb(totalBytes)} MB across ${allFiles.length} files`)
push('')
push('| top-level entry | files | MB |')
push('| --- | --- | --- |')
for (const [key, bucket] of [...byDir.entries()].sort((a, b) => b[1].bytes - a[1].bytes)) {
  push(`| ${key} | ${bucket.count} | ${mb(bucket.bytes)} |`)
}
push('')

const tileMeta = allFiles.filter((file) => file.endsWith('.json') && /tile/i.test(file))
const tileBins = allFiles.filter((file) => file.endsWith('.bin'))
push('## 2. tile cache')
push('')
push(`- tile meta files (.json under a path matching /tile/): ${tileMeta.length}`)
push(`- tile payload files (.bin anywhere): ${tileBins.length}`)
if (tileBins.length) {
  const sample = tileBins.slice(0, 200)
  const metas = sample.map((file) => file.replace(/\.bin$/, '.json'))
  const tileRoot = join(userData, 'tile-cache')
  let bytes = 0
  for (const file of tileBins) { try { bytes += statSync(file).size } catch { } }
  push(`- tile payload bytes total: ${mb(bytes)} MB, average per tile: ${round(bytes / tileBins.length / 1024)} KB`)
  bench('replicate readTile x200 (2x existsSync + read json + parse + read bin)', () => {
    for (let index = 0; index < sample.length; index += 1) {
      const dataPath = sample[index]
      const metaPath = metas[index]
      if (!statSync(dataPath).isFile() || !statSync(metaPath).isFile()) continue
      const metadata = JSON.parse(readFileSync(metaPath, 'utf8'))
      if (typeof metadata.contentType !== 'string') continue
      readFileSync(dataPath)
    }
  })
  bench('collectFiles + statSync on the real tile cache (cacheStats path)', () => {
    const stack = [tileRoot]
    while (stack.length) {
      const current = stack.pop()
      for (const entry of readdirSync(current, { withFileTypes: true })) {
        const full = join(current, entry.name)
        if (entry.isDirectory()) stack.push(full)
        else if (full.endsWith('.bin')) statSync(full)
      }
    }
  }, 1)
  const scratch = mkdtempSync(join(tmpdir(), 'guearth-perf-'))
  const payload = Buffer.alloc(Math.max(1024, Math.round(bytes / tileBins.length)))
  bench('replicate writeTile x200 (recursive mkdir + write bin + write meta)', () => {
    for (let index = 0; index < 200; index += 1) {
      const dir = join(scratch, `p${index % 4}`, `s${index % 3}`, `l${index % 8}`, `x${index % 16}`)
      mkdirSync(dir, { recursive: true })
      const base = join(dir, `t${index}`)
      writeFileSync(`${base}.bin`, payload)
      writeFileSync(`${base}.json`, JSON.stringify({ contentType: 'image/png', expiresAt: Date.now() + 86400000 }), 'utf8')
    }
  })
}
push('')

push('## 3. write cost of the JSON stores (measured on the real files)')
push('')
for (const name of ['ai-chat-history.json', 'annotations.json', 'earthquakes.json']) {
  const path = join(userData, name)
  let parsed
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    push(`- ${name}: unreadable, skipped`)
    continue
  }
  const compact = JSON.stringify(parsed)
  const pretty = JSON.stringify(parsed, null, 2)
  push(`- ${name}: compact ${mb(Buffer.byteLength(compact))} MB, pretty ${mb(Buffer.byteLength(pretty))} MB`)
  bench(`${name} :: stringify compact`, () => { JSON.stringify(parsed) })
  bench(`${name} :: stringify pretty (current code path)`, () => { JSON.stringify(parsed, null, 2) })
}
try {
  const feed = JSON.parse(readFileSync(join(userData, 'earthquakes.json'), 'utf8'))
  push('')
  push(`- earthquakes.json top-level: ${Object.keys(feed).join(', ')}`)
  for (const [key, value] of Object.entries(feed)) {
    if (Array.isArray(value)) push(`- earthquakes.json ${key}: ${value.length} items`)
  }
} catch {
  push('- earthquakes.json unreadable')
}
flush()

section('## 4. V8 parse + compile cost of the shipped bundles', () => {
  const moduleClass = vm.SourceTextModule
  push(`- vm.SourceTextModule available: ${moduleClass ? 'yes' : 'no (run with --experimental-vm-modules)'}`)
  const scripts = []
  try {
    const assets = join(repo, 'out', 'renderer', 'assets')
    for (const entry of readdirSync(assets)) {
      if (entry.endsWith('.js')) scripts.push(join(assets, entry))
    }
  } catch {
    push('- out/renderer/assets missing, run npm run build first')
  }
  scripts.push(join(repo, 'node_modules', 'cesium', 'Build', 'Cesium', 'Cesium.js'))
  for (const file of scripts) {
    let source = ''
    try {
      source = readFileSync(file, 'utf8')
    } catch {
      push(`- ${file}: missing`)
      continue
    }
    const label = relative(repo, file)
    const size = mb(Buffer.byteLength(source))
    let mode = 'script'
    try {
      new vm.Script(source, { filename: file })
    } catch {
      mode = moduleClass ? 'module' : 'unsupported'
    }
    if (mode === 'unsupported') {
      push(`- ${label} (${size} MB): skipped, needs --experimental-vm-modules`)
      continue
    }
    let compiled
    bench(`${label} (${size} MB, ${mode}) parse+compile`, () => {
      compiled = mode === 'module' ? new moduleClass(source, { identifier: file }) : new vm.Script(source, { filename: file })
    }, 3)
    if (!compiled) push(`- ${label}: compile failed`)
  }
})

section('## 5. cesium package layout', () => {
  try {
    const pkg = JSON.parse(readFileSync(join(repo, 'node_modules', 'cesium', 'package.json'), 'utf8'))
    push(`- version: ${pkg.version}`)
    push(`- main: ${pkg.main ?? '(none)'}`)
    push(`- module: ${pkg.module ?? '(none)'}`)
    push(`- exports: ${pkg.exports ? JSON.stringify(pkg.exports) : '(none)'}`)
  } catch {
    push('- node_modules/cesium/package.json unreadable')
  }
  for (const candidate of ['index.js', 'index.cjs', 'Source/Cesium.js', 'Build/Cesium/index.js', 'Build/Cesium/Cesium.js']) {
    const path = join(repo, 'node_modules', 'cesium', candidate)
    try {
      push(`- ${candidate}: ${mb(statSync(path).size)} MB`)
    } catch {
      push(`- ${candidate}: missing`)
    }
  }
})

push('## 6. startup-critical remote calls')
push('')
const endpoints = [
  ['arcgis terrain metadata', 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer?f=json'],
  ['terrain height tile z3 (LERC)', 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer/tile/3/3/4'],
  ['osm imagery tile z3', 'https://tile.openstreetmap.org/3/4/3.png'],
  ['esri imagery tile z3', 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/3/3/4']
]
push('| endpoint | sample | ms | bytes | status |')
push('| --- | --- | --- | --- | --- |')
for (const [label, url] of endpoints) {
  for (let index = 0; index < 3; index += 1) {
    const started = process.hrtime.bigint()
    let bytes = -1
    let status = 'error'
    try {
      const response = await fetch(url)
      status = String(response.status)
      const buffer = Buffer.from(await response.arrayBuffer())
      bytes = buffer.length
    } catch (error) {
      status = `error: ${error instanceof Error ? error.name : 'unknown'}`
    }
    push(`| ${label} | ${index + 1} | ${round(Number(process.hrtime.bigint() - started) / 1e6)} | ${bytes} | ${status} |`)
  }
}
push('')

flush()
console.log(out.join('\n'))
console.log('')
console.log(`written: ${target}`)
