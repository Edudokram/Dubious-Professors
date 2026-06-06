#!/usr/bin/env node
// Pipeline stage: LLM taste-tag master entries that pass the langlinks pre-filter
// but don't yet have a decision. Runs N workers concurrently for throughput.
//
// Pre-filter: only tag entries with exists !== false AND langlinkCount < CUT_THRESHOLD.
// Entries above the threshold are auto-cut (famous) without spending an LLM call.
//
// Idempotent + resumable: saves master periodically; only processes decision === null.
//
// Run: node scripts/pipeline/tag-parallel.mjs [--workers=6] [--model=haiku]

import { spawn } from 'node:child_process'
import { loadMaster, saveMaster, stats } from './master.mjs'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)
const WORKERS = parseInt(args.workers || '3', 10)
const MODEL = args.model || 'haiku'
const BATCH_SIZE = 80
const CUT_THRESHOLD = 30           // langlinkCount >= this => auto-cut, skip LLM
const SAVE_EVERY_BATCHES = 3

// Heuristic auto-cut: titles matching these patterns are almost never game-good
// (dates, sport seasons, year-in-X listings). Conservative — we'd rather pass
// borderline titles to the LLM than wrongly cut interesting ones.
const HEURISTIC_CUT_PATTERNS = [
  /^\d{4}$/,                              // "1996"
  /^\d{1,4}\s*(?:BC|AD|BCE|CE)\.?$/i,    // "500 BC"
  /^\d{1,4}[-\u2013\u2014]\d{2,4}\b/,    // "2010-11" or "2010–11"
  /^\d{1,2}\s+\w+\s+\d{4}$/,             // "1 January 2020"
  /^\w+\s+\d{1,2},?\s+\d{4}$/,           // "January 1, 2020"
  /^\d{4}\s+in\s+/i,                     // "1996 in film" (year-prefixed only)
  /^(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d/i,
  /\d{4}.+\bseason$/i,                    // "2010-11 NBA season" (requires year in title)
  /\b(?:championship|tournament|playoffs|finals|standings)\b.*\d{4}/i, // year-specific sport events
  /\(footballer(?:,\s*born\s+\d+)?\)$/i,                  // "John Smith (footballer)"
  /\((?:cricketer|rugby|tennis|golfer)\b[^)]*\)$/i,        // narrower than before — dropped musician/actor/etc.
  /\(born\s+\d{4}\)$/i,                                   // "X (born 1923)"
]

function heuristicCut(title) {
  for (const p of HEURISTIC_CUT_PATTERNS) if (p.test(title)) return true
  return false
}

const SYSTEM_PROMPT = `You are tagging Wikipedia article titles for a party game called Dubious Professors.

In the game, one player secretly read a Wikipedia article and others must bluff that they read it too, improvising from THE TITLE ALONE. The title is everything.

A GOOD ("keep") title is funny, bizarre, intriguing, or unobvious on its face, AND not widely known. It gives bluffers something to riff on. Examples: "Feast of the Ass", "Green Monster", "Bog snorkelling", "Whole stuffed camel", "Jumping Frenchmen of Maine", "A Kitten for Hitler", "Cox-Zucker machine", "Great Canadian Maple Syrup Heist".

A BAD ("cut") title is:
- A common noun or famous proper noun anyone recognizes ("Potato", "Iran", "Fidel Castro")
- Generic-sounding obscure names that don't pique curiosity ("Sokh District", "Banjawarn Station")
- Boring even if obscure ("Response to sneezing", "Pen name")
- A wall of technical/scientific jargon
- A list page, disambiguation page, or meta/Wikipedia-about-itself article

Output ONLY a JSON array, SAME LENGTH and SAME ORDER as the input. Each element: { "decision": "keep" | "cut", "reason": "<5-10 words>" }. No markdown, no preamble.`

