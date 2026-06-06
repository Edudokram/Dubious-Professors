#!/usr/bin/env node
// Pipeline stage: fill langlinkCount + qid for any master entry that lacks them.
// Idempotent and resumable — only touches entries with langlinkCount === null.
// Saves the master every N batches so interruptions lose at most a few batches.
//
// langlinks  -> obscurity signal (cheap filter before the expensive LLM stage)
// qid        -> durability anchor (lets revalidate.mjs self-heal renamed/deleted pages)
//
// Run: node scripts/pipeline/enrich-langlinks.mjs

import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadMaster, saveMaster, stats } from './master.mjs'

const BATCH_SIZE = 20
const LANGLINKS_LIMIT = 500
const AUTO_CUT_THRESHOLD = 30          // matches the rest of the pipeline
const SAVE_EVERY_BATCHES = 25

async function main() {
  const master = await loadMaster()
  const pending = Object.keys(master).filter((t) => master[t].langlinkCount === null)
  console.log(`${pending.length} titles need langlinks (of ${Object.keys(master).length} total)`)

  let processed = 0
  let batchesSinceSave = 0
  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE)
    const counts = await fetchLanglinkCountsWithContinue(batch)
    for (const t of batch) {
      const rec = counts.get(t)
      const entry = master[t]
      entry.langlinkCount = rec ? rec.count : 0
      entry.qid = rec?.qid || null
      entry.exists = rec ? rec.exists : false
      entry.lastChecked = new Date().toISOString()
    }
    processed += batch.length
    process.stdout.write(`  ${processed}/${pending.length}\r`)
    if (++batchesSinceSave >= SAVE_EVERY_BATCHES) {
      await saveMaster(master)
      batchesSinceSave = 0
    }
  }
  await saveMaster(master)
  console.log('\nDone. Master stats:')
  console.log(JSON.stringify(stats(master), null, 2))
}

// Proper batched langlinks fetch with continuation (handles the per-response cap).
async function fetchLanglinkCountsWithContinue(titles) {
  const { fetchWithBackoff, USER_AGENT } = await import('../harvest/lib.mjs')
  const WP_API = 'https://en.wikipedia.org/w/api.php'
  const counts = new Map()
  for (const t of titles) counts.set(t, { count: 0, qid: null, exists: true })
  let cont = {}
  while (true) {
    const sp = new URLSearchParams({
      action: 'query', format: 'json', origin: '*',
      titles: titles.join('|'),
      prop: 'langlinks|pageprops',
      lllimit: String(LANGLINKS_LIMIT),
      ppprop: 'wikibase_item',
      ...cont,
    })
    const res = await fetchWithBackoff(`${WP_API}?${sp}`)
    const data = await res.json()
    const query = data.query || {}
    const norm = new Map()
    for (const t of titles) norm.set(t, t)
    for (const n of query.normalized || []) norm.set(n.to, n.from)
    for (const r of query.redirects || []) norm.set(r.to, norm.get(r.from) || r.from)
    for (const page of Object.values(query.pages || {})) {
      const orig = norm.get(page.title) || page.title
      const rec = counts.get(orig) || { count: 0, qid: null, exists: true }
      if (page.missing !== undefined) rec.exists = false
      else {
        rec.count += page.langlinks?.length || 0
        if (page.pageprops?.wikibase_item) rec.qid = page.pageprops.wikibase_item
      }
      counts.set(orig, rec)
    }
    if (data.continue) {
      const allOver = [...counts.values()].every((c) => !c.exists || c.count >= AUTO_CUT_THRESHOLD)
      if (allOver) break
      cont = data.continue
    } else break
  }
  return counts
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
