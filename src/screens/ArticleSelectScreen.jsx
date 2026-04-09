import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import Button from '../components/Button'
import { fetchRandomArticles } from '../lib/wikipedia'

export default function ArticleSelectScreen({ onSelect, isInterrogator, players, cachedArticles, onCacheArticles, myArticle, onViewArticle }) {
  const [articles, setArticles] = useState(cachedArticles || [])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function loadArticles() {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchRandomArticles(6)
      setArticles(data)
      onCacheArticles?.(data)
    } catch (err) {
      setError('Couldn\'t load articles')
    }
    setLoading(false)
  }

  useEffect(() => {
    if (!isInterrogator && articles.length === 0) loadArticles()
  }, [isInterrogator])

  if (isInterrogator) {
    const professors = players.filter(p => p.role !== 'interrogator')
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full">
          <h2 className="animate-fade-in text-lg font-bold text-center">
            Waiting for professors...
          </h2>

          <div className="w-full space-y-2 stagger">
            {professors.map((p, i) => (
              <div key={p.id} className="animate-slide-up flex items-center justify-between px-4 py-3 bg-[#1a1a1a] border border-[#333] rounded-xl">
                <span className="text-sm font-medium">{p.name}</span>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  p.isReady
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-[#333] text-[#666]'
                }`}>
                  {p.isReady ? 'Ready' : 'Reading'}
                </span>
              </div>
            ))}
          </div>

          {myArticle && onViewArticle && (
            <div className="animate-fade-in mt-2" style={{ animationDelay: '200ms' }}>
              <Button onClick={() => onViewArticle(myArticle)} variant="secondary">Re-read Article</Button>
            </div>
          )}
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center gap-6 w-full">
        <h2 className="animate-fade-in text-lg font-bold text-center mt-2">
          Pick an article
        </h2>
        <p className="animate-fade-in text-xs text-[#888] text-center -mt-3" style={{ animationDelay: '80ms' }}>
          Pick the most obscure, funniest one you can find
        </p>

        {loading && (
          <div className="flex-1 flex items-center">
            <p className="text-[#666] text-sm animate-fade-in">Loading...</p>
          </div>
        )}

        {error && (
          <p className="text-red-400/80 text-sm animate-fade-in">{error}</p>
        )}

        <div className="w-full space-y-2 stagger">
          {articles.map((article) => (
            <button
              key={article.title}
              onClick={() => onSelect(article.title, article.url)}
              className="animate-slide-up w-full text-left px-4 py-3.5 bg-[#1a1a1a] border border-[#333] rounded-xl text-sm font-medium hover:bg-[#252525] hover:border-[#555] active:scale-[0.98] transition-all duration-200"
            >
              {article.title}
            </button>
          ))}
        </div>

        {!loading && (
          <div className="animate-fade-in pb-4">
            <Button onClick={loadArticles} variant="secondary">More Articles</Button>
          </div>
        )}
      </div>
    </Layout>
  )
}
