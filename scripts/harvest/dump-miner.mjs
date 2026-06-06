#!/usr/bin/env node
// Harvest stage: mine the enwiki all-titles dump for funny/bizarre/obscure
// candidate titles using title-only regex heuristics. NO API calls, NO quota —
// just a streamed download + gunzip + line scan. Output feeds the normal funnel
// (seed-master -> enrich-langlinks -> tag-parallel), which dedups against master
// and does the real quality + fame filtering. We only cast a wide-but-shaped net.
//
// The dump is ~70MB gz / ~17M titles (ns0, redirects included, spaces as '_').
// We stream it so memory stays flat regardless of dump size.
//
// Run: node scripts/harvest/dump-miner.mjs [--limit=0] [--file=<localpath>]
//   --limit=N  cap emitted titles (0 = no cap, default)
//   --file=... mine a already-downloaded .gz instead of fetching

import { createGunzip } from 'node:zlib'
import { createReadStream } from 'node:fs'
import { writeFile, mkdir } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { createInterface } from 'node:readline'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { USER_AGENT } from './lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const HARVEST_DIR = resolve(__dirname, '..', 'output', 'harvest')
const DUMP_URL = 'https://dumps.wikimedia.org/enwiki/latest/enwiki-latest-all-titles-in-ns0.gz'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)
const LIMIT = parseInt(args.limit || '0', 10)

// --- Shaping filters -------------------------------------------------------
// Hard excludes: things the tagger would cut anyway, or that aren't game titles.
const EXCLUDE = [
  /^List_of_/i,
  /_\(disambiguation\)$/i,
  /^\d{1,4}$/, // bare years/numbers
  /^\d{1,4}_(BC|AD|BCE|CE)$/i,
  /^\d{4}[–-]\d{2,4}/, // ranges "2010-11..."
  /^\d{4}_in_/i, // "1996_in_film"
  /_(season|election|tournament|championship)$/i,
]

// Whimsy buckets — title-only signals that historically yield game-good titles.
// Each is reported separately so a human can judge yield/precision per bucket.
const BUCKETS = {
  weird_parenthetical:
    /_\((horse|dog|cat|cocktail|drink|cult|hoax|crater|dance|gene|protein|mango|cheese|cow|pig|bull|goat|sheep|software|video_game|board_game|mascot|sculpture|grape|apple|comics?|wrestler|magician|clown|robot|dinosaur|elephant|whale|fish|frog|beetle|moth|spider|cannon|locomotive|ship|mountain|volcano|island|monster|creature|ghost|demon|saint|martyr)\)$/i,
  incident_affair:
    /_(incident|affair|controversy|riot|hoax|panic|mystery|curse|conspiracy|debacle|fiasco|kerfuffle|scandal|caper)$/i,
  heist: /_(heist)(_|$)/i,
  the_great: /^The_Great_[A-Z]/,
  operation: /^Operation_[A-Z][a-z]/,
  superlative:
    /(World's_(Largest|Smallest|Oldest|Longest|Tallest|Heaviest|Ugliest|Strongest)|Worlds_(Largest|Smallest|Oldest)|_Colossal_|_Gigantic_)/i,
  whimsy_adjective:
    /(^|_)(Exploding|Flying|Jumping|Dancing|Screaming|Talking|Haunted|Cursed|Naked|Nude|Drunken|Invisible|Self-immolat|Disappearing|Inflatable|Radioactive|Mechanical|Two-headed|Headless)([_a-z])/i,
  vs_machine: /_(machine|device|apparatus|contraption|engine|gun)$/i,
  beast_of: /^(The_)?(Beast|Ghost|Monster|Curse|Legend|Riddle|Mystery)_of_[A-Z]/,
}

function underscoresToSpaces(t) {
  return t.replace(/_/g, ' ')
}

function classify(title) {
  for (const ex of EXCLUDE) if (ex.test(title)) return null
  if (title.length > 80) return null // unwieldy
  for (const [name, re] of Object.entries(BUCKETS)) if (re.test(title)) return name
  return null
}

async function getLineStream() {
  if (args.file) {
    console.log(`mining local file ${args.file}`)
    return createReadStream(resolve(String(args.file))).pipe(createGunzip())
  }
  console.log(`downloading ${DUMP_URL}`)
  const res = await fetch(DUMP_URL, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok || !res.body) throw new Error(`fetch ${res.status} ${res.statusText}`)
  return Readable.fromWeb(res.body).pipe(createGunzip())
}

async function main() {
  await mkdir(HARVEST_DIR, { recursive: true })
  const gunzip = await getLineStream()
  const rl = createInterface({ input: gunzip, crlfDelay: Infinity })

  const found = new Set()
  const byPattern = Object.fromEntries(Object.keys(BUCKETS).map((k) => [k, 0]))
  let scanned = 0
  let capped = false

  for await (const raw of rl) {
    scanned++
    if (scanned % 1_000_000 === 0) process.stdout.write(`  scanned ${scanned / 1e6}M, kept ${found.size}\r`)
    const bucket = classify(raw)
    if (!bucket) continue
    const title = underscoresToSpaces(raw)
    if (found.has(title)) continue
    found.add(title)
    byPattern[bucket]++
    if (LIMIT > 0 && found.size >= LIMIT) { capped = true; break }
  }

  const titles = [...found]
  const outPath = resolve(HARVEST_DIR, 'dump-mined.json')
  await writeFile(outPath, JSON.stringify({ source: 'all-titles-dump', byPattern, scanned, titles }, null, 0))

  console.log(`\nscanned ${scanned} titles${capped ? ' (hit --limit)' : ''}`)
  console.log('by bucket:', JSON.stringify(byPattern, null, 2))
  console.log(`wrote ${titles.length} candidates -> ${outPath}`)
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
