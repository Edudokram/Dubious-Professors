import { useState } from 'react'
import Layout from '../components/Layout'
import Button from '../components/Button'
import Toggle from '../components/Toggle'

export default function SettingsScreen({ onStart, onCancel }) {
  const [randomRoles, setRandomRoles] = useState(false)

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full">
        <h2 className="animate-fade-in text-xl font-bold mb-2">Game Settings</h2>

        <div className="animate-fade-in w-full max-w-xs bg-[#1a1a1a] rounded-2xl p-5 border border-[#333]" style={{ animationDelay: '100ms' }}>
          <Toggle label="Random Roles" value={randomRoles} onChange={setRandomRoles} />
        </div>

        <div className="flex flex-col gap-3 w-full max-w-xs animate-fade-in" style={{ animationDelay: '200ms' }}>
          <Button onClick={() => onStart({ randomRoles, keepLobby: true })}>
            Start Game
          </Button>
          <Button onClick={onCancel} variant="ghost">Cancel</Button>
        </div>
      </div>
    </Layout>
  )
}
