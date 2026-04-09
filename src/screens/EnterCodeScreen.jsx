import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import Button from '../components/Button'

export default function EnterCodeScreen({ onJoin, onCancel, error: externalError }) {
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (externalError) setError(externalError)
  }, [externalError])

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setError('')
    setChecking(true)
    await onJoin(trimmed)
    setChecking(false)
  }

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full">
        <h2 className="animate-fade-in text-xl font-bold">Enter Game Code</h2>

        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-5 w-full max-w-xs">
          <div className="animate-fade-in w-full" style={{ animationDelay: '100ms' }}>
            <input
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError('') }}
              maxLength={3}
              autoFocus
              placeholder="ABC"
              className={`w-full bg-[#1a1a1a] border rounded-xl px-5 py-4 text-white text-center text-3xl tracking-[0.4em] font-light outline-none transition-colors placeholder:text-[#333] uppercase ${
                error ? 'border-red-500/50' : 'border-[#333] focus:border-[#555]'
              }`}
            />
            {error && (
              <p className="text-red-400/80 text-xs text-center mt-2 animate-fade-in-fast">{error}</p>
            )}
          </div>

          <div className="flex flex-col gap-3 w-full animate-fade-in" style={{ animationDelay: '200ms' }}>
            <Button type="submit" disabled={!code.trim() || checking}>
              {checking ? 'Checking...' : 'Join'}
            </Button>
            <Button onClick={onCancel} variant="ghost">Back</Button>
          </div>
        </form>
      </div>
    </Layout>
  )
}
