#!/usr/bin/env node
// Harvester: "See Also" / outlink snowball. Weird articles link to other weird
// articles. Seed from titles we ALREADY judged "keep" (in master.json), harvest
// their outgoing article links, and emit the new ones as candidates. Compounding:
// each curation round's keepers seed the next round's discovery.
//
// Output: scripts/output/harvest/snowball.json -> { source, titles: [...] }
//
// Run: node scripts/harvest/snowball.mjs [--seeds=N]

import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchOutlinks, sleep } from './lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT = resolve(__dirname, '..', 'output', 'harvest', 'snowball.json')
const MASTER_PATH = resolve(__dirname, '..', 'output', 'master.json')

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const MAX_SEEDS = args.seeds ? parseInt(args.seeds, 10) : 800 // cap to keep the run bounded
const BATCH = 20

async function main() {
  if (!existsSync(MASTER_PATH)) {
    console.error('No master.json yet — run the pipeline first so we have "keep" seeds.')
    process.exit(1)
  }
  const master = JSON.parse(await readFile(MASTER_PATH, 'utf8'))

  // Seeds = titles we already love. Prefer the most obscure keepers (lowest langlinks)
  // since their neighbors are likeliest to also be obscure gems.
  const seeds = Object.entries(master)
    .filter(([, e]) => e.decision === 'keep' && e.exists !== false)
    .sort((a, b) => (a[1].langlinkCount ?? 0) - (b[1].langlinkCount ?? 0))
    .slice(0, MAX_SEEDS)
    .map(([t]) => t)

  console.log(`snowballing from ${seeds.length} "keep" seeds...`)

  const discovered = new Set()
  let processed = 0
  for (let i = 0; i < seeds.length; i += BATCH) {
    const batch = seeds.slice(i, i + BATCH)
    const linkMap = await fetchOutlinks(batch)
    for (const links of linkMap.values()) {
      for (const l of links) {
        // Only keep genuinely new titles (not already in master).
        if (!master[l] && !l.startsWith('List of') && !l.includes('(disambiguation)')) {
          discovered.add(l)
        }
      }
    }
    processed += batch.length
    process.stdout.write(`  ${processed}/${seeds.length} seeds, ${discovered.size} new candidates\r`)
    await sleep(150)
  }

  const titles = [...discovered]
  await mkdir(dirname(OUTPUT), { recursive: true })
  await writeFile(
    OUTPUT,
    JSON.stringify({ source: 'see-also-snowball', generatedAt: new Date().toISOString(), seedCount: seeds.length, titles }, null, 2),
  )
  console.log(`\nWrote ${titles.length} new candidate titles to ${OUTPUT}`)
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
