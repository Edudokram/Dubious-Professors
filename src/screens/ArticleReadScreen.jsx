import Layout from '../components/Layout'
import Button from '../components/Button'

export default function ArticleReadScreen({ title, url, onBack, onReady }) {
  return (
    <div className="h-screen bg-[#111] flex flex-col">
      <div className="px-5 py-4 flex items-center justify-between border-b border-[#333] bg-[#111]">
        <h2 className="text-sm font-bold text-white truncate max-w-[60%] animate-fade-in">
          {title}
        </h2>
        <div className="flex gap-2 animate-fade-in" style={{ animationDelay: '100ms' }}>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg text-xs font-medium bg-[#1a1a1a] border border-[#333] text-[#888] hover:text-white hover:border-[#555] transition-all"
          >
            Back
          </button>
          {onReady ? (
            <button
              onClick={onReady}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-white text-[#111] hover:bg-[#e0e0e0] active:scale-[0.97] transition-all"
            >
              Ready!
            </button>
          ) : (
            <span className="px-4 py-2 rounded-lg text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/20">
              Ready
            </span>
          )}
        </div>
      </div>

      <iframe
        src={url}
        title={title}
        className="flex-1 w-full bg-white"
        sandbox="allow-same-origin allow-scripts allow-popups"
      />
    </div>
  )
}
