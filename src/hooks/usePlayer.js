import { useState } from 'react'

function generatePlayerId() {
  return Math.random().toString(36).substring(2, 15) + Date.now().toString(36)
}

export function usePlayer() {
  const [playerId] = useState(() => {
    const stored = sessionStorage.getItem('dp_playerId')
    if (stored) return stored
    const id = generatePlayerId()
    sessionStorage.setItem('dp_playerId', id)
    return id
  })

  const [playerName, setPlayerNameState] = useState(() => {
    return sessionStorage.getItem('dp_playerName') || ''
  })

  // Room code starts null on refresh — user must explicitly rejoin
  const [roomCode, setRoomCodeState] = useState(null)

  function setPlayerName(name) {
    sessionStorage.setItem('dp_playerName', name)
    setPlayerNameState(name)
  }

  function setRoomCode(code) {
    setRoomCodeState(code)
  }

  function clearSession() {
    setRoomCodeState(null)
  }

  return { playerId, playerName, setPlayerName, roomCode, setRoomCode, clearSession }
}
