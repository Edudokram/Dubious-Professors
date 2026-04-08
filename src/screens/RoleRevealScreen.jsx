import { useState, useEffect } from 'react'
import Layout from '../components/Layout'
import Button from '../components/Button'

export default function RoleRevealScreen({ myPlayer, selectedArticleTitle, isHost, onContinue }) {
  const [acknowledged, setAcknowledged] = useState(false)

  if (myPlayer.role === 'interrogator') {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center">
          <h2 className="text-xl font-light tracking-[0.15em] uppercase">
            You are the Interrogator
          </h2>

          <p className="font-light opacity-80 max-w-xs leading-relaxed">
            The article being discussed is:
          </p>

          <p className="text-2xl font-light tracking-wide">
            {selectedArticleTitle}
          </p>

          <p className="font-light opacity-60 max-w-xs leading-relaxed text-sm">
            Question each professor to figure out who actually read this article.
          </p>

          {isHost && (
            <Button onClick={onContinue} className="mt-4">
              Begin Interrogation
            </Button>
          )}
        </div>
      </Layout>
    )
  }

  if (myPlayer.role === 'truthful') {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center">
          <h2 className="text-xl font-light tracking-[0.15em] uppercase">
            You are the Truthful Professor
          </h2>

          <p className="font-light opacity-80 max-w-xs leading-relaxed">
            The article being discussed should be what you have read.
          </p>

          <p className="text-2xl font-light tracking-wide">
            {selectedArticleTitle}
          </p>

          <p className="font-light opacity-60 max-w-xs leading-relaxed text-sm">
            Answer the Interrogator's questions honestly using what you read.
          </p>
        </div>
      </Layout>
    )
  }

  // Dubious professor
  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center">
        <h2 className="text-xl font-light tracking-[0.15em] uppercase">
          You are a Dubious Professor
        </h2>

        <p className="font-light opacity-80 max-w-xs leading-relaxed">
          The article being discussed should NOT be what you have read.
          Pretend you know everything about it.
        </p>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-light opacity-50 uppercase tracking-widest">Article being discussed</p>
            <p className="text-xl font-light tracking-wide">{selectedArticleTitle}</p>
          </div>

          <div>
            <p className="text-sm font-light opacity-50 uppercase tracking-widest">Your article (for reference)</p>
            <p className="text-lg font-light tracking-wide opacity-70">{myPlayer.articleTitle}</p>
          </div>
        </div>

        <p className="font-light opacity-60 max-w-xs leading-relaxed text-sm">
          Bluff your way through the Interrogator's questions!
        </p>
      </div>
    </Layout>
  )
}
