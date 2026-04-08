import { useState } from 'react'
import Layout from '../components/Layout'
import Button from '../components/Button'

export default function EnterNameScreen({ onSubmit, onCancel }) {
  const [name, setName] = useState('')

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed) onSubmit(trimmed)
  }

  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        <h2 className="text-xl font-light tracking-[0.15em] uppercase mb-4">
          Enter Your Name
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-6">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
            placeholder="Name"
            className="bg-transparent border border-white px-6 py-3 text-white font-light tracking-wide text-center text-lg w-64 outline-none placeholder:opacity-30"
          />

          <div className="flex flex-col gap-4">
            <Button type="submit" disabled={!name.trim()}>Continue</Button>
            {onCancel && <Button onClick={onCancel}>Cancel</Button>}
          </div>
        </form>
      </div>
    </Layout>
  )
}
