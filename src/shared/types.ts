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
}

export interface Preset {
  name: string
  phases: Phase[]
}

export interface StorageData {
  activeSession: Session | null
  presets: Preset[]
  overlayMinimized: boolean
  overlayPosition: { x: number; y: number } | null
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
]
