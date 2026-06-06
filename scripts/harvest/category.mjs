#!/usr/bin/env node
// Harvester: recursively crawl inherently-funny Wikipedia categories for candidate titles.
//
// Round 2 list: fixes the categories that returned 0 last time (wrong names or container-only),
// retries ones that may have hit rate limits, and adds new high-yield categories.
//
// Output: scripts/output/harvest/category.json  -> { source, titles: [...] }
//
// Run: node scripts/harvest/category.mjs

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crawlCategory } from './lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT = resolve(__dirname, '..', 'output', 'harvest', 'category.json')

const SEED_CATEGORIES = [
  // Working from previous round (kept)
  { cat: 'Category:Hoaxes', depth: 2 },
  { cat: 'Category:Internet memes', depth: 2 },
  { cat: 'Category:Practical jokes', depth: 2 },
  { cat: 'Category:Novelty songs', depth: 1 },
  { cat: 'Category:Cryptids', depth: 2 },
  { cat: 'Category:Conspiracy theories', depth: 1 },
  { cat: 'Category:Urban legends', depth: 2 },
  { cat: 'Category:Cargo cults', depth: 1 },
  { cat: "Category:April Fools' Day jokes", depth: 1 },
  { cat: 'Category:Defunct amusement parks', depth: 1 },
  { cat: 'Category:Pseudoscience', depth: 1 },
  { cat: 'Category:Impostors', depth: 2 },
  { cat: 'Category:Confidence tricks', depth: 1 },
  { cat: 'Category:Microstates', depth: 1 },
  { cat: 'Category:Micronations', depth: 1 },
  { cat: 'Category:Obscenity controversies', depth: 1 },
  { cat: 'Category:Streaking', depth: 1 },
  { cat: 'Category:Roadside attractions', depth: 2 },
  { cat: 'Category:Tax avoidance', depth: 1 },
  { cat: 'Category:Feral children', depth: 1 },

  // FIXED names from probes
  { cat: 'Category:Eccentricity (behavior)', depth: 2 },        // was "Eccentrics" -> 0
  { cat: 'Category:Pretenders', depth: 2 },                       // was "Pretenders to the throne" -> 0
  { cat: 'Category:Fictional foods', depth: 2 },                  // retry; verified it exists
  { cat: 'Category:Fictional foods and drinks', depth: 2 },
  { cat: 'Category:Mass hysteria', depth: 2 },                    // retry; verified it exists

  // NEW high-yield candidates
  { cat: 'Category:Lists of unusual deaths', depth: 1 },
  { cat: 'Category:Daredevils', depth: 1 },
  { cat: 'Category:Hermits', depth: 1 },
  { cat: 'Category:Cult films', depth: 2 },
  { cat: 'Category:Esoteric programming languages', depth: 1 },
  { cat: 'Category:Wikipedia hoaxes', depth: 1 },
  { cat: 'Category:Performance art', depth: 2 },
  { cat: 'Category:Folk religion', depth: 1 },
  { cat: 'Category:Stunts', depth: 1 },
  { cat: 'Category:Heists', depth: 2 },
  { cat: 'Category:Bank robberies', depth: 1 },
  { cat: 'Category:Mascots', depth: 2 },
  { cat: 'Category:Folklore', depth: 1 },              // mostly broad but has weird subcats
  { cat: 'Category:Centenarians', depth: 1 },
  { cat: 'Category:Lists of cryptids', depth: 1 },
  { cat: 'Category:Paranormal hoaxes', depth: 1 },
  { cat: 'Category:Bizarre deaths', depth: 1 },
  { cat: 'Category:Death from animal attacks', depth: 1 },
  { cat: 'Category:Tabloid newspapers', depth: 1 },
  { cat: 'Category:Cults', depth: 1 },
  { cat: 'Category:Esoteric Christianity', depth: 1 },
  { cat: 'Category:Religious controversies', depth: 1 },
  { cat: 'Category:Fictional cryptids', depth: 1 },
  { cat: 'Category:Quackery (medicine)', depth: 1 },   // alt for plain "Quackery"
  { cat: 'Category:Charlatans', depth: 1 },
  { cat: 'Category:Tarring and feathering', depth: 1 },
  { cat: 'Category:Cross-dressing', depth: 1 },
  { cat: 'Category:Whales in popular culture', depth: 1 },
  { cat: 'Category:Roadkill', depth: 1 },
  { cat: 'Category:Toilet humour', depth: 1 },
  { cat: 'Category:Stuntmen', depth: 1 },
]

async function main() {
  const all = new Set()
  const perCat = {}

  for (const { cat, depth } of SEED_CATEGORIES) {
    process.stdout.write(`crawling ${cat} (depth ${depth})... `)
    const before = all.size
    try {
      const seen = await crawlCategory(cat, { maxDepth: depth })
      for (const t of seen) all.add(t)
      perCat[cat] = seen.size
      console.log(`${seen.size} members (+${all.size - before} new, total ${all.size})`)
    } catch (err) {
      console.log(`FAILED: ${err.message}`)
      perCat[cat] = 0
    }
  }

  // Drop obvious non-game titles: list pages, leftovers from other namespaces.
  const titles = [...all].filter(
    (t) => !t.startsWith('List of') && !t.startsWith('Category:') && !t.startsWith('Wikipedia:'),
  )

  await mkdir(dirname(OUTPUT), { recursive: true })
  await writeFile(
    OUTPUT,
    JSON.stringify({ source: 'category-crawl', generatedAt: new Date().toISOString(), perCat, titles }, null, 2),
  )
  console.log(`\nWrote ${titles.length} unique titles to ${OUTPUT}`)
}

main().catch((e) => {
  console.error('FATAL:', e)
  process.exit(1)
})
