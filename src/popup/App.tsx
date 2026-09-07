import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Phase,
  Session,
  Preset,
  SavedJourney,
  DEFAULT_PHASES,
  DEFAULT_PRESETS,
  ExportedTracklist,
} from '../shared/types'
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
  deleteJourney,
  listJourneys,
} from '../shared/storage'
import {
  generateId,
  timeInputToTimestamp,
  formatDurationCompact,
  formatClock,
  resolveStartTimestamp,
} from '../shared/utils'
import PhaseEditor from './components/PhaseEditor'
import Library from './components/Library'
import JourneyStrip from './components/JourneyStrip'

type Screen = 'plan' | 'library'

interface PageInfo {
  url: string | null // canonical playlist URL, null off a playlist
  title: string | null
}

// Handles "Receiving end does not exist" when the content script isn't on the page
function sendMessageToContentScript<T>(tabId: number, message: object): Promise<T | null> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      resolve(chrome.runtime.lastError ? null : (response as T))
    })
  })
}

// Ask the content script for the page; if nothing answers, the tab predates this version of the
// extension, so inject the script (activeTab allows it) and ask again once it has loaded
async function getPageInfo(tabId: number): Promise<PageInfo | null> {
  const ask = () => sendMessageToContentScript<PageInfo>(tabId, { type: 'GET_PLAYLIST_URL' })
  const first = await ask()
  if (first) return first
  const { js = [], css = [] } = chrome.runtime.getManifest().content_scripts?.[0] ?? {}
  try {
    if (css.length) await chrome.scripting.insertCSS({ target: { tabId }, files: css })
    await chrome.scripting.executeScript({ target: { tabId }, files: js })
  } catch {
    return null
  }
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise((r) => setTimeout(r, 150))
    const info = await ask()
    if (info) return info
  }
  return null
}

const freshIds = (phases: Phase[]) => phases.map((p) => ({ ...p, id: generateId() }))
const totalMinutes = (phases: Phase[]) => phases.reduce((sum, p) => sum + p.duration, 0)

