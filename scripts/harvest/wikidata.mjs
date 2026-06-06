#!/usr/bin/env node
// Harvester: Wikidata SPARQL. Find enwiki articles whose Wikidata item is a
// direct instance (P31) of an inherently-funny class, with relatively few
// sitelinks (obscure). Gives QIDs natively (durability).
//
// Output: scripts/output/harvest/wikidata.json -> { source, titles: [...] }
//
// Run: node scripts/harvest/wikidata.mjs
//
// HISTORY / FIX (2026-06-05): the previous version was doubly broken —
//   (1) it used `wdt:P31/wdt:P279*`, traversing entire subclass trees and pulling
//       thousands of unrelated entries (universities, cyclones, eclipses); and
//   (2) 14 of its 16 hardcoded class QIDs were WRONG (e.g. the "eccentric" QID was
//       actually "educational organization" -> that's why it returned universities;
//       "cargo cult" was "order"; "impostor" was "Stokes' theorem").
// This version uses verified QIDs + direct P31 only, and a self-verifying preflight
// (verifyClasses) that fetches each class label and SKIPS any QID whose label no
// longer matches its `expect` keyword — so a future QID drift fails loud, not silent.

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { wikidataSparql, sleep } from './lib.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT = resolve(__dirname, '..', 'output', 'harvest', 'wikidata.json')

// Verified 2026-06-05 via wbsearchentities + a VALUES label query. `expect` is a
// substring the class's current English label must contain, checked at runtime.
const FUNNY_CLASSES = [
  { qid: 'Q190084', expect: 'hoax' },
  { qid: 'Q2927074', expect: 'meme' },
  { qid: 'Q189349', expect: 'urban legend' },
  { qid: 'Q772636', expect: 'cryptid' },
  { qid: 'Q159535', expect: 'conspiracy theory' },
  { qid: 'Q1151663', expect: 'novelty music' },
  { qid: 'Q931092', expect: 'practical joke' },
  { qid: 'Q22314', expect: 'cargo cult' },
  { qid: 'Q188443', expect: 'micronation' },
  { qid: 'Q847836', expect: 'mass hysteria' },
  { qid: 'Q1413522', expect: 'impostor' },
  { qid: 'Q14915208', expect: 'roadside attraction' },
  { qid: 'Q15731648', expect: 'fictional food' },
]

const MAX_SITELINKS = 25 // obscurity filter applied in SPARQL via wikibase:sitelinks

// Preflight: confirm each QID still labels what we think it does. Returns the
// subset that passes; loudly warns and drops any that don't.
async function verifyClasses(classes) {
  const values = classes.map((c) => `wd:${c.qid}`).join(' ')
  const q = `SELECT ?c ?cLabel WHERE { VALUES ?c { ${values} } SERVICE wikibase:label { bd:serviceParam wikibase:language "en". } }`
  const rows = await wikidataSparql(q)
  const labelByQid = {}
  for (const r of rows) labelByQid[r.c.value.split('/').pop()] = (r.cLabel?.value || '').toLowerCase()
  const verified = []
  for (const c of classes) {
    const actual = labelByQid[c.qid] || ''
    if (actual.includes(c.expect.toLowerCase())) {
      verified.push({ ...c, label: actual })
      console.log(`  ✓ ${c.qid} = "${actual}"`)
    } else {
      console.warn(`  ✗ SKIP ${c.qid}: expected ~"${c.expect}", got "${actual || '(no label)'}"`)
    }
  }
  return verified
}

function queryFor(qid) {
  // Direct instance-of only (no P279* subclass traversal — that was the bug).
  return `
    SELECT ?article ?sitelinks WHERE {
      ?item wdt:P31 wd:${qid} .
      ?item wikibase:sitelinks ?sitelinks .
      FILTER(?sitelinks <= ${MAX_SITELINKS})
      ?article schema:about ?item ;
               schema:isPartOf <https://en.wikipedia.org/> .
    }
    LIMIT 5000`
}

function titleFromArticleUrl(url) {
  const m = url.match(/\/wiki\/(.+)$/)
  if (!m) return null
  return decodeURIComponent(m[1].replace(/_/g, ' '))
}

async function main() {
  console.log('verifying class QIDs...')
  const classes = await verifyClasses(FUNNY_CLASSES)
  if (!classes.length) {
    console.error('No class QIDs passed verification — aborting rather than harvesting garbage.')
    process.exit(1)
  }
  console.log(`\n${classes.length}/${FUNNY_CLASSES.length} classes verified; harvesting.\n`)

  const all = new Set()
  const perClass = {}
  for (const { label, qid } of classes) {
    process.stdout.write(`querying ${label} (${qid})... `)
    try {
      const bindings = await wikidataSparql(queryFor(qid))
      let added = 0
      for (const b of bindings) {
        const title = titleFromArticleUrl(b.article.value)
        if (title && !title.startsWith('List of')) {
          if (!all.has(title)) added++
          all.add(title)
        }
      }
      perClass[label] = bindings.length
      console.log(`${bindings.length} results (+${added} new, total ${all.size})`)
    } catch (err) {
      console.log(`FAILED: ${err.message}`)
      perClass[label] = 0
    }
    await sleep(1500) // be gentle with the SPARQL endpoint
  }

  const titles = [...all]
  await mkdir(dirname(OUTPUT), { recursive: true })
  await writeFile(
    OUTPUT,
    JSON.stringify({ source: 'wikidata-sparql', perClass, titles }, null, 2),
  )
  console.log(`\nWrote ${titles.length} unique titles to ${OUTPUT}`)
}

main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
