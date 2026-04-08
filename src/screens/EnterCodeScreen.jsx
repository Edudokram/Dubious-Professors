import { useState } from 'react'
import Layout from '../components/Layout'
import Button from '../components/Button'

export default function EnterCodeScreen({ onJoin, onCancel, error }) {
  const [code, setCode] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (trimmed) onJoin(trimmed)
  }

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <h2 className="text-xl font-light tracking-[0.15em] uppercase mb-4">
          Enter Game Code
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={6}
            autoFocus
            placeholder="CODE"
            className="bg-transparent border border-white px-6 py-3 text-white font-light tracking-[0.3em] text-center text-2xl w-64 outline-none placeholder:opacity-30 uppercase"
          />

          {error && (
            <p className="text-white opacity-60 text-sm font-light">{error}</p>
          )}

          <div className="flex flex-col gap-4">
            <Button type="submit" disabled={!code.trim()}>Join Game</Button>
            <Button onClick={onCancel}>Cancel</Button>
          </div>
        </form>
      </div>
    </Layout>
  )
}
