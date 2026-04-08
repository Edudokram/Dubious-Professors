export default function PlayerList({ players, onSelect, selectedId, showStatus }) {
  return (
    <div className="w-full max-w-xs space-y-2">
      {players.map((player, i) => {
        const isDisconnected = player.connected === false
        const isSelected = selectedId === player.id

        return (
          <button
            key={player.id}
            onClick={() => onSelect?.(player.id)}
            disabled={!onSelect}
            className={`w-full text-left px-4 py-3 border border-white font-light tracking-wide flex items-center justify-between
              ${onSelect ? 'cursor-pointer hover:opacity-80' : 'cursor-default'}
              ${isSelected ? 'bg-white text-[#1a1a1a]' : ''}
              ${isDisconnected ? 'opacity-40' : ''}
            `}
          >
            <span>
              <span className="text-sm opacity-50 mr-3">{i + 1}</span>
              {player.name}
              {isDisconnected && <span className="text-xs ml-2 opacity-60">(disconnected)</span>}
            </span>
            {showStatus && (
              <span className="text-sm">
                {player.isReady ? '✓' : '?'}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
