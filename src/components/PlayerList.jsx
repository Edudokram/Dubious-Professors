export default function PlayerList({ players, onSelect, selectedId, showStatus }) {
  return (
    <div className="w-full space-y-2 stagger">
      {players.map((player, i) => {
        const isDisconnected = player.connected === false
        const isSelected = selectedId === player.id

        return (
          <button
            key={player.id}
            onClick={() => onSelect?.(player.id)}
            disabled={!onSelect}
            className={`animate-slide-up w-full text-left px-4 py-3 rounded-xl border transition-all duration-200 flex items-center justify-between
              ${onSelect ? 'cursor-pointer hover:bg-[#252525] active:scale-[0.98]' : 'cursor-default'}
              ${isSelected ? 'bg-white text-[#111] border-white' : 'bg-[#1a1a1a] border-[#333]'}
              ${isDisconnected ? 'opacity-40' : ''}
            `}
          >
            <span className="flex items-center gap-3">
              <span className={`text-xs font-medium w-5 h-5 rounded-full flex items-center justify-center ${
                isSelected ? 'bg-[#111] text-white' : 'bg-[#333] text-[#888]'
              }`}>
                {i + 1}
              </span>
              <span className="font-medium text-sm">
                {player.name}
                {isDisconnected && <span className="text-xs ml-2 opacity-60">(offline)</span>}
              </span>
            </span>
            {showStatus && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                player.isReady
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-[#333] text-[#666]'
              }`}>
                {player.isReady ? 'Ready' : 'Reading...'}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
