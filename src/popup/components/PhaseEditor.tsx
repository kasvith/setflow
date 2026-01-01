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
  onAdd: () => void
  onUpdate: (id: string, updates: Partial<Phase>) => void
  onDelete: (id: string) => void
  onReorder: (phases: Phase[]) => void
}

export default function PhaseEditor({
  phases,
  disabled,
  onAdd,
  onUpdate,
  onDelete,
}: Props) {
  const [colorPickerId, setColorPickerId] = useState<string | null>(null)

  return (
    <div className="phase-list">
      {phases.map((phase) => (
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

          <input
            type="text"
            className="phase-name"
            value={phase.name}
            disabled={disabled}
            onChange={(e) => onUpdate(phase.id, { name: e.target.value })}
          />

          <input
            type="text"
            className="phase-duration"
            value={formatDurationCompact(phase.duration)}
            disabled={disabled}
            placeholder="1h30m"
            onChange={(e) => {
              const parsed = parseDuration(e.target.value)
              if (parsed !== null) {
                onUpdate(phase.id, { duration: parsed })
              }
            }}
          />

          <button
            className="phase-delete"
            disabled={disabled || phases.length <= 1}
            onClick={() => onDelete(phase.id)}
          >
            ×
          </button>
        </div>
      ))}

      {!disabled && (
        <button className="add-phase" onClick={onAdd}>
          + Add Phase
        </button>
      )}
    </div>
  )
}
