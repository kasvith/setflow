import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Phase, Session, Preset, DEFAULT_PHASES, DEFAULT_PRESETS, ExportedTracklist } from '../shared/types'
import {
  getActiveSession,
  setActiveSession,
  getPresets,
  savePreset,
  deletePreset,
  setStorageData,
  getDraftFormState,
  saveDraftFormState,
  clearDraftFormState,
  getSavedJourney,
  saveJourney,
} from '../shared/storage'
import { generateId, timeInputToTimestamp, formatDurationCompact } from '../shared/utils'
import PhaseEditor from './components/PhaseEditor'
import PresetManager from './components/PresetManager'

type Tab = 'session' | 'presets'
type DurationPreset = '2h' | '4h' | '6h' | '8h' | '12h' | 'custom'

// Helper to safely send message to content script (handles "Receiving end does not exist" error)
function sendMessageToContentScript<T>(tabId: number, message: object): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        // Content script not available (e.g., not on YouTube Music)
        resolve(null)
      } else {
        resolve(response as T)
      }
    })
  })
}

export default function App() {
  const [tab, setTab] = useState<Tab>('session')
  const [phases, setPhases] = useState<Phase[]>(DEFAULT_PHASES)
  const [activeSession, setActiveSessionState] = useState<Session | null>(null)
  const [presets, setPresets] = useState<Preset[]>([])
  const [isOnYouTubeMusic, setIsOnYouTubeMusic] = useState<boolean | null>(null)

  // Journey settings state
  const [startTime, setStartTime] = useState<string>('')
  const [sunriseTime, setSunriseTime] = useState<string>('')
  const [sunsetTime, setSunsetTime] = useState<string>('')
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('12h')
  const [journeyName, setJourneyName] = useState<string>('')
  const [currentPlaylistUrl, setCurrentPlaylistUrl] = useState<string | null>(null)
  const isInitialLoad = useRef(true)

  // Handle playlist URL changes
  const handlePlaylistUrlChange = useCallback(async (newUrl: string | null) => {
    if (newUrl === currentPlaylistUrl) return
    setCurrentPlaylistUrl(newUrl)

    // Don't change anything if there's an active session
    if (activeSession) return

    if (newUrl) {
      // Check for saved journey for this URL
      const savedJourney = await getSavedJourney(newUrl)
      if (savedJourney) {
        setJourneyName(savedJourney.name)
        setPhases(savedJourney.phases.map(p => ({ ...p, id: generateId() })))
        if (savedJourney.startTime) setStartTime(savedJourney.startTime)
        if (savedJourney.sunriseTime) setSunriseTime(savedJourney.sunriseTime)
        if (savedJourney.sunsetTime) setSunsetTime(savedJourney.sunsetTime)
        return
      }
    }

    // No saved journey - reset to defaults
    setJourneyName('')
    setPhases(DEFAULT_PHASES.map(p => ({ ...p, id: generateId() })))
    setStartTime('')
    setSunriseTime('')
    setSunsetTime('')
  }, [currentPlaylistUrl, activeSession])

  useEffect(() => {
    // Load initial data from storage
    async function loadData() {
      const [session, loadedPresets, draft] = await Promise.all([
        getActiveSession(),
        getPresets(),
        getDraftFormState(),
      ])
      setActiveSessionState(session)
      setPresets(loadedPresets)

      // Check if we're on YouTube Music
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
      const currentUrl = tabs[0]?.url || ''
      const onYTMusic = currentUrl.startsWith('https://music.youtube.com/')
      setIsOnYouTubeMusic(onYTMusic)

      if (!onYTMusic) {
        isInitialLoad.current = false
        return
      }

      // Try to get playlist URL from content script
      if (tabs[0]?.id) {
        const response = await sendMessageToContentScript<{ url: string | null }>(
          tabs[0].id,
          { type: 'GET_PLAYLIST_URL' }
        )
        if (response?.url) {
          setCurrentPlaylistUrl(response.url)
          // Check for saved journey
          const savedJourney = await getSavedJourney(response.url)
          if (savedJourney && !session) {
            setJourneyName(savedJourney.name)
            setPhases(savedJourney.phases.map(p => ({ ...p, id: generateId() })))
            if (savedJourney.startTime) setStartTime(savedJourney.startTime)
            if (savedJourney.sunriseTime) setSunriseTime(savedJourney.sunriseTime)
            if (savedJourney.sunsetTime) setSunsetTime(savedJourney.sunsetTime)
            if (savedJourney.durationPreset) setDurationPreset(savedJourney.durationPreset as DurationPreset)
            isInitialLoad.current = false
            return
          }
        }
      }

      if (session) {
        setPhases(session.phases)
        if (session.journeyName) setJourneyName(session.journeyName)
      } else if (draft) {
        // Restore draft state if no active session
        setStartTime(draft.startTime || '')
        setSunriseTime(draft.sunriseTime || '')
        setSunsetTime(draft.sunsetTime || '')
        setDurationPreset((draft.durationPreset as DurationPreset) || '12h')
        setPhases(draft.phases?.length > 0 ? draft.phases : DEFAULT_PHASES)
        setJourneyName(draft.journeyName || '')
      }

      isInitialLoad.current = false
    }

    loadData()

    // Listen for URL changes from content script
    const handleMessage = (message: { type: string; url: string | null }) => {
      if (message.type === 'URL_CHANGED') {
        handlePlaylistUrlChange(message.url)
      }
    }
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [handlePlaylistUrlChange])

  // Auto-save draft on form changes (debounced)
  useEffect(() => {
    if (isInitialLoad.current) return
    if (activeSession) return // Don't save draft during active session

    const timeoutId = setTimeout(() => {
      saveDraftFormState({
        startTime,
        sunriseTime,
        sunsetTime,
        durationPreset,
        phases,
        journeyName,
        lastUpdated: Date.now(),
      })
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [startTime, sunriseTime, sunsetTime, durationPreset, phases, journeyName, activeSession])

  async function handleStartPlanning() {
    // Calculate start timestamp from time input or use now
    let startTimestamp: number
    if (startTime) {
      const [hours, minutes] = startTime.split(':').map(Number)
      const now = new Date()
      now.setHours(hours, minutes, 0, 0)
      // If the time is in the past, assume it's for today still (user just started)
      startTimestamp = now.getTime()
    } else {
      startTimestamp = Date.now()
    }

    // Calculate celestial timestamps if times are set
    const sunriseTimestamp = sunriseTime
      ? timeInputToTimestamp(sunriseTime, startTimestamp)
      : undefined
    const sunsetTimestamp = sunsetTime
      ? timeInputToTimestamp(sunsetTime, startTimestamp)
      : undefined

    const session: Session = {
      startTime: startTimestamp,
      phases: phases.map((p) => ({ ...p })),
      sunriseTime: sunriseTime || undefined,
      sunsetTime: sunsetTime || undefined,
      sunriseTimestamp,
      sunsetTimestamp,
      journeyName: journeyName || undefined,
      playlistUrl: currentPlaylistUrl || undefined,
    }

    // Clear draft and save session
    await clearDraftFormState()
    await setActiveSession(session)
    setActiveSessionState(session)

    // Notify content script directly (fallback for storage listener)
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) {
      await sendMessageToContentScript(tabs[0].id, { type: 'SESSION_STARTED', session })
    }

    // Save journey if we have a playlist URL and name
    if (currentPlaylistUrl && journeyName) {
      await saveJourney({
        name: journeyName,
        playlistUrl: currentPlaylistUrl,
        phases: phases.map((p) => ({ ...p })),
        startTime: startTime || undefined,
        sunriseTime: sunriseTime || undefined,
        sunsetTime: sunsetTime || undefined,
        durationPreset,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      })
    }
  }

  async function handleEndSession() {
    await setActiveSession(null)
    setActiveSessionState(null)

    // Notify content script directly
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) {
      await sendMessageToContentScript(tabs[0].id, { type: 'SESSION_ENDED' })
    }
  }

  function handleAddPhase() {
    const newPhase: Phase = {
      id: generateId(),
      name: 'New Phase',
      duration: 60,
      color: '#9C27B0',
    }
    setPhases([...phases, newPhase])
  }

  function handleUpdatePhase(id: string, updates: Partial<Phase>) {
    setPhases(phases.map((p) => (p.id === id ? { ...p, ...updates } : p)))
  }

  function handleDeletePhase(id: string) {
    setPhases(phases.filter((p) => p.id !== id))
  }

  function handleClearPhases() {
    setPhases([])
    setDurationPreset('custom')
  }


  function handleReorderPhases(newPhases: Phase[]) {
    setPhases(newPhases)
  }

  async function handleSavePreset(name: string) {
    const preset: Preset = { name, phases: phases.map((p) => ({ ...p })) }
    await savePreset(preset)
    setPresets(await getPresets())
  }

  function handleLoadPreset(preset: Preset) {
    setPhases(preset.phases.map((p) => ({ ...p, id: generateId() })))
    setTab('session')
  }

  async function handleDeletePreset(name: string) {
    await deletePreset(name)
    setPresets(await getPresets())
  }

  async function handleRestoreDefaults() {
    await setStorageData({ presets: DEFAULT_PRESETS })
    setPresets(DEFAULT_PRESETS)
  }

  const totalDuration = phases.reduce((sum, p) => sum + p.duration, 0)

  async function handleExportTracklist() {
    if (!activeSession) return

    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tabs[0]?.id) {
      alert('Please open YouTube Music to export the tracklist')
      return
    }

    const response = await sendMessageToContentScript<{ tracks: ExportedTracklist['tracks']; playlistTitle: string }>(
      tabs[0].id,
      { type: 'EXPORT_TRACKLIST' }
    )

    if (!response) {
      alert('Could not connect to YouTube Music. Please refresh the page and try again.')
      return
    }
    if (!response.tracks || response.tracks.length === 0) {
      alert('No tracks found. Make sure the playlist tracks are visible on the page.')
      return
    }

    const exportData: ExportedTracklist = {
      journeyName: activeSession.journeyName || 'Unnamed Journey',
      playlistUrl: currentPlaylistUrl || '',
      playlistTitle: response.playlistTitle || 'Unknown Playlist',
      exportedAt: new Date().toISOString(),
      session: {
        startTime: formatTime(new Date(activeSession.startTime)),
        phases: activeSession.phases,
        sunriseTime: activeSession.sunriseTime,
        sunsetTime: activeSession.sunsetTime,
      },
      tracks: response.tracks || [],
      totalDuration: formatDurationCompact((response.tracks || []).reduce((sum, t) => sum + t.durationMinutes, 0)),
      totalTracks: (response.tracks || []).length,
    }

    // Download JSON
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `setflow-${(activeSession.journeyName || 'journey').replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  const phaseTimeRanges = useMemo(() => {
    if (!activeSession) return []
    const sessionStartTime = activeSession.startTime
    let accumulatedMinutes = 0
    return phases.map((phase) => {
      const phaseStart = new Date(sessionStartTime + accumulatedMinutes * 60 * 1000)
      accumulatedMinutes += phase.duration
      const phaseEnd = new Date(sessionStartTime + accumulatedMinutes * 60 * 1000)
      return {
        phase,
        startTime: phaseStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        endTime: phaseEnd.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      }
    })
  }, [activeSession, phases])

  if (isOnYouTubeMusic === false) {
    return (
      <div className="app">
        <header className="header">
          <h1>Setflow</h1>
        </header>
        <div className="disabled-state">
          <p>Open a YouTube Music playlist to use Setflow</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Setflow</h1>
      </header>

      <div className="tabs">
        <button
          className={`tab ${tab === 'session' ? 'active' : ''}`}
          onClick={() => setTab('session')}
        >
          Session
        </button>
        <button
          className={`tab ${tab === 'presets' ? 'active' : ''}`}
          onClick={() => setTab('presets')}
        >
          Presets
        </button>
      </div>

      {tab === 'session' && (
        <>
          {activeSession && (
            <div className="active-badge">
              <span className="pulse-dot"></span>
              {activeSession.journeyName || 'Journey Active'}
            </div>
          )}

          {activeSession?.playlistUrl && currentPlaylistUrl && activeSession.playlistUrl !== currentPlaylistUrl && (
            <div className="url-mismatch-warning">
              You&apos;ve navigated away from the session&apos;s playlist
            </div>
          )}

          {activeSession && (
            <div className="phase-schedule">
              <div className="phase-schedule-item">
                <span className="phase-schedule-dot" style={{ background: '#666' }}></span>
                <span className="phase-schedule-name">Started</span>
                <span className="phase-schedule-time">
                  {formatTime(new Date(activeSession.startTime))}
                </span>
              </div>

              {phaseTimeRanges.map(({ phase, startTime, endTime }) => (
                <div key={phase.id} className="phase-schedule-item">
                  <span
                    className="phase-schedule-dot"
                    style={{ background: phase.color }}
                  ></span>
                  <span className="phase-schedule-name">{phase.name}</span>
                  <span className="phase-schedule-time">
                    {startTime} – {endTime}
                  </span>
                </div>
              ))}

              {activeSession.sunriseTime && (
                <div className="phase-schedule-item">
                  <span className="phase-schedule-dot" style={{ background: '#FFB74D' }}></span>
                  <span className="phase-schedule-name">Sunrise</span>
                  <span className="phase-schedule-time">{activeSession.sunriseTime}</span>
                </div>
              )}
              {activeSession.sunsetTime && (
                <div className="phase-schedule-item">
                  <span className="phase-schedule-dot" style={{ background: '#5C6BC0' }}></span>
                  <span className="phase-schedule-name">Sunset</span>
                  <span className="phase-schedule-time">{activeSession.sunsetTime}</span>
                </div>
              )}
            </div>
          )}

          {!activeSession && (
            <>
              <div className="section">
                <div className="setting-group full-width">
                  <span className="section-title">Journey Name</span>
                  <input
                    type="text"
                    className="text-input"
                    value={journeyName}
                    onChange={(e) => setJourneyName(e.target.value)}
                    placeholder="My Sunrise Set"
                  />
                  {currentPlaylistUrl && (
                    <span className="input-hint">Linked to current playlist</span>
                  )}
                </div>
              </div>

              <div className="section">
                <div className="settings-row">
                  <div className="setting-group">
                    <span className="section-title">Start Time</span>
                    <input
                      type="time"
                      className="time-input"
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      placeholder="Now"
                    />
                  </div>
                  <div className="setting-group">
                    <span className="section-title">Duration</span>
                    <div className="duration-display">
                      <span className="duration-value">{formatDurationCompact(totalDuration)}</span>
                      <span className="duration-hint">Edit phases below</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="section">
                <div className="settings-row">
                  <div className="setting-group">
                    <span className="section-title">☀️ Sunrise</span>
                    <input
                      type="time"
                      className="time-input"
                      value={sunriseTime}
                      onChange={(e) => setSunriseTime(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="setting-group">
                    <span className="section-title">🌙 Sunset</span>
                    <input
                      type="time"
                      className="time-input"
                      value={sunsetTime}
                      onChange={(e) => setSunsetTime(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          <div className="section">
            <div className="section-header">
              <span className="section-title">Phases</span>
              <div className="section-header-right">
                {phases.length > 0 && !activeSession && (
                  <button className="clear-btn" onClick={handleClearPhases}>
                    Clear
                  </button>
                )}
                {phases.length > 0 && (
                  <span className="total-duration">
                    {formatDurationCompact(totalDuration)}
                  </span>
                )}
              </div>
            </div>
            <PhaseEditor
              phases={phases}
              disabled={!!activeSession}
              startTime={startTime}
              onAdd={handleAddPhase}
              onUpdate={handleUpdatePhase}
              onDelete={handleDeletePhase}
              onReorder={handleReorderPhases}
            />
          </div>

          {activeSession ? (
            <div className="button-row">
              <button className="btn btn-secondary" onClick={handleExportTracklist}>
                Export JSON
              </button>
              <button className="btn btn-danger" onClick={handleEndSession}>
                End Planning
              </button>
            </div>
          ) : (
            <button className="btn btn-primary" onClick={handleStartPlanning}>
              Start Planning
            </button>
          )}

          <p className="hint">
            {activeSession
              ? 'Phases are now highlighted on YouTube Music playlists'
              : 'Configure phases above, then start to highlight tracks on YouTube Music'
            }
          </p>
        </>
      )}

      {tab === 'presets' && (
        <PresetManager
          presets={presets}
          currentPhases={phases}
          onLoad={handleLoadPreset}
          onSave={handleSavePreset}
          onDelete={handleDeletePreset}
          onRestoreDefaults={handleRestoreDefaults}
        />
      )}
    </div>
  )
}
