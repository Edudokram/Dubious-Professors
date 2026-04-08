import { useState, useEffect, useCallback } from 'react'
import { db, ref, set, get, update, onValue, onDisconnect, remove, serverTimestamp } from '../firebase'
import { generateRoomCode } from '../lib/roomCode'
import { assignRoles } from '../lib/roles'

export function useGameState(playerId, roomCode) {
  const [room, setRoom] = useState(null)
  const [error, setError] = useState(null)

  // Subscribe to room state
  useEffect(() => {
    if (!roomCode) {
      setRoom(null)
      return
    }

    const roomRef = ref(db, `rooms/${roomCode}`)
    const unsub = onValue(roomRef, (snapshot) => {
      const data = snapshot.val()
      if (!data) {
        setRoom(null)
        setError('Room not found')
        return
      }
      setRoom(data)
      setError(null)
    }, (err) => {
      setError(err.message)
    })

    return () => unsub()
  }, [roomCode])

  // Set up presence tracking when in a room
  useEffect(() => {
    if (!roomCode || !playerId) return

    const playerConnRef = ref(db, `rooms/${roomCode}/players/${playerId}/connected`)
    const playerLastSeenRef = ref(db, `rooms/${roomCode}/players/${playerId}/lastSeen`)

    set(playerConnRef, true)
    set(playerLastSeenRef, serverTimestamp())

    // On disconnect, mark as disconnected
    onDisconnect(playerConnRef).set(false)
    onDisconnect(playerLastSeenRef).set(serverTimestamp())

    // Heartbeat
    const interval = setInterval(() => {
      set(playerLastSeenRef, serverTimestamp())
    }, 15000)

    return () => clearInterval(interval)
  }, [roomCode, playerId])

  // Create a new room
  const createRoom = useCallback(async (hostName, settings) => {
    const code = generateRoomCode()
    const roomRef = ref(db, `rooms/${code}`)

    // Check code doesn't already exist
    const existing = await get(roomRef)
    if (existing.exists()) {
      // Extremely unlikely collision, just retry
      return createRoom(hostName, settings)
    }

    await set(roomRef, {
      settings: {
        timerOn: settings.timerOn || false,
        randomRoles: settings.randomRoles || false,
        keepLobby: settings.keepLobby || false,
      },
      phase: 'lobby',
      hostId: playerId,
      createdAt: serverTimestamp(),
      players: {
        [playerId]: {
          name: hostName,
          isReady: false,
          articleTitle: '',
          articleUrl: '',
          role: '',
          connected: true,
          lastSeen: serverTimestamp(),
        }
      },
      selectedArticleTitle: '',
      guess: null,
      pausedAt: null,
      previousPhase: null,
      disconnectedPlayerId: null,
    })

    return code
  }, [playerId])

  // Join an existing room
  const joinRoom = useCallback(async (code, playerName) => {
    const roomRef = ref(db, `rooms/${code}`)
    const snapshot = await get(roomRef)

    if (!snapshot.exists()) {
      throw new Error('Room not found')
    }

    const data = snapshot.val()
    if (data.phase !== 'lobby') {
      throw new Error('Game already in progress')
    }

    await set(ref(db, `rooms/${code}/players/${playerId}`), {
      name: playerName,
      isReady: false,
      articleTitle: '',
      articleUrl: '',
      role: '',
      connected: true,
      lastSeen: serverTimestamp(),
    })

    return code
  }, [playerId])

  // Rejoin a room after disconnect
  const rejoinRoom = useCallback(async (code) => {
    const playerRef = ref(db, `rooms/${code}/players/${playerId}`)
    const snapshot = await get(playerRef)

    if (!snapshot.exists()) {
      throw new Error('You are not in this room')
    }

    await update(playerRef, {
      connected: true,
      lastSeen: serverTimestamp(),
    })

    // If game was paused for this player, unpause
    const roomRef = ref(db, `rooms/${code}`)
    const roomSnap = await get(roomRef)
    const roomData = roomSnap.val()

    if (roomData.phase === 'paused' && roomData.disconnectedPlayerId === playerId) {
      await update(roomRef, {
        phase: roomData.previousPhase,
        pausedAt: null,
        previousPhase: null,
        disconnectedPlayerId: null,
      })
    }

    return code
  }, [playerId])

  // Begin the game (host only)
  const beginGame = useCallback(async (code) => {
    await update(ref(db, `rooms/${code}`), {
      phase: 'article-selection',
    })
  }, [])

  // Set player's chosen article
  const selectArticle = useCallback(async (code, title, url) => {
    await update(ref(db, `rooms/${code}/players/${playerId}`), {
      articleTitle: title,
      articleUrl: url,
      isReady: false,
    })
  }, [playerId])

  // Mark player as ready (done reading article)
  const setReady = useCallback(async (code) => {
    await update(ref(db, `rooms/${code}/players/${playerId}`), {
      isReady: true,
    })
  }, [playerId])

  // Assign roles and advance to role reveal (host only)
  const startRoleReveal = useCallback(async (code) => {
    const roomRef = ref(db, `rooms/${code}`)
    const snapshot = await get(roomRef)
    const data = snapshot.val()

    const { playerUpdates, selectedArticleTitle } = assignRoles(
      data.players,
      data.hostId,
      data.settings.randomRoles
    )

    const updates = {
      phase: 'role-reveal',
      selectedArticleTitle,
    }

    for (const [pid, roleData] of Object.entries(playerUpdates)) {
      updates[`players/${pid}/role`] = roleData.role
    }

    await update(roomRef, updates)
  }, [])

  // Advance to next phase (host/interrogator only)
  const advancePhase = useCallback(async (code, nextPhase) => {
    await update(ref(db, `rooms/${code}`), {
      phase: nextPhase,
    })
  }, [])

  // Submit guess (interrogator only)
  const submitGuess = useCallback(async (code, guessedPlayerId) => {
    const roomRef = ref(db, `rooms/${code}`)
    const snapshot = await get(roomRef)
    const data = snapshot.val()

    const guessedPlayer = data.players[guessedPlayerId]
    const correct = guessedPlayer?.role === 'truthful'

    await update(roomRef, {
      phase: 'results',
      guess: { guessedPlayerId, correct },
    })
  }, [])

  // End round — return to lobby or home
  const endRound = useCallback(async (code) => {
    const roomRef = ref(db, `rooms/${code}`)
    const snapshot = await get(roomRef)
    const data = snapshot.val()

    if (data.settings.keepLobby) {
      // Reset players but keep them in the room
      const updates = {
        phase: 'lobby',
        selectedArticleTitle: '',
        guess: null,
        pausedAt: null,
        previousPhase: null,
        disconnectedPlayerId: null,
      }

      for (const pid of Object.keys(data.players)) {
        updates[`players/${pid}/isReady`] = false
        updates[`players/${pid}/articleTitle`] = ''
        updates[`players/${pid}/articleUrl`] = ''
        updates[`players/${pid}/role`] = ''
      }

      await update(roomRef, updates)
      return 'lobby'
    } else {
      await remove(roomRef)
      return 'home'
    }
  }, [])

  // Pause game due to disconnect
  const pauseGame = useCallback(async (code, disconnectedPid, currentPhase) => {
    await update(ref(db, `rooms/${code}`), {
      phase: 'paused',
      pausedAt: serverTimestamp(),
      previousPhase: currentPhase,
      disconnectedPlayerId: disconnectedPid,
    })
  }, [])

  // Leave room
  const leaveRoom = useCallback(async (code) => {
    await remove(ref(db, `rooms/${code}/players/${playerId}`))
  }, [playerId])

  // Get current player's data
  const myPlayer = room?.players?.[playerId] || null
  const isHost = room?.hostId === playerId
  const players = room?.players || {}
  const playerList = Object.entries(players).map(([id, data]) => ({ id, ...data }))
  const connectedPlayers = playerList.filter(p => p.connected !== false)

  return {
    room,
    error,
    myPlayer,
    isHost,
    players,
    playerList,
    connectedPlayers,
    createRoom,
    joinRoom,
    rejoinRoom,
    beginGame,
    selectArticle,
    setReady,
    startRoleReveal,
    advancePhase,
    submitGuess,
    endRound,
    pauseGame,
    leaveRoom,
  }
}
