// The master corpus: a single source of truth for all candidate titles across
// all harvest sources and all pipeline stages.
//
// Shape (keyed by title for natural dedup):
//   {
//     "Feast of the Ass": {
//       qid: "Q1234567" | null,        // Wikidata id (durability anchor)
//       langlinkCount: 7 | null,        // obscurity signal (null = not yet fetched)
//       decision: "keep"|"cut"|null,    // LLM taste verdict (null = not yet judged)
//       reason: "..." ,                 // LLM rationale
//       exists: true|false,             // article currently resolves
//       sources: ["unusual-articles","category-crawl"],
//       firstSeen: "ISO", lastChecked: "ISO"
//     }
//   }
//
// Every stage is idempotent: it only touches entries missing the field it owns,
// so the whole pipeline is resumable and incremental. Re-running a harvester just
// adds new titles + source tags; it never clobbers existing enrichment.

import { readFile, writeFile, mkdir, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const MASTER_PATH = resolve(__dirname, '..', 'output', 'master.json')

export async function loadMaster() {
  if (!existsSync(MASTER_PATH)) return {}
  return JSON.parse(await readFile(MASTER_PATH, 'utf8'))
}

// Atomic write (write temp then rename) so an interrupted save can't corrupt the master.
export async function saveMaster(master) {
  await mkdir(dirname(MASTER_PATH), { recursive: true })
  const tmp = MASTER_PATH + '.tmp'
  await writeFile(tmp, JSON.stringify(master, null, 2))
  await rename(tmp, MASTER_PATH)
}

// Add a batch of titles from a given source. Returns count of newly-added titles.
export function addTitles(master, titles, source) {
  const now = new Date().toISOString()
  let added = 0
  for (const title of titles) {
    if (!title || title.startsWith('List of') || title.includes('(disambiguation)')) continue
    if (!master[title]) {
      master[title] = {
        qid: null,
        langlinkCount: null,
        decision: null,
        reason: null,
        exists: null,
        sources: [source],
        firstSeen: now,
        lastChecked: null,
      }
      added++
    } else if (!master[title].sources.includes(source)) {
      master[title].sources.push(source)
    }
  }
  return added
}

export function stats(master) {
  const vals = Object.values(master)
  return {
    total: vals.length,
    withLanglinks: vals.filter((v) => v.langlinkCount !== null).length,
    withDecision: vals.filter((v) => v.decision !== null).length,
    kept: vals.filter((v) => v.decision === 'keep').length,
    cut: vals.filter((v) => v.decision === 'cut').length,
    withQid: vals.filter((v) => v.qid).length,
    bySource: vals.reduce((acc, v) => {
      for (const s of v.sources) acc[s] = (acc[s] || 0) + 1
      return acc
    }, {}),
  }
}
