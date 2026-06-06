// Probe Wikipedia to find the actual category names that match concepts
// my hardcoded seed list got wrong (returned 0 members).
//
// For each search term, query the Categories namespace via allcategories
// + opensearch and return the top hits.

import { fetchWithBackoff, USER_AGENT } from './lib.mjs'

const TERMS = [
  'Eccentrics', 'Eccentric people', 'Eccentricity',
  'Mononymous', 'People known by one name',
  'Foods named after people', 'Eponymous foods',
  'Animal hoaxes', 'Hoax animals', 'Fictitious animals',
  'Quackery', 'Quacks', 'Medical pseudoscience',
  'Pretenders', 'Pretenders to thrones',
  'Unusual deaths',
  'Fictional foods', 'Fictional dishes',
  'Folk festivals',
  'Mass hysteria', 'Mass psychogenic illness',
]

const WP = 'https://en.wikipedia.org/w/api.php'

async function search(term) {
  // OpenSearch in the Category namespace (14).
  const sp = new URLSearchParams({
    action: 'opensearch', search: term, namespace: '14', limit: '5', format: 'json', origin: '*',
  })
  const r = await fetchWithBackoff(`${WP}?${sp}`)
  const data = await r.json()
  return data[1] || []
}

for (const t of TERMS) {
  try {
    const hits = await search(t)
    console.log(`\n${t}:`)
    for (const h of hits) console.log('  ', h)
  } catch (e) {
    console.log(`\n${t}: ERROR ${e.message}`)
  }
}
