import { useState } from 'react'

export default function GameCode({ code }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea')
      el.value = code
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="text-center"
    >
      <div className="text-sm font-light tracking-widest uppercase opacity-60 mb-1">
        Game Code {copied && '— Copied!'}
      </div>
      <div className="text-4xl font-light tracking-[0.3em]">
        {code}
      </div>
    </button>
  )
}
