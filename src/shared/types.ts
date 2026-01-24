export interface Phase {
  id: string
  name: string
  duration: number // in minutes
  color: string
}

export interface Session {
  startTime: number // timestamp when journey starts
  phases: Phase[]
  sunriseTime?: string // e.g., "06:30" - optional sunrise time input
  sunsetTime?: string // e.g., "20:00" - optional sunset time input
  sunriseTimestamp?: number // calculated timestamp when sunrise occurs
  sunsetTimestamp?: number // calculated timestamp when sunset occurs
  journeyName?: string // optional name for the journey
  playlistUrl?: string // optional playlist URL for journey restoration
}

export interface Preset {
  name: string
  phases: Phase[]
}

export interface DraftFormState {
  startTime: string
  sunriseTime: string
  sunsetTime: string
  durationPreset: string
  phases: Phase[]
  journeyName: string
  lastUpdated: number
}

export interface SavedJourney {
  name: string
  playlistUrl: string
  phases: Phase[]
  startTime?: string
  sunriseTime?: string
  sunsetTime?: string
  durationPreset?: string
  createdAt: number
  updatedAt: number
}

export interface ExportedTrack {
  index: number
  name: string
  artist: string
  duration: string
  durationMinutes: number
  journeyStartTime: string
  journeyEndTime: string
  journeyStartMinutes: number
  journeyEndMinutes: number
  phase: { name: string; color: string } | null
  youtubeUrl: string | null
}

export interface ExportedTracklist {
  journeyName: string
  playlistUrl: string
  playlistTitle: string
  exportedAt: string
  session: {
    startTime: string
    phases: Phase[]
    sunriseTime?: string
    sunsetTime?: string
  }
  tracks: ExportedTrack[]
  totalDuration: string
  totalTracks: number
}

export interface StorageData {
  activeSession: Session | null
  presets: Preset[]
  overlayMinimized: boolean
  overlayPosition: { x: number; y: number } | null
  draftFormState: DraftFormState | null
  savedJourneys: Record<string, SavedJourney>
}

export const DEFAULT_PHASES: Phase[] = [
  { id: '1', name: 'Comeup', duration: 90, color: '#FFB74D' },
  { id: '2', name: 'Peak', duration: 180, color: '#E91E63' },
  { id: '3', name: 'Plateau', duration: 180, color: '#9C27B0' },
  { id: '4', name: 'Comedown', duration: 270, color: '#42A5F5' },
]

export const DEFAULT_PRESETS: Preset[] = [
  {
    name: 'Standard 12hr',
    phases: DEFAULT_PHASES,
  },
  {
    name: 'Short 8hr',
    phases: [
      { id: '1', name: 'Comeup', duration: 60, color: '#FFB74D' },
      { id: '2', name: 'Peak', duration: 120, color: '#E91E63' },
      { id: '3', name: 'Plateau', duration: 120, color: '#9C27B0' },
      { id: '4', name: 'Comedown', duration: 180, color: '#42A5F5' },
    ],
  },
  {
    name: 'Quick 2h',
    phases: [
      { id: '1', name: 'Intro', duration: 20, color: '#FFB74D' },
      { id: '2', name: 'Body', duration: 70, color: '#E91E63' },
      { id: '3', name: 'Outro', duration: 30, color: '#42A5F5' },
    ],
  },
  {
    name: 'Medium 4h',
    phases: [
      { id: '1', name: 'Opening', duration: 40, color: '#FFB74D' },
      { id: '2', name: 'Main', duration: 140, color: '#E91E63' },
      { id: '3', name: 'Closing', duration: 60, color: '#42A5F5' },
    ],
  },
  {
    name: 'Extended 6h',
    phases: [
      { id: '1', name: 'Warm-up', duration: 60, color: '#FFB74D' },
      { id: '2', name: 'Build', duration: 120, color: '#E91E63' },
      { id: '3', name: 'Drop', duration: 120, color: '#9C27B0' },
      { id: '4', name: 'Cool', duration: 60, color: '#42A5F5' },
    ],
  },
  {
    name: '12h Standard',
    phases: [
      { id: '1', name: 'Onset', duration: 45, color: '#FFB74D' },
      { id: '2', name: 'Come Up', duration: 75, color: '#FF8A65' },
      { id: '3', name: 'Peak', duration: 180, color: '#E91E63' },
      { id: '4', name: 'Plateau', duration: 180, color: '#9C27B0' },
      { id: '5', name: 'Comedown', duration: 240, color: '#42A5F5' },
    ],
  },
]
