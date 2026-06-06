// Smoke test of the LLM tagging path on a tiny hand-picked batch
import { spawn } from 'node:child_process'

const SYSTEM_PROMPT = `You are tagging Wikipedia article titles for a party game.
A GOOD title is funny, bizarre, intriguing, or unobvious on its face, and not widely known.
A BAD title is a common noun, famous proper noun, or generic-sounding obscure name.
Output ONLY a JSON array (same length, same order as input). Each element: { "decision": "keep" | "cut", "reason": "<5-10 words>" }.`

const titles = [
  'Feast of the Ass',
  'Green Monster',
  'Bobson Dugnutt',
  'Fidel Castro',
  'Potato',
  'Sokh District',
  'Transhumanist',
  '26th Congress of the Communist Party of the Soviet Union (diamond)',
  'Magic Roundabout (Hemel Hempstead)',
  'New England vampire panic',
]

function callClaude(userMessage) {
  return new Promise((resolveFn, reject) => {
    const args = [
      '-p', '--no-session-persistence',
      '--permission-mode', 'bypassPermissions',
      '--model', 'haiku',
      '--output-format', 'text',
    ]
    const child = spawn('claude.cmd', args, { shell: true, stdio: ['pipe', 'pipe', 'pipe'] })
    let out = '', err = ''
    child.stdout.on('data', (c) => (out += c.toString()))
    child.stderr.on('data', (c) => (err += c.toString()))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(`exit ${code}: ${err}`))
      else resolveFn(out)
    })
    child.stdin.write(SYSTEM_PROMPT + '\n\n' + userMessage)
    child.stdin.end()
  })
}

const t0 = Date.now()
const response = await callClaude(
  'Tag each of these titles.\n\n' + JSON.stringify(titles, null, 2),
)
const elapsedMs = Date.now() - t0
console.log(`Got response in ${(elapsedMs / 1000).toFixed(1)}s\n`)
console.log('RAW RESPONSE:')
console.log(response)
console.log('\nPARSED:')
let cleaned = response.trim().replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '')
const start = cleaned.indexOf('[')
const end = cleaned.lastIndexOf(']')
const decisions = JSON.parse(cleaned.slice(start, end + 1))
for (let i = 0; i < titles.length; i++) {
  console.log(`  ${decisions[i].decision.toUpperCase().padEnd(5)} | ${titles[i].padEnd(50)} (${decisions[i].reason})`)
}
