import { useInView, playDecade, scrollToReadingLine, MEASURES } from '../lib.js'

// One card per bar chart: what it counts, in plain words.
function Dial({ measure, role }) {
  const m = MEASURES[measure]
  return (
    <div className="dial">
      <div className="kicker">{role}</div>
      <div className="dial-name" style={{ color: m.color }}>Songs that {m.says}</div>
      <div className="dial-desc">{m.rule}</div>
    </div>
  )
}

// The screen that opens each journey: the century-long arc in one line, then the two measures the
// bars count, then the invitation. Both cards are derived from the journey's `measures` via
// MEASURES, so a new journey needs no changes here.
export default function JourneyIntro({ journey }) {
  const [ref, seen] = useInView()
  const { measures, tab, intro } = journey

  return (
    <section ref={ref} className={`journey-intro ${seen ? 'in' : ''}`} aria-label={`About ${tab}`}>
      <div className="kicker">{tab}</div>
      <h2>{intro.title}</h2>
      <p className="lede">{intro.hook}</p>

      <div className="intro-dials">
        <Dial measure={measures[0]} role="top chart" />
        <Dial measure={measures[1]} role="bottom chart" />
      </div>

      {/* The first decade's song starts in the click itself, or Safari will not start it (playSong). */}
      <button className="explore-btn" onClick={() => { scrollToReadingLine('.step'); playDecade(0) }}>
        Dive in ↓
      </button>
    </section>
  )
}
