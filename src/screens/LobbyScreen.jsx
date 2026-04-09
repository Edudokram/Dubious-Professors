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

        <div className="animate-fade-in text-xs font-medium tracking-widest uppercase text-[#666]">
          {players.length} player{players.length !== 1 ? 's' : ''} in lobby
        </div>

        <PlayerList players={players} />

        <div className="animate-fade-in mt-2 flex flex-col items-center gap-3 w-full max-w-xs" style={{ animationDelay: '300ms' }}>
          {isHost ? (
            <>
              {players.length < minPlayers && (
                <p className="text-xs text-[#666] text-center">
                  Need at least {minPlayers} players
                </p>
              )}
              <Button
                onClick={onBeginGame}
                disabled={players.length < minPlayers}
              >
                Begin Game
              </Button>
            </>
          ) : (
            <p className="text-sm text-[#666] text-center">
              Waiting for host to lock in...
            </p>
          )}
        </div>
      </div>
    </Layout>
  )
}