function callClaude(userMessage) {
  return new Promise((resolveFn, reject) => {
    const child = spawn(
      'claude.cmd',
      ['-p', '--no-session-persistence', '--permission-mode', 'bypassPermissions', '--model', MODEL, '--output-format', 'text'],
      { shell: true, stdio: ['pipe', 'pipe', 'pipe'] },
    )
    let out = '', err = '', settled = false
    // Ensure even a crashed/hung Bun-wrapped child is force-reaped on any failure
    // path, so subprocesses can't accumulate to the Windows handle limit (the
    // round-4 wedge: spawn UNKNOWN / exit 3221225773 after ~98 leaked children).
    const fail = (e) => { if (settled) return; settled = true; try { child.kill('SIGKILL') } catch {} ; reject(e) }
    const ok = (v) => { if (settled) return; settled = true; resolveFn(v) }
    child.stdout.on('data', (c) => (out += c.toString()))
    child.stderr.on('data', (c) => (err += c.toString()))
    child.on('error', fail)
    child.on('close', (code) => (code === 0 ? ok(out) : fail(new Error(`exit ${code}: ${err.slice(0, 200)}`))))
    try {
      child.stdin.write(SYSTEM_PROMPT + '\n\n' + userMessage)
      child.stdin.end()
    } catch (e) { fail(e) }
  })
}

function parseJsonArray(text) {
  let s = text.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
  const a = s.indexOf('['), b = s.lastIndexOf(']')
  if (a === -1 || b === -1) throw new Error('no array: ' + s.slice(0, 120))
  return JSON.parse(s.slice(a, b + 1))
}

async function tagBatch(titles) {
  const msg = 'Tag each of these titles.\n\n' + JSON.stringify(titles, null, 2)
  let decisions
  try {
    decisions = parseJsonArray(await callClaude(msg))
    if (decisions.length !== titles.length) throw new Error(`len ${decisions.length} != ${titles.length}`)
  } catch (err) {
    // Split-and-retry once.
    const mid = Math.floor(titles.length / 2)
    if (mid === 0) throw err
    const [d1, d2] = await Promise.all([tagBatch(titles.slice(0, mid)), tagBatch(titles.slice(mid))])
    decisions = [...d1, ...d2]
  }
  return decisions
}

async function main() {
  const master = await loadMaster()
  // Auto-cut by langlinks (cheap, no LLM) + by title heuristics (obvious junk).
  let autoCut = 0
  let heurCut = 0
  for (const t of Object.keys(master)) {
    if (master[t].decision !== null) continue
    if ((master[t].langlinkCount ?? 0) >= CUT_THRESHOLD) {
      master[t].decision = 'cut'
      master[t].reason = `auto-cut: ${master[t].langlinkCount} langlinks (widely known)`
      autoCut++
    } else if (heuristicCut(t)) {
      master[t].decision = 'cut'
      master[t].reason = 'auto-cut: title heuristic (date/season/disambig)'
      heurCut++
    }
  }
  console.log(`auto-cut ${autoCut} famous titles by langlinks`)
  console.log(`auto-cut ${heurCut} junk titles by heuristic`)
  const pending = Object.keys(master).filter(
    (t) => master[t].decision === null && master[t].exists !== false && (master[t].langlinkCount ?? 0) < CUT_THRESHOLD,
  )
  console.log(`${pending.length} titles to LLM-tag with ${WORKERS} workers (model: ${MODEL})\n`)

  // Build batches.
  const batches = []
  for (let i = 0; i < pending.length; i += BATCH_SIZE) batches.push(pending.slice(i, i + BATCH_SIZE))

  let done = 0
  let batchesSinceSave = 0
  let nextBatch = 0

  async function worker(id) {
    while (true) {
      const myIndex = nextBatch++
      if (myIndex >= batches.length) return
      const batch = batches[myIndex]
      try {
        const decisions = await tagBatch(batch)
        for (let j = 0; j < batch.length; j++) {
          master[batch[j]].decision = decisions[j].decision === 'keep' ? 'keep' : 'cut'
          master[batch[j]].reason = decisions[j].reason || null
        }
      } catch (err) {
        console.error(`\n[worker ${id}] batch ${myIndex} failed permanently: ${err.message}`)
        // Leave as null; a future run will retry.
      }
      done += batch.length
      process.stdout.write(`  ${done}/${pending.length}\r`)
      if (++batchesSinceSave >= SAVE_EVERY_BATCHES) {
        batchesSinceSave = 0
        await saveMaster(master)
      }
    }
  }

  await Promise.all(Array.from({ length: WORKERS }, (_, i) => worker(i)))
  await saveMaster(master)
  console.log('\nDone. Master stats:')
  console.log(JSON.stringify(stats(master), null, 2))
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
