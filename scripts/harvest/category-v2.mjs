#!/usr/bin/env node
// Second-pass category crawler for categories reclaimed after the v1 probe
// found their correct names. Writes to scripts/output/harvest/category-v2.json
// which seed-master.mjs merges in alongside the v1 output.

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crawlCategory } from './lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT = resolve(__dirname, '..', 'output', 'harvest', 'category-v2.json')

const SEED_CATEGORIES = [
  { cat: 'Category:Pretenders', depth: 1 },
  { cat: 'Category:Accidental deaths', depth: 1 },
  { cat: 'Category:Folk festivals', depth: 1 },
  { cat: 'Category:Mass psychogenic illness', depth: 1 },
  { cat: 'Category:Moral panic', depth: 1 },
  { cat: 'Category:Unexplained phenomena', depth: 1 },
  { cat: 'Category:Counterfeiters', depth: 1 },
  { cat: 'Category:Parodies', depth: 2 },
  { cat: 'Category:Satire', depth: 1 },
  { cat: 'Category:Lists of unusual deaths', depth: 1 },
]

async function main() {
  const all = new Set()
  const perCat = {}
  for (const { cat, depth } of SEED_CATEGORIES) {
    process.stdout.write(`${cat} (d${depth})... `)
    try {
      const seen = await crawlCategory(cat, { maxDepth: depth })
      for (const t of seen) all.add(t)
      perCat[cat] = seen.size
      console.log(`${seen.size} (total ${all.size})`)
    } catch (err) {
      console.log(`FAILED: ${err.message}`)
    }
  }
  const titles = [...all].filter(
    (t) => !t.startsWith('List of') && !t.startsWith('Category:') && !t.startsWith('Wikipedia:'),
  )
  await mkdir(dirname(OUTPUT), { recursive: true })
  await writeFile(OUTPUT, JSON.stringify({ source: 'category-crawl-v2', generatedAt: new Date().toISOString(), perCat, titles }, null, 2))
  console.log(`\nWrote ${titles.length} titles to ${OUTPUT}`)
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
