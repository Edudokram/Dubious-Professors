#!/usr/bin/env node
// Durability self-heal. Run periodically (e.g. quarterly) to keep the shipped
// title list valid years into the future without manual work.
//
// For every entry in the master that has a QID:
//   - Ask Wikidata (by QID) for the CURRENT English Wikipedia sitelink (title).
//   - If the article was renamed, update master[oldTitle] -> note new title.
//   - If the article was deleted / lost its enwiki sitelink, mark exists=false
//     (build-final will drop it).
//
// QIDs are permanent, so this resolves renames and deletions that plain title
// links can't survive. After running, re-run build-final.mjs to refresh the app list.
//
// Run: node scripts/pipeline/revalidate.mjs [--limit=N]

import { loadMaster, saveMaster, stats } from './master.mjs'
import { fetchWithBackoff } from '../harvest/lib.mjs'

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')))
const LIMIT = args.limit ? parseInt(args.limit, 10) : Infinity
const BATCH = 50 // Wikidata wbgetentities accepts up to 50 ids
const SAVE_EVERY = 10

// Resolve current enwiki titles for a batch of QIDs. Returns Map<qid, title|null>.
async function resolveQids(qids) {
  const url =
    'https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&origin=*' +
    `&props=sitelinks&sitefilter=enwiki&ids=${qids.join('|')}`
  const res = await fetchWithBackoff(url)
  const data = await res.json()
  const out = new Map()
  for (const qid of qids) {
    const ent = data.entities?.[qid]
    const title = ent?.sitelinks?.enwiki?.title || null
    out.set(qid, title)
  }
  return out
}

async function main() {
  const master = await loadMaster()
  // Entries we can revalidate: have a QID, currently kept (worth maintaining).
  const entries = Object.entries(master).filter(([, e]) => e.qid && e.decision === 'keep').slice(0, LIMIT)
  console.log(`revalidating ${entries.length} kept titles by QID...`)

  // Group by QID for batch lookup.
  const qidToTitles = new Map()
  for (const [title, e] of entries) {
    if (!qidToTitles.has(e.qid)) qidToTitles.set(e.qid, [])
    qidToTitles.get(e.qid).push(title)
  }
  const qids = [...qidToTitles.keys()]

  let renamed = 0, deleted = 0, ok = 0, processed = 0, sinceSave = 0
  for (let i = 0; i < qids.length; i += BATCH) {
    const batch = qids.slice(i, i + BATCH)
    const resolved = await resolveQids(batch)
    for (const qid of batch) {
      const currentTitle = resolved.get(qid)
      for (const oldTitle of qidToTitles.get(qid)) {
        const e = master[oldTitle]
        e.lastChecked = new Date().toISOString()
        if (!currentTitle) {
          e.exists = false
          deleted++
        } else if (currentTitle !== oldTitle) {
          // Renamed: record the new title as a fresh entry, retire the old one.
          e.exists = false
          e.renamedTo = currentTitle
          if (!master[currentTitle]) {
            master[currentTitle] = { ...e, exists: true, renamedTo: undefined, sources: [...e.sources, 'revalidate-rename'] }
          }
          renamed++
        } else {
          e.exists = true
          ok++
        }
      }
    }
    processed += batch.length
    process.stdout.write(`  ${processed}/${qids.length}\r`)
    if (++sinceSave >= SAVE_EVERY) { await saveMaster(master); sinceSave = 0 }
  }
  await saveMaster(master)
  console.log(`\nDone. ok=${ok} renamed=${renamed} deleted=${deleted}`)
  console.log('Re-run build-final.mjs to refresh the shipped list.')
  console.log(JSON.stringify(stats(master), null, 2))
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
