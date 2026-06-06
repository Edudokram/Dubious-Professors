#!/usr/bin/env node
// Stage 2 of the article curation pipeline.
//
// Reads scripts/output/candidates.json (output of curate-articles.mjs) and asks
// Claude (via the local `claude -p` CLI, using the user's existing subscription)
// to tag each candidate as `keep` or `cut` based on game-funniness criteria.
//
// Why this stage: langlinks alone catches "famous" titles but doesn't catch
// "obscure-but-boring" ones (e.g. "Transhumanist", "Sokh District"). The LLM
// has good taste for "is this title funny on its own?" which is the second axis.
//
// We only LLM-tag the `auto-keep` and `borderline` buckets — `auto-cut` titles
// were already definitively cut by the langlinks pass.
//
// Output: scripts/output/tagged.json with [{ title, langlinkCount, decision, reason }]
//
// Run: node scripts/llm-tag.mjs

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const INPUT_PATH = resolve(__dirname, 'output', 'candidates.json')
const OUTPUT_PATH = resolve(__dirname, 'output', 'tagged.json')
const CHECKPOINT_PATH = resolve(__dirname, 'output', 'tagged-checkpoint.json')

const BATCH_SIZE = 60                    // titles per Claude call
const CHECKPOINT_EVERY_BATCHES = 2
const MODEL = process.env.CURATE_MODEL || 'haiku'  // cheap+fast for this kind of taste task
const CLAUDE_BIN = 'claude.cmd'          // Windows shim from npm

// ----------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are tagging Wikipedia article titles for a party game called Dubious Professors.

The game works like this: one player reads a Wikipedia article, then other players have to bluff that they ALSO read it, while one interrogator tries to figure out who actually read it. THE ENTIRE GAME HINGES ON THE ARTICLE TITLE. The title is the only thing all other players see — they must improvise plausible-sounding explanations from the title alone.

Therefore a GOOD title is:
- Funny, bizarre, intriguing, or unobvious on its face
- Not widely known — most people couldn't tell you what it is from the title alone
- Specific enough to be the bluff material itself
- Examples: "Feast of the Ass", "Green Monster", "The Northwest Lincolnshire By-election of 1871", "Bobson Dugnutt", "Magic Roundabout (Hemel Hempstead)", "26th Congress of the Communist Party of the Soviet Union (diamond)"

A BAD title is:
- A common noun or famous proper noun anyone would recognize ("Potatoes", "Iran", "Fidel Castro")
- A generic-sounding place/person/concept that doesn't pique curiosity ("Sokh District", "Transhumanist", "Banjawarn Station")
- Boring even if obscure ("Response to sneezing", "Pen name")
- Long technical/scientific terminology that's just a wall of jargon
- Disambiguation pages, list pages, or articles about Wikipedia itself

You will be given a JSON array of titles. For EACH title, decide "keep" or "cut".

