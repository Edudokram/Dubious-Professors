import { useState, useEffect } from 'react'
import Layout from '../components/Layout'

export default function PausedScreen({ pausedAt, disconnectedPlayerName }) {
  const PAUSE_DURATION = 3 * 60 * 1000 // 3 minutes
  const [secondsLeft, setSecondsLeft] = useState(180)

  useEffect(() => {
    if (!pausedAt) return

    const interval = setInterval(() => {
      const elapsed = Date.now() - pausedAt
      const remaining = Math.max(0, Math.ceil((PAUSE_DURATION - elapsed) / 1000))
      setSecondsLeft(remaining)
    }, 1000)

    return () => clearInterval(interval)
  }, [pausedAt])

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center">
        <h2 className="text-xl font-light tracking-[0.15em] uppercase">
          Game Paused
        </h2>

        <p className="font-light opacity-70 max-w-xs leading-relaxed">
          {disconnectedPlayerName
            ? `${disconnectedPlayerName} has disconnected.`
            : 'A player has disconnected.'
          }
          <br />
          Waiting for them to rejoin...
        </p>

        <div className="text-4xl font-light tracking-widest tabular-nums">
          {mins}:{secs.toString().padStart(2, '0')}
        </div>
      </div>
    </Layout>
  )
}
