import { useMemo } from 'react'
import { scaleLinear } from 'd3-scale'
import { line as d3line } from 'd3-shape'
import { extent } from 'd3-array'
import { splitAxis, usePlaneRoomy } from '../lib.js'

// Two geometries, not one scaled down. The svg sizes by viewBox alone, so its font sizes are user
// units: shrinking a 560-wide plane into a phone column renders 13px ticks at ~7px. `compact` is
// picked so one user unit is about one CSS px at phone width, which keeps the type at its stated
// size — the margins and tick count come down instead of the text.
// `tickGap` is the numeric row's drop below the axis line and `axisY` the name's rise off the
// bottom edge; both are per-geometry because the compact bottom margin has no room for the wide
// one's spacing. `labelW` is roughly how wide "1920s" renders at that geometry's type size — used
// only to decide which side of the dot the label goes on, so an estimate is enough.
const DIMS = {
  wide: {
    W: 560, H: 470, M: { t: 26, r: 30, b: 62, l: 82 },
    ticks: 4, tickGap: 20, axisY: 16, yAxisX: 22, dot: 3.5, rNow: 13, ends: true, labelW: 48,
  },
  compact: {
    W: 320, H: 210, M: { t: 12, r: 14, b: 40, l: 50 },
    ticks: 3, tickGap: 13, axisY: 5, yAxisX: 12, dot: 3, rNow: 9, ends: false, labelW: 42,
  },
  // Same width, taller box. A deck page is one viewport tall and the plane is the only thing on it
  // that can absorb height, but its aspect — not the screen — decides how much it takes. On a tall
  // phone that left 40% of the page empty. Squarer here, which a position plane reads fine as.
  compactTall: {
    W: 320, H: 290, M: { t: 14, r: 14, b: 44, l: 50 },
    ticks: 4, tickGap: 14, axisY: 6, yAxisX: 13, dot: 3.5, rNow: 10, ends: false, labelW: 42,
  },
}

function pad([a, b], p) {
  return [a - p, b + p]
}

// The hero: music's path across a two-metric plane, with the active decade as a spotlighted dot.
// Axes and colour are set per journey via props. Position animates via CSS.
export default function MoodSpace({ decades, active, xKey, yKey, xLabel, yLabel, accent, compact }) {
  // One query, not `useIsTall() || useIsShort()` — `||` short-circuits, so the second hook went
  // uncalled whenever the first was true, and rotating across the boundary changed the hook count.
  const roomy = usePlaneRoomy()
  const D = compact ? (roomy ? DIMS.compactTall : DIMS.compact) : DIMS.wide
  const { W, H, M } = D
  const x = useMemo(
    () => scaleLinear().domain(pad(extent(decades, (d) => d[xKey]), 0.015)).range([M.l, W - M.r]),
    [decades, xKey, M, W],
  )
  const y = useMemo(
    () => scaleLinear().domain(pad(extent(decades, (d) => d[yKey]), 0.04)).range([H - M.b, M.t]),
    [decades, yKey, M, H],
  )
  const path = useMemo(
    () => d3line().x((d) => x(d[xKey])).y((d) => y(d[yKey]))(decades),
    [decades, x, y, xKey, yKey],
  )

  const cur = decades[active]
  const [xLow, xName, xHigh] = splitAxis(xLabel)
  const [yLow, yName, yHigh] = splitAxis(yLabel)
  // The "← sadder / happier →" descriptors are the first thing to collide once the plot is a phone
  // wide, and they are the most expendable: the axis name alone still says what the axis is.
  const ends = D.ends
  // The decade label sits to the right of the dot — except when the dot is near the right edge,
  // where the outermost svg (which clips by default) would cut it to "192". Then it goes left.
  const gap = D.rNow + 12
  const flip = x(cur[xKey]) + gap + D.labelW > W

  return (
    <svg className={`moodspace ${compact ? 'compact' : ''}`} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Position for the ${cur.decade}s: ${xName} ${cur[xKey]}, ${yName} ${cur[yKey]}`}>
      {/* gridlines + numeric ticks */}
      {x.ticks(D.ticks).map((t) => (
        <g key={`x${t}`}>
          <line className="ms-grid" x1={x(t)} x2={x(t)} y1={M.t} y2={H - M.b} />
          <text className="ms-tick" x={x(t)} y={H - M.b + D.tickGap} textAnchor="middle">{t.toFixed(2)}</text>
        </g>
      ))}
      {y.ticks(D.ticks).map((t) => (
        <g key={`y${t}`}>
          <line className="ms-grid" x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} />
          <text className="ms-tick" x={M.l - 8} y={y(t)} dy="0.32em" textAnchor="end">{t.toFixed(2)}</text>
        </g>
      ))}
      {/* axes */}
      <line className="ms-axis-line" x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} />
      <line className="ms-axis-line" x1={M.l} x2={M.l} y1={M.t} y2={H - M.b} />

      {/* axis direction labels — descriptors pushed to the plot's edges, name centred */}
      {ends && xLow && <text className="ms-axis" x={M.l} y={H - D.axisY} textAnchor="start">{xLow}</text>}
      <text className="ms-axis ms-axis-title" x={(M.l + W - M.r) / 2} y={H - D.axisY} textAnchor="middle">{xName}</text>
      {ends && xHigh && <text className="ms-axis" x={W - M.r} y={H - D.axisY} textAnchor="end">{xHigh}</text>}
      {ends && yLow && (
        <text className="ms-axis" transform={`translate(${D.yAxisX},${H - M.b}) rotate(-90)`} textAnchor="start">{yLow}</text>
      )}
      <text className="ms-axis ms-axis-title" transform={`translate(${D.yAxisX},${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">
        {yName}
      </text>
      {ends && yHigh && (
        <text className="ms-axis" transform={`translate(${D.yAxisX},${M.t}) rotate(-90)`} textAnchor="end">{yHigh}</text>
      )}

      {/* the century path */}
      <path className="ms-path" d={path} />

      {/* every decade as a small marker; past = a touch brighter than future */}
      {decades.map((d, i) => (
        <circle
          key={d.decade}
          cx={x(d[xKey])}
          cy={y(d[yKey])}
          r={D.dot}
          className={`ms-dot ${i <= active ? 'past' : 'future'}`}
        />
      ))}

      {/* the spotlighted current decade (position animates); colour = journey accent */}
      <g className="ms-now" style={{ transform: `translate(${x(cur[xKey])}px, ${y(cur[yKey])}px)`, '--accent': accent }}>
        <circle className="ms-now-halo" r={D.rNow + 7} />
        <circle className="ms-now-core" r={D.rNow} />
        <text className="ms-now-label" x={flip ? -gap : gap} textAnchor={flip ? 'end' : 'start'} dy="0.32em">
          {cur.decade}s
        </text>
      </g>
    </svg>
  )
}
