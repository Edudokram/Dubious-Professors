#!/usr/bin/env node
// Pull in-game title feedback from Firebase into overrides.json's deny list,
// closing the self-improving curation loop: players flag boring/too-famous titles
// on the results screen (feedback/<key> = { title, downvotes }) -> titles at or
// above the threshold get denied -> they vanish from the next build-final run.
//
// Run: node scripts/pipeline/pull-feedback.mjs [--threshold=3] [--dburl=<rtdb>]
// Then: node scripts/build-final.mjs   (to actually ship the change)

import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { USER_AGENT } from '../harvest/lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OVERRIDES = resolve(__dirname, '..', 'overrides.json')

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true] }),
)
const THRESHOLD = parseInt(args.threshold || '3', 10)
const DRY = Boolean(args.dry)
const DB_URL = String(args.dburl || 'https://dubious-professors-default-rtdb.firebaseio.com').replace(/\/$/, '')

async function main() {
  const res = await fetch(`${DB_URL}/feedback.json`, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`feedback fetch ${res.status} ${res.statusText} (RTDB read rules may block public reads)`)
  const feedback = await res.json()
  if (!feedback) { console.log('No feedback recorded yet.'); return }

  const flagged = Object.values(feedback)
    .filter((f) => f && typeof f.title === 'string' && (f.downvotes || 0) >= THRESHOLD)
    .map((f) => ({ title: f.title, downvotes: f.downvotes || 0 }))
    .sort((a, b) => b.downvotes - a.downvotes)

  const overrides = JSON.parse(await readFile(OVERRIDES, 'utf8'))
  const denyLower = new Set(overrides.deny.map((s) => s.toLowerCase()))
  const allowLower = new Set(overrides.allow.map((s) => s.toLowerCase()))

  let added = 0
  for (const { title, downvotes } of flagged) {
    const key = title.toLowerCase()
    if (denyLower.has(key) || allowLower.has(key)) continue // already decided (manual allow wins)
    overrides.deny.push(title)
    denyLower.add(key)
    added++
    console.log(`  ${DRY ? '[dry] would deny' : '+ deny'} "${title}" (${downvotes} downvotes)`)
  }

  if (added && !DRY) await writeFile(OVERRIDES, JSON.stringify(overrides, null, 2) + '\n')
  console.log(`\n${flagged.length} title(s) at >= ${THRESHOLD} downvotes; added ${added} new deny entr${added === 1 ? 'y' : 'ies'}.`)
  console.log(added ? 'Re-run scripts/build-final.mjs to ship the updated list.' : 'No changes.')
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
