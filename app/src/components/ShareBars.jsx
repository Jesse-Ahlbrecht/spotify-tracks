import { useLayoutEffect, useRef, useState } from 'react'
import { scaleBand, scaleLinear } from 'd3-scale'
import { MEASURES, usePlaneRoomy } from '../lib.js'

// The journey's chart (sticky on desktop, one per page on the phone deck): for each of the journey's two measures, one bar per decade showing
// the share of that decade's songs that pass it ("% of songs that are high-energy"). Bars fill in
// up to the decade being read; later decades are empty slots until the reader gets there. Shares,
// not Spotify's 0–1 scores, because a share of songs needs no explaining.
//
// Desktop: the chart fills its card. The card's height is whatever the sticky column leaves above
// the players, so a fixed-aspect viewBox letterboxed inside it, with dead bands above and below;
// instead the viewBox is the card's measured size, which also makes one user unit one CSS px.
// Phone: the deck sizes the card *from* the chart (height: auto), so there the geometry is fixed —
// `compact`, picked so one unit is about one CSS px at phone width, or `compactTall` on a tall
// phone, where the chart is the only thing on a deck page that can absorb height.
// The class stays `moodspace` — the name the layout CSS and check-scroll know the plane by.
const DIMS = {
  wide: { W: 560, H: 470, M: { t: 14, r: 24, b: 32, l: 58 }, pad: 24, gap: 26, titleH: 40, titleY: 20, axisY: 22 },
  compact: { W: 320, H: 210, M: { t: 4, r: 10, b: 16, l: 38 }, pad: 10, gap: 8, titleH: 19, titleY: 12, axisY: 12 },
  compactTall: { W: 320, H: 290, M: { t: 6, r: 10, b: 18, l: 38 }, pad: 10, gap: 14, titleH: 22, titleY: 13, axisY: 13 },
}
const pct = (v) => `${Math.round(v * 100)}%`
const short = (d) => `’${String(d).slice(2)}`

// The svg's own box, kept current — desktop only (see above).
function useBox(ref, on) {
  const [box, setBox] = useState(null)
  useLayoutEffect(() => {
    if (!on || !ref.current) return setBox(null)
    const ro = new ResizeObserver(([e]) => {
      const W = Math.round(e.contentRect.width), H = Math.round(e.contentRect.height)
      setBox((b) => (b && b.W === W && b.H === H ? b : { W, H }))
    })
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [ref, on])
  return box
}

export default function ShareBars({ decades, active, measures, compact }) {
  const ref = useRef(null)
  const roomy = usePlaneRoomy()
  const box = useBox(ref, !compact)
  const base = compact ? (roomy ? DIMS.compactTall : DIMS.compact) : DIMS.wide
  const D = box && box.W > 200 && box.H > 200 ? { ...base, ...box } : base
  const { W, H, M } = D
  const ph = (H - M.t - M.b - D.gap) / 2
  const x = scaleBand(decades.map((d) => d.decade), [M.l, W - M.r]).padding(0.22)
  const cur = decades[active]

  return (
    <svg ref={ref} className={`moodspace ${compact ? 'compact' : ''}`} viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`In the ${cur.decade}s: ` + measures.map((m) => `${pct(cur[MEASURES[m].field])} of songs ${MEASURES[m].says}`).join('; ')}>
      {measures.map((m, p) => {
        const { field, says, color } = MEASURES[m]
        const top = M.t + p * (ph + D.gap)
        const y = scaleLinear([0, 1], [top + ph, top + D.titleH])
        return (
          <g key={m}>
            <rect x={D.pad} y={top + D.titleY - (compact ? 9 : 12)} width={compact ? 9 : 12} height={compact ? 9 : 12} rx={2.5} fill={color} />
            <text className="ms-axis ms-axis-title sb-title" x={D.pad + (compact ? 14 : 19)} y={top + D.titleY}>% of songs that {says}</text>
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
            {/* half of all songs: the one reference line, labelled where a y-axis would be */}
            <line className="sb-half" x1={M.l - 4} x2={W - M.r} y1={y(0.5)} y2={y(0.5)} />
            <text className="ms-tick" x={M.l - 8} y={y(0.5)} dy="0.32em" textAnchor="end">50%</text>
            <text className="ms-now-label sb-value" x={x(cur.decade) + x.bandwidth() / 2} y={y(cur[field]) - 6} textAnchor="middle">
              {pct(cur[field])}
            </text>
          </g>
        )
      })}
      {/* every decade on the wide chart; every other one (plus the current) on a phone */}
      {decades.map((d, i) => (!compact || i % 2 === 0 || i === active) && (
        <text key={d.decade} className={`ms-tick ${i === active ? 'sb-now' : ''}`} x={x(d.decade) + x.bandwidth() / 2}
          y={H - M.b + D.axisY} textAnchor="middle">{short(d.decade)}</text>
      ))}
    </svg>
  )
}
