export default function Layout({ children }) {
  return (
    <div className="min-h-screen bg-[#111111] text-[#f0f0f0] flex flex-col items-center px-5 py-8">
      <div className="w-full max-w-md flex flex-col items-center flex-1">
        {children}
      </div>
    </div>
  )
}
