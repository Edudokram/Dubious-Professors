import { fetchWithBackoff } from './lib.mjs'
const extra = [
  'Category:Eponymous foods',
  'Category:English eccentrics',
  'Category:Medical fraud',
  'Category:Zoological hoaxes',
  'Category:Single-name people',
  'Category:Foods in fiction',
  'Category:Moral panic',
  'Category:Lists of unusual things',
  'Category:Wikipedia humour',
  "Category:Wikipedia's wikipedia",
  'Category:Eccentricity',
  'Category:Strange phenomena',
  'Category:Unexplained phenomena',
  'Category:Forteana',
  'Category:Charlatans',
  'Category:Frauds',
  'Category:Counterfeiters',
  'Category:Mock trials',
  'Category:Spoofs',
  'Category:Parodies',
  'Category:Satire',
]
for (const name of extra) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encodeURIComponent(name)}&cmlimit=3&cmtype=page&format=json&origin=*`
  const r = await fetchWithBackoff(url)
  const d = await r.json()
  const m = d.query?.categorymembers || []
  console.log(`${m.length > 0 ? '✓' : '✗'}  ${name.padEnd(45)} ${m.slice(0,3).map(x => x.title).join(' | ')}`)
}
