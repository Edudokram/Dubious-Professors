export default function Timer({ secondsLeft }) {
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const isLow = secondsLeft <= 5

  return (
    <div className={`text-5xl font-light tracking-widest tabular-nums transition-colors duration-300 ${
      isLow ? 'text-red-400' : 'text-[#888]'
    }`}>
      {mins > 0 && <>{mins}:</>}
      {secs.toString().padStart(mins > 0 ? 2 : 1, '0')}
    </div>
  )
}
