#!/usr/bin/env node
// Curate the Wikipedia:Unusual_articles title pool for the Dubious Professors game.
//
// This is a one-shot offline script. It produces a static JSON the app ships with,
// instead of fetching/filtering at runtime.
//
// Pipeline:
//   1. Fetch all article links from Wikipedia:Unusual_articles (matches src/lib/wikipedia.js).
//   2. For each title, query MediaWiki for langlinks count (interlanguage link count).
//      Articles in many languages are well-known; few languages = obscure.
//   3. Output a JSON file at scripts/output/candidates.json with:
//        [{ title, langlinkCount, status: 'auto-keep' | 'auto-cut' | 'borderline' }, ...]
//   4. Print summary stats so we can choose a threshold.
//
// Why langlinks alone? It's the cheapest, most objective "is this widely known" signal.
// Famous things like Fidel Castro / DRC / Potatoes have 100+ interlanguage links.
// Obscure things like Feast of the Ass / Northwest Lincolnshire By-election have <10.
// A second LLM pass (separate script) will catch the weirdness/funniness dimension.
//
// Run with: node scripts/curate-articles.mjs

import { writeFile, mkdir, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_PATH = resolve(__dirname, 'output', 'candidates.json')
const CHECKPOINT_PATH = resolve(__dirname, 'output', 'checkpoint.json')

const API_URL = 'https://en.wikipedia.org/w/api.php'

// Wikipedia requires a meaningful User-Agent for non-trivial API use; without it,
// requests get throttled or 429'd. https://meta.wikimedia.org/wiki/User-Agent_policy
const USER_AGENT = 'DubiousProfessors-Curator/1.0 (https://github.com/schma/DubiousProfessors; one-shot offline curation)'

// Tunables.
const BATCH_SIZE = 10                  // Smaller batches so one famous title can't eat the langlinks budget.
const LANGLINKS_LIMIT = 500            // Max for unauthenticated MediaWiki queries.
const AUTO_CUT_THRESHOLD = 30          // langlinkCount >= this -> auto-cut (famous).
const AUTO_KEEP_THRESHOLD = 8          // langlinkCount <= this -> auto-keep (obscure).
const REQUEST_DELAY_MS = 200           // Polite throttle between batches.
const MAX_BACKOFF_RETRIES = 6
const CHECKPOINT_EVERY_BATCHES = 20

// ----------------------------------------------------------------------------

async function fetchAllUnusualTitles() {
  const params = new URLSearchParams({
    action: 'parse',
    page: 'Wikipedia:Unusual_articles',
    prop: 'links',
    format: 'json',
    origin: '*',
  })

  const res = await fetch(`${API_URL}?${params}`, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`Wikipedia parse fetch failed: ${res.status}`)

  const data = await res.json()
  const links = data.parse?.links || []

  return links
    .filter((link) => link.ns === 0 && link.exists !== undefined)
    .map((link) => link['*'])
    .filter((title) => title.length > 0 && !title.startsWith('List of'))
}

// ----------------------------------------------------------------------------

async function fetchWithBackoff(url) {
  let waitMs = 1000
  for (let attempt = 0; attempt < MAX_BACKOFF_RETRIES; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
    if (res.ok) return res
    if (res.status === 429 || res.status >= 500) {
      // Honor Retry-After if present, else exponential backoff.
      const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10)
      const sleep = retryAfter > 0 ? retryAfter * 1000 : waitMs
      console.log(`  [backoff] ${res.status}, sleeping ${sleep}ms (attempt ${attempt + 1}/${MAX_BACKOFF_RETRIES})`)
      await new Promise((r) => setTimeout(r, sleep))
      waitMs = Math.min(waitMs * 2, 60_000)
      continue
    }
    throw new Error(`fetch failed: ${res.status} ${res.statusText}`)
  }
  throw new Error(`exhausted ${MAX_BACKOFF_RETRIES} backoff retries`)
}

// ----------------------------------------------------------------------------

// Fetch langlink counts for a batch of titles. Returns Map<title, count|null>.
//
// Important: MediaWiki's `lllimit` caps the TOTAL langlinks per response across all
// titles in the query, not per page. A single famous title (e.g. Vodka with 200+
// langlinks) can starve the others, making them look like they have 0 langlinks.
//
// The fix is to paginate through `continue.llcontinue` until the batch is exhausted,
// summing counts per page across pages of the response. We also short-circuit pages
// that have already crossed AUTO_CUT_THRESHOLD since we don't need exact counts above it.
async function fetchLanglinkCounts(titles) {
  const counts = new Map()
  for (const t of titles) counts.set(t, 0)

  let llcontinue = null
  let pagesNeedingMore = new Set() // pageids that hit the per-response cap and need pagination

  while (true) {
    const params = new URLSearchParams({
      action: 'query',
      titles: titles.join('|'),
      prop: 'langlinks',
      lllimit: String(LANGLINKS_LIMIT),
      format: 'json',
      origin: '*',
    })
    if (llcontinue) params.set('llcontinue', llcontinue)

    const res = await fetchWithBackoff(`${API_URL}?${params}`)
    const data = await res.json()

    // Build normalization map from the response.
    const normMap = new Map()
    for (const t of titles) normMap.set(t, t)
    for (const n of data.query?.normalized || []) normMap.set(n.to, n.from)
    for (const r of data.query?.redirects || []) normMap.set(r.to, normMap.get(r.from) || r.from)

    const pages = data.query?.pages || {}
    pagesNeedingMore = new Set()
    for (const page of Object.values(pages)) {
      const original = normMap.get(page.title) || page.title
      if (page.missing !== undefined) {
        counts.set(original, null)
        continue
      }
      const got = page.langlinks?.length || 0
      counts.set(original, (counts.get(original) || 0) + got)
    }

    if (data.continue?.llcontinue) {
      // Short-circuit: if every title we know about already crossed the cut threshold,
      // exact counts above 30 don't matter — stop paginating.
      const allOverThreshold = [...counts.values()].every(
        (c) => c === null || c >= AUTO_CUT_THRESHOLD,
      )
      if (allOverThreshold) break
      llcontinue = data.continue.llcontinue
    } else {
      break
    }
  }

  // Any titles we never saw — mark unknown (shouldn't normally happen).
  for (const t of titles) if (!counts.has(t)) counts.set(t, null)

  return counts
}

