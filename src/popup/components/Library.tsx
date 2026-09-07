import { useState } from 'react'
import { Phase, Preset, SavedJourney } from '../../shared/types'
import { formatDurationCompact } from '../../shared/utils'
import JourneyStrip from './JourneyStrip'

interface Props {
  journeys: SavedJourney[]
  presets: Preset[]
  currentPhases: Phase[]
  onOpenJourney: (journey: SavedJourney) => void
  onDeleteJourney: (playlistUrl: string) => void
  onUsePreset: (preset: Preset) => void
  onSavePreset: (name: string) => void
  onDeletePreset: (name: string) => void
  onRestoreDefaults: () => void
}

const totalOf = (phases: Phase[]) => formatDurationCompact(phases.reduce((s, p) => s + p.duration, 0))

function formatDay(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function Library({
  journeys,
  presets,
  currentPhases,
  onOpenJourney,
  onDeleteJourney,
  onUsePreset,
  onSavePreset,
  onDeletePreset,
  onRestoreDefaults,
}: Props) {
  const [presetName, setPresetName] = useState('')
  // Second tap confirms a delete; key is "journey:<url>" or "preset:<name>"
  const [confirming, setConfirming] = useState<string | null>(null)

  function deleteButton(key: string, onConfirm: () => void) {
    const armed = confirming === key
    return (
      <button
        type="button"
        className={`link ${armed ? 'danger' : ''}`}
        onClick={() => {
          if (armed) {
            onConfirm()
            setConfirming(null)
          } else {
            setConfirming(key)
          }
        }}
      >
        {armed ? 'Confirm delete' : 'Delete'}
      </button>
    )
  }

  function savePreset() {
    const name = presetName.trim()
    if (!name) return
    onSavePreset(name)
    setPresetName('')
  }

  const sortedJourneys = [...journeys].sort((a, b) => b.updatedAt - a.updatedAt)

  return (
    <div>
      <section className="library-group">
        <h3 className="group-title">Journeys</h3>
        {sortedJourneys.length === 0 && (
          <p className="empty">No saved journeys yet. Start one on a playlist and it's kept here.</p>
        )}
        {sortedJourneys.map((journey) => (
          <div key={journey.playlistUrl} className="lib-row">
            <div className="lib-main">
              <div className="lib-name">{journey.name}</div>
              <div className="lib-sub">
                {journey.playlistTitle && journey.playlistTitle !== journey.name
                  ? `${journey.playlistTitle}, `
                  : ''}
                {totalOf(journey.phases)}, used {formatDay(journey.updatedAt)}
              </div>
              <JourneyStrip phases={journey.phases} start={0} compact />
            </div>
            <div className="lib-actions">
              <button type="button" className="link" onClick={() => onOpenJourney(journey)}>
                Open
              </button>
              {deleteButton(`journey:${journey.playlistUrl}`, () => onDeleteJourney(journey.playlistUrl))}
            </div>
          </div>
        ))}
      </section>

      <section className="library-group">
        <div className="group-head">
          <h3 className="group-title">Presets</h3>
          <button type="button" className="link" onClick={onRestoreDefaults}>
            Restore defaults
          </button>
        </div>
        {presets.map((preset) => (
          <div key={preset.name} className="lib-row">
            <div className="lib-main">
              <div className="lib-name">{preset.name}</div>
              <div className="lib-sub">
                {preset.phases.map((p) => p.name).join(', ')}, {totalOf(preset.phases)}
              </div>
              <JourneyStrip phases={preset.phases} start={0} compact />
            </div>
            <div className="lib-actions">
              <button type="button" className="link" onClick={() => onUsePreset(preset)}>
                Use
              </button>
              {deleteButton(`preset:${preset.name}`, () => onDeletePreset(preset.name))}
            </div>
          </div>
        ))}
        <div className="save-preset">
          <input
            type="text"
            placeholder={`Save current phases (${totalOf(currentPhases)}) as…`}
            value={presetName}
            aria-label="New preset name"
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && savePreset()}
          />
          <button type="button" className="btn btn-secondary" onClick={savePreset}>
            Save preset
          </button>
        </div>
      </section>
    </div>
  )
}
