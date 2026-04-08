import { useState } from 'react'
import Layout from '../components/Layout'
import Button from '../components/Button'
import PlayerList from '../components/PlayerList'

export default function GuessScreen({ isInterrogator, professors, onGuess }) {
  const [selected, setSelected] = useState(null)

  if (!isInterrogator) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center">
          <h2 className="text-xl font-light tracking-[0.15em] uppercase">
            Waiting for the Interrogator<br />to make their guess
          </h2>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-8 w-full">
        <h2 className="text-xl font-light tracking-[0.15em] uppercase text-center">
          Who is the truthful professor?
        </h2>

        <p className="font-light opacity-60 text-sm text-center">
          Make your final guess
        </p>

        <PlayerList
          players={professors}
          onSelect={setSelected}
          selectedId={selected}
        />

        <Button
          onClick={() => onGuess(selected)}
          disabled={!selected}
          className="mt-4"
        >
          Confirm Guess
        </Button>
      </div>
    </Layout>
  )
}
