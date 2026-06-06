// Shared Wikipedia / Wikidata API helpers for the harvest pipeline.
// All harvesters import from here so backoff, batching, and User-Agent are consistent.

const WP_API = 'https://en.wikipedia.org/w/api.php'
const WD_SPARQL = 'https://query.wikidata.org/sparql'

// Wikipedia requires a descriptive User-Agent for non-trivial API use.
export const USER_AGENT =
  'DubiousProfessors-Curator/1.0 (https://github.com/schma/DubiousProfessors; offline title curation)'

const MAX_RETRIES = 6

export async function fetchWithBackoff(url, opts = {}) {
  let waitMs = 1000
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    let res
    try {
      res = await fetch(url, { ...opts, headers: { 'User-Agent': USER_AGENT, ...(opts.headers || {}) } })
    } catch (err) {
      // Network error — back off and retry.
      await sleep(waitMs)
      waitMs = Math.min(waitMs * 2, 60_000)
      continue
    }
    if (res.ok) return res
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10)
      await sleep(retryAfter > 0 ? retryAfter * 1000 : waitMs)
      waitMs = Math.min(waitMs * 2, 60_000)
      continue
    }
    throw new Error(`fetch ${res.status} ${res.statusText} for ${url.slice(0, 120)}`)
  }
  throw new Error(`exhausted ${MAX_RETRIES} retries for ${url.slice(0, 120)}`)
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Generic MediaWiki API query with automatic `continue` pagination.
// Calls `onPage(query)` for each response's `query` object. Stops when no continue.
export async function mwQueryAll(params, onResponse, { maxPages = Infinity } = {}) {
  let cont = {}
  let pages = 0
  while (pages < maxPages) {
    const sp = new URLSearchParams({ action: 'query', format: 'json', origin: '*', ...params, ...cont })
    const res = await fetchWithBackoff(`${WP_API}?${sp}`)
    const data = await res.json()
    if (data.query) onResponse(data.query)
    pages++
    if (data.continue) cont = data.continue
    else break
  }
}

// Recursively collect article (ns=0) members of a category and its subcategories.
// Returns a Set of titles. Depth-limited to avoid runaway crawls.
export async function crawlCategory(categoryTitle, { maxDepth = 2, seen = new Set(), visited = new Set() } = {}) {
  if (visited.has(categoryTitle) || maxDepth < 0) return seen
  visited.add(categoryTitle)

  const subcats = []
  await mwQueryAll(
    {
      list: 'categorymembers',
      cmtitle: categoryTitle,
      cmlimit: '500',
      cmtype: 'page|subcat',
    },
    (query) => {
      for (const m of query.categorymembers || []) {
        if (m.ns === 0) seen.add(m.title)
        else if (m.ns === 14) subcats.push(m.title) // Category namespace
      }
    },
  )

  for (const sub of subcats) {
    await crawlCategory(sub, { maxDepth: maxDepth - 1, seen, visited })
  }
  return seen
}

// Fetch outgoing article links + "See also"-rich links for a batch of titles.
// We use prop=links (all article links). Returns Map<sourceTitle, Set<linkedTitle>>.
export async function fetchOutlinks(titles) {
  const out = new Map()
  for (const t of titles) out.set(t, new Set())
  await mwQueryAll(
    {
      titles: titles.join('|'),
      prop: 'links',
      pllimit: '500',
      plnamespace: '0',
    },
    (query) => {
      const norm = new Map()
      for (const t of titles) norm.set(t, t)
      for (const n of query.normalized || []) norm.set(n.to, n.from)
      for (const page of Object.values(query.pages || {})) {
        const src = norm.get(page.title) || page.title
        const set = out.get(src) || new Set()
        for (const l of page.links || []) set.add(l.title)
        out.set(src, set)
      }
    },
  )
  return out
}

// Run a SPARQL query against Wikidata. Returns the bindings array.
export async function wikidataSparql(query) {
  const url = `${WD_SPARQL}?query=${encodeURIComponent(query)}&format=json`
  const res = await fetchWithBackoff(url, { headers: { Accept: 'application/sparql-results+json' } })
  const data = await res.json()
  return data.results?.bindings || []
}
