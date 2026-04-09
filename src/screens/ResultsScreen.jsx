import Layout from '../components/Layout'
import Button from '../components/Button'

export default function ResultsScreen({ myPlayer, guess, players, isInterrogator, onEndRound }) {
  const guessedPlayer = players.find(p => p.id === guess.guessedPlayerId)
  const truthfulPlayer = players.find(p => p.role === 'truthful')
  const interrogator = players.find(p => p.role === 'interrogator')

  let resultMessage = ''
  let subMessage = ''

  if (myPlayer.role === 'interrogator') {
    if (guess.correct) {
      resultMessage = 'Correct!'
      subMessage = `${guessedPlayer.name} was the truthful professor.`
    } else {
      resultMessage = 'Wrong.'
      subMessage = `You picked ${guessedPlayer.name}, but it was ${truthfulPlayer.name}.`
    }
  } else if (myPlayer.role === 'truthful') {
    if (guess.correct) {
      resultMessage = 'You got caught.'
      subMessage = `${interrogator.name} figured you out.`
    } else {
      resultMessage = 'You got away with it!'
      subMessage = `${interrogator.name} picked ${guessedPlayer.name} instead.`
    }
  } else {
    if (guess.correct) {
      resultMessage = 'Interrogator got it right.'
      subMessage = `${truthfulPlayer.name} was caught.`
    } else if (guess.guessedPlayerId === myPlayer.id) {
      resultMessage = 'You got falsely accused!'
      subMessage = `The real one was ${truthfulPlayer.name}.`
    } else {
      resultMessage = 'The truthful professor wins.'
      subMessage = `${interrogator.name} picked wrong.`
    }
  }

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center w-full">
        <h2 className="animate-fade-in text-2xl font-bold" style={{ animationDelay: '100ms' }}>
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
                <p className="text-xs text-[#666] mt-1.5 truncate">{p.articleTitle}</p>
              )}
            </div>
          ))}
        </div>

        {isInterrogator && (
          <div className="animate-fade-in w-full max-w-xs mt-4" style={{ animationDelay: '600ms' }}>
            <Button onClick={onEndRound}>Run It Back</Button>
          </div>
        )}
      </div>
    </Layout>
  )
}
