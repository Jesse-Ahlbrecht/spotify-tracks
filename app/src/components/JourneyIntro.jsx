import { useInView, scrollToReadingLine, splitAxis, VAR_INFO } from '../lib.js'

// One dial card: what the metric is, and which way it runs on the plane.
function Dial({ metric, role }) {
  const v = VAR_INFO[metric]
  const [low, , high] = splitAxis(v.axis)
  return (
    <div className="dial">
      <div className="kicker">{role}</div>
      <div className="dial-name" style={{ color: v.color }}>{v.label}</div>
      <div className="dial-desc">{v.desc}</div>
      <div className="dial-arrow">{low} … {high}</div>
    </div>
  )
}

// The screen that opens each journey: the century-long arc in one line, then the two metrics the
// plane plots, then the invitation. Both cards are derived from the journey's x/y via VAR_INFO, so
// a new journey needs no changes here.
export default function JourneyIntro({ journey }) {
  const [ref, seen] = useInView()
  const { x, y, tab, intro } = journey

  return (
    <section ref={ref} className={`journey-intro ${seen ? 'in' : ''}`} aria-label={`About ${tab}`}>
      <div className="kicker">{tab}</div>
      <h2>{intro.title}</h2>
      <p className="lede">{intro.hook}</p>

      <div className="intro-dials">
        <Dial metric={x} role="horizontal axis" />
        <Dial metric={y} role="vertical axis" />
      </div>

      <button className="explore-btn" onClick={() => scrollToReadingLine('.step')}>
        Dive in ↓
      </button>
    </section>
  )
}
