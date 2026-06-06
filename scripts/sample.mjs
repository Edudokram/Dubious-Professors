// Bigger random sample of auto-keep to gauge if LLM stage is needed
import { readFile } from 'node:fs/promises'
const d = JSON.parse(await readFile('scripts/output/candidates.json', 'utf8'))
const keeps = d.rows.filter(r => r.status === 'auto-keep')
console.log(`auto-keep pool: ${keeps.length} titles\n`)

// Shuffle and take 40
for (let i = keeps.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1))
  ;[keeps[i], keeps[j]] = [keeps[j], keeps[i]]
}
console.log('40 random samples:')
for (let i = 0; i < 40; i++) {
  console.log(`  [${String(keeps[i].langlinkCount).padStart(2)}] ${keeps[i].title}`)
}
