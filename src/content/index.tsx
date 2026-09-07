import { getActiveSession, onStorageChange } from '../shared/storage'
import { Session, Phase, ExportedTrack } from '../shared/types'
import { getPhaseAtTime, getPhasesInRange } from '../shared/utils'

let session: Session | null = null
let popover: HTMLElement | null = null
let labelIntervalId: number | null = null
let debounceTimeout: number | null = null
let hoverFrame = 0
// Per-row hover data; dies with the row instead of round-tripping through JSON attributes
let trackInfos = new WeakMap<Element, TrackInfo>()

// Check if extension context is still valid (not invalidated by reload)
function isExtensionContextValid(): boolean {
  return typeof chrome !== 'undefined' && !!chrome.runtime?.id
}

// Get current playlist URL
function getCurrentPlaylistUrl(): string | null {
  const url = new URL(window.location.href)
  const listId = url.searchParams.get('list')
  if (listId) {
    return `https://music.youtube.com/playlist?list=${listId}`
  }
  return null
}

// Only the playlist the session was started on gets labelled (sessions without a URL label any)
function isTracking(): boolean {
  return !!session && (!session.playlistUrl || session.playlistUrl === getCurrentPlaylistUrl())
}

function getPlaylistTitle(): string | null {
  const el = document.querySelector(
    'ytmusic-responsive-header-renderer yt-formatted-string.title, ytmusic-detail-header-renderer yt-formatted-string.title, h2.title'
  )
  return el?.textContent?.trim() || null
}

// Notify popup of URL change
function notifyUrlChange() {
  if (!isExtensionContextValid()) return

  chrome.runtime.sendMessage({
    type: 'URL_CHANGED',
    url: getCurrentPlaylistUrl(),
    title: getPlaylistTitle(),
  }).catch(() => {
    // Popup might not be open or context invalidated, ignore error
  })
}

// YouTube Music is a SPA. Its navigations happen in the page's world, invisible to a content
// script's history monkeypatch, but the browser's Navigation API fires here for every
// pushState/replaceState/back/forward. (Types for it are not in this TS lib yet.)
const navigation = (window as Window & { navigation?: EventTarget }).navigation
navigation?.addEventListener('currententrychange', () => {
  sync()
  // The new page's header renders after the URL changes; wait for it so the title is fresh
  setTimeout(notifyUrlChange, 1000)
})

// Format time from session start minutes
function formatTimeFromMinutes(session: Session | null, minutes: number): string {
  if (!session) return ''
  const timestamp = session.startTime + minutes * 60 * 1000
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// Extract track data for export
function extractTrackData(): ExportedTrack[] {
  if (!session) return []

  // Try multiple selectors for different YouTube Music page layouts
  let trackItems = document.querySelectorAll('#contents > ytmusic-playlist-shelf-renderer ytmusic-responsive-list-item-renderer')

  if (trackItems.length === 0) {
    // Try alternative selector for playlist detail pages
    trackItems = document.querySelectorAll('ytmusic-playlist-shelf-renderer ytmusic-responsive-list-item-renderer')
  }

  if (trackItems.length === 0) {
    // Try selector for general list items
    trackItems = document.querySelectorAll('ytmusic-responsive-list-item-renderer')
  }

  if (trackItems.length === 0) return []
  const tracks: ExportedTrack[] = []
  let accumulatedMinutes = 0

  trackItems.forEach((item, index) => {
    // Extract title
    const titleEl = item.querySelector('yt-formatted-string.title') as HTMLElement | null
    const name = titleEl?.textContent?.trim() || 'Unknown Track'

    // Extract artist(s)
    const artistEl = item.querySelector('.secondary-flex-columns yt-formatted-string') as HTMLElement | null
    const artist = artistEl?.textContent?.trim() || 'Unknown Artist'

    // Extract duration
    let durationText = ''
    const durationEl = item.querySelector('.fixed-columns > yt-formatted-string')
    if (durationEl) {
      durationText = durationEl.textContent?.trim() || ''
    }
    if (!durationText || !durationText.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
      const allFormattedStrings = item.querySelectorAll('yt-formatted-string')
      for (const el of allFormattedStrings) {
        const text = el.textContent?.trim() || ''
        if (text.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
          durationText = text
          break
        }
      }
    }
    if (!durationText) durationText = '4:00'

    const durationMinutes = parseDurationToMinutes(durationText)

    // Extract YouTube URL
    const linkEl = item.querySelector('a[href*="watch"]') as HTMLAnchorElement | null
    const youtubeUrl = linkEl?.href || null

    // Calculate phase
    const phase = getPhaseAtTime(session!, accumulatedMinutes)

    const trackStart = accumulatedMinutes
    const trackEnd = accumulatedMinutes + durationMinutes

    tracks.push({
      index: index + 1,
      name,
      artist,
      duration: durationText,
      durationMinutes,
      journeyStartTime: formatTimeFromMinutes(session, trackStart),
      journeyEndTime: formatTimeFromMinutes(session, trackEnd),
      journeyStartMinutes: trackStart,
      journeyEndMinutes: trackEnd,
      phase: phase ? { name: phase.name, color: phase.color } : null,
      youtubeUrl,
    })

    accumulatedMinutes += durationMinutes
  })

  return tracks
}

// Message handler for popup communication
if (isExtensionContextValid()) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!isExtensionContextValid()) return false

    if (message.type === 'GET_PLAYLIST_URL') {
      sendResponse({ url: getCurrentPlaylistUrl(), title: getPlaylistTitle() })
      return true
    }
    if (message.type === 'EXPORT_TRACKLIST') {
      const tracks = extractTrackData()
      const playlistTitle = getPlaylistTitle() || 'Unknown Playlist'
      sendResponse({ tracks, playlistTitle })
      return true
    }
    if (message.type === 'SESSION_STARTED' || message.type === 'SESSION_ENDED') {
      // Direct notification from popup (fallback for storage listener)
      session = message.type === 'SESSION_STARTED' ? message.session : null
      sync()
      sendResponse({ success: true })
      return true
    }
    return false
  })
}

