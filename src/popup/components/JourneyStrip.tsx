import { Phase } from '../../shared/types'
import { formatClock } from '../../shared/utils'

interface Props {
  phases: Phase[]
  start: number // timestamp
  sunrise?: number
  sunset?: number
  compact?: boolean // no clock labels, thinner track (library rows)
}

// The journey as one bar: phase widths in proportion to duration, celestial ticks at their
// real positions
export default function JourneyStrip({ phases, start, sunrise, sunset, compact }: Props) {
  const total = phases.reduce((sum, p) => sum + p.duration, 0) * 60 * 1000
  const end = start + total
  const pct = (t: number) => `${Math.min(100, Math.max(0, ((t - start) / total) * 100))}%`
  const inside = (t?: number): t is number => t !== undefined && t >= start && t < end
  const hasTicks = inside(sunrise) || inside(sunset)

  return (
    <div className={`strip ${compact ? 'compact' : ''}`}>
      <div className="strip-track">
        {phases.map((p) => (
          <span key={p.id} style={{ flex: p.duration, background: p.color }} title={p.name} />
        ))}
      </div>
      {inside(sunrise) && (
        <span className="strip-tick" style={{ left: pct(sunrise) }} title={`Sunrise ${formatClock(sunrise)}`}>
          ☀
        </span>
      )}
      {inside(sunset) && (
        <span className="strip-tick" style={{ left: pct(sunset) }} title={`Sunset ${formatClock(sunset)}`}>
          ☾
        </span>
      )}
      {!compact && (
        <div className={`strip-labels ${hasTicks ? 'below-ticks' : ''}`}>
          <span>{formatClock(start)}</span>
          <span>{formatClock(end)}</span>
        </div>
      )}
    </div>
  )
}
