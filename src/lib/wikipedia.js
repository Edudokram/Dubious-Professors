// The article-title pool for the game.
//
// Source: src/data/curatedTitles.json — a static, pre-curated list generated
// offline by the scripts in /scripts (curate-articles -> llm-tag -> build-final).
//
// We don't fetch from Wikipedia at runtime because:
//   1. The raw Wikipedia:Unusual_articles list has ~7000 titles, but only a
//      fraction work for this game — the game depends on the title being
//      funny/bizarre/unobvious on its own. Most boring-titled obscure articles
//      slip through, which is exactly the bug we hit before.
//   2. A static list loads instantly, works offline, and is auditable.
//
// To regenerate (e.g. after Wikipedia adds new entries):
//   node scripts/curate-articles.mjs   # fetch titles + langlink counts
//   node scripts/llm-tag.mjs           # taste pass via local `claude -p`
//   node scripts/build-final.mjs       # merge in allow/deny overrides -> curatedTitles.json
import CURATED_TITLES from '../data/curatedTitles.json' with { type: 'json' }

export async function fetchRandomArticles(count = 6) {
  // Fisher-Yates partial shuffle: O(count) instead of O(n) — cheap even with thousands of titles.
  const pool = CURATED_TITLES
  const picks = []
  const seen = new Set()
  while (picks.length < count && seen.size < pool.length) {
    const idx = Math.floor(Math.random() * pool.length)
    if (seen.has(idx)) continue
    seen.add(idx)
    const title = pool[idx]
    picks.push({ title, url: getArticleUrl(title) })
  }
  return picks
}

export function getArticleUrl(title) {
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
}
