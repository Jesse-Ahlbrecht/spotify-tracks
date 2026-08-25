import { useMemo, useRef, useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { line as d3line, area as d3area } from 'd3-shape'
import { extent, bisector } from 'd3-array'
import { useIsMobile } from '../lib.js'

// Two geometries, for the reason MoodSpace has two: the svg sizes by viewBox alone, so its font
// sizes are user units and a 720-wide box in a phone column renders 12px ticks at ~6px. `compact`
// is picked so one user unit is about one CSS px at phone width.
// The wide right margin exists only to park the direct labels; compact drops those and reclaims
// all of it, because the HTML legend above already names every series.
const DIMS = {
  wide: { W: 720, H: 400, M: { t: 20, r: 120, b: 46, l: 52 }, xTicks: 6, direct: true },
  compact: { W: 340, H: 250, M: { t: 12, r: 14, b: 40, l: 40 }, xTicks: 4, direct: false },
}

// Shared multi-series line/area chart: one y-axis (never dual), legend + direct
// labels, recessive grid, and a crosshair+tooltip hover layer.
export default function LineFig({
  data,
  xKey,
  series,
  yDomain,
  yTicks = 5,
  fmtY = (v) => v,
  fmtX = (v) => v,
  xLabel,
  yLabel,
  caption,
}) {
  const [hover, setHover] = useState(null)
  const wrapRef = useRef(null)
  const D = useIsMobile() ? DIMS.compact : DIMS.wide
  const { W, H, M } = D

  const x = useMemo(
    () => scaleLinear().domain(extent(data, (d) => d[xKey])).range([M.l, W - M.r]),
    [data, xKey, M, W],
  )
  const y = useMemo(() => {
    const dom =
      yDomain ??
      extent(
        data.flatMap((d) => series.map((s) => d[s.key])).filter((v) => v != null),
      )
    return scaleLinear().domain(dom).nice().range([H - M.b, M.t])
  }, [data, series, yDomain, M, H])

  // Paths depend only on data + scales, not on hover — memoize so mouse-moves don't
  // rebuild/re-run the d3 generators.
  const paths = useMemo(() => {
    const lines = {}
    const areas = {}
    for (const s of series) {
      lines[s.key] = d3line()
        .defined((d) => d[s.key] != null)
        .x((d) => x(d[xKey]))
        .y((d) => y(d[s.key]))(data)
      if (s.area) {
        areas[s.key] = d3area()
          .defined((d) => d[s.key] != null)
          .x((d) => x(d[xKey]))
          .y0(y(y.domain()[0]))
          .y1((d) => y(d[s.key]))(data)
      }
    }
    return { lines, areas }
  }, [data, series, x, y, xKey])

  const bis = useMemo(() => bisector((d) => d[xKey]).center, [xKey])
  const onMove = (e) => {
    const r = wrapRef.current.getBoundingClientRect()
    const svgX = ((e.clientX - r.left) / r.width) * W
    const xv = x.invert(Math.max(M.l, Math.min(W - M.r, svgX)))
    setHover(bis(data, xv))
  }
  // On touch, `pan-y` means a swipe with any vertical component is claimed by the browser, which
  // fires pointercancel and never pointerleave — so without this the tooltip stays up for good.
  const clear = () => setHover(null)

  // Direct labels park in the right margin at their line's end height, nudged apart
  // so they never overlap or clip. Empty on the compact geometry, which has no right margin to
  // park them in — gated here rather than at the call site so the work is skipped, not discarded.
  const directLabels = useMemo(() => {
    if (!D.direct) return []
    const labelX = W - M.r + 10
    const lastPoint = (k) => data.findLast((d) => d[k] != null) ?? null
    const labels = series
      .map((s) => {
        const p = lastPoint(s.key)
        return p ? { key: s.key, color: s.color, label: s.label, x: labelX, y: y(p[s.key]) } : null
      })
      .filter(Boolean)
      .sort((a, b) => a.y - b.y)
    for (let i = 1; i < labels.length; i++) {
      if (labels[i].y - labels[i - 1].y < 16) labels[i].y = labels[i - 1].y + 16
    }
    return labels
  }, [data, series, y, D.direct, W, M])

  return (
    <figure className="fig">
      <div className="fig-legend">
        {series.map((s) => (
          <span key={s.key} className="legend-item">
            <span className="swatch" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <div
        className="fig-plot"
        ref={wrapRef}
        onPointerMove={onMove}
        onPointerLeave={clear}
        onPointerCancel={clear}
        onPointerUp={clear}
      >
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={caption}>
          {/* horizontal gridlines + y ticks */}
          {y.ticks(yTicks).map((t) => (
            <g key={t}>
              <line className="grid" x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} />
              <text className="tick" x={M.l - 8} y={y(t)} dy="0.32em" textAnchor="end">
                {fmtY(t)}
              </text>
            </g>
          ))}
          {/* x ticks */}
          {x.ticks(D.xTicks).map((t) => (
            <text key={t} className="tick" x={x(t)} y={H - M.b + 20} textAnchor="middle">
              {fmtX(t)}
            </text>
          ))}
          <line className="axis" x1={M.l} x2={W - M.r} y1={H - M.b} y2={H - M.b} />

          {/* areas then lines */}
          {series.filter((s) => s.area).map((s) => (
            <path key={s.key} d={paths.areas[s.key]} fill={s.color} opacity="0.14" />
          ))}
          {series.map((s) => (
            <path
              key={s.key}
              className="series-line"
              d={paths.lines[s.key]}
              stroke={s.color}
              strokeDasharray={s.dashed ? '5 4' : undefined}
            />
          ))}

          {/* direct labels parked in the right margin, de-collided */}
          {directLabels.map((l) => (
            <g key={l.key} transform={`translate(${l.x},${l.y})`}>
              <circle r="3" fill={l.color} />
              <text className="direct-label" x="8" dy="0.32em">
                {l.label}
              </text>
            </g>
          ))}

          {/* hover crosshair + points */}
          {hover != null && (
            <g>
              <line
                className="crosshair"
                x1={x(data[hover][xKey])}
                x2={x(data[hover][xKey])}
                y1={M.t}
                y2={H - M.b}
              />
              {series.map((s) =>
                data[hover][s.key] == null ? null : (
                  <circle
                    key={s.key}
                    cx={x(data[hover][xKey])}
                    cy={y(data[hover][s.key])}
                    r="4"
                    fill={s.color}
                    stroke="var(--surface)"
                    strokeWidth="2"
                  />
                ),
              )}
            </g>
          )}

          {yLabel && (
            <text className="axis-label" transform={`translate(14,${(M.t + H - M.b) / 2}) rotate(-90)`} textAnchor="middle">
              {yLabel}
            </text>
          )}
          {xLabel && (
            <text className="axis-label" x={(M.l + W - M.r) / 2} y={H - 6} textAnchor="middle">
              {xLabel}
            </text>
          )}
        </svg>

        {hover != null && (
          <div
            className="tooltip"
            style={{
              left: `${(x(data[hover][xKey]) / W) * 100}%`,
              transform: x(data[hover][xKey]) > W / 2 ? 'translateX(-108%)' : 'translateX(8%)',
            }}
          >
            <div className="tooltip-x">{fmtX(data[hover][xKey])}</div>
            {series.map((s) => (
              <div key={s.key} className="tooltip-row">
                <span className="swatch" style={{ background: s.color }} />
                {s.label}
                <b>{data[hover][s.key] == null ? '—' : fmtY(data[hover][s.key])}</b>
              </div>
            ))}
          </div>
        )}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  )
}