Output ONLY a JSON array (no preamble, no markdown fences) with the SAME LENGTH and SAME ORDER as the input. Each element: { "decision": "keep" | "cut", "reason": "<5-10 words>" }.`

// ----------------------------------------------------------------------------

// Run `claude -p` without trying to pass the system prompt as a CLI arg
// (cmd.exe mangles the multi-line prompt). Instead we send everything via stdin.
async function callClaude(userMessage) {
  return new Promise((resolveFn, reject) => {
    const args = [
      '-p',
      '--no-session-persistence',
      '--permission-mode', 'bypassPermissions',
      '--model', MODEL,
      '--output-format', 'text',
    ]
    const child = spawn(CLAUDE_BIN, args, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (chunk) => (stdout += chunk.toString()))
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`claude exited ${code}: ${stderr || stdout}`))
      } else {
        resolveFn(stdout)
      }
    })
    child.stdin.write(SYSTEM_PROMPT + '\n\n' + userMessage)
    child.stdin.end()
  })
}

function parseClaudeJson(text) {
  // Strip code fences if present.
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '').trim()
  }
  // Find the first '[' and last ']' to extract the array even if the model added stray text.
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) {
    throw new Error('no JSON array in response: ' + cleaned.slice(0, 200))
  }
  return JSON.parse(cleaned.slice(start, end + 1))
}

async function tagBatch(titles) {
  const userMessage =
    'Tag each of these article titles for the Dubious Professors game.\n\n' +
    JSON.stringify(titles, null, 2)
  const responseText = await callClaude(userMessage)
  const decisions = parseClaudeJson(responseText)
  if (!Array.isArray(decisions) || decisions.length !== titles.length) {
    throw new Error(`expected ${titles.length} decisions, got ${decisions.length}`)
  }
  return decisions
}

// ----------------------------------------------------------------------------

async function main() {
  console.log(`Reading ${INPUT_PATH}...`)
  const candidates = JSON.parse(await readFile(INPUT_PATH, 'utf8'))
  // We tag both auto-keep and borderline rows. auto-cut titles are already cut.
  const toTag = candidates.rows.filter((r) => r.status === 'auto-keep' || r.status === 'borderline')
  console.log(`  ${toTag.length} titles to tag (out of ${candidates.rows.length} total)`)
  console.log(`  using model: ${MODEL}, batch size: ${BATCH_SIZE}\n`)

  // Resume from checkpoint if present.
  let tagged = []
  let startIndex = 0
  if (existsSync(CHECKPOINT_PATH)) {
    const cp = JSON.parse(await readFile(CHECKPOINT_PATH, 'utf8'))
    if (cp.totalToTag === toTag.length) {
      tagged = cp.tagged
      startIndex = tagged.length
      console.log(`  resuming from checkpoint: ${startIndex} already tagged`)
    }
  }

  let batchesSinceCheckpoint = 0
  for (let i = startIndex; i < toTag.length; i += BATCH_SIZE) {
    const batch = toTag.slice(i, i + BATCH_SIZE)
    const titles = batch.map((r) => r.title)
    let decisions
    try {
      decisions = await tagBatch(titles)
    } catch (err) {
      console.error(`\n  batch ${i}-${i + batch.length} failed: ${err.message}`)
      console.error('  retrying once with smaller batch...')
      // Fallback: split in half and try each half.
      const mid = Math.floor(titles.length / 2)
      const d1 = await tagBatch(titles.slice(0, mid))
      const d2 = await tagBatch(titles.slice(mid))
      decisions = [...d1, ...d2]
    }
    for (let j = 0; j < batch.length; j++) {
      tagged.push({
        ...batch[j],
        decision: decisions[j].decision,
        reason: decisions[j].reason,
      })
    }
    process.stdout.write(`  ${Math.min(i + BATCH_SIZE, toTag.length)}/${toTag.length}\r`)

    batchesSinceCheckpoint++
    if (batchesSinceCheckpoint >= CHECKPOINT_EVERY_BATCHES) {
      await mkdir(dirname(CHECKPOINT_PATH), { recursive: true })
      await writeFile(CHECKPOINT_PATH, JSON.stringify({ totalToTag: toTag.length, tagged }, null, 2))
      batchesSinceCheckpoint = 0
    }
  }
  console.log()

  // Write output (sorted by decision, then langlinkCount).
  tagged.sort((a, b) => {
    if (a.decision !== b.decision) return a.decision === 'keep' ? -1 : 1
    return (a.langlinkCount ?? 999) - (b.langlinkCount ?? 999)
  })

  await mkdir(dirname(OUTPUT_PATH), { recursive: true })
  await writeFile(
    OUTPUT_PATH,
    JSON.stringify(
      {
        meta: {
          generatedAt: new Date().toISOString(),
          model: MODEL,
          inputCount: toTag.length,
        },
        rows: tagged,
      },
      null,
      2,
    ),
  )
  console.log(`Wrote ${OUTPUT_PATH}`)

  const kept = tagged.filter((r) => r.decision === 'keep')
  const cut = tagged.filter((r) => r.decision === 'cut')
  console.log(`\nSummary: ${kept.length} keep, ${cut.length} cut`)
  console.log('\nSample of KEPT titles:')
  for (let i = 0; i < 10; i++) {
    const r = kept[Math.floor(Math.random() * kept.length)]
    console.log(`  [${String(r.langlinkCount).padStart(3)}] ${r.title}  — ${r.reason}`)
  }
  console.log('\nSample of CUT titles (the LLM disagreed with langlinks-only):')
  for (let i = 0; i < 10; i++) {
    const r = cut[Math.floor(Math.random() * cut.length)]
    console.log(`  [${String(r.langlinkCount).padStart(3)}] ${r.title}  — ${r.reason}`)
  }
}

main().catch((err) => {
  console.error('FATAL:', err)
  process.exit(1)
})
