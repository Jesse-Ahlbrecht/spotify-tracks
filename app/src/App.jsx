import { useData } from './lib.js'
import Journey from './components/Journey.jsx'
import Beat from './components/Beat.jsx'
import { EnergyDanceChart, SadChart, ElectrificationChart, WorldChart } from './charts/beats.jsx'

export default function App() {
  const data = useData()

  if (!data) {
    return <div className="loading">Loading a century of music…</div>
  }

  const { decades } = data.timeline

  return (
    <>
      <header className="topbar">
        <span className="brand">The Sound of Time</span>
        <span className="topbar-sub">100 years of mood</span>
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
          and music’s mood turns out to have moved in a clear, and slightly unsettling, direction.
        </p>
        <div className="scroll-cue">scroll to travel through time ↓</div>
      </section>

      <Journey decades={decades} tracks={data.tracks} />

      <Beat
        kicker="03"
        title="The beat gets harder"
        lede="Two of the dials move together and almost never stop: music got steadily more intense, and — after a mid-century dip — more danceable than ever."
      >
        <EnergyDanceChart decades={decades} />
      </Beat>

      <Beat
        kicker="04"
        title="Two kinds of sad"
        lede="Positivity is only one way to be down. The other is tonal — minor keys — and it has climbed relentlessly, giving us the modern “sad banger”: melancholy you can dance to."
      >
        <SadChart decades={decades} />
      </Beat>

      <Beat
        kicker="05"
        title="Why so intense?"
        lede="The energy climb isn’t really about feeling — it’s about wiring. As acoustic instruments gave way to electric and digital production, energy rose in near-perfect lockstep."
      >
        <ElectrificationChart decades={decades} />
      </Beat>

      <Beat
        kicker="06"
        title="Does music mirror the world?"
        lede="You’d think harder times make sadder songs. Tested against the economy and against how people say they feel, music’s mood tracks neither — it follows a path of its own."
      >
        <WorldChart world={data.world} />
      </Beat>

      <footer className="footer">
        <p>
          <b>The takeaway:</b> across a century, music grew <em>more intense</em> (electrification),
          <em> more minor-key</em> (a steady tonal darkening), and <em>a little less positive</em> —
          three threads that don’t all point the same way, and none of which simply mirror the world
          around them. Why the darkening? Likely genre, the streaming economy, and culture — but
          that’s the next question, not this dataset’s answer.
        </p>
        <p className="credits">
          Built from ~587k tracks (1922–2021) + US economic series (FRED). An exploratory,
          correlational read — see the notebooks for methods and caveats. Song previews via Spotify.
        </p>
      </footer>
    </>
  )
}
