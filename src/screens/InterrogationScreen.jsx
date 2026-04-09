import Layout from '../components/Layout'
import Button from '../components/Button'

export default function InterrogationScreen({
  phase,
  myPlayer,
  selectedArticleTitle,
  isInterrogator,
  onDone,
}) {
  const isPhase1 = phase === 'interrogation-1'

  if (isInterrogator) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center w-full">
          <div className="animate-fade-in space-y-3">
            <p className="text-sm text-[#888]">
              {isPhase1
                ? 'Ask each professor:'
                : 'Get the full story from each professor.'
              }
            </p>
            {isPhase1 && (
              <p className="text-lg font-bold text-white">
                "What is {selectedArticleTitle}?"
              </p>
            )}
            {!isPhase1 && (
              <p className="text-2xl font-bold text-white">
                {selectedArticleTitle}
              </p>
            )}
          </div>

          <div className="animate-fade-in w-full max-w-xs mt-4" style={{ animationDelay: '200ms' }}>
            <Button onClick={onDone}>
              {isPhase1 ? 'Done' : 'End Interrogation'}
            </Button>
          </div>
        </div>
      </Layout>
    )
  }

  // Professor view
  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center w-full">
        <div className={`animate-scale-in text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full border ${
          myPlayer.role === 'truthful'
            ? 'bg-green-500/10 border-green-500/20 text-green-400'
            : 'bg-red-500/10 border-red-500/20 text-red-400'
        }`}>
          {myPlayer.role}
        </div>

        <div className="animate-fade-in space-y-4" style={{ animationDelay: '150ms' }}>
          <div>
            <p className="text-xs text-[#666] uppercase tracking-widest mb-1">Topic</p>
            <p className="text-xl font-bold text-white">{selectedArticleTitle}</p>
          </div>

          {myPlayer.role === 'dubious' && (
            <div className="bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3">
              <p className="text-xs text-[#666] uppercase tracking-widest mb-1">What you read</p>
              <p className="text-sm text-[#888]">{myPlayer.articleTitle}</p>
            </div>
          )}
        </div>

        <p className="animate-fade-in text-xs text-[#555]" style={{ animationDelay: '300ms' }}>
          {isPhase1 ? 'Give a quick summary when asked.' : 'Explain in detail when asked.'}
        </p>
      </div>
    </Layout>
  )
}
