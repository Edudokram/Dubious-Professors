import Layout from '../components/Layout'
import Button from '../components/Button'

export default function RoleRevealScreen({ myPlayer, selectedArticleTitle, isInterrogator, onContinue }) {
  const roleConfig = {
    interrogator: {
      title: 'You are the Interrogator',
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
    },
    truthful: {
      title: 'You are the Truthful Professor',
      color: 'text-green-400',
      bg: 'bg-green-500/10 border-green-500/20',
    },
    dubious: {
      title: 'You are a Dubious Professor',
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
    },
  }

  const config = roleConfig[myPlayer.role]

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full text-center">
        <div className={`animate-scale-in text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-full border ${config.bg} ${config.color}`}>
          {myPlayer.role}
        </div>

        <h2 className={`animate-fade-in text-xl font-bold ${config.color}`} style={{ animationDelay: '150ms' }}>
          {config.title}
        </h2>

        {myPlayer.role === 'interrogator' && (
          <div className="animate-fade-in space-y-4" style={{ animationDelay: '300ms' }}>
            <p className="text-sm text-[#888]">The article is:</p>
            <p className="text-2xl font-bold text-white">{selectedArticleTitle}</p>
            <p className="text-xs text-[#666] max-w-[280px]">
              Figure out which professor actually read it.
            </p>
          </div>
        )}

        {myPlayer.role === 'truthful' && (
          <div className="animate-fade-in space-y-4" style={{ animationDelay: '300ms' }}>
            <p className="text-sm text-[#888]">You read this one. Answer honestly.</p>
            <p className="text-2xl font-bold text-white">{selectedArticleTitle}</p>
          </div>
        )}

        {myPlayer.role === 'dubious' && (
          <div className="animate-fade-in space-y-5" style={{ animationDelay: '300ms' }}>
            <div>
              <p className="text-xs text-[#666] uppercase tracking-widest mb-1">Topic</p>
              <p className="text-xl font-bold text-white">{selectedArticleTitle}</p>
            </div>
            <div className="bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3">
              <p className="text-xs text-[#666] uppercase tracking-widest mb-1">What you actually read</p>
              <p className="text-sm text-[#888]">{myPlayer.articleTitle}</p>
            </div>
            <p className="text-xs text-[#666] max-w-[280px] mx-auto text-center">
              Pretend you read the topic article. Trust. Most real professors do this.
            </p>
          </div>
        )}

        {isInterrogator && (
          <div className="animate-fade-in mt-4 w-full max-w-xs" style={{ animationDelay: '500ms' }}>
            <Button onClick={onContinue}>Begin Interrogation</Button>
          </div>
        )}
      </div>
    </Layout>
  )
}
