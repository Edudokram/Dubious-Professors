import { useState, useEffect, useCallback } from 'react'
import { usePlayer } from './hooks/usePlayer'
import { useGameState } from './hooks/useGameState'

import HomeScreen from './screens/HomeScreen'
import SettingsScreen from './screens/SettingsScreen'
import EnterNameScreen from './screens/EnterNameScreen'
import EnterCodeScreen from './screens/EnterCodeScreen'
import LobbyScreen from './screens/LobbyScreen'
import ArticleSelectScreen from './screens/ArticleSelectScreen'
import ArticleReadScreen from './screens/ArticleReadScreen'
import RoleRevealScreen from './screens/RoleRevealScreen'
import InterrogationScreen from './screens/InterrogationScreen'
import GuessScreen from './screens/GuessScreen'
import ResultsScreen from './screens/ResultsScreen'
import HowToPlayScreen from './screens/HowToPlayScreen'
import PausedScreen from './screens/PausedScreen'

export default function App() {
  const { playerId, playerName, setPlayerName, roomCode, setRoomCode, clearSession } = usePlayer()
  const gameState = useGameState(playerId, roomCode)

  // Local UI state for pre-game navigation
  const [screen, setScreen] = useState('home')
  const [pendingSettings, setPendingSettings] = useState(null)
  const [joinError, setJoinError] = useState(null)
  const [selectedArticle, setSelectedArticle] = useState(null) // { title, url }

  const { room, myPlayer, isHost, playerList, connectedPlayers } = gameState

  // Watch for disconnect events and pause game
  useEffect(() => {
    if (!room || !isHost || room.phase === 'lobby' || room.phase === 'paused' || room.phase === 'results') return

    const disconnected = playerList.find(p => p.connected === false && p.id !== playerId)
    if (disconnected) {
      gameState.pauseGame(roomCode, disconnected.id, room.phase)
    }
  }, [room, isHost, playerList, roomCode, playerId])

  // Watch for pause timeout (3 minutes)
  useEffect(() => {
    if (!room || room.phase !== 'paused' || !isHost) return

    const interval = setInterval(() => {
      if (room.pausedAt) {
        const elapsed = Date.now() - room.pausedAt
        if (elapsed >= 3 * 60 * 1000) {
          // Timeout — end the game
          gameState.endRound(roomCode).then(result => {
            if (result === 'home') {
              clearSession()
              setScreen('home')
            }
          })
        }
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [room, isHost, roomCode])

  // --- PRE-GAME SCREENS (no room yet) ---

  if (!roomCode || !room) {
    if (screen === 'howToPlay') {
      return <HowToPlayScreen onBack={() => setScreen('home')} />
    }

    if (screen === 'settings') {
      return (
        <SettingsScreen
          onStart={(settings) => {
            setPendingSettings(settings)
            if (settings.randomRoles || playerName) {
              // Random roles: skip name entry, use existing name or prompt
              if (playerName) {
                handleCreateRoom(playerName, settings)
              } else {
                setScreen('enterName-host')
              }
            } else {
              setScreen('enterName-host')
            }
          }}
          onCancel={() => setScreen('home')}
        />
      )
    }

    if (screen === 'enterName-host') {
      return (
        <EnterNameScreen
          onSubmit={(name) => handleCreateRoom(name, pendingSettings)}
          onCancel={() => setScreen('settings')}
        />
      )
    }

    if (screen === 'enterName-join') {
      return (
        <EnterNameScreen
          onSubmit={(name) => {
            setPlayerName(name)
            setScreen('enterCode')
          }}
          onCancel={() => setScreen('home')}
        />
      )
    }

    if (screen === 'enterCode') {
      return (
        <EnterCodeScreen
          onJoin={handleJoinRoom}
          onCancel={() => setScreen('home')}
          error={joinError}
        />
      )
    }

    return (
      <HomeScreen
        onStartGame={() => setScreen('settings')}
        onJoinGame={() => {
          if (playerName) {
            setScreen('enterCode')
          } else {
            setScreen('enterName-join')
          }
        }}
        onHowToPlay={() => setScreen('howToPlay')}
        onRejoin={handleRejoin}
      />
    )
  }

  // --- IN-GAME SCREENS (room exists, phase-driven) ---

  const phase = room.phase

  if (phase === 'paused') {
    const disconnectedPlayer = playerList.find(p => p.id === room.disconnectedPlayerId)
    return (
      <PausedScreen
        pausedAt={room.pausedAt}
        disconnectedPlayerName={disconnectedPlayer?.name}
      />
    )
  }

  if (phase === 'lobby') {
    return (
      <LobbyScreen
        roomCode={roomCode}
        players={connectedPlayers}
        isHost={isHost}
        onBeginGame={() => gameState.beginGame(roomCode)}
      />
    )
  }

  if (phase === 'article-selection') {
    const isInterrogator = !room.settings.randomRoles && isHost

    // If player has selected an article but not yet marked ready, show the article
    if (selectedArticle && !myPlayer.isReady && !isInterrogator) {
      return (
        <ArticleReadScreen
          title={selectedArticle.title}
          url={selectedArticle.url}
          onBack={() => setSelectedArticle(null)}
          onReady={() => {
            gameState.setReady(roomCode)
          }}
        />
      )
    }

    // If already ready, show waiting
    if (myPlayer.isReady && !isInterrogator) {
      return (
        <ArticleSelectScreen
          isInterrogator={true}
          players={playerList}
        />
      )
    }

    // Check if all professors are ready (host auto-advances)
    const professors = playerList.filter(p => {
      if (!room.settings.randomRoles) return p.id !== room.hostId
      return true // in random roles mode, everyone is a professor during article selection
    })
    const allReady = professors.length > 0 && professors.every(p => p.isReady)

    if (allReady && isHost) {
      // Auto advance to role reveal
      gameState.startRoleReveal(roomCode)
    }

    return (
      <ArticleSelectScreen
        isInterrogator={isInterrogator}
        players={playerList}
        onSelect={(title, url) => {
          gameState.selectArticle(roomCode, title, url)
          setSelectedArticle({ title, url })
        }}
      />
    )
  }

  if (phase === 'role-reveal') {
    const interrogatorPlayer = playerList.find(p => p.role === 'interrogator')
    const isInterrogator = interrogatorPlayer?.id === playerId

    return (
      <RoleRevealScreen
        myPlayer={myPlayer}
        selectedArticleTitle={room.selectedArticleTitle}
        isHost={isHost}
        onContinue={() => gameState.advancePhase(roomCode, 'interrogation-1')}
      />
    )
  }

  if (phase === 'interrogation-1' || phase === 'interrogation-2') {
    const isInterrogator = myPlayer.role === 'interrogator'
    const nextPhase = phase === 'interrogation-1' ? 'interrogation-2' : 'guessing'

    return (
      <InterrogationScreen
        phase={phase}
        myPlayer={myPlayer}
        selectedArticleTitle={room.selectedArticleTitle}
        timerOn={room.settings.timerOn}
        isInterrogator={isInterrogator}
        onDone={() => gameState.advancePhase(roomCode, nextPhase)}
      />
    )
  }

  if (phase === 'guessing') {
    const isInterrogator = myPlayer.role === 'interrogator'
    const professors = playerList.filter(p => p.role !== 'interrogator')

    return (
      <GuessScreen
        isInterrogator={isInterrogator}
        professors={professors}
        onGuess={(guessedId) => gameState.submitGuess(roomCode, guessedId)}
      />
    )
  }

  if (phase === 'results') {
    return (
      <ResultsScreen
        myPlayer={myPlayer}
        guess={room.guess}
        players={playerList}
        isHost={isHost}
        onEndRound={() => {
          gameState.endRound(roomCode).then(result => {
            if (result === 'home') {
              clearSession()
              setScreen('home')
            } else {
              setSelectedArticle(null)
            }
          })
        }}
      />
    )
  }

  // Fallback
  return null

  // --- HANDLERS ---

  async function handleCreateRoom(name, settings) {
    setPlayerName(name)
    try {
      const code = await gameState.createRoom(name, settings)
      setRoomCode(code)
      setScreen('lobby')
    } catch (err) {
      console.error('Failed to create room:', err)
    }
  }

  async function handleJoinRoom(code) {
    setJoinError(null)
    try {
      await gameState.joinRoom(code, playerName)
      setRoomCode(code)
    } catch (err) {
      setJoinError(err.message)
    }
  }

  async function handleRejoin() {
    const storedCode = sessionStorage.getItem('dp_roomCode')
    if (!storedCode) return

    try {
      await gameState.rejoinRoom(storedCode)
      setRoomCode(storedCode)
    } catch (err) {
      sessionStorage.removeItem('dp_roomCode')
      setJoinError(err.message)
    }
  }
}
