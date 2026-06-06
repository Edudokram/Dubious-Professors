#!/usr/bin/env node
// Stage: produce the final shipping list from the master corpus.
//
// Reads scripts/output/master.json (preferred) or falls back to the legacy
// candidates/tagged files. Applies allow/deny overrides. Emits TWO artifacts:
//   - src/data/curatedTitles.json : ["Title", ...]                (what the game loads)
//   - src/data/curatedTitles.meta.json : [{title, qid}, ...]      (durability anchor for revalidate.mjs)
//
// Run: node scripts/build-final.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MASTER_PATH = resolve(__dirname, 'output', 'master.json')
const CANDIDATES_PATH = resolve(__dirname, 'output', 'candidates.json')
const TAGGED_PATH = resolve(__dirname, 'output', 'tagged.json')
const OVERRIDES_PATH = resolve(__dirname, 'overrides.json')
const FINAL_PATH = resolve(__dirname, '..', 'src', 'data', 'curatedTitles.json')
const META_PATH = resolve(__dirname, '..', 'src', 'data', 'curatedTitles.meta.json')

async function loadJsonIfExists(p) {
  if (!existsSync(p)) return null
  return JSON.parse(await readFile(p, 'utf8'))
}

async function main() {
  const overrides = (await loadJsonIfExists(OVERRIDES_PATH)) || { allow: [], deny: [] }
  const denySet = new Set(overrides.deny.map((s) => s.toLowerCase()))

  let kept = [] // [{ title, qid }]
  let source

  const master = await loadJsonIfExists(MASTER_PATH)
  if (master && Object.keys(master).length) {
    for (const [title, e] of Object.entries(master)) {
      if (e.decision === 'keep' && e.exists !== false) kept.push({ title, qid: e.qid || null })
    }
    source = `master.json (${Object.keys(master).length} total entries)`
  } else {
    // Legacy fallback.
    const tagged = await loadJsonIfExists(TAGGED_PATH)
    const candidates = await loadJsonIfExists(CANDIDATES_PATH)
    if (tagged?.rows?.length) {
      kept = tagged.rows.filter((r) => r.decision === 'keep').map((r) => ({ title: r.title, qid: null }))
      source = 'tagged.json (legacy)'
    } else if (candidates?.rows?.length) {
      kept = candidates.rows.filter((r) => r.status === 'auto-keep').map((r) => ({ title: r.title, qid: null }))
      source = 'candidates.json (legacy, langlinks-only)'
    } else {
      console.error('No input data found.')
      process.exit(1)
    }
  }

  // Apply deny, then allow (allow wins).
  const byTitle = new Map()
  for (const { title, qid } of kept) {
    if (denySet.has(title.toLowerCase())) continue
    byTitle.set(title, qid)
  }
  for (const title of overrides.allow) if (!byTitle.has(title)) byTitle.set(title, null)

  const sorted = [...byTitle.entries()].sort((a, b) => a[0].localeCompare(b[0], 'en'))
  const titles = sorted.map(([t]) => t)
  const meta = sorted.map(([title, qid]) => ({ title, qid }))

  await mkdir(dirname(FINAL_PATH), { recursive: true })
  await writeFile(FINAL_PATH, JSON.stringify(titles, null, 2))
  await writeFile(META_PATH, JSON.stringify(meta, null, 2))

  console.log(`source: ${source}`)
  console.log(`final list: ${titles.length} titles (${meta.filter((m) => m.qid).length} with QID anchor)`)
  console.log(`deny overrides: ${overrides.deny.length}, allow overrides: ${overrides.allow.length}`)
  console.log(`wrote ${FINAL_PATH}`)
  console.log(`wrote ${META_PATH}`)
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