interface TrackInfo {
  trackStart: number // minutes from journey start
  trackEnd: number
  trackDuration: number // track duration in minutes
  sunriseMinutes: number | null
  sunsetMinutes: number | null
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.floor(minutes % 60)
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

function formatTimeWithSeconds(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatDurationShort(minutes: number): string {
  if (minutes < 0) {
    // Past event
    const absMin = Math.abs(minutes)
    if (absMin < 1) {
      const seconds = Math.round(absMin * 60)
      return `${seconds}s ago`
    }
    return `${Math.floor(absMin)}m ago`
  }
  if (minutes < 1) {
    const seconds = Math.round(minutes * 60)
    return `${seconds}s`
  }
  const m = Math.floor(minutes)
  const s = Math.round((minutes - m) * 60)
  if (s > 0) return `${m}m ${s}s`
  return `${m}m`
}

function formatTrackPosition(currentSeconds: number, totalSeconds: number): string {
  const formatSec = (sec: number) => {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }
  return `${formatSec(currentSeconds)} / ${formatSec(totalSeconds)}`
}

function getPhaseTimeRange(session: Session, phase: Phase): { start: string; end: string } {
  let accumulatedMinutes = 0
  for (const p of session.phases) {
    if (p.id === phase.id || p.name === phase.name) {
      const startTime = session.startTime + accumulatedMinutes * 60 * 1000
      const endTime = startTime + phase.duration * 60 * 1000
      return { start: formatTime(startTime), end: formatTime(endTime) }
    }
    accumulatedMinutes += p.duration
  }
  return { start: '', end: '' }
}

function createPopover(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'setflow-popover'
  el.style.display = 'none'
  document.body.appendChild(el)
  return el
}

function showPopover(target: HTMLElement, info: TrackInfo, mouseY: number) {
  if (!popover) popover = createPopover()
  if (!session) return

  // Calculate position ratio based on mouseY within target
  const rect = target.getBoundingClientRect()
  const ratio = Math.max(0, Math.min(1, (mouseY - rect.top) / rect.height))

  // Calculate simulated time based on mouse position
  const simulatedMinutes = info.trackStart + (info.trackDuration * ratio)
  const simulatedTimestamp = session.startTime + simulatedMinutes * 60 * 1000

  // Calculate track position in seconds
  const trackPositionSeconds = ratio * info.trackDuration * 60
  const trackTotalSeconds = info.trackDuration * 60

  let html = `<div class="popover-content">`

  // Simulated time header (changes with mouse position)
  const dayDiff = Math.floor((simulatedTimestamp - session.startTime) / (24 * 60 * 60 * 1000))
  let timeDisplay = formatTimeWithSeconds(simulatedTimestamp)
  if (dayDiff > 0) {
    timeDisplay += ` <span class="day-indicator">+${dayDiff}d</span>`
  }
  html += `<div class="popover-time">${timeDisplay}</div>`

  // Phase at the hovered position (a track can straddle two phases)
  const phase = getPhaseAtTime(session, simulatedMinutes)
  if (phase) {
    const timeRange = getPhaseTimeRange(session, phase)
    html += `
      <div class="popover-phase">
        <span class="phase-dot" style="background: ${phase.color}"></span>
        <span class="phase-name">${phase.name}</span>
        <span class="phase-range">${timeRange.start} – ${timeRange.end}</span>
      </div>
    `
  }

  // Track position
  html += `<div class="popover-track-position">${formatTrackPosition(trackPositionSeconds, trackTotalSeconds)}</div>`

  // Celestial events relative to simulated time
  if (info.sunriseMinutes !== null && info.trackStart <= info.sunriseMinutes && info.trackEnd > info.sunriseMinutes) {
    const minutesToSunrise = info.sunriseMinutes - simulatedMinutes
    if (Math.abs(minutesToSunrise) < 0.05) {
      // At sunrise moment (within ~3 seconds)
      html += `<div class="popover-celestial sunrise active">☀️ Sunrise!</div>`
    } else if (minutesToSunrise > 0) {
      html += `<div class="popover-celestial sunrise">☀️ Sunrise in ${formatDurationShort(minutesToSunrise)}</div>`
    } else {
      html += `<div class="popover-celestial sunrise past">☀️ Sunrise was ${formatDurationShort(minutesToSunrise)}</div>`
    }
  }
  if (info.sunsetMinutes !== null && info.trackStart <= info.sunsetMinutes && info.trackEnd > info.sunsetMinutes) {
    const minutesToSunset = info.sunsetMinutes - simulatedMinutes
    if (Math.abs(minutesToSunset) < 0.05) {
      // At sunset moment (within ~3 seconds)
      html += `<div class="popover-celestial sunset active">🌙 Sunset!</div>`
    } else if (minutesToSunset > 0) {
      html += `<div class="popover-celestial sunset">🌙 Sunset in ${formatDurationShort(minutesToSunset)}</div>`
    } else {
      html += `<div class="popover-celestial sunset past">🌙 Sunset was ${formatDurationShort(minutesToSunset)}</div>`
    }
  }

  html += `</div>`
  popover.innerHTML = html

  // Position popover near mouse but stable
  popover.style.display = 'block'
  popover.style.left = `${rect.left + 20}px`
  popover.style.top = `${rect.top - popover.offsetHeight - 8}px`

  // Adjust if off-screen
  const popoverRect = popover.getBoundingClientRect()
  if (popoverRect.top < 10) {
    popover.style.top = `${rect.bottom + 8}px`
  }
  if (popoverRect.right > window.innerWidth - 10) {
    popover.style.left = `${window.innerWidth - popoverRect.width - 10}px`
  }
}

function hidePopover() {
  cancelAnimationFrame(hoverFrame)
  if (popover) {
    popover.style.display = 'none'
  }
}
let observer: MutationObserver | null = null

// Cleanup function to prevent memory leaks
function cleanup() {
  if (labelIntervalId) {
    clearInterval(labelIntervalId)
    labelIntervalId = null
  }
  if (debounceTimeout) {
    clearTimeout(debounceTimeout)
    debounceTimeout = null
  }
  stopObserver()
  removeLabels()
}

// Listen for page unload to cleanup
window.addEventListener('beforeunload', cleanup)

async function init() {
  if (!isExtensionContextValid()) return

  try {
    session = await getActiveSession()
    sync()

    onStorageChange((data) => {
      if (!isExtensionContextValid()) return
      // Every storage write (draft autosave, presets) lands here; only react when the session changed
      if (JSON.stringify(data.activeSession) === JSON.stringify(session)) return
      session = data.activeSession
      sync()
    })

    // Only the phase header is time-based; track labels depend on playlist position alone
    if (labelIntervalId) clearInterval(labelIntervalId)
    labelIntervalId = setInterval(() => {
      if (!isTracking() || !isExtensionContextValid()) return
      addPhaseHeader()
      observer?.takeRecords()
    }, 10000)
  } catch {
    // Extension context may have been invalidated
  }
}

// Reconcile the page with the session: label + observe on the tracked playlist, clear elsewhere
function sync() {
  if (isTracking()) {
    startObserver()
  } else {
    stopObserver()
    removeLabels()
  }
}

let observerRetry: number | null = null

function startObserver() {
  stopObserver()

  // ytmusic-browse-response survives SPA navigation; the playlist shelf inside it is rebuilt
  // on every page change, so observing the shelf itself would go stale after the first navigation
  const container = document.querySelector('ytmusic-browse-response')
  if (!container) {
    observerRetry = setTimeout(startObserver, 1000)
    return
  }

  observer = new MutationObserver(() => {
    if (debounceTimeout) clearTimeout(debounceTimeout)
    debounceTimeout = setTimeout(labelTracks, 100)
  })
  observer.observe(container, { childList: true, subtree: true })
  labelTracks()
}

function stopObserver() {
  if (observerRetry) clearTimeout(observerRetry)
  if (debounceTimeout) clearTimeout(debounceTimeout)
  observerRetry = debounceTimeout = null
  observer?.disconnect()
  observer = null
}

function removeLabels() {
  trackInfos = new WeakMap()
  // Single consolidated query for all setflow elements
  document.querySelectorAll(
    '.setflow-celestial-label, .setflow-celestial-left-indicator, .setflow-phase-header, .setflow-popover, [data-setflow-phase], .setflow-beyond-phase'
  ).forEach((el) => {
    if (el.classList.contains('setflow-celestial-label') ||
        el.classList.contains('setflow-celestial-left-indicator') ||
        el.classList.contains('setflow-phase-header') ||
        el.classList.contains('setflow-popover')) {
      el.remove()
    } else {
      // data-setflow-bound stays: the hover listeners persist and no-op without track info
      const htmlEl = el as HTMLElement
      htmlEl.removeAttribute('data-setflow-phase')
      htmlEl.classList.remove('setflow-beyond-phase')
      htmlEl.style.removeProperty('--setflow-stripe')
      htmlEl.style.background = ''
    }
  })
  popover = null
}

function parseDurationToMinutes(duration: string): number {
  const parts = duration.split(':').map(Number)

  if (parts.length === 3) {
    // H:MM:SS
    return parts[0] * 60 + parts[1] + parts[2] / 60
  } else if (parts.length === 2) {
    // MM:SS or M:SS
    return parts[0] + parts[1] / 60
  }

  return 0
}

function labelTracks() {
  if (!session || !isTracking()) return

  // Calculate celestial moments (minutes from journey start)
  const sunriseMinutes = session.sunriseTimestamp
    ? (session.sunriseTimestamp - session.startTime) / (1000 * 60)
    : null
  const sunsetMinutes = session.sunsetTimestamp
    ? (session.sunsetTimestamp - session.startTime) / (1000 * 60)
    : null

  // Find track items only in the playlist shelf
  const container = document.querySelector('#contents > ytmusic-playlist-shelf-renderer')
  if (!container) return

  const trackItems = container.querySelectorAll('ytmusic-responsive-list-item-renderer')

  if (trackItems.length === 0) return

  // Start from beginning of playlist (0 minutes)
  let accumulatedTime = 0

  trackItems.forEach((item) => {
    // Get track duration from fixed-columns > yt-formatted-string
    let durationText = ''

    // Primary method: Look in fixed-columns for duration
    const durationEl = item.querySelector('.fixed-columns > yt-formatted-string')
    if (durationEl) {
      durationText = durationEl.textContent?.trim() || ''
    }

    // Fallback: search for time pattern in any yt-formatted-string
    if (!durationText || !durationText.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
      const allFormattedStrings = item.querySelectorAll('yt-formatted-string')
      for (const el of allFormattedStrings) {
        const text = el.textContent?.trim() || ''
        if (text.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
          durationText = text
          break
        }
      }
    }

    if (!durationText || !durationText.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
      // Fallback: assume 4 minutes average
      durationText = '4:00'
    }

    const trackDuration = parseDurationToMinutes(durationText)
    const trackStart = accumulatedTime
    const trackEnd = accumulatedTime + trackDuration

    const htmlItem = item as HTMLElement

    trackInfos.set(item, { trackStart, trackEnd, trackDuration, sunriseMinutes, sunsetMinutes })

    // Add popover event listeners (only once per row; the row's info is looked up live)
    if (!htmlItem.hasAttribute('data-setflow-bound')) {
      htmlItem.setAttribute('data-setflow-bound', 'true')
      htmlItem.addEventListener('mousemove', (e) => {
        const info = trackInfos.get(htmlItem)
        if (!info) return
        // One popover render per frame; mousemove fires far more often than the screen repaints
        cancelAnimationFrame(hoverFrame)
        hoverFrame = requestAnimationFrame(() => showPopover(htmlItem, info, e.clientY))
      })
      htmlItem.addEventListener('mouseleave', hidePopover)
    }

    // A track can straddle phases: the left stripe shows every phase it overlaps, split in proportion
    const phases = getPhasesInRange(session!, trackStart, trackEnd)
    if (phases.length > 0) {
      const stops = phases.map(({ phase, from, to }) => `${phase.color} ${from * 100}% ${to * 100}%`)
      htmlItem.style.setProperty('--setflow-stripe', `linear-gradient(to bottom, ${stops.join(', ')})`)
      const tint = phases[0].phase.color
      htmlItem.style.background = `linear-gradient(90deg, ${tint}15 0%, transparent 30%)`
      htmlItem.setAttribute('data-setflow-phase', phases.map((p) => p.phase.name).join(' / '))
      htmlItem.classList.remove('setflow-beyond-phase')
    } else {
      // No phase - show striped border indicator only
      htmlItem.style.removeProperty('--setflow-stripe')
      htmlItem.style.background = ''
      htmlItem.removeAttribute('data-setflow-phase')
      htmlItem.classList.add('setflow-beyond-phase')
    }

    // Check for celestial events on this track
    // First remove any existing celestial label
    removeCelestialLabel(item)

    // Check for sunrise
    if (sunriseMinutes !== null && trackStart <= sunriseMinutes && trackEnd > sunriseMinutes) {
      addCelestialLabel(item, 'sunrise', sunriseMinutes, trackStart, trackDuration)
    }
    // Check for sunset
    else if (sunsetMinutes !== null && trackStart <= sunsetMinutes && trackEnd > sunsetMinutes) {
      addCelestialLabel(item, 'sunset', sunsetMinutes, trackStart, trackDuration)
    }

    accumulatedTime += trackDuration
  })

  // Also add a header showing current phase if we're in an active session
  addPhaseHeader()

  // Drop the mutation records this pass produced so the observer doesn't re-trigger itself
  observer?.takeRecords()
}

function addCelestialLabel(
  item: Element,
  type: 'sunrise' | 'sunset',
  eventMinutes: number,
  trackStart: number,
  trackDuration: number
) {
  // Check if label already exists
  if (item.querySelector('.setflow-celestial-label')) return

  const fixedColumns = item.querySelector('.fixed-columns')
  if (!fixedColumns) return

  const label = document.createElement('div')
  label.className = 'setflow-celestial-label'
  label.setAttribute('data-type', type)

  const icon = type === 'sunrise' ? '☀️' : '🌙'
  const text = type === 'sunrise' ? 'sunrise' : 'sunset'

  label.innerHTML = `<span class="celestial-icon">${icon}</span><span class="celestial-text">${text}</span>`

  // Insert before the duration element
  const durationEl = fixedColumns.querySelector('yt-formatted-string[aria-label*="minute"], yt-formatted-string[title*=":"]')
  if (durationEl) {
    fixedColumns.insertBefore(label, durationEl)
  } else {
    fixedColumns.insertBefore(label, fixedColumns.firstChild)
  }

  // Add left-side indicator at proportional position
  const positionInTrack = (eventMinutes - trackStart) / trackDuration
  const indicator = document.createElement('div')
  indicator.className = 'setflow-celestial-left-indicator'
  indicator.setAttribute('data-type', type)
  indicator.style.top = `${positionInTrack * 100}%`
  indicator.innerHTML = `<span class="celestial-indicator-icon">${icon}</span>`
  item.appendChild(indicator)
}

function removeCelestialLabel(item: Element) {
  const label = item.querySelector('.setflow-celestial-label')
  if (label) {
    label.remove()
  }
  const leftIndicator = item.querySelector('.setflow-celestial-left-indicator')
  if (leftIndicator) {
    leftIndicator.remove()
  }
}

function addPhaseHeader() {
  if (!session) return

  const elapsedMinutes = (Date.now() - session.startTime) / (1000 * 60)
  const currentPhase = getPhaseAtTime(session, elapsedMinutes)

  // Find the playlist header area
  const headerArea = document.querySelector('ytmusic-detail-header-renderer, ytmusic-playlist-shelf-renderer #header')
  if (!headerArea) return

  let phaseHeader = document.querySelector('.setflow-phase-header') as HTMLElement | null

  if (!phaseHeader) {
    phaseHeader = document.createElement('div')
    phaseHeader.className = 'setflow-phase-header'
    headerArea.insertBefore(phaseHeader, headerArea.firstChild)
  }

  if (currentPhase) {
    const timeRange = getPhaseTimeRange(session, currentPhase)
    const remaining = Math.ceil(currentPhase.duration - (elapsedMinutes - getPhaseStartTime(session, currentPhase.name)))

    phaseHeader.style.display = 'block'
    phaseHeader.innerHTML = `
      <div style="
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        margin: 8px 0 16px 0;
        background: ${currentPhase.color}22;
        border-left: 4px solid ${currentPhase.color};
        border-radius: 0 8px 8px 0;
        font-family: 'YouTube Sans', sans-serif;
      ">
        <div style="
          width: 8px;
          height: 8px;
          background: ${currentPhase.color};
          border-radius: 50%;
          animation: pulse 2s infinite;
        "></div>
        <div>
          <div style="font-size: 14px; font-weight: 500; color: ${currentPhase.color};">
            ${currentPhase.name}
          </div>
          <div style="font-size: 12px; color: #aaa;">
            ${timeRange.start} – ${timeRange.end} · ${formatDuration(remaining)} remaining
          </div>
        </div>
      </div>
    `
  } else {
    // Journey complete - hide the header
    phaseHeader.style.display = 'none'
  }
}

function getPhaseStartTime(session: Session, phaseName: string): number {
  let accumulatedTime = 0
  for (const phase of session.phases) {
    if (phase.name === phaseName) {
      return accumulatedTime
    }
    accumulatedTime += phase.duration
  }
  return 0
}

// Add CSS for phase indicators and celestial labels
// Guard against duplicate injection if script re-runs
if (!document.getElementById('setflow-styles')) {
const style = document.createElement('style')
style.id = 'setflow-styles'
style.textContent = `
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  [data-setflow-phase] {
    transition: background 0.3s ease;
  }

  /* Left stripe: phase colour(s) from --setflow-stripe, hatched once the track is past every phase */
  [data-setflow-phase]::before,
  .setflow-beyond-phase::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--setflow-stripe, repeating-linear-gradient(
      -45deg,
      #555,
      #555 2px,
      #333 2px,
      #333 4px
    ));
  }

  .setflow-celestial-label {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 10px;
    margin-right: 12px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .setflow-celestial-label[data-type="sunrise"] {
    background: linear-gradient(135deg, #FFD54F, #FF9800);
    color: #1a1a1a;
    animation: sunrise-glow 2s ease-in-out infinite;
  }

  .setflow-celestial-label[data-type="sunset"] {
    background: linear-gradient(135deg, #5C6BC0, #3949AB);
    color: #fff;
    animation: sunset-glow 2s ease-in-out infinite;
  }

  .celestial-icon {
    font-size: 12px;
  }

  .celestial-text {
    text-transform: lowercase;
  }

  @keyframes sunrise-glow {
    0%, 100% { box-shadow: 0 0 4px rgba(255, 152, 0, 0.4); }
    50% { box-shadow: 0 0 16px rgba(255, 152, 0, 0.7); }
  }

  @keyframes sunset-glow {
    0%, 100% { box-shadow: 0 0 4px rgba(92, 107, 192, 0.4); }
    50% { box-shadow: 0 0 16px rgba(92, 107, 192, 0.7); }
  }

  ytmusic-responsive-list-item-renderer {
    position: relative;
  }

  .setflow-celestial-left-indicator {
    position: absolute;
    left: 0;
    transform: translate(-50%, -50%);
    z-index: 2;
    cursor: pointer;
    padding: 10px;
  }

  .celestial-indicator-icon {
    display: block;
    font-size: 14px;
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.6));
    transition: transform 0.3s ease, filter 0.3s ease;
  }

  .setflow-celestial-left-indicator:hover .celestial-indicator-icon {
    transform: scale(1.4);
  }

  /* Sun: gentle continuous rotation */
  .setflow-celestial-left-indicator[data-type="sunrise"]:hover .celestial-indicator-icon {
    animation: sun-spin 4s linear infinite;
    filter: drop-shadow(0 0 8px rgba(255, 180, 0, 0.9)) drop-shadow(0 0 16px rgba(255, 120, 0, 0.5));
  }

  /* Moon: gentle rocking like tides */
  .setflow-celestial-left-indicator[data-type="sunset"]:hover .celestial-indicator-icon {
    animation: moon-rock 2s ease-in-out infinite;
    filter: drop-shadow(0 0 8px rgba(150, 170, 255, 0.9)) drop-shadow(0 0 16px rgba(100, 120, 200, 0.5));
  }

  @keyframes sun-spin {
    from { transform: scale(1.4) rotate(0deg); }
    to { transform: scale(1.4) rotate(360deg); }
  }

  @keyframes moon-rock {
    0%, 100% { transform: scale(1.4) rotate(-8deg); }
    50% { transform: scale(1.4) rotate(8deg); }
  }

  .setflow-popover {
    position: fixed;
    z-index: 99999;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 0;
    min-width: 200px;
    max-width: 280px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.05);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    pointer-events: none;
    animation: popover-in 0.15s ease-out;
  }

  @keyframes popover-in {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .popover-content {
    padding: 12px 14px;
  }

  .popover-time {
    font-size: 20px;
    font-weight: 600;
    color: #fff;
    margin-bottom: 8px;
    letter-spacing: -0.5px;
  }

  .day-indicator {
    font-size: 12px;
    color: #888;
    font-weight: 400;
    margin-left: 4px;
  }

  .popover-phase {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    margin-bottom: 8px;
  }

  .phase-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .phase-name {
    font-size: 13px;
    font-weight: 600;
    color: #fff;
  }

  .phase-range {
    font-size: 11px;
    color: #888;
    margin-left: auto;
  }

  .popover-status {
    font-size: 12px;
    color: #888;
    margin-bottom: 8px;
  }

  .popover-status.playing {
    color: #4CAF50;
    font-weight: 500;
  }

  .popover-upcoming {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #aaa;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .upcoming-label {
    color: #666;
  }

  .popover-celestial {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 500;
    padding: 6px 10px;
    border-radius: 6px;
    margin-top: 8px;
  }

  .popover-celestial.sunrise {
    background: linear-gradient(135deg, rgba(255, 213, 79, 0.2), rgba(255, 152, 0, 0.1));
    color: #FFD54F;
  }

  .popover-celestial.sunset {
    background: linear-gradient(135deg, rgba(92, 107, 192, 0.2), rgba(57, 73, 171, 0.1));
    color: #7986CB;
  }

  .popover-celestial.active {
    animation: celestial-pulse 0.5s ease-in-out infinite;
    font-weight: 700;
  }

  .popover-celestial.sunrise.active {
    background: linear-gradient(135deg, rgba(255, 213, 79, 0.4), rgba(255, 152, 0, 0.3));
    box-shadow: 0 0 12px rgba(255, 152, 0, 0.4);
  }

  .popover-celestial.sunset.active {
    background: linear-gradient(135deg, rgba(92, 107, 192, 0.4), rgba(57, 73, 171, 0.3));
    box-shadow: 0 0 12px rgba(92, 107, 192, 0.4);
  }

  .popover-celestial.past {
    opacity: 0.6;
  }

  @keyframes celestial-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.02); }
  }

  .popover-track-position {
    font-size: 13px;
    font-weight: 500;
    color: #9C27B0;
    margin-bottom: 8px;
    font-variant-numeric: tabular-nums;
  }
`
document.head.appendChild(style)
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}

// Export for CRXJS
export const onExecute = () => {}
