export default function Timer({ secondsLeft }) {
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60

  return (
    <div className="text-4xl font-light tracking-widest tabular-nums">
      {mins > 0 && <>{mins}:</>}
      {secs.toString().padStart(mins > 0 ? 2 : 1, '0')}
    </div>
  )
}
