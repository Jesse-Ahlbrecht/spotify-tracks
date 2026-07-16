import { useMemo } from 'react'
import { scaleLinear } from 'd3-scale'
import { line as d3line } from 'd3-shape'
import { extent } from 'd3-array'

const W = 560
const H = 470
const M = { t: 26, r: 30, b: 62, l: 60 }

function pad([a, b], p) {
  return [a - p, b + p]
}

// The hero: music's path across the valence×energy plane, with the active decade
// as a spotlighted dot (size = minor-key share). Position animates via CSS.
export default function MoodSpace({ decades, active }) {
  const x = useMemo(
    () => scaleLinear().domain(pad(extent(decades, (d) => d.valence), 0.015)).range([M.l, W - M.r]),
    [decades],
  )
  const y = useMemo(
    () => scaleLinear().domain(pad(extent(decades, (d) => d.energy), 0.04)).range([H - M.b, M.t]),
    [decades],
  )
  const size = useMemo(
    () => scaleLinear().domain(extent(decades, (d) => d.minor_share)).range([8, 24]),
    [decades],
  )
  const path = useMemo(
    () => d3line().x((d) => x(d.valence)).y((d) => y(d.energy))(decades),
    [decades, x, y],
  )

  const cur = decades[active]
  const rNow = size(cur.minor_share) // marker radius = minor-key share

  return (
    <svg className="moodspace" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Mood-space position for the ${cur.decade}s: valence ${cur.valence}, energy ${cur.energy}`}>
      {/* gridlines + numeric ticks */}
      {x.ticks(4).map((t) => (
        <g key={`x${t}`}>
          <line className="ms-grid" x1={x(t)} x2={x(t)} y1={M.t} y2={H - M.b} />
          <text className="ms-tick" x={x(t)} y={H - M.b + 20} textAnchor="middle">{t.toFixed(2)}</text>
        </g>
      ))}
      {y.ticks(4).map((t) => (
        <g key={`y${t}`}>
          <line className="ms-grid" x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} />
          <text className="ms-tick" x={M.l - 8} y={y(t)} dy="0.32em" textAnchor="end">{t.toFixed(2)}</text>
        </g>
      ))}
      {/* axes */}
      <line className="ms-axis-line" x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} />
      <line className="ms-axis-line" x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} />

      {/* axis direction labels */}
      <text className="ms-axis" x={(M.l + W - M.r) / 2} y={H - 16} textAnchor="middle">
        ← sadder&nbsp;&nbsp;&nbsp;valence&nbsp;&nbsp;&nbsp;happier →
      </text>
      <text className="ms-axis" transform={`translate(18,${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">
        ← calmer&nbsp;&nbsp;&nbsp;energy&nbsp;&nbsp;&nbsp;more intense →
      </text>

      {/* the century path */}
      <path className="ms-path" d={path} />

      {/* every decade as a small marker; past = a touch brighter than future */}
      {decades.map((d, i) => (
        <circle
          key={d.decade}
          cx={x(d.valence)}
          cy={y(d.energy)}
          r={3.5}
          className={`ms-dot ${i <= active ? 'past' : 'future'}`}
        />
      ))}

      {/* the spotlighted current decade (position animates) */}
      <g className="ms-now" style={{ transform: `translate(${x(cur.valence)}px, ${y(cur.energy)}px)` }}>
        <circle className="ms-now-halo" r={rNow + 7} />
        <circle className="ms-now-core" r={rNow} />
        <text className="ms-now-label" x={rNow + 12} dy="0.32em">
          {cur.decade}s
        </text>
      </g>
    </svg>
  )
}
