import { useState, useEffect } from 'react'

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

  const [roomCode, setRoomCodeState] = useState(() => {
    return sessionStorage.getItem('dp_roomCode') || null
  })

  function setPlayerName(name) {
    sessionStorage.setItem('dp_playerName', name)
    setPlayerNameState(name)
  }

  function setRoomCode(code) {
    if (code) {
      sessionStorage.setItem('dp_roomCode', code)
    } else {
      sessionStorage.removeItem('dp_roomCode')
    }
    setRoomCodeState(code)
  }

  function clearSession() {
    sessionStorage.removeItem('dp_roomCode')
    setRoomCodeState(null)
  }

  return { playerId, playerName, setPlayerName, roomCode, setRoomCode, clearSession }
}
