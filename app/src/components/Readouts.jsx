import { useMemo } from 'react'
import { scaleLinear } from 'd3-scale'
import { line as d3line } from 'd3-shape'
import { extent } from 'd3-array'
import { DIALS } from '../lib.js'

const W = 150
const H = 40

function Sparkline({ decades, dialKey, color, active }) {
  // Scales + path depend only on the (stable) data, not the scroll-driven `active`.
  const { x, y, path } = useMemo(() => {
    const x = scaleLinear().domain([0, decades.length - 1]).range([3, W - 3])
    const y = scaleLinear().domain(extent(decades, (d) => d[dialKey])).range([H - 5, 5])
    return { x, y, path: d3line().x((_, i) => x(i)).y((d) => y(d[dialKey]))(decades) }
  }, [decades, dialKey])
  return (
    <svg className="spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={path} stroke={color} className="spark-line" />
      <circle cx={x(active)} cy={y(decades[active][dialKey])} r="3.5" fill={color} stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  )
}

// The four dials that travel with the journey.
export default function Readouts({ decades, active }) {
  const cur = decades[active]
  return (
    <div className="readouts">
      {DIALS.map((dial) => (
        <div className="dial" key={dial.key}>
          <div className="dial-head">
            <span className="dial-label">{dial.label}</span>
            <span className="dial-value" style={{ color: dial.color }}>
              {dial.fmt(cur[dial.key])}
            </span>
          </div>
          <Sparkline decades={decades} dialKey={dial.key} color={dial.color} active={active} />
          <div className="dial-sub">{dial.sub}</div>
        </div>
      ))}
    </div>
  )
}
