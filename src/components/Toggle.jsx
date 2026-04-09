export default function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between w-full py-3">
      <span className="text-sm text-[#ccc]">{label}</span>
      <button
        onClick={() => onChange(!value)}
        className={`w-12 h-6 rounded-full relative transition-all duration-300 ${
          value ? 'bg-white' : 'bg-[#333]'
        }`}
      >
        <span
          className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 ${
            value
              ? 'right-1 bg-[#111]'
              : 'left-1 bg-[#666]'
          }`}
        />
      </button>
    </div>
  )
}
