#!/usr/bin/env node
// Seed the master corpus from work already done, then merge in all harvest sources.
// Idempotent — safe to re-run; it only adds/fills, never clobbers.
//
// Run: node scripts/pipeline/seed-master.mjs

import { readFile, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadMaster, saveMaster, addTitles, stats } from './master.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = resolve(__dirname, '..', 'output')
const HARVEST_DIR = resolve(OUTPUT_DIR, 'harvest')

async function readJson(p) {
  return JSON.parse(await readFile(p, 'utf8'))
}

async function main() {
  const master = await loadMaster()

  // 1. Seed from the original langlinks pass (candidates.json) — titles + langlinkCount.
  const candidatesPath = resolve(OUTPUT_DIR, 'candidates.json')
  if (existsSync(candidatesPath)) {
    const cand = await readJson(candidatesPath)
    addTitles(master, cand.rows.map((r) => r.title), 'unusual-articles')
    let filled = 0
    for (const r of cand.rows) {
      if (master[r.title] && master[r.title].langlinkCount === null && r.langlinkCount !== null) {
        master[r.title].langlinkCount = r.langlinkCount
        filled++
      }
    }
    console.log(`seeded ${cand.rows.length} titles from candidates.json (${filled} langlink counts)`)
  }

  // 2. Seed decisions from the LLM tagger output (prefer final tagged.json, fall back to checkpoint).
  const taggedPath = resolve(OUTPUT_DIR, 'tagged.json')
  const checkpointPath = resolve(OUTPUT_DIR, 'tagged-checkpoint.json')
  let taggedRows = null
  if (existsSync(taggedPath)) taggedRows = (await readJson(taggedPath)).rows
  else if (existsSync(checkpointPath)) taggedRows = (await readJson(checkpointPath)).tagged
  if (taggedRows) {
    let filled = 0
    for (const r of taggedRows) {
      if (master[r.title] && master[r.title].decision === null && r.decision) {
        master[r.title].decision = r.decision
        master[r.title].reason = r.reason || null
        filled++
      }
    }
    console.log(`seeded ${filled} decisions from LLM tagger output`)
  }

  // 3. Merge in every harvest source file (scripts/output/harvest/*.json).
  if (existsSync(HARVEST_DIR)) {
    const files = (await readdir(HARVEST_DIR)).filter((f) => f.endsWith('.json'))
    for (const f of files) {
      const data = await readJson(resolve(HARVEST_DIR, f))
      if (!Array.isArray(data.titles)) continue
      const added = addTitles(master, data.titles, data.source || f.replace('.json', ''))
      console.log(`merged ${data.titles.length} from ${f} (${added} new)`)
    }
  }

  await saveMaster(master)
  console.log('\nMaster stats:')
  console.log(JSON.stringify(stats(master), null, 2))
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
