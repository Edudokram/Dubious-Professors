// Probe what categories actually exist for the broken seed concepts.
// Uses allcategories with prefix search to find real category names.
import { fetchWithBackoff } from './lib.mjs'

const concepts = [
  'Eccentric',
  'Mononymous',
  'Foods named',
  'Animal hoax',
  'Quack',
  'Pretender',
  'Unusual death',
  'Fictional food',
  'Mass hysteria',
  'Festival',
]

for (const c of concepts) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=allcategories&acprefix=${encodeURIComponent(c)}&aclimit=15&format=json&origin=*`
  const res = await fetchWithBackoff(url)
  const data = await res.json()
  const cats = data.query?.allcategories?.map(a => a['*']) || []
  console.log(`\n${c}:`)
  for (const cat of cats) console.log(`  Category:${cat}`)
}
