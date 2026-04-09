import { useState } from 'react'
import Layout from '../components/Layout'
import Button from '../components/Button'
import PlayerList from '../components/PlayerList'

export default function GuessScreen({ isInterrogator, professors, onGuess }) {
  const [selected, setSelected] = useState(null)

  if (!isInterrogator) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center">
          <div className="animate-scale-in w-16 h-16 rounded-full bg-[#1a1a1a] border border-[#333] flex items-center justify-center text-2xl">
            ?
          </div>
          <h2 className="animate-fade-in text-lg font-bold">
            Interrogator is deciding...
          </h2>
          <p className="animate-fade-in text-sm text-[#666]" style={{ animationDelay: '100ms' }}>
            Sit tight.
          </p>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full">
        <h2 className="animate-fade-in text-xl font-bold text-center">
          Who's the truthful professor?
        </h2>

        <PlayerList
          players={professors}
          onSelect={setSelected}
          selectedId={selected}
        />

        <div className="animate-fade-in w-full max-w-xs mt-2" style={{ animationDelay: '300ms' }}>
          <Button
            onClick={() => onGuess(selected)}
            disabled={!selected}
          >
            Lock In
          </Button>
        </div>
      </div>
    </Layout>
  )
}
