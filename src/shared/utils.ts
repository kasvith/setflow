import type { Phase, Session } from './types'

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

// Phases overlapping [start, end), each with the fraction of that range it covers (0-1)
export function getPhasesInRange(
  session: Session,
  start: number,
  end: number
): { phase: Phase; from: number; to: number }[] {
  const span = end - start || 1
  const overlaps: { phase: Phase; from: number; to: number }[] = []
  let accumulatedTime = 0

  for (const phase of session.phases) {
    const from = Math.max(start, accumulatedTime)
    const to = Math.min(end, accumulatedTime + phase.duration)
    if (to > from) {
      overlaps.push({ phase, from: (from - start) / span, to: (to - start) / span })
    }
    accumulatedTime += phase.duration
  }

  return overlaps
}

// Absolute start/end timestamps of each phase for a journey starting at `start`
export function phaseWindows(
  phases: Phase[],
  start: number
): { phase: Phase; start: number; end: number }[] {
  let t = start
  return phases.map((phase) => {
    const window = { phase, start: t, end: t + phase.duration * 60 * 1000 }
    t = window.end
    return window
  })
}

export function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// A typed start clock time ("04:30") as a timestamp. A journey that would already be over
// by now can't be what was meant, so it rolls to tomorrow; a start a few minutes ago stays today.
export function resolveStartTimestamp(
  timeInput: string,
  totalMinutes: number,
  now: number = Date.now()
): number {
  if (!timeInput) return now
  const [hours, minutes] = timeInput.split(':').map(Number)
  const date = new Date(now)
  date.setHours(hours, minutes, 0, 0)
  let start = date.getTime()
  if (start + totalMinutes * 60 * 1000 < now) start += 24 * 60 * 60 * 1000
  return start
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
