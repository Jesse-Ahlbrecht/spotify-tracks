import { useActiveStep, DECADE_CAPTIONS } from '../lib.js'
import MoodSpace from './MoodSpace.jsx'
import Readouts from './Readouts.jsx'
import TrackEmbed from './TrackEmbed.jsx'

// Beats 1–2: the sticky mood-space graphic + a scrolling column of decade steps.
export default function Journey({ decades, tracks }) {
  const [active, setRef] = useActiveStep(decades.length)
  const cur = decades[active]
  const decadeTracks = tracks[String(cur.decade)]

  return (
    <section className="journey" aria-label="The journey through mood-space">
      <div className="journey-graphic">
        <MoodSpace decades={decades} active={active} />
        <Readouts decades={decades} active={active} />
        <TrackEmbed tracks={decadeTracks} decade={cur.decade} />
      </div>

      <div className="journey-steps">
        {decades.map((d, i) => (
          <div className="step" key={d.decade} data-step={i} ref={setRef(i)}>
            <div className={`step-inner ${i === active ? 'active' : ''}`}>
              <div className="step-decade">{d.decade}s</div>
              <p>{DECADE_CAPTIONS[d.decade]}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
