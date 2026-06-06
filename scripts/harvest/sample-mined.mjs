#!/usr/bin/env node
// Inspect dump-mined.json: bucket each candidate (space-form display regexes)
// and print evenly-spaced samples so a human can judge per-bucket precision.
// Run: node scripts/harvest/sample-mined.mjs [--n=8]
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const N = parseInt((process.argv.find((a) => a.startsWith('--n=')) || '--n=8').split('=')[1], 10)

// Display-form (spaces) approximations of the miner's underscore buckets.
const BUCKETS = {
  weird_parenthetical:
    / \((horse|dog|cat|cocktail|drink|cult|hoax|crater|dance|gene|protein|mango|cheese|cow|pig|bull|goat|sheep|software|video game|board game|mascot|sculpture|grape|apple|comics?|wrestler|magician|clown|robot|dinosaur|elephant|whale|fish|frog|beetle|moth|spider|cannon|locomotive|ship|mountain|volcano|island|monster|creature|ghost|demon|saint|martyr)\)$/i,
  incident_affair:
    / (incident|affair|controversy|riot|hoax|panic|mystery|curse|conspiracy|debacle|fiasco|kerfuffle|scandal|caper)$/i,
  heist: / heist( |$)/i,
  the_great: /^The Great [A-Z]/,
  operation: /^Operation [A-Z][a-z]/,
  superlative:
    /(World's (Largest|Smallest|Oldest|Longest|Tallest|Heaviest|Ugliest|Strongest)|Worlds (Largest|Smallest|Oldest)| Colossal | Gigantic )/i,
  whimsy_adjective:
    /(^| )(Exploding|Flying|Jumping|Dancing|Screaming|Talking|Haunted|Cursed|Naked|Nude|Drunken|Invisible|Self-immolat|Disappearing|Inflatable|Radioactive|Mechanical|Two-headed|Headless)( |[a-z])/i,
  vs_machine: / (machine|device|apparatus|contraption|engine|gun)$/i,
  beast_of: /^(The )?(Beast|Ghost|Monster|Curse|Legend|Riddle|Mystery) of [A-Z]/,
}

const { titles } = JSON.parse(await readFile(resolve(__dirname, '..', 'output', 'harvest', 'dump-mined.json'), 'utf8'))
const groups = Object.fromEntries(Object.keys(BUCKETS).map((k) => [k, []]))
for (const t of titles) {
  for (const [name, re] of Object.entries(BUCKETS)) {
    if (re.test(t)) { groups[name].push(t); break }
  }
}
for (const [name, arr] of Object.entries(groups)) {
  console.log(`\n=== ${name}  (${arr.length}) ===`)
  if (!arr.length) continue
  const step = Math.max(1, Math.floor(arr.length / N))
  for (let i = 0; i < arr.length && i / step < N; i += step) console.log('  ', arr[i])
}
