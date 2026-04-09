import { useState, useEffect, useRef } from 'react'
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
import Layout from './components/Layout'

export default function App() {
  const { playerId, playerName, setPlayerName, roomCode, setRoomCode, clearSession } = usePlayer()
  const gameState = useGameState(playerId, roomCode)

  const [screen, setScreen] = useState('home')
  const [pendingSettings, setPendingSettings] = useState(null)
  const [joinError, setJoinError] = useState(null)
  const [selectedArticle, setSelectedArticle] = useState(null)
  const [pendingRoomCode, setPendingRoomCode] = useState(null)
  const [existingNames, setExistingNames] = useState([])
  const [cachedArticles, setCachedArticles] = useState([])

  const { room, loading, myPlayer, isHost, isInterrogator, playerList, connectedPlayers } = gameState
  const advancingRef = useRef(false)

  // If room disappears (destroyed/ended), go home — but only after we've actually loaded once
  useEffect(() => {
    if (roomCode && !room && !loading && gameState.hasLoaded) {
      sessionStorage.removeItem('dp_rejoinCode')
      sessionStorage.removeItem('dp_rejoinTime')
      clearSession()
      setScreen('home')
    }
  }, [room, roomCode, loading])

  // Check if there's a rejoinable room (within 3 minutes)
  const rejoinCode = sessionStorage.getItem('dp_rejoinCode')
  const rejoinTime = parseInt(sessionStorage.getItem('dp_rejoinTime') || '0', 10)
  const canRejoin = Boolean(rejoinCode) && (Date.now() - rejoinTime < 3 * 60 * 1000)

  // --- PRE-GAME SCREENS ---

  if (!roomCode || (!room && !loading)) {
    if (screen === 'howToPlay') {
      return <HowToPlayScreen onBack={() => setScreen('home')} />
    }

    if (screen === 'settings') {
      return (
        <SettingsScreen
          onStart={(settings) => {
            setPendingSettings(settings)
            if (settings.randomRoles && playerName) {
              handleCreateRoom(playerName, settings)
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

    // Join flow: code first
    if (screen === 'enterCode') {
      return (
        <EnterCodeScreen
          onJoin={async (code) => {
            // Validate room exists before moving to name screen
            try {
              const names = await gameState.getExistingNames(code)
              setExistingNames(names)
              setPendingRoomCode(code)
              setJoinError(null)
              setScreen('enterName-join')
            } catch (err) {
              setJoinError('Room not found')
            }
          }}
          onCancel={() => { setScreen('home'); setJoinError(null) }}
          error={joinError}
        />
      )
    }

    // Join flow: then name
    if (screen === 'enterName-join') {
      return (
        <EnterNameScreen
          onSubmit={(name) => handleJoinRoom(pendingRoomCode, name)}
          onCancel={() => { setScreen('enterCode'); setJoinError(null) }}
          existingNames={existingNames}
          error={joinError}
        />
      )
    }

    return (
      <HomeScreen
        onStartGame={() => setScreen('settings')}
        onJoinGame={() => setScreen('enterCode')}
        onHowToPlay={() => setScreen('howToPlay')}
        canRejoin={canRejoin}
        onRejoin={handleRejoin}
      />
    )
  }

  // Loading state while Firebase subscription connects
  if (loading && !room) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[#666] text-sm animate-fade-in">Connecting...</p>
        </div>
      </Layout>
    )
  }

  // --- IN-GAME SCREENS ---

  // Guard: if player data hasn't loaded yet, wait
  if (!myPlayer) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[#666] text-sm animate-fade-in">Loading...</p>
        </div>
      </Layout>
    )
  }

  const phase = room.phase

  if (phase === 'lobby') {
    // Clear stale state from previous round
    if (selectedArticle) setSelectedArticle(null)
    if (cachedArticles.length > 0) setCachedArticles([])

    return (
      <LobbyScreen
        roomCode={roomCode}
        players={connectedPlayers}
        isHost={isHost}
        onBeginGame={() => gameState.beginGame(roomCode, room.settings.randomRoles)}
      />
    )
  }

  if (phase === 'article-selection') {
    // Check if all professors ready BEFORE any early returns —
    // host might be a professor in random roles mode
    const professors = playerList.filter(p => p.role !== 'interrogator')
    const allReady = professors.length > 0 && professors.every(p => p.isReady)

    if (allReady && isInterrogator && !advancingRef.current) {
      advancingRef.current = true
      gameState.startRoleReveal(roomCode).finally(() => {
        advancingRef.current = false
      })
    }

    // Reading an article (before or after ready)
    if (selectedArticle && !isInterrogator) {
      return (
        <ArticleReadScreen
          title={selectedArticle.title}
          url={selectedArticle.url}
          onBack={() => setSelectedArticle(null)}
          onReady={myPlayer.isReady ? null : () => gameState.setReady(roomCode)}
        />
      )
    }

    // Already ready — show waiting view (same as interrogator view)
    if ((myPlayer.isReady && !isInterrogator) || isInterrogator) {
      return (
        <ArticleSelectScreen
          isInterrogator={true}
          players={playerList}
          myArticle={!isInterrogator ? { title: myPlayer.articleTitle, url: myPlayer.articleUrl } : null}
          onViewArticle={(article) => setSelectedArticle(article)}
        />
      )
    }

    return (
      <ArticleSelectScreen
        isInterrogator={false}
        players={playerList}
        cachedArticles={cachedArticles}
        onCacheArticles={setCachedArticles}
        onSelect={(title, url) => {
          gameState.selectArticle(roomCode, title, url)
          setSelectedArticle({ title, url })
        }}
      />
    )
  }

  if (phase === 'role-reveal') {
    return (
      <RoleRevealScreen
        myPlayer={myPlayer}
        selectedArticleTitle={room.selectedArticleTitle}
        isInterrogator={isInterrogator}
        onContinue={() => gameState.advancePhase(roomCode, 'interrogation-1')}
      />
    )
  }

  if (phase === 'interrogation-1' || phase === 'interrogation-2') {
    const nextPhase = phase === 'interrogation-1' ? 'interrogation-2' : 'guessing'

    return (
      <InterrogationScreen
        phase={phase}
        myPlayer={myPlayer}
        selectedArticleTitle={room.selectedArticleTitle}
        isInterrogator={isInterrogator}
        onDone={() => gameState.advancePhase(roomCode, nextPhase)}
      />
    )
  }

  if (phase === 'guessing') {
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
        isInterrogator={isInterrogator}
        onEndRound={() => {
          gameState.endRound(roomCode).then(result => {
            if (result === 'home') {
              sessionStorage.removeItem('dp_rejoinCode')
              clearSession()
              setScreen('home')
            } else {
              setSelectedArticle(null)
              setCachedArticles([])
            }
          })
        }}
      />
    )
  }

  return null

  // --- HANDLERS ---

  async function handleCreateRoom(name, settings) {
    setPlayerName(name)
    try {
      const code = await gameState.createRoom(name, settings)
      sessionStorage.setItem('dp_rejoinCode', code)
      sessionStorage.setItem('dp_rejoinTime', Date.now().toString())
      setRoomCode(code)
    } catch (err) {
      console.error('Failed to create room:', err)
    }
  }

  async function handleJoinRoom(code, name) {
    setJoinError(null)
    try {
      await gameState.joinRoom(code, name)
      setPlayerName(name)
      sessionStorage.setItem('dp_rejoinCode', code)
      sessionStorage.setItem('dp_rejoinTime', Date.now().toString())
      setRoomCode(code)
    } catch (err) {
      setJoinError(err.message)
      // If name error, stay on name screen. If room error, go back to code.
      if (err.message === 'Room not found' || err.message === 'Game already in progress') {
        setScreen('enterCode')
      }
    }
  }

  async function handleRejoin() {
    const storedCode = sessionStorage.getItem('dp_rejoinCode')
    if (!storedCode) return

    try {
      await gameState.rejoinRoom(storedCode)
      setRoomCode(storedCode)
    } catch (err) {
      sessionStorage.removeItem('dp_rejoinCode')
      console.error('Rejoin failed:', err)
    }
  }
}
