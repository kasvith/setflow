import { useState } from 'react'
import { Phase, Preset } from '../../shared/types'

interface Props {
  presets: Preset[]
  currentPhases: Phase[]
  onLoad: (preset: Preset) => void
  onSave: (name: string) => void
  onDelete: (name: string) => void
  onRestoreDefaults: () => void
}

export default function PresetManager({
  presets,
  onLoad,
  onSave,
  onDelete,
  onRestoreDefaults,
}: Props) {
  const [newName, setNewName] = useState('')

  function handleSave() {
    if (!newName.trim()) return
    onSave(newName.trim())
    setNewName('')
  }

  function handleDelete(e: React.MouseEvent, name: string) {
    e.stopPropagation()
    onDelete(name)
  }

  return (
    <div>
      <div className="section">
        <div className="section-title">Save Current Phases</div>
        <div className="save-preset-input">
          <input
            type="text"
            placeholder="Preset name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <button className="btn btn-secondary" onClick={handleSave}>
            Save
          </button>
        </div>
      </div>

      <div className="section">
        <div className="section-header">
          <span className="section-title">Saved Presets</span>
          <button className="clear-btn" onClick={onRestoreDefaults}>
            Restore Defaults
          </button>
        </div>
        <div className="preset-list">
          {presets.length === 0 && (
            <div style={{ color: '#666', fontSize: 14, padding: 12 }}>
              No presets saved yet
            </div>
          )}
          {presets.map((preset) => (
            <div
              key={preset.name}
              className="preset-item"
              onClick={() => onLoad(preset)}
            >
              <span className="preset-name">{preset.name}</span>
              <div className="preset-phases">
                {preset.phases.map((phase, i) => (
                  <div
                    key={i}
                    className="preset-phase-dot"
                    style={{ background: phase.color }}
                    title={`${phase.name} (${phase.duration}m)`}
                  />
                ))}
              </div>
              <button
                className="phase-delete"
                onClick={(e) => handleDelete(e, preset.name)}
                title="Delete preset"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
