// Quick smoke test of the new batched-with-continue fetcher
// before unleashing it on 7216 titles.

const API_URL = 'https://en.wikipedia.org/w/api.php'
const LANGLINKS_LIMIT = 500
const AUTO_CUT_THRESHOLD = 30
const USER_AGENT = 'DubiousProfessors-Curator/1.0 (test)'

async function fetchLanglinkCounts(titles) {
  const counts = new Map()
  for (const t of titles) counts.set(t, 0)
  let llcontinue = null
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
    const res = await fetch(`${API_URL}?${params}`, { headers: { 'User-Agent': USER_AGENT } })
    const data = await res.json()
    const normMap = new Map()
    for (const t of titles) normMap.set(t, t)
    for (const n of data.query?.normalized || []) normMap.set(n.to, n.from)
    for (const r of data.query?.redirects || []) normMap.set(r.to, normMap.get(r.from) || r.from)
    for (const page of Object.values(data.query?.pages || {})) {
      const original = normMap.get(page.title) || page.title
      if (page.missing !== undefined) { counts.set(original, null); continue }
      counts.set(original, (counts.get(original) || 0) + (page.langlinks?.length || 0))
    }
    if (data.continue?.llcontinue) {
      const allOver = [...counts.values()].every(c => c === null || c >= AUTO_CUT_THRESHOLD)
      if (allOver) break
      llcontinue = data.continue.llcontinue
    } else {
      break
    }
  }
  return counts
}

const test = ['Vodka', 'Fidel Castro', 'Potato', 'Feast of the Ass', 'Green Monster', 'Yiddish', 'Wolf', 'Volkswagen']
const result = await fetchLanglinkCounts(test)
for (const t of test) {
  console.log('  ', t.padEnd(30), '->', result.get(t))
}