// ----------------------------------------------------------------------------

function bucketStatus(count) {
  if (count === null) return 'unknown'
  if (count >= AUTO_CUT_THRESHOLD) return 'auto-cut'
  if (count <= AUTO_KEEP_THRESHOLD) return 'auto-keep'
  return 'borderline'
}

function summarize(rows) {
  const tally = { 'auto-keep': 0, 'auto-cut': 0, 'borderline': 0, 'unknown': 0 }
  for (const r of rows) tally[r.status]++

  const known = rows.filter((r) => r.langlinkCount !== null).map((r) => r.langlinkCount)
  known.sort((a, b) => a - b)
  const pct = (p) => known[Math.floor((known.length - 1) * p)]

  return {
    total: rows.length,
    tally,
    distribution: known.length
      ? {
          min: known[0],
          p10: pct(0.1),
          p25: pct(0.25),
          median: pct(0.5),
          p75: pct(0.75),
          p90: pct(0.9),
          max: known[known.length - 1],
        }
      : null,
  }
}

function exampleNames(rows, status, n = 8) {
  return rows
    .filter((r) => r.status === status)
    .slice(0, n)
    .map((r) => `${r.title.padEnd(50)} (${r.langlinkCount} langlinks)`)
}

// ----------------------------------------------------------------------------

async function main() {
  console.log('Step 1: fetching title list from Wikipedia:Unusual_articles...')
  const titles = await fetchAllUnusualTitles()
  console.log(`  -> ${titles.length} candidate titles`)

  // Resume from checkpoint if one exists.
  let rows = []
  let startIndex = 0
  if (existsSync(CHECKPOINT_PATH)) {
    const cp = JSON.parse(await readFile(CHECKPOINT_PATH, 'utf8'))
    if (cp.totalTitles === titles.length) {
      rows = cp.rows
      startIndex = rows.length
      console.log(`  resuming from checkpoint: ${startIndex} titles already processed`)
    } else {
      console.log(`  checkpoint exists but title count differs (${cp.totalTitles} vs ${titles.length}); starting over`)
    }
  }

  console.log(`Step 2: fetching langlink counts in batches of ${BATCH_SIZE}...`)
  let batchesSinceCheckpoint = 0
  for (let i = startIndex; i < titles.length; i += BATCH_SIZE) {
    const batch = titles.slice(i, i + BATCH_SIZE)
    const counts = await fetchLanglinkCounts(batch)
    for (const t of batch) {
      const c = counts.get(t)
      rows.push({ title: t, langlinkCount: c, status: bucketStatus(c) })
    }
    process.stdout.write(`  ${Math.min(i + BATCH_SIZE, titles.length)}/${titles.length}\r`)

    batchesSinceCheckpoint++
    if (batchesSinceCheckpoint >= CHECKPOINT_EVERY_BATCHES) {
      await mkdir(dirname(CHECKPOINT_PATH), { recursive: true })
      await writeFile(
        CHECKPOINT_PATH,
        JSON.stringify({ totalTitles: titles.length, rows }, null, 2),
      )
      batchesSinceCheckpoint = 0
    }

    if (REQUEST_DELAY_MS > 0) await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS))
  }
  console.log()

  // Sort by langlinkCount ascending (most obscure first), then alphabetic.
  rows.sort((a, b) => {
    const ac = a.langlinkCount ?? Infinity
    const bc = b.langlinkCount ?? Infinity
    if (ac !== bc) return ac - bc
    return a.title.localeCompare(b.title)
  })

  console.log('Step 3: writing output...')
  await mkdir(dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(
    OUTPUT_PATH,
    JSON.stringify(
      {
        meta: {
          generatedAt: new Date().toISOString(),
          source: 'Wikipedia:Unusual_articles',
          autoKeepThreshold: AUTO_KEEP_THRESHOLD,
          autoCutThreshold: AUTO_CUT_THRESHOLD,
        },
        rows,
      },
      null,
      2,
    ),
  )
  console.log(`  -> wrote ${OUTPUT_PATH}`)

  console.log('\nStep 4: summary')
  const stats = summarize(rows)
  console.log(JSON.stringify(stats, null, 2))

  console.log('\nExamples — auto-keep (obscure, presumed good):')
  for (const ex of exampleNames(rows, 'auto-keep')) console.log('  ' + ex)
  console.log('\nExamples — auto-cut (famous, presumed bad):')
  for (const ex of exampleNames(rows.slice().reverse(), 'auto-cut')) console.log('  ' + ex)
  console.log('\nExamples — borderline (needs review):')
  for (const ex of exampleNames(rows, 'borderline')) console.log('  ' + ex)
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
