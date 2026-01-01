import { useState, useEffect } from 'react'
import { Phase, Session, Preset, DEFAULT_PHASES, DEFAULT_PRESETS } from '../shared/types'
import {
  getActiveSession,
  setActiveSession,
  getPresets,
  savePreset,
  deletePreset,
  setStorageData,
} from '../shared/storage'
import { generateId, timeInputToTimestamp, formatDurationCompact } from '../shared/utils'
import PhaseEditor from './components/PhaseEditor'
import PresetManager from './components/PresetManager'

type Tab = 'session' | 'presets'
type DurationPreset = '8h' | '12h' | 'custom'

export default function App() {
  const [tab, setTab] = useState<Tab>('session')
  const [phases, setPhases] = useState<Phase[]>(DEFAULT_PHASES)
  const [activeSession, setActiveSessionState] = useState<Session | null>(null)
  const [presets, setPresets] = useState<Preset[]>([])

  // Journey settings state
  const [startTime, setStartTime] = useState<string>('')
  const [sunriseTime, setSunriseTime] = useState<string>('')
  const [sunsetTime, setSunsetTime] = useState<string>('')
  const [durationPreset, setDurationPreset] = useState<DurationPreset>('12h')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    const [session, loadedPresets] = await Promise.all([
      getActiveSession(),
      getPresets(),
    ])
    setActiveSessionState(session)
    setPresets(loadedPresets)
    if (session) {
      setPhases(session.phases)
    }
  }

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
    }
    await setActiveSession(session)
    setActiveSessionState(session)
  }

  async function handleEndSession() {
    await setActiveSession(null)
    setActiveSessionState(null)
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

  function handleDurationPreset(preset: DurationPreset) {
    setDurationPreset(preset)
    if (preset === '12h') {
      const preset12h = DEFAULT_PRESETS.find(p => p.name === 'Standard 12hr')
      if (preset12h) {
        setPhases(preset12h.phases.map(p => ({ ...p, id: generateId() })))
      }
    } else if (preset === '8h') {
      const preset8h = DEFAULT_PRESETS.find(p => p.name === 'Short 8hr')
      if (preset8h) {
        setPhases(preset8h.phases.map(p => ({ ...p, id: generateId() })))
      }
    }
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

  function formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }

  function getPhaseTimeRanges() {
    if (!activeSession) return []
    const startTime = activeSession.startTime
    let accumulatedMinutes = 0
    return phases.map((phase) => {
      const phaseStart = new Date(startTime + accumulatedMinutes * 60 * 1000)
      accumulatedMinutes += phase.duration
      const phaseEnd = new Date(startTime + accumulatedMinutes * 60 * 1000)
      return {
        phase,
        startTime: formatTime(phaseStart),
        endTime: formatTime(phaseEnd),
      }
    })
  }

  const phaseTimeRanges = getPhaseTimeRanges()

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
              Journey Active
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
                    <div className="duration-preset-selector">
                      <button
                        className={`preset-btn ${durationPreset === '8h' ? 'active' : ''}`}
                        onClick={() => handleDurationPreset('8h')}
                      >
                        8h
                      </button>
                      <button
                        className={`preset-btn ${durationPreset === '12h' ? 'active' : ''}`}
                        onClick={() => handleDurationPreset('12h')}
                      >
                        12h
                      </button>
                      <button
                        className={`preset-btn ${durationPreset === 'custom' ? 'active' : ''}`}
                        onClick={() => handleDurationPreset('custom')}
                      >
                        Custom
                      </button>
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
            <button className="btn btn-danger" onClick={handleEndSession}>
              End Planning
            </button>
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
