import { useState } from 'react'
import Layout from '../components/Layout'
import Button from '../components/Button'

export default function ResultsScreen({ myPlayer, guess, players, canAdvance, onEndRound, onFlagTitle }) {
  // Track which titles this player has flagged, so the button disables after one tap.
  const [flagged, setFlagged] = useState({})
  const guessedPlayer = players.find(p => p.id === guess.guessedPlayerId)
  const truthfulPlayer = players.find(p => p.role === 'truthful')
  const interrogator = players.find(p => p.role === 'interrogator')

  // Defensive: a player could leave between guess submission and this render.
  // Use display-safe names so the screen never crashes on a missing player.
  const guessedName = guessedPlayer?.name || '(left)'
  const truthfulName = truthfulPlayer?.name || '(left)'
  const interrogatorName = interrogator?.name || '(left)'

  // Game outcome semantics:
  //   - Interrogator wins iff guess.correct (they picked the Truthful Professor).
  //   - The Truthful + every Dubious win iff !guess.correct (Interrogator vs. Everyone Else).
  // The Dubious are bluffers on the Truthful's team — when the Truthful escapes, they all win,
  // including (especially) the Dubious who took the false accusation.

  const interrogatorWon = guess.correct
  const iWasPicked = guess.guessedPlayerId === myPlayer.id

  let didIWin
  let resultMessage
  let subMessage

  if (myPlayer.role === 'interrogator') {
    didIWin = interrogatorWon
    if (interrogatorWon) {
      resultMessage = 'You won!'
      subMessage = `${guessedName} was the truthful professor.`
    } else {
      resultMessage = 'You lost.'
      subMessage = `You picked ${guessedName}, but ${truthfulName} was telling the truth.`
    }
  } else if (myPlayer.role === 'truthful') {
    didIWin = !interrogatorWon
    if (interrogatorWon) {
      resultMessage = 'You got caught.'
      subMessage = `${interrogatorName} figured you out.`
    } else {
      resultMessage = 'You got away with it!'
      subMessage = `${interrogatorName} picked ${guessedName} instead.`
    }
  } else {
    // Dubious — fate tied to the Truthful Professor.
    didIWin = !interrogatorWon
    if (interrogatorWon) {
      resultMessage = 'Your team lost.'
      subMessage = `${truthfulName} got caught.`
    } else if (iWasPicked) {
      resultMessage = 'You took the heat — and won!'
      subMessage = `Your bluff drew suspicion away from ${truthfulName}.`
    } else {
      resultMessage = 'Your team won!'
      subMessage = `${guessedName} took the heat. ${truthfulName} got away.`
    }
  }

  const headlineColor = didIWin ? 'text-green-400' : 'text-red-400'

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center w-full">
        <h2 className={`animate-fade-in text-2xl font-bold ${headlineColor}`} style={{ animationDelay: '100ms' }}>
          {resultMessage}
        </h2>

        <p className="animate-fade-in text-sm text-[#888]" style={{ animationDelay: '250ms' }}>
          {subMessage}
        </p>

        <div className="animate-fade-in w-full space-y-2 mt-4 stagger" style={{ animationDelay: '400ms' }}>
          {players.map((p) => (
            <div key={p.id} className="animate-slide-up bg-[#1a1a1a] border border-[#333] rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{p.name}</span>
                <span className={`text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded-full border ${
                  p.role === 'truthful' ? 'bg-green-500/10 border-green-500/20 text-green-400' :
                  p.role === 'interrogator' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                  'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                  {p.role}
                </span>
              </div>
              {p.articleTitle && (
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <p className="text-xs text-[#666] truncate">{p.articleTitle}</p>
                  {onFlagTitle && (
                    <button
                      type="button"
                      disabled={flagged[p.id]}
                      onClick={() => {
                        onFlagTitle(p.articleTitle)
                        setFlagged((f) => ({ ...f, [p.id]: true }))
                      }}
                      title="Flag this title as boring or too well-known"
                      className={`shrink-0 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full border transition-colors ${
                        flagged[p.id]
                          ? 'border-green-500/20 text-green-400 cursor-default'
                          : 'border-[#333] text-[#666] hover:text-[#aaa] hover:border-[#555]'
                      }`}
                    >
                      {flagged[p.id] ? 'flagged ✓' : 'bad title?'}
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {canAdvance && (
          <div className="animate-fade-in w-full max-w-xs mt-4" style={{ animationDelay: '600ms' }}>
            <Button onClick={onEndRound}>Run It Back</Button>
          </div>
        )}
      </div>
    </Layout>
  )
}
