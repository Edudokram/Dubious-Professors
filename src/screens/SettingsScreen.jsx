import { useState } from 'react'
import Layout from '../components/Layout'
import Button from '../components/Button'
import Toggle from '../components/Toggle'

export default function SettingsScreen({ onStart, onCancel }) {
  const [timerOn, setTimerOn] = useState(false)
  const [randomRoles, setRandomRoles] = useState(false)
  const [keepLobby, setKeepLobby] = useState(false)

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full">
        <h2 className="text-xl font-light tracking-[0.15em] uppercase mb-6">
          Customize Game
        </h2>

        <div className="w-full max-w-xs">
          <Toggle label="Timer" value={timerOn} onChange={setTimerOn} />
          <Toggle label="Random Roles" value={randomRoles} onChange={setRandomRoles} />
          <Toggle label="Keep Lobby" value={keepLobby} onChange={setKeepLobby} />
        </div>

        <div className="flex flex-col gap-4 mt-8">
          <Button onClick={() => onStart({ timerOn, randomRoles, keepLobby })}>
            Start Game
          </Button>
          <Button onClick={onCancel}>Cancel</Button>
        </div>
      </div>
    </Layout>
  )
}
