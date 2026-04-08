export default function Button({ children, onClick, disabled, className = '' }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`border border-white px-8 py-3 text-white font-light tracking-wider uppercase text-sm
        transition-opacity hover:opacity-80 active:opacity-60
        disabled:opacity-30 disabled:cursor-not-allowed
        ${className}`}
    >
      {children}
    </button>
  )
}
