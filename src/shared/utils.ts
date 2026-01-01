import { Phase, Session } from './types'

export interface PhaseInfo {
  phase: Phase
  index: number
  startTime: number // minutes from session start
  endTime: number // minutes from session start
  elapsedInPhase: number // minutes elapsed in this phase
  remainingInPhase: number // minutes remaining in this phase
  progress: number // 0-1
}

export interface SessionInfo {
  elapsedMinutes: number
  elapsedFormatted: string
  currentPhase: PhaseInfo | null
  phases: PhaseInfo[]
  isComplete: boolean
  totalDuration: number
}

export function calculateSessionInfo(session: Session): SessionInfo {
  const now = Date.now()
  const elapsedMs = now - session.startTime
  const elapsedMinutes = elapsedMs / (1000 * 60)

  const phases: PhaseInfo[] = []
  let accumulatedTime = 0

  for (let i = 0; i < session.phases.length; i++) {
    const phase = session.phases[i]
    const startTime = accumulatedTime
    const endTime = accumulatedTime + phase.duration

    const elapsedInPhase = Math.max(0, Math.min(phase.duration, elapsedMinutes - startTime))
    const remainingInPhase = Math.max(0, phase.duration - elapsedInPhase)
    const progress = elapsedInPhase / phase.duration

    phases.push({
      phase,
      index: i,
      startTime,
      endTime,
      elapsedInPhase,
      remainingInPhase,
      progress,
    })

    accumulatedTime = endTime
  }

  const totalDuration = accumulatedTime
  const isComplete = elapsedMinutes >= totalDuration

  let currentPhase: PhaseInfo | null = null
  for (const phaseInfo of phases) {
    if (elapsedMinutes >= phaseInfo.startTime && elapsedMinutes < phaseInfo.endTime) {
      currentPhase = phaseInfo
      break
    }
  }

  // If elapsed is beyond all phases, current is the last one (or null if complete)
  if (!currentPhase && !isComplete && phases.length > 0) {
    currentPhase = phases[phases.length - 1]
  }

  return {
    elapsedMinutes,
    elapsedFormatted: formatDuration(elapsedMinutes),
    currentPhase,
    phases,
    isComplete,
    totalDuration,
  }
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = Math.floor(minutes % 60)
  const secs = Math.floor((minutes * 60) % 60)

  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m ${secs}s`
}

export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = Math.floor(minutes % 60)
  return `${hours}:${mins.toString().padStart(2, '0')}`
}

export function getPhaseAtTime(session: Session, minutesFromStart: number): Phase | null {
  let accumulatedTime = 0

  for (const phase of session.phases) {
    if (minutesFromStart >= accumulatedTime && minutesFromStart < accumulatedTime + phase.duration) {
      return phase
    }
    accumulatedTime += phase.duration
  }

  return null
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export function parseDuration(input: string): number | null {
  // Parse formats like "1h30m", "90m", "1:30", "90"
  const hourMinMatch = input.match(/^(\d+)h\s*(\d+)?m?$/)
  if (hourMinMatch) {
    const hours = parseInt(hourMinMatch[1], 10)
    const mins = parseInt(hourMinMatch[2] || '0', 10)
    return hours * 60 + mins
  }

  const minMatch = input.match(/^(\d+)m?$/)
  if (minMatch) {
    return parseInt(minMatch[1], 10)
  }

  const colonMatch = input.match(/^(\d+):(\d+)$/)
  if (colonMatch) {
    const hours = parseInt(colonMatch[1], 10)
    const mins = parseInt(colonMatch[2], 10)
    return hours * 60 + mins
  }

  return null
}

// Format duration as "2h" or "1h30m" (compact format for display)
export function formatDurationCompact(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0 && m > 0) return `${h}h${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

// Convert "HH:MM" time input to timestamp
// Handles next-day crossing (if target time is before/equal to start time, assume next day)
export function timeInputToTimestamp(
  timeInput: string, // "06:30" format from <input type="time">
  startTimestamp: number // journey start timestamp
): number {
  const [hours, minutes] = timeInput.split(':').map(Number)
  const startDate = new Date(startTimestamp)
  const targetDate = new Date(startDate)
  targetDate.setHours(hours, minutes, 0, 0)

  // If target time is before or equal to start time, it's the next day
  if (targetDate.getTime() <= startTimestamp) {
    targetDate.setDate(targetDate.getDate() + 1)
  }

  return targetDate.getTime()
}
