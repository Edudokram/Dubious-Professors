#!/usr/bin/env node
// Retroactive heuristic cleanup: apply the same auto-cut patterns that tag-parallel
// uses for NEW titles to the existing KEPT titles in the master. Catches LLM
// false-positives like "John Smith (politician)" or "2011 Indianapolis 500" that
// slipped through earlier rounds.
//
// Dry-run by default; pass --apply to write changes back to master.
//
// Run: node scripts/pipeline/cleanup-heuristic.mjs            (dry-run report)
//      node scripts/pipeline/cleanup-heuristic.mjs --apply    (actually demote)

import { loadMaster, saveMaster, stats } from './master.mjs'

const apply = process.argv.includes('--apply')

const HEURISTIC_CUT_PATTERNS = [
  /^\d{4}$/,
  /^\d{1,4}\s*(?:BC|AD|BCE|CE)\.?$/i,
  /^\d{1,4}[-\u2013\u2014]\d{2,4}\b/,
  /^\d{1,2}\s+\w+\s+\d{4}$/,
  /^\w+\s+\d{1,2},?\s+\d{4}$/,
  /\bseason$/i,
  /^(?:\d{4}\s+)?(?:in\s+\w+|elections?\s+in|in\s+the)/i,
  /^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d/i,
  /\b(?:championship|tournament|league|playoffs|finals|standings)\b.*\d{4}/i,
  /^(?:UEFA|FIFA|NCAA|NFL|NBA|NHL|MLB|UCI|FIA)\s/i,
  /\(footballer(?:,\s*born\s+\d+)?\)$/i,
  /\((?:cricketer|baseball|basketball|hockey|rugby|tennis|golfer)\b[^)]*\)$/i,
  /\((?:politician|MP|senator|judge|lawyer|actor|actress|musician|singer|director|writer|author|painter|sculptor|architect|engineer|scientist|botanist|zoologist|astronomer|mathematician|physicist|chemist|biologist|historian|economist|philosopher)\b[^)]*\)$/i,
  /\(born\s+\d{4}\)$/i,
]

function whichPatternMatches(title) {
  for (const p of HEURISTIC_CUT_PATTERNS) if (p.test(title)) return p.toString()
  return null
}

async function main() {
  const master = await loadMaster()
  const candidates = []
  for (const [title, e] of Object.entries(master)) {
    if (e.decision !== 'keep') continue
    const matched = whichPatternMatches(title)
    if (matched) candidates.push({ title, matched })
  }
  console.log(`${candidates.length} keepers match a junk-pattern and would be demoted.\n`)
  console.log('Sample of what would be cut (every 20th):')
  for (let i = 0; i < candidates.length; i += Math.max(1, Math.floor(candidates.length / 20))) {
    console.log(`  ${candidates[i].title}`)
  }
  if (!apply) {
    console.log('\n(dry-run) — re-run with --apply to actually demote these.')
    return
  }
  for (const { title } of candidates) {
    master[title].decision = 'cut'
    master[title].reason = 'retroactive-heuristic-cleanup'
  }
  await saveMaster(master)
  console.log(`\nApplied. Master stats:`)
  console.log(JSON.stringify(stats(master), null, 2))
  console.log('\nRe-run build-final.mjs to refresh the shipped list.')
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
