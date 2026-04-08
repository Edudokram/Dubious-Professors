import Layout from '../components/Layout'
import Button from '../components/Button'
import GameCode from '../components/GameCode'
import PlayerList from '../components/PlayerList'

export default function LobbyScreen({ roomCode, players, isHost, onBeginGame }) {
  const minPlayers = 3

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full">
        <GameCode code={roomCode} />

        <div className="text-sm font-light tracking-widest uppercase opacity-60">
          {players.length} player{players.length !== 1 ? 's' : ''} connected
        </div>

        <PlayerList players={players} />

        {isHost && (
          <div className="mt-6 flex flex-col items-center gap-3">
            {players.length < minPlayers && (
              <p className="text-sm font-light opacity-50">
                Need at least {minPlayers} players to start
              </p>
            )}
            <Button
              onClick={onBeginGame}
              disabled={players.length < minPlayers}
            >
              Begin Game
            </Button>
          </div>
        )}

        {!isHost && (
          <p className="text-sm font-light tracking-widest uppercase opacity-60 mt-6">
            Waiting for host to start the game
          </p>
        )}
      </div>
    </Layout>
  )
}
