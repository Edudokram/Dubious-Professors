import { useEffect } from 'react'
import Layout from '../components/Layout'
import Button from '../components/Button'
import TimerDisplay from '../components/Timer'
import { useTimer } from '../hooks/useTimer'

export default function InterrogationScreen({
  phase,
  myPlayer,
  selectedArticleTitle,
  timerOn,
  isInterrogator,
  onDone,
}) {
  const isPhase1 = phase === 'interrogation-1'
  const duration = isPhase1 ? 10 : 60
  const { secondsLeft, isRunning, start } = useTimer(duration, () => {
    if (isInterrogator) onDone()
  })

  useEffect(() => {
    if (timerOn) start()
  }, [phase, timerOn, start])

  if (isInterrogator) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center">
          {timerOn && isRunning && (
            <TimerDisplay secondsLeft={secondsLeft} />
          )}

          <h2 className="text-lg font-light tracking-[0.1em] max-w-xs leading-relaxed">
            {isPhase1
              ? `Ask each professor, "What is ${selectedArticleTitle}?" (~10 seconds)`
              : `Ask each professor for the full story (~1 minute)`
            }
          </h2>

          <p className="text-2xl font-light tracking-wide">
            {selectedArticleTitle}
          </p>

          <Button onClick={onDone} className="mt-4">
            {isPhase1 ? 'Done' : 'End Interrogation'}
          </Button>
        </div>
      </Layout>
    )
  }

  // Professor view
  return (
    <Layout>
      <div className="flex-1 flex flex-col items-center justify-center gap-8 text-center">
        {timerOn && isRunning && (
          <TimerDisplay secondsLeft={secondsLeft} />
        )}

        <h2 className="text-sm font-light tracking-[0.15em] uppercase opacity-60">
          {myPlayer.role === 'truthful' ? 'Truthful Professor' : 'Dubious Professor'}
        </h2>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-light opacity-50 uppercase tracking-widest">Article being discussed</p>
            <p className="text-xl font-light tracking-wide">{selectedArticleTitle}</p>
          </div>

          {myPlayer.role === 'dubious' && (
            <div>
              <p className="text-sm font-light opacity-50 uppercase tracking-widest">Your article (reference)</p>
              <p className="text-lg font-light tracking-wide opacity-70">{myPlayer.articleTitle}</p>
            </div>
          )}
        </div>

        <p className="font-light opacity-40 text-sm">
          {isPhase1 ? 'Waiting for interrogation to proceed...' : 'Answer the Interrogator\'s questions...'}
        </p>
      </div>
    </Layout>
  )
}
