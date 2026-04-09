import Layout from '../components/Layout'
import Button from '../components/Button'

export default function HomeScreen({ onStartGame, onJoinGame, onHowToPlay, canRejoin, onRejoin }) {
  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full">
        <div className="animate-scale-in mb-2">
          <img
            src={import.meta.env.BASE_URL + 'logo.png'}
            alt="Dubious Professors"
            className="w-28 h-28 rounded-full"
          />
        </div>

        <h1 className="animate-fade-in text-2xl font-bold tracking-wide mb-6">
          Dubious Professors
        </h1>

        <div className="flex flex-col gap-3 w-full max-w-xs stagger">
          <div className="animate-slide-up">
            <Button onClick={onStartGame}>Start Game</Button>
          </div>
          <div className="animate-slide-up">
            <Button onClick={onJoinGame} variant="secondary">Join Game</Button>
          </div>
          <div className="animate-slide-up">
            <Button onClick={onHowToPlay} variant="ghost">How to Play</Button>
          </div>
          {canRejoin && (
            <div className="animate-slide-up">
              <Button onClick={onRejoin} variant="secondary">Rejoin Game</Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
