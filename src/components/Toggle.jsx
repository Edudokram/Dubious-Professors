export default function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between w-full max-w-xs py-3">
      <span className="font-light tracking-wide">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-14 h-7 border border-white rounded-full relative transition-colors ${
          value ? 'bg-white' : 'bg-transparent'
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 rounded-full transition-all ${
            value
              ? 'right-0.5 bg-[#1a1a1a]'
              : 'left-0.5 bg-white'
          }`}
        />
      </button>
    </div>
  )
}
