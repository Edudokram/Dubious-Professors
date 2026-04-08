import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import Button from '../components/Button'

export default function HomeScreen({ onStartGame, onJoinGame, onHowToPlay, onRejoin }) {
  const [hasDisconnectedRoom, setHasDisconnectedRoom] = useState(false)

  useEffect(() => {
    const roomCode = sessionStorage.getItem('dp_roomCode')
    if (roomCode) setHasDisconnectedRoom(true)
  }, [])

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-8">
        <h1 className="text-3xl font-light tracking-[0.15em] uppercase mb-12">
          Dubious<br />Professors
        </h1>

        <div className="flex flex-col gap-4">
          <Button onClick={onStartGame}>Start Game</Button>
          <Button onClick={onJoinGame}>Join Game</Button>
          <Button onClick={onHowToPlay}>How to Play</Button>
          {hasDisconnectedRoom && (
            <Button onClick={onRejoin}>Rejoin Game</Button>
          )}
        </div>
      </div>
    </Layout>
  )
}
