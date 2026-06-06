// Inspect the in-progress checkpoint
import { readFile } from 'node:fs/promises'
const d = JSON.parse(await readFile('scripts/output/checkpoint.json', 'utf8'))
const rows = d.rows
console.log('rows so far:', rows.length, '/', d.totalTitles)

const buckets = { 'auto-keep': [], 'auto-cut': [], 'borderline': [], unknown: [] }
for (const r of rows) buckets[r.status].push(r)
for (const [k, v] of Object.entries(buckets)) console.log(' ', k.padEnd(12), v.length)

const counts = rows.map(r => r.langlinkCount).filter(c => c !== null).sort((a,b) => a-b)
const pct = (p) => counts[Math.floor((counts.length-1)*p)]
console.log('\ndistribution of (known) langlinkCounts so far:')
console.log('  min', counts[0], '| p10', pct(0.1), '| p25', pct(0.25), '| median', pct(0.5), '| p75', pct(0.75), '| p90', pct(0.9), '| max', counts[counts.length-1])

console.log('\n10 random auto-keep titles (good candidates):')
const keeps = buckets['auto-keep']
for (let i = 0; i < 10; i++) {
  const r = keeps[Math.floor(Math.random() * keeps.length)]
  console.log(' ', `[${String(r.langlinkCount).padStart(3)}]`, r.title)
}

console.log('\n10 random auto-cut titles (filtered out):')
const cuts = buckets['auto-cut']
for (let i = 0; i < 10; i++) {
  const r = cuts[Math.floor(Math.random() * cuts.length)]
  console.log(' ', `[${String(r.langlinkCount).padStart(3)}]`, r.title)
}

console.log('\n10 random borderline titles:')
const bds = buckets['borderline']
for (let i = 0; i < Math.min(10, bds.length); i++) {
  const r = bds[Math.floor(Math.random() * bds.length)]
  console.log(' ', `[${String(r.langlinkCount).padStart(3)}]`, r.title)
}
