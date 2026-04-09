import { useState, useMemo } from 'react'
import Layout from '../components/Layout'
import Button from '../components/Button'

export default function EnterNameScreen({ onSubmit, onCancel, existingNames = [], error: externalError }) {
  const [name, setName] = useState('')
  const [localError, setLocalError] = useState('')

  const trimmed = name.trim()
  const isDuplicate = useMemo(
    () => existingNames.some(n => n.toLowerCase() === trimmed.toLowerCase()),
    [trimmed, existingNames]
  )
  const isEmpty = trimmed.length === 0

  const displayError = localError || externalError || (isDuplicate ? 'That name is already taken' : '')
  const isDisabled = isEmpty || isDuplicate

  function handleSubmit(e) {
    e.preventDefault()
    if (isEmpty) {
      setLocalError('Name cannot be blank')
      return
    }
    if (isDuplicate) return
    setLocalError('')
    onSubmit(trimmed)
  }

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full">
        <h2 className="animate-fade-in text-xl font-bold">Enter Your Name</h2>

        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-5 w-full max-w-xs">
          <div className="animate-fade-in w-full" style={{ animationDelay: '100ms' }}>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setLocalError('') }}
              maxLength={20}
              autoFocus
              placeholder="Enter name"
              className={`w-full bg-[#1a1a1a] border rounded-xl px-5 py-3 text-white text-center text-lg outline-none transition-colors placeholder:text-[#444] ${
                displayError ? 'border-red-500/50' : 'border-[#333] focus:border-[#555]'
              }`}
            />
            {displayError && (
              <p className="text-red-400/80 text-xs text-center mt-2 animate-fade-in-fast">{displayError}</p>
            )}
          </div>

          <div className="flex flex-col gap-3 w-full animate-fade-in" style={{ animationDelay: '200ms' }}>
            <Button type="submit" disabled={isDisabled}>Continue</Button>
            {onCancel && <Button onClick={onCancel} variant="ghost">Back</Button>}
          </div>
        </form>
      </div>
    </Layout>
  )
}
