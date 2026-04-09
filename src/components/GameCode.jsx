import { useState } from 'react'

export default function GameCode({ code }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
    } catch {
      const el = document.createElement('textarea')
      el.value = code
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={handleCopy}
      className="text-center group animate-scale-in"
    >
      <div className="text-xs font-medium tracking-widest uppercase text-[#666] mb-2">
        {copied ? 'Copied!' : 'Tap to copy'}
      </div>
      <div className="text-5xl font-light tracking-[0.4em] text-white group-hover:opacity-80 transition-opacity">
        {code}
      </div>
    </button>
  )
}
