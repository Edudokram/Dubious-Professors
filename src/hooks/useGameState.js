import { useState, useEffect, useCallback, useRef } from 'react'
import { db, ref, set, get, update, onValue, onDisconnect, remove, serverTimestamp, increment } from '../firebase'
import { generateRoomCode } from '../lib/roomCode'

// Rooms older than this with no connected players are deleted on next createRoom.
// Tuned conservatively: long enough not to nuke a slow party game, short enough
// that the curated funny-code pool recycles within a day of abandonment.
const STALE_ROOM_MS = 4 * 60 * 60 * 1000  // 4 hours

// Firebase RTDB keys can't contain . # $ [ ] / — escape them reversibly so each
// distinct title maps to a distinct, valid key. The readable title is also stored
// in the value, so pull-feedback.mjs never has to decode the key.
function feedbackKey(title) {
  return title.replace(/[.#$/[\]]/g, (c) => `~${c.charCodeAt(0)}~`)
}

function findStaleRoomCodes(roomsData) {
  if (!roomsData) return []
  const now = Date.now()
  const stale = []
  for (const [code, room] of Object.entries(roomsData)) {
    if (!room || typeof room !== 'object') continue
    // Skip rooms with any currently-connected player (active game).
    const players = room.players ? Object.values(room.players) : []
    if (players.some((p) => p && p.connected === true)) continue
    // Need a numeric timestamp to judge age. Skip pending/missing values.
    const createdAt = room.createdAt
    if (typeof createdAt !== 'number') continue
    if (now - createdAt < STALE_ROOM_MS) continue
    stale.push(code)
  }
  return stale
}

export function useGameState(playerId, roomCode) {
  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const hasLoadedOnce = useRef(false)

  // Subscribe to room state
  useEffect(() => {
    if (!roomCode) {
      setRoom(null)
      setLoading(false)
      hasLoadedOnce.current = false
      return
    }

    setLoading(true)
    hasLoadedOnce.current = false

    const roomRef = ref(db, `rooms/${roomCode}`)
    const unsub = onValue(roomRef, (snapshot) => {
      const data = snapshot.val()
      hasLoadedOnce.current = true
      setLoading(false)
      if (!data) {
        setRoom(null)
        return
      }
      setRoom(data)
      setError(null)
    }, (err) => {
      setLoading(false)
      hasLoadedOnce.current = true
      setError(err.message)
    })

    return () => unsub()
  }, [roomCode])

  // Presence tracking — re-establishes onDisconnect hooks after reconnect
  useEffect(() => {
    if (!roomCode || !playerId) return

    const playerConnRef = ref(db, `rooms/${roomCode}/players/${playerId}/connected`)
    const playerLastSeenRef = ref(db, `rooms/${roomCode}/players/${playerId}/lastSeen`)
    const connectedRef = ref(db, '.info/connected')

    function setupPresence() {
      set(playerConnRef, true).catch(() => {})
      set(playerLastSeenRef, serverTimestamp()).catch(() => {})
      onDisconnect(playerConnRef).set(false)
      onDisconnect(playerLastSeenRef).set(serverTimestamp())
    }

    // Re-setup presence every time Firebase reconnects
    const unsub = onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
        setupPresence()
      }
    })

    // Heartbeat
    const interval = setInterval(() => {
      set(playerLastSeenRef, serverTimestamp()).catch(() => {})
    }, 15000)

    return () => {
      unsub()
      clearInterval(interval)
    }
  }, [roomCode, playerId])

  const createRoom = useCallback(async (hostName, settings) => {
    // Fetch the universe of current rooms. We use this for two things:
    //  1) Identify stale rooms to delete (frees up funny codes that would
    //     otherwise be permanently consumed by abandoned test sessions).
    //  2) Pass occupied codes to generateRoomCode so the funny-pool branch
    //     can pick from codes that are actually free.
    const allRoomsSnap = await get(ref(db, 'rooms'))
    const allRooms = allRoomsSnap.exists() ? allRoomsSnap.val() : {}

    const staleCodes = findStaleRoomCodes(allRooms)
    if (staleCodes.length > 0) {
      // Fire-and-forget — don't block room creation on cleanup network calls.
      // Failures are non-fatal: another client will sweep them next time.
      console.log(`[lobby cleanup] removing ${staleCodes.length} stale room(s):`, staleCodes)
      for (const code of staleCodes) {
        remove(ref(db, `rooms/${code}`)).catch(() => {})
      }
    }

    // Treat stale codes as already-freed for the purposes of code selection,
    // since we just queued their deletion.
    const takenCodes = new Set(Object.keys(allRooms))
    for (const code of staleCodes) takenCodes.delete(code)

    const code = generateRoomCode(takenCodes)
    const roomRef = ref(db, `rooms/${code}`)

    // Race-condition safety net: someone else may have grabbed this code
    // between our read and write. Retry once if so.
    const existing = await get(roomRef)
    if (existing.exists()) {
      return createRoom(hostName, settings)
    }

    await set(roomRef, {
      settings: {
        randomRoles: settings.randomRoles || false,
        keepLobby: true,
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
          joinedAt: serverTimestamp(),
        }
      },
      selectedArticleTitle: '',
      guess: null,
      disconnectTimers: null,
    })

    return code
  }, [playerId])

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

    // Check for duplicate names
    const existingNames = Object.values(data.players || {}).map(p => p.name.toLowerCase())
    if (existingNames.includes(playerName.toLowerCase())) {
      throw new Error('Name already taken')
    }

    await set(ref(db, `rooms/${code}/players/${playerId}`), {
      name: playerName,
      isReady: false,
      articleTitle: '',
      articleUrl: '',
      role: '',
      connected: true,
      lastSeen: serverTimestamp(),
      joinedAt: serverTimestamp(),
    })

    return code
  }, [playerId])

  const getExistingNames = useCallback(async (code) => {
    const roomRef = ref(db, `rooms/${code}`)
    const snapshot = await get(roomRef)
    if (!snapshot.exists()) return []
    const data = snapshot.val()
    return Object.values(data.players || {}).map(p => p.name)
  }, [])

  const rejoinRoom = useCallback(async (code) => {
    // First check if room still exists
    const roomRef = ref(db, `rooms/${code}`)
    const roomSnap = await get(roomRef)
    if (!roomSnap.exists()) {
      throw new Error('Room no longer exists')
    }

    const playerRef = ref(db, `rooms/${code}/players/${playerId}`)
    const snapshot = await get(playerRef)

    if (!snapshot.exists()) {
      throw new Error('You are not in this room')
    }

    await update(playerRef, {
      connected: true,
      lastSeen: serverTimestamp(),
    })

    // Clear disconnect timer for this player
    await remove(ref(db, `rooms/${code}/disconnectTimers/${playerId}`))

    return code
  }, [playerId])

  const beginGame = useCallback(async (code, randomRoles) => {
    const roomRef = ref(db, `rooms/${code}`)
    const snapshot = await get(roomRef)
    const data = snapshot.val()
    const playerIds = Object.keys(data.players)
    // Only connected players are eligible for randomly-assigned roles —
    // never select a disconnected ghost as Interrogator.
    const connectedIds = playerIds.filter((id) => data.players[id].connected !== false)

    if (randomRoles) {
      // Assign interrogator now, before article selection
      const eligible = connectedIds.length > 0 ? connectedIds : playerIds
      const interrogatorId = eligible[Math.floor(Math.random() * eligible.length)]

      const updates = {
        phase: 'article-selection',
      }
      // Set everyone's role: interrogator for the chosen one, clear for others
      for (const pid of playerIds) {
        updates[`players/${pid}/role`] = pid === interrogatorId ? 'interrogator' : ''
      }

      await update(roomRef, updates)
    } else {
      // Host is interrogator
      const updates = {
        phase: 'article-selection',
      }
      for (const pid of playerIds) {
        updates[`players/${pid}/role`] = pid === data.hostId ? 'interrogator' : ''
      }

      await update(roomRef, updates)
    }
  }, [])

  const selectArticle = useCallback(async (code, title, url) => {
    await update(ref(db, `rooms/${code}/players/${playerId}`), {
      articleTitle: title,
      articleUrl: url,
      isReady: false,
    })
  }, [playerId])

  const setReady = useCallback(async (code) => {
    await update(ref(db, `rooms/${code}/players/${playerId}`), {
      isReady: true,
    })
  }, [playerId])

  const startRoleReveal = useCallback(async (code) => {
    const roomRef = ref(db, `rooms/${code}`)
    const snapshot = await get(roomRef)
    const data = snapshot.val()

    // Interrogator is already assigned. Now pick truthful from the professors —
    // but only from connected ones, never a disconnected ghost.
    const playerIds = Object.keys(data.players)
    const professorIds = playerIds.filter(id => data.players[id].role !== 'interrogator')
    const eligibleProfessorIds = professorIds.filter(id => data.players[id].connected !== false)
    const pool = eligibleProfessorIds.length > 0 ? eligibleProfessorIds : professorIds

    const truthfulIdx = Math.floor(Math.random() * pool.length)
    const truthfulId = pool[truthfulIdx]

    const selectedArticleTitle = data.players[truthfulId].articleTitle

    const updates = {
      phase: 'role-reveal',
      selectedArticleTitle,
    }

    for (const pid of professorIds) {
      updates[`players/${pid}/role`] = pid === truthfulId ? 'truthful' : 'dubious'
    }

    await update(roomRef, updates)
  }, [])

  const advancePhase = useCallback(async (code, nextPhase) => {
    await update(ref(db, `rooms/${code}`), { phase: nextPhase })
  }, [])

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

  // Player feedback: flag a title as boring/too-famous. Accumulates downvotes in
  // feedback/<key>; pull-feedback.mjs later folds high-vote titles into the deny
  // list. Atomic server-side increment so concurrent flags from a lobby all count.
  const flagTitle = useCallback(async (title) => {
    if (!title) return
    await update(ref(db, `feedback/${feedbackKey(title)}`), {
      title,
      downvotes: increment(1),
      lastFlagged: serverTimestamp(),
    })
  }, [])

  const endRound = useCallback(async (code) => {
    const roomRef = ref(db, `rooms/${code}`)
    const snapshot = await get(roomRef)
    const data = snapshot.val()

    if (data.settings.keepLobby) {
      const updates = {
        phase: 'lobby',
        selectedArticleTitle: '',
        guess: null,
        disconnectTimers: null,
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

  const leaveRoom = useCallback(async (code) => {
    await remove(ref(db, `rooms/${code}/players/${playerId}`))
    // If we were the last player, delete the room so the code returns to the pool.
    const playersSnap = await get(ref(db, `rooms/${code}/players`)).catch(() => null)
    if (!playersSnap || !playersSnap.exists() || Object.keys(playersSnap.val()).length === 0) {
      await remove(ref(db, `rooms/${code}`)).catch(() => {})
    }
  }, [playerId])

  const myPlayer = room?.players?.[playerId] || null
  const isHost = room?.hostId === playerId
  const isInterrogator = myPlayer?.role === 'interrogator'
  const players = room?.players || {}

  // Sort players chronologically by join time
  const playerList = Object.entries(players)
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))

  const connectedPlayers = playerList.filter(p => p.connected !== false)

  return {
    room,
    loading,
    hasLoaded: hasLoadedOnce.current,
    error,
    myPlayer,
    isHost,
    isInterrogator,
    players,
    playerList,
    connectedPlayers,
    createRoom,
    joinRoom,
    getExistingNames,
    rejoinRoom,
    beginGame,
    selectArticle,
    setReady,
    startRoleReveal,
    advancePhase,
    submitGuess,
    flagTitle,
    endRound,
    leaveRoom,
  }
}
