import { useState, useEffect } from 'react'
import {
  useData,
  useSettleToStep,
  scrollToIntro as toIntro,
  scrollToTop as toTop,
  JOURNEYS,
  VAR_INFO,
} from './lib.js'
import Journey from './components/Journey.jsx'
import JourneyIntro from './components/JourneyIntro.jsx'
import Beat from './components/Beat.jsx'
import { WorldChart } from './charts/WorldChart.jsx'

export default function App() {
  const data = useData()
  const [jid, setJid] = useState(JOURNEYS[0].id)
  const [showTop, setShowTop] = useState(false)
  useSettleToStep('.step')

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > window.innerHeight * 0.8)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!data) {
    return <div className="loading">Loading a century of music…</div>
  }

  const { decades } = data.timeline
  const journey = JOURNEYS.find((j) => j.id === jid)
  const accent = VAR_INFO[journey.y].color // each journey's accent = its y-axis colour

  return (
    <div className="app" style={{ '--accent': accent }}>
      <header className="topbar">
        <span className="brand">The Sound of Time</span>
        <span className="topbar-sub">How a century changed its tune.</span>
      </header>

      <section className="hero">
        <p className="hero-kicker">100 years of recorded music · 1920s → 2020s</p>
        <h1>
          Music from the 1920s is <em>different</em>.
          <br />
          But <span className="hl">how</span>?
        </h1>
        <p className="hero-lede">
          Every song Spotify knows carries a handful of numbers — how positive it sounds, how
          intense, how danceable, whether it’s in a major or minor key. Line up a century of them
          and the sound of music turns out to have shifted in clear, and often surprising, ways —
          several threads that don’t all point the same direction. Pick a story below and travel it
          decade by decade.
        </p>
        <div id="stories" className="story-toggle" role="tablist" aria-label="Pick a story">
          {JOURNEYS.map((j) => (
            <button
              key={j.id}
              role="tab"
              aria-selected={j.id === jid}
              className={`story-seg ${j.id === jid ? 'active' : ''}`}
              style={{ '--seg-accent': VAR_INFO[j.y].color }}
              onClick={() => {
                if (j.id !== jid) {
                  setJid(j.id)
                  toIntro() // its "Dive in" button takes it from there
                }
              }}
            >
              {j.tab}
            </button>
          ))}
        </div>
        <button className="explore-btn scroll-cue" onClick={toIntro}>
          scroll to travel through time <span className="cue-arrow">↓</span>
        </button>
      </section>

      {/* Keyed so switching stories remounts the explainer and its reveal replays. */}
      <JourneyIntro key={journey.id} journey={journey} />

      <Journey decades={decades} tracks={data.tracks} journey={journey} />

      {journey.coda && (
        <Beat
          kicker="Coda"
          title="Does music mirror the world?"
          lede="You’d think harder times make sadder songs. Tested against the economy and against how people say they feel, music’s mood tracks neither — it follows a path of its own."
        >
          <WorldChart world={data.world} />
        </Beat>
      )}

      <div className="explore-more">
        <button className="explore-btn" onClick={toTop}>
          ↑ Explore another journey
        </button>
      </div>

      <footer className="footer">
        <p>
          <b>The takeaway:</b> across a century, music grew <em>more intense</em> (electrification),
          <em> more minor-key</em> (a steady tonal darkening), and <em>a little less positive</em> —
          though by a wandering route: a mid-century low, a seventies rebound, then a slide that’s
          still going. Three threads that don’t all point the same way, and none of which simply
          mirror the world around them. Why the darkening? Likely genre, the streaming economy, and
          culture — but that’s the next question, not this dataset’s answer.
        </p>
        <p className="credits">
          Built from ~587k tracks (1922–2021) + US economic series (FRED). An exploratory,
          correlational read — see the notebooks for methods and caveats. Song previews via Spotify.
        </p>
      </footer>

      <button
        className={`to-top ${showTop ? 'show' : ''}`}
        aria-label="Jump to the top"
        onClick={toTop}
      >
        ↑ Jump to top
      </button>
    </div>
  )
}
