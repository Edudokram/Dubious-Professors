const API_URL = 'https://en.wikipedia.org/w/api.php'

let cachedTitles = null

async function fetchAllUnusualTitles() {
  if (cachedTitles) return cachedTitles

  const params = new URLSearchParams({
    action: 'parse',
    page: 'Wikipedia:Unusual_articles',
    prop: 'links',
    format: 'json',
    origin: '*',
  })

  const res = await fetch(`${API_URL}?${params}`)
  if (!res.ok) throw new Error('Failed to fetch from Wikipedia')

  const data = await res.json()
  const links = data.parse?.links || []

  cachedTitles = links
    .filter((link) => link.ns === 0 && link.exists !== undefined)
    .map((link) => link['*'])
    .filter(
      (title) =>
        !title.startsWith('List of') &&
        title.length > 0
    )

  return cachedTitles
}

export async function fetchRandomArticles(count = 6) {
  const all = await fetchAllUnusualTitles()
  const shuffled = [...all].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).map((title) => ({
    title,
    url: getArticleUrl(title),
  }))
}

export function getArticleUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}
