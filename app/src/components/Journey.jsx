import { useActiveStep, useDebounced, useSizeVar, VAR_INFO } from '../lib.js'
import MoodSpace from './MoodSpace.jsx'
import TrackEmbed from './TrackEmbed.jsx'

// The journey: a sticky decade-path graphic + a scrolling column of per-decade steps.
// The active `journey` (chosen by the toggle in the hero) swaps the plane, the tracks and
// the captions; the scroll column persists across switches. Axis labels and the accent
// colour are derived from VAR_INFO, keyed by the journey's x/y metric names.
export default function Journey({ decades, tracks, journey }) {
  const [active, setRef] = useActiveStep(decades.length)
  // Plane + captions follow scroll instantly; the visible embed swaps once scrolling
  // settles, so a fast scroll doesn't thrash which players are shown.
  const settled = useDebounced(active)
  // Publishes the player stack's height as --embed-h, which lets the captions centre on the plane
  // rather than the viewport (see .step-inner in index.css).
  const stackRef = useSizeVar('--embed-h', '.journey')

  // Mount the settled decade's players alongside its neighbours. All stay loaded and painted
  // (the .embed-stack cross-fade only toggles opacity), so neighbours preload while you read
  // and the next decade's players are already there when you scroll in. Window stays ≤3 decades.
  const windowIdx = [settled - 1, settled, settled + 1].filter((i) => i >= 0 && i < decades.length)

  return (
    <section className="journey" aria-label="The journey through the decades">
      <div className="journey-graphic">
        <MoodSpace
          decades={decades}
          active={active}
          xKey={journey.x}
          yKey={journey.y}
          xLabel={VAR_INFO[journey.x].axis}
          yLabel={VAR_INFO[journey.y].axis}
          sizeKey={journey.sizeKey}
          accent={VAR_INFO[journey.y].color}
        />
        <div className="embed-stack" ref={stackRef}>
          {windowIdx.map((i) => (
            <TrackEmbed
              key={i}
              tracks={tracks[journey.id]?.[String(decades[i].decade)]}
              decade={decades[i].decade}
              active={i === settled}
            />
          ))}
        </div>
      </div>

      <div className="journey-steps">
        {decades.map((d, i) => (
          <div className="step" key={d.decade} data-step={i} ref={setRef(i)}>
            <div className={`step-inner ${i === active ? 'active' : ''}`}>
              <div className="step-decade">{d.decade}s</div>
              <p>{journey.captions[d.decade]}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
