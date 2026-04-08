import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import Button from '../components/Button'
import { fetchRandomArticles, getArticleUrl } from '../lib/wikipedia'

export default function ArticleSelectScreen({ onSelect, isInterrogator, players }) {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function loadArticles() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchRandomArticles(6)
      setArticles(data)
    } catch (err) {
      setError('Failed to load articles. Try again.')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!isInterrogator) loadArticles()
  }, [isInterrogator])

  // Interrogator sees waiting screen
  if (isInterrogator) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full">
          <h2 className="text-xl font-light tracking-[0.15em] uppercase text-center">
            Wait for professors<br />to read their articles
          </h2>

          <div className="w-full max-w-xs space-y-2">
            {players.filter(p => p.role !== 'interrogator').map((p, i) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 border border-white font-light">
                <span>
                  <span className="text-sm opacity-50 mr-3">{i + 1}</span>
                  {p.name}
                </span>
                <span>{p.isReady ? '✓' : '?'}</span>
              </div>
            ))}
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center gap-6 w-full max-w-md">
        <h2 className="text-lg font-light tracking-[0.1em] text-center mt-4">
          Tap on an interesting and obscure<br />article of your choice
        </h2>

        {loading && (
          <p className="font-light opacity-50">Loading articles...</p>
        )}

        {error && (
          <p className="font-light opacity-60">{error}</p>
        )}

        <div className="w-full space-y-2">
          {articles.map((article) => (
            <button
              key={article.title}
              onClick={() => onSelect(article.title, getArticleUrl(article.title))}
              className="w-full text-left px-4 py-3 border border-white font-light tracking-wide hover:opacity-80"
            >
              {article.title}
            </button>
          ))}
        </div>

        <Button onClick={loadArticles} disabled={loading}>
          More Articles
        </Button>
      </div>
    </Layout>
  )
}
