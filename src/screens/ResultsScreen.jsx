import Layout from '../components/Layout'
import Button from '../components/Button'

export default function ResultsScreen({ myPlayer, guess, players, isHost, onEndRound }) {
  const guessedPlayer = players.find(p => p.id === guess.guessedPlayerId)
  const truthfulPlayer = players.find(p => p.role === 'truthful')
  const interrogator = players.find(p => p.role === 'interrogator')

  let resultMessage = ''
  let subMessage = ''

  if (myPlayer.role === 'interrogator') {
    if (guess.correct) {
      resultMessage = 'You guessed correctly!'
      subMessage = `${guessedPlayer.name} was indeed the truthful professor.`
    } else {
      resultMessage = 'You guessed wrong!'
      subMessage = `You picked ${guessedPlayer.name}, but ${truthfulPlayer.name} was the truthful professor.`
    }
  } else if (myPlayer.role === 'truthful') {
    if (guess.correct) {
      resultMessage = 'You were caught!'
      subMessage = `${interrogator.name} identified you as the truthful professor.`
    } else {
      resultMessage = 'You win!'
      subMessage = `${interrogator.name} guessed ${guessedPlayer.name} instead of you.`
    }
  } else {
    // Dubious
    if (guess.correct) {
      resultMessage = 'The interrogator wins'
      subMessage = `${interrogator.name} correctly identified ${truthfulPlayer.name}.`
    } else if (guess.guessedPlayerId === myPlayer.id) {
      resultMessage = 'You were suspected!'
      subMessage = `${interrogator.name} thought you were the truthful professor. But ${truthfulPlayer.name} was.`
    } else {
      resultMessage = 'The truthful professor wins'
      subMessage = `${interrogator.name} guessed ${guessedPlayer.name}, but it was ${truthfulPlayer.name}.`
    }
  }

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center">
        <h2 className="text-2xl font-light tracking-[0.15em] uppercase">
          {resultMessage}
        </h2>

        <p className="font-light opacity-70 max-w-xs leading-relaxed">
          {subMessage}
        </p>

        <div className="w-full max-w-xs space-y-2 mt-4">
          {players.map((p) => (
            <div key={p.id} className="flex items-center justify-between px-4 py-3 border border-white font-light">
              <span>{p.name}</span>
              <span className="text-sm opacity-60 uppercase tracking-wider">
                {p.role}
              </span>
            </div>
          ))}
        </div>

        {isHost && (
          <Button onClick={onEndRound} className="mt-6">
            End Round
          </Button>
        )}
      </div>
    </Layout>
  )
}
