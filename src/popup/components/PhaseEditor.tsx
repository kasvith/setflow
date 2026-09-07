import { useState } from 'react'
import { Phase } from '../../shared/types'
import { formatClock, formatDurationCompact, parseDuration, phaseWindows } from '../../shared/utils'

const COLORS = [
  '#FFB74D', '#FF8A65', '#E91E63', '#F06292', '#BA68C8',
  '#9C27B0', '#7E57C2', '#5C6BC0', '#42A5F5', '#26C6DA',
  '#26A69A', '#66BB6A', '#9CCC65', '#FFEE58', '#FFA726',
]

interface Props {
  phases: Phase[]
  disabled: boolean
  start: number // journey start timestamp; rows show real clock times
  sunrise?: number
  sunset?: number
  onAdd: () => void
  onUpdate: (id: string, updates: Partial<Phase>) => void
  onDelete: (id: string) => void
  onUsePreset: () => void
}

export default function PhaseEditor({
  phases,
  disabled,
  start,
  sunrise,
  sunset,
  onAdd,
  onUpdate,
  onDelete,
  onUsePreset,
}: Props) {
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)
  const [editingDuration, setEditingDuration] = useState<{ id: string; value: string } | null>(null)

  return (
    <div className="phase-list">
      {phaseWindows(phases, start).map(({ phase, start: from, end: to }) => (
        <div key={phase.id} className="phase-row">
          <div className="swatch-wrap">
            <button
              type="button"
              className="swatch"
              style={{ background: phase.color }}
              disabled={disabled}
              aria-label={`${phase.name} colour`}
              onClick={() => setColorPickerId(colorPickerId === phase.id ? null : phase.id)}
            />
            {colorPickerId === phase.id && (
              <div className="color-picker">
                {COLORS.map((color) => (
                  <button
                    type="button"
                    key={color}
                    className={`color-option ${phase.color === color ? 'selected' : ''}`}
                    style={{ background: color }}
                    aria-label={color}
                    onClick={() => {
                      onUpdate(phase.id, { color })
                      setColorPickerId(null)
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <input
            type="text"
            className="phase-name"
            value={phase.name}
            disabled={disabled}
            aria-label="Phase name"
            onChange={(e) => onUpdate(phase.id, { name: e.target.value })}
          />

          <span className="phase-range">
            {sunrise !== undefined && sunrise >= from && sunrise < to && (
              <span title={`Sunrise ${formatClock(sunrise)}`}>☀ </span>
            )}
            {sunset !== undefined && sunset >= from && sunset < to && (
              <span title={`Sunset ${formatClock(sunset)}`}>☾ </span>
            )}
            {formatClock(from)} – {formatClock(to)}
          </span>

          <input
            type="text"
            className="phase-duration"
            value={
              editingDuration?.id === phase.id
                ? editingDuration.value
                : formatDurationCompact(phase.duration)
            }
            disabled={disabled}
            aria-label="Phase duration"
            placeholder="1h30m"
            onFocus={() =>
              setEditingDuration({ id: phase.id, value: formatDurationCompact(phase.duration) })
            }
            onChange={(e) => setEditingDuration({ id: phase.id, value: e.target.value })}
            onBlur={() => {
              if (!editingDuration) return
              const parsed = parseDuration(editingDuration.value)
              if (parsed !== null && parsed > 0) onUpdate(phase.id, { duration: parsed })
              setEditingDuration(null)
            }}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
          />

          <button
            type="button"
            className="icon-btn"
            disabled={disabled}
            aria-label={`Remove ${phase.name}`}
            onClick={() => onDelete(phase.id)}
          >
            ×
          </button>
        </div>
      ))}

      {!disabled && (
        <div className="phase-footer">
          <button type="button" className="link" onClick={onAdd}>
            + Add phase
          </button>
          <button type="button" className="link" onClick={onUsePreset}>
            Use a preset
          </button>
        </div>
      )}
    </div>
  )
}