export default function App() {
  const [screen, setScreen] = useState<Screen>('plan')
  const [phases, setPhases] = useState<Phase[]>(DEFAULT_PHASES)
  const [activeSession, setActiveSessionState] = useState<Session | null>(null)
  const [presets, setPresets] = useState<Preset[]>([])
  const [journeys, setJourneys] = useState<SavedJourney[]>([])
  const [isOnYouTubeMusic, setIsOnYouTubeMusic] = useState<boolean | null>(null)
  const [page, setPage] = useState<PageInfo>({ url: null, title: null })

  const [startTime, setStartTime] = useState('')
  const [sunriseTime, setSunriseTime] = useState('')
  const [sunsetTime, setSunsetTime] = useState('')
  const [journeyName, setJourneyName] = useState('')

  const tabId = useRef<number | undefined>(undefined)
  const isInitialLoad = useRef(true)
  const sessionRef = useRef<Session | null>(null)
  sessionRef.current = activeSession

  // Form for a playlist: its saved journey, else this playlist's draft, else defaults
  const loadForm = useCallback(async (info: PageInfo) => {
    const saved = info.url ? await getSavedJourney(info.url) : null
    if (saved) {
      setJourneyName(saved.name)
      setPhases(freshIds(saved.phases))
      setStartTime(saved.startTime || '')
      setSunriseTime(saved.sunriseTime || '')
      setSunsetTime(saved.sunsetTime || '')
      return
    }
    const draft = await getDraftFormState()
    if (draft && (draft.playlistUrl ?? null) === info.url) {
      setJourneyName(draft.journeyName || info.title || '')
      setPhases(draft.phases?.length > 0 ? draft.phases : freshIds(DEFAULT_PHASES))
      setStartTime(draft.startTime || '')
      setSunriseTime(draft.sunriseTime || '')
      setSunsetTime(draft.sunsetTime || '')
      return
    }
    setJourneyName(info.title || '')
    setPhases(freshIds(DEFAULT_PHASES))
    setStartTime('')
    setSunriseTime('')
    setSunsetTime('')
  }, [])

  useEffect(() => {
    async function loadData() {
      const [session, loadedPresets, loadedJourneys] = await Promise.all([
        getActiveSession(),
        getPresets(),
        listJourneys(),
      ])
      setActiveSessionState(session)
      setPresets(loadedPresets)
      setJourneys(loadedJourneys)

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
      tabId.current = tab?.id
      const onYTMusic = (tab?.url || '').startsWith('https://music.youtube.com/')
      setIsOnYouTubeMusic(onYTMusic)
      if (!onYTMusic) {
        isInitialLoad.current = false
        return
      }

      const info = tab?.id ? await getPageInfo(tab.id) : null
      const current = { url: info?.url ?? null, title: info?.title ?? null }
      setPage(current)

      if (session) {
        setPhases(session.phases)
        setJourneyName(session.journeyName || '')
      } else {
        await loadForm(current)
      }
      isInitialLoad.current = false
    }

    loadData()

    const handleMessage = (message: { type: string; url: string | null; title: string | null }) => {
      if (message.type !== 'URL_CHANGED') return
      const current = { url: message.url, title: message.title }
      setPage(current)
      if (!sessionRef.current) loadForm(current)
    }
    chrome.runtime.onMessage.addListener(handleMessage)
    return () => chrome.runtime.onMessage.removeListener(handleMessage)
  }, [loadForm])

  // Auto-save the draft (debounced), tied to the playlist it was written on
  useEffect(() => {
    if (isInitialLoad.current || activeSession) return
    const id = setTimeout(() => {
      saveDraftFormState({
        startTime,
        sunriseTime,
        sunsetTime,
        phases,
        journeyName,
        playlistUrl: page.url ?? undefined,
        lastUpdated: Date.now(),
      })
    }, 500)
    return () => clearTimeout(id)
  }, [startTime, sunriseTime, sunsetTime, phases, journeyName, page.url, activeSession])

  async function handleStart() {
    let title = page.title
    if (!journeyName.trim() && !title && tabId.current) {
      const info = await sendMessageToContentScript<PageInfo>(tabId.current, { type: 'GET_PLAYLIST_URL' })
      title = info?.title ?? null
    }
    const name = journeyName.trim() || title || 'Journey'
    const start = resolveStartTimestamp(startTime, totalMinutes(phases))
    const session: Session = {
      startTime: start,
      phases: phases.map((p) => ({ ...p })),
      sunriseTime: sunriseTime || undefined,
      sunsetTime: sunsetTime || undefined,
      sunriseTimestamp: sunriseTime ? timeInputToTimestamp(sunriseTime, start) : undefined,
      sunsetTimestamp: sunsetTime ? timeInputToTimestamp(sunsetTime, start) : undefined,
      journeyName: name,
      playlistUrl: page.url || undefined,
    }

    await clearDraftFormState()
    await setActiveSession(session)
    setActiveSessionState(session)
    setJourneyName(name)
    if (tabId.current) {
      await sendMessageToContentScript(tabId.current, { type: 'SESSION_STARTED', session })
    }

    if (page.url) {
      const existing = await getSavedJourney(page.url)
      await saveJourney({
        name,
        playlistUrl: page.url,
        playlistTitle: title || undefined,
        phases: phases.map((p) => ({ ...p })),
        startTime: startTime || undefined,
        sunriseTime: sunriseTime || undefined,
        sunsetTime: sunsetTime || undefined,
        createdAt: existing?.createdAt ?? Date.now(),
        updatedAt: Date.now(),
      })
      setJourneys(await listJourneys())
    }
  }

  async function handleEnd() {
    if (activeSession) {
      const startTimeStr = new Date(activeSession.startTime).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      })
      const draft = {
        startTime: startTimeStr,
        sunriseTime: activeSession.sunriseTime || '',
        sunsetTime: activeSession.sunsetTime || '',
        phases: activeSession.phases,
        journeyName: activeSession.journeyName || '',
        playlistUrl: activeSession.playlistUrl,
        lastUpdated: Date.now(),
      }
      await saveDraftFormState(draft)
      setStartTime(draft.startTime)
      setSunriseTime(draft.sunriseTime)
      setSunsetTime(draft.sunsetTime)
      setPhases(draft.phases)
      setJourneyName(draft.journeyName)
    }
    await setActiveSession(null)
    setActiveSessionState(null)
    if (tabId.current) {
      await sendMessageToContentScript(tabId.current, { type: 'SESSION_ENDED' })
    }
  }

  function openPlaylist(url: string) {
    if (tabId.current) chrome.tabs.update(tabId.current, { url })
  }

  function handleOpenJourney(journey: SavedJourney) {
    // Apply right away; the page navigation catches up on its own
    setPage({ url: journey.playlistUrl, title: journey.playlistTitle || null })
    loadForm({ url: journey.playlistUrl, title: journey.playlistTitle || null })
    openPlaylist(journey.playlistUrl)
    setScreen('plan')
  }

  async function handleDeleteJourney(playlistUrl: string) {
    await deleteJourney(playlistUrl)
    setJourneys(await listJourneys())
  }

  function handleUsePreset(preset: Preset) {
    setPhases(freshIds(preset.phases))
    setScreen('plan')
  }

  async function handleSavePreset(name: string) {
    await savePreset({ name, phases: phases.map((p) => ({ ...p })) })
    setPresets(await getPresets())
  }

  async function handleDeletePreset(name: string) {
    await deletePreset(name)
    setPresets(await getPresets())
  }

  async function handleRestoreDefaults() {
    await setStorageData({ presets: DEFAULT_PRESETS })
    setPresets(DEFAULT_PRESETS)
  }

  async function handleExport() {
    if (!activeSession || !tabId.current) return
    const response = await sendMessageToContentScript<{
      tracks: ExportedTracklist['tracks']
      playlistTitle: string
    }>(tabId.current, { type: 'EXPORT_TRACKLIST' })
    if (!response) {
      alert('Could not reach YouTube Music. Reload the page and try again.')
      return
    }
    if (!response.tracks?.length) {
      alert('No tracks found. Open the playlist so its tracks are visible, then try again.')
      return
    }
    const tracks = response.tracks
    const exportData: ExportedTracklist = {
      journeyName: activeSession.journeyName || 'Journey',
      playlistUrl: page.url || '',
      playlistTitle: response.playlistTitle || 'Unknown Playlist',
      exportedAt: new Date().toISOString(),
      session: {
        startTime: formatClock(activeSession.startTime),
        phases: activeSession.phases,
        sunriseTime: activeSession.sunriseTime,
        sunsetTime: activeSession.sunsetTime,
      },
      tracks,
      totalDuration: formatDurationCompact(tracks.reduce((sum, t) => sum + t.durationMinutes, 0)),
      totalTracks: tracks.length,
    }
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `setflow-${(activeSession.journeyName || 'journey').replace(/[^a-z0-9]/gi, '-')}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  if (isOnYouTubeMusic === false) {
    return (
      <div className="app">
        <header className="topbar">
          <span className="wordmark">Setflow</span>
        </header>
        <p className="disabled-state">Open a YouTube Music playlist to plan a journey.</p>
      </div>
    )
  }

  if (screen === 'library') {
    return (
      <div className="app">
        <header className="topbar">
          <button type="button" className="link" onClick={() => setScreen('plan')}>
            ← Back
          </button>
          <span className="wordmark">Library</span>
        </header>
        <Library
          journeys={journeys}
          presets={presets}
          currentPhases={phases}
          onOpenJourney={handleOpenJourney}
          onDeleteJourney={handleDeleteJourney}
          onUsePreset={handleUsePreset}
          onSavePreset={handleSavePreset}
          onDeletePreset={handleDeletePreset}
          onRestoreDefaults={handleRestoreDefaults}
        />
      </div>
    )
  }

  // Planned or running start, and the celestial moments relative to it
  const start = activeSession
    ? activeSession.startTime
    : resolveStartTimestamp(startTime, totalMinutes(phases))
  const sunrise = activeSession
    ? activeSession.sunriseTimestamp
    : sunriseTime
      ? timeInputToTimestamp(sunriseTime, start)
      : undefined
  const sunset = activeSession
    ? activeSession.sunsetTimestamp
    : sunsetTime
      ? timeInputToTimestamp(sunsetTime, start)
      : undefined

  // The plan can't show a sunrise or sunset that falls outside it; say where it is instead
  const end = start + totalMinutes(activeSession ? activeSession.phases : phases) * 60 * 1000
  const outsideNotes = (
    [
      ['☀ Sunrise', sunrise],
      ['☾ Sunset', sunset],
    ] as [string, number | undefined][]
  )
    .filter(([, t]) => t !== undefined && (t < start || t >= end))
    .map(([label, t]) =>
      t! < start
        ? `${label} ${formatClock(t!)} is ${formatDurationCompact(Math.round((start - t!) / 60000))} before the plan starts`
        : `${label} ${formatClock(t!)} is ${formatDurationCompact(Math.round((t! - end) / 60000))} after it ends`
    )
  const notes = outsideNotes.map((text) => (
    <p key={text} className="strip-note">
      {text}
    </p>
  ))
  const awayFromPlaylist = !!activeSession?.playlistUrl && activeSession.playlistUrl !== page.url

  return (
    <div className="app">
      <header className="topbar">
        <span className="wordmark">Setflow</span>
        <button type="button" className="link" onClick={() => setScreen('library')}>
          Library
        </button>
      </header>

      {activeSession ? (
        <>
          <div className="journey-head">
            <h2 className="journey-title">{activeSession.journeyName || 'Journey'}</h2>
          </div>
          {awayFromPlaylist ? (
            <div className="notice">
              <span>{page.url ? "This isn't the journey's playlist." : 'The journey\'s playlist is elsewhere.'}</span>
              <button
                type="button"
                className="link"
                onClick={() => openPlaylist(activeSession.playlistUrl!)}
              >
                Open it
              </button>
            </div>
          ) : (
            <p className="subline">Planning this playlist. Its tracks are marked by phase.</p>
          )}
          <JourneyStrip phases={activeSession.phases} start={start} sunrise={sunrise} sunset={sunset} />
          {notes}
          <PhaseEditor
            phases={activeSession.phases}
            disabled
            start={start}
            sunrise={sunrise}
            sunset={sunset}
            onAdd={() => {}}
            onUpdate={() => {}}
            onDelete={() => {}}
            onUsePreset={() => {}}
          />
          <div className="actions">
            <button type="button" className="btn btn-secondary" onClick={handleExport}>
              Export JSON
            </button>
            <button type="button" className="btn btn-primary" onClick={handleEnd}>
              End planning
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="journey-head">
            <input
              type="text"
              className="name-input"
              value={journeyName}
              placeholder="Journey name"
              aria-label="Journey name"
              onChange={(e) => setJourneyName(e.target.value)}
            />
          </div>
          <p className="subline">
            {page.url ? 'Linked to this playlist' : 'Open a playlist to link this journey to it'}
          </p>
          <JourneyStrip phases={phases} start={start} sunrise={sunrise} sunset={sunset} />
          {notes}
          <div className="times">
            <label className="field">
              Start
              <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </label>
            <label className="field">
              ☀ Sunrise
              <input type="time" value={sunriseTime} onChange={(e) => setSunriseTime(e.target.value)} />
            </label>
            <label className="field">
              ☾ Sunset
              <input type="time" value={sunsetTime} onChange={(e) => setSunsetTime(e.target.value)} />
            </label>
          </div>
          <PhaseEditor
            phases={phases}
            disabled={false}
            start={start}
            sunrise={sunrise}
            sunset={sunset}
            onAdd={() =>
              setPhases([...phases, { id: generateId(), name: 'New phase', duration: 60, color: '#9C27B0' }])
            }
            onUpdate={(id, updates) => setPhases(phases.map((p) => (p.id === id ? { ...p, ...updates } : p)))}
            onDelete={(id) => setPhases(phases.filter((p) => p.id !== id))}
            onUsePreset={() => setScreen('library')}
          />
          <button
            type="button"
            className="btn btn-primary"
            disabled={phases.length === 0}
            onClick={handleStart}
          >
            Start planning
          </button>
        </>
      )}
    </div>
  )
}
