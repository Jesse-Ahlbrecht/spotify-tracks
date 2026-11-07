import { scaleBand, scaleLinear } from 'd3-scale'
import { MEASURES, usePlaneRoomy } from '../lib.js'

// The journey's sticky chart: for each of the journey's two measures, one bar per decade showing
// the share of that decade's songs that pass it ("75% of songs are high-energy"). Bars fill in up
// to the decade being read; later decades are empty slots until the reader gets there. Shares, not
// Spotify's 0–1 scores, because a share of songs needs no explaining.
//
// Two geometries, not one scaled down. The svg sizes by viewBox alone, so its font sizes are user
// units: shrinking a 560-wide chart into a phone column renders 13px ticks at ~7px. `compact` is
// picked so one user unit is about one CSS px at phone width, which keeps the type at its stated
// size. The class stays `moodspace` — the name the layout CSS and check-scroll know the plane by.
const DIMS = {
  wide: { W: 560, H: 470, M: { t: 12, r: 24, b: 30, l: 24 }, gap: 22, titleH: 34, titleY: 20, labelY: 20 },
  compact: { W: 320, H: 210, M: { t: 4, r: 10, b: 16, l: 10 }, gap: 8, titleH: 17, titleY: 12, labelY: 12 },
  // Same width, taller box: on a tall phone the chart is the only thing on a deck page that can
  // absorb height, and the squat box left 40% of the page empty.
  compactTall: { W: 320, H: 290, M: { t: 6, r: 10, b: 18, l: 10 }, gap: 14, titleH: 20, titleY: 13, labelY: 13 },
}
const pct = (v) => `${Math.round(v * 100)}%`
const short = (d) => `’${String(d).slice(2)}`

export default function ShareBars({ decades, active, measures, compact }) {
  const roomy = usePlaneRoomy()
  const D = compact ? (roomy ? DIMS.compactTall : DIMS.compact) : DIMS.wide
  const { W, H, M } = D
  const ph = (H - M.t - M.b - D.gap) / 2
  const x = scaleBand(decades.map((d) => d.decade), [M.l, W - M.r]).padding(0.22)
  const cur = decades[active]

  return (
    <svg className={`moodspace ${compact ? 'compact' : ''}`} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`In the ${cur.decade}s: ` + measures.map((m) => `${MEASURES[m].title.toLowerCase()}, ${pct(cur[MEASURES[m].field])}`).join('; ')}>
      {measures.map((m, p) => {
        const { field, title, color } = MEASURES[m]
        const top = M.t + p * (ph + D.gap)
        const y = scaleLinear([0, 1], [top + ph, top + D.titleH])
        return (
          <g key={m}>
            <text className="ms-axis ms-axis-title" x={M.l} y={top + D.titleY}>{title}</text>
            <text className="ms-tick" x={W - M.r} y={top + D.labelY} textAnchor="end">line = half of all songs</text>
            {decades.map((d, i) => (
              <g key={d.decade}>
                {/* the empty slot, so the decades still to come are visible as places */}
                <rect className="sb-slot" x={x(d.decade)} width={x.bandwidth()} y={y(1)} height={y(0) - y(1)} rx={3} />
                {i <= active && (
                  <rect x={x(d.decade)} width={x.bandwidth()} y={y(d[field])} height={y(0) - y(d[field])} rx={3}
                    fill={color} opacity={i === active ? 1 : 0.35} />
                )}
              </g>
            ))}
            <line className="sb-half" x1={M.l} x2={W - M.r} y1={y(0.5)} y2={y(0.5)} />
            <text className="ms-now-label sb-value" x={x(cur.decade) + x.bandwidth() / 2} y={y(cur[field]) - 6} textAnchor="middle">
              {pct(cur[field])}
            </text>
          </g>
        )
      })}
      {/* every decade on the wide chart; every other one (plus the current) on a phone */}
      {decades.map((d, i) => (!compact || i % 2 === 0 || i === active) && (
        <text key={d.decade} className={`ms-tick ${i === active ? 'sb-now' : ''}`} x={x(d.decade) + x.bandwidth() / 2}
          y={H - M.b + (compact ? 12 : 20)} textAnchor="middle">{short(d.decade)}</text>
      ))}
    </svg>
  )
}
