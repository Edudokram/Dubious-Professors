export default function Button({ children, onClick, disabled, variant = 'primary', className = '', type = 'button' }) {
  const base = 'px-7 py-3 rounded-xl font-medium text-sm tracking-wide transition-all duration-200 w-full max-w-xs'

  const variants = {
    primary: 'bg-white text-[#111] hover:bg-[#e0e0e0] active:scale-[0.97]',
    secondary: 'bg-[#1a1a1a] text-[#f0f0f0] border border-[#333] hover:border-[#555] hover:bg-[#252525] active:scale-[0.97]',
    ghost: 'bg-transparent text-[#888] hover:text-[#f0f0f0] hover:bg-[#1a1a1a]',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} disabled:opacity-30 disabled:cursor-not-allowed disabled:active:scale-100 ${className}`}
    >
      {children}
    </button>
  )
}
