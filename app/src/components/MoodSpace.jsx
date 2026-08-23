import { useMemo } from 'react'
import { scaleLinear } from 'd3-scale'
import { line as d3line } from 'd3-shape'
import { extent } from 'd3-array'
import { splitAxis } from '../lib.js'

const W = 560
const H = 470
const M = { t: 26, r: 30, b: 62, l: 82 }
const R_NOW = 13 // spotlight radius. Was a third metric mapped to size; two axes read cleaner.

function pad([a, b], p) {
  return [a - p, b + p]
}

// The hero: music's path across a two-metric plane, with the active decade as a spotlighted dot.
// Axes and colour are set per journey via props. Position animates via CSS.
export default function MoodSpace({ decades, active, xKey, yKey, xLabel, yLabel, accent }) {
  const x = useMemo(
    () => scaleLinear().domain(pad(extent(decades, (d) => d[xKey]), 0.015)).range([M.l, W - M.r]),
    [decades, xKey],
  )
  const y = useMemo(
    () => scaleLinear().domain(pad(extent(decades, (d) => d[yKey]), 0.04)).range([H - M.b, M.t]),
    [decades, yKey],
  )
  const path = useMemo(
    () => d3line().x((d) => x(d[xKey])).y((d) => y(d[yKey]))(decades),
    [decades, x, y, xKey, yKey],
  )

  const cur = decades[active]
  const [xLow, xName, xHigh] = splitAxis(xLabel)
  const [yLow, yName, yHigh] = splitAxis(yLabel)

  return (
    <svg className="moodspace" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Position for the ${cur.decade}s: ${xName} ${cur[xKey]}, ${yName} ${cur[yKey]}`}>
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

      {/* axis direction labels — descriptors pushed to the plot's edges, name centred */}
      {xLow && <text className="ms-axis" x={M.l} y={H - 16} textAnchor="start">{xLow}</text>}
      <text className="ms-axis ms-axis-title" x={(M.l + W - M.r) / 2} y={H - 16} textAnchor="middle">{xName}</text>
      {xHigh && <text className="ms-axis" x={W - M.r} y={H - 16} textAnchor="end">{xHigh}</text>}
      {yLow && (
        <text className="ms-axis" transform={`translate(22,${H - M.b}) rotate(-90)`} textAnchor="start">{yLow}</text>
      )}
      <text className="ms-axis ms-axis-title" transform={`translate(22,${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">
        {yName}
      </text>
      {yHigh && (
        <text className="ms-axis" transform={`translate(22,${M.t}) rotate(-90)`} textAnchor="end">{yHigh}</text>
      )}

      {/* the century path */}
      <path className="ms-path" d={path} />

      {/* every decade as a small marker; past = a touch brighter than future */}
      {decades.map((d, i) => (
        <circle
          key={d.decade}
          cx={x(d[xKey])}
          cy={y(d[yKey])}
          r={3.5}
          className={`ms-dot ${i <= active ? 'past' : 'future'}`}
        />
      ))}

      {/* the spotlighted current decade (position animates); colour = journey accent */}
      <g className="ms-now" style={{ transform: `translate(${x(cur[xKey])}px, ${y(cur[yKey])}px)`, '--accent': accent }}>
        <circle className="ms-now-halo" r={R_NOW + 7} />
        <circle className="ms-now-core" r={R_NOW} />
        <text className="ms-now-label" x={R_NOW + 12} dy="0.32em">
          {cur.decade}s
        </text>
      </g>
    </svg>
  )
}
