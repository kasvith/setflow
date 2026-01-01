import { useState } from 'react'
import { Phase } from '../../shared/types'
import { formatDurationCompact, parseDuration } from '../../shared/utils'

const COLORS = [
  '#FFB74D', '#FF8A65', '#E91E63', '#F06292', '#BA68C8',
  '#9C27B0', '#7E57C2', '#5C6BC0', '#42A5F5', '#26C6DA',
  '#26A69A', '#66BB6A', '#9CCC65', '#FFEE58', '#FFA726',
]

interface Props {
  phases: Phase[]
  disabled: boolean
  startTime?: string // "HH:MM" format from time input
  onAdd: () => void
  onUpdate: (id: string, updates: Partial<Phase>) => void
  onDelete: (id: string) => void
  onReorder: (phases: Phase[]) => void
}

function getBaseTimeMinutes(startTime: string | undefined): number {
  if (startTime) {
    const [hours, minutes] = startTime.split(':').map(Number)
    return hours * 60 + minutes
  }
  // Use current time as default
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

function formatTimeFromMinutes(baseMinutes: number, minutesOffset: number): string {
  const totalMinutes = baseMinutes + minutesOffset
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  const period = h >= 12 ? 'PM' : 'AM'
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${displayHour}:${m.toString().padStart(2, '0')} ${period}`
}

export default function PhaseEditor({
  phases,
  disabled,
  startTime,
  onAdd,
  onUpdate,
  onDelete,
}: Props) {
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)
  const [editingDuration, setEditingDuration] = useState<{ id: string; value: string } | null>(null)

  // Calculate phase time ranges (uses current time if no start time set)
  const baseMinutes = getBaseTimeMinutes(startTime)

  function getPhaseTimeRange(index: number): { start: string; end: string } {
    let accumulatedMinutes = 0
    for (let i = 0; i < index; i++) {
      accumulatedMinutes += phases[i].duration
    }
    const phaseStart = formatTimeFromMinutes(baseMinutes, accumulatedMinutes)
    const phaseEnd = formatTimeFromMinutes(baseMinutes, accumulatedMinutes + phases[index].duration)
    return { start: phaseStart, end: phaseEnd }
  }

  return (
    <div className="phase-list">
      {phases.map((phase, index) => {
        const timeRange = getPhaseTimeRange(index)
        return (
          <div key={phase.id} className="phase-item">
            <div className="color-picker-wrapper">
              <div
                className="phase-color"
                style={{ background: phase.color }}
                onClick={() => !disabled && setColorPickerId(colorPickerId === phase.id ? null : phase.id)}
              />
              {colorPickerId === phase.id && (
                <div className="color-picker">
                  {COLORS.map((color) => (
                    <div
                      key={color}
                      className={`color-option ${phase.color === color ? 'selected' : ''}`}
                      style={{ background: color }}
                      onClick={() => {
                        onUpdate(phase.id, { color })
                        setColorPickerId(null)
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="phase-info">
              <input
                type="text"
                className="phase-name"
                value={phase.name}
                disabled={disabled}
                onChange={(e) => onUpdate(phase.id, { name: e.target.value })}
              />
              <span className="phase-time-range">
                {timeRange.start} – {timeRange.end}
              </span>
            </div>

            <input
              type="text"
              className="phase-duration"
              value={editingDuration?.id === phase.id ? editingDuration.value : formatDurationCompact(phase.duration)}
              disabled={disabled}
              placeholder="1h30m"
              onFocus={() => setEditingDuration({ id: phase.id, value: formatDurationCompact(phase.duration) })}
              onChange={(e) => {
                setEditingDuration({ id: phase.id, value: e.target.value })
              }}
              onBlur={() => {
                if (editingDuration) {
                  const parsed = parseDuration(editingDuration.value)
                  if (parsed !== null && parsed > 0) {
                    onUpdate(phase.id, { duration: parsed })
                  }
                  setEditingDuration(null)
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur()
                }
              }}
            />

            <button
              className="phase-delete"
              disabled={disabled}
              onClick={() => onDelete(phase.id)}
            >
              ×
            </button>
          </div>
        )
      })}

      {!disabled && (
        <button className="add-phase" onClick={onAdd}>
          + Add Phase
        </button>
      )}
    </div>
  )
}
