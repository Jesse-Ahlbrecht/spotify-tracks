import { useActiveStep, useDebounced, useIsMobile, useSizeVar, VAR_INFO } from '../lib.js'
import DecadeArrows from './DecadeArrows.jsx'
import MoodSpace from './MoodSpace.jsx'
import TrackEmbed from './TrackEmbed.jsx'

// The journey, in two shapes. The active `journey` (chosen by the toggle in the hero) swaps the
// plane, the tracks and the captions in both; axis labels and the accent colour come from VAR_INFO,
// keyed by the journey's x/y metric names.
//
// Desktop: a sticky decade-path graphic beside a scrolling column of per-decade steps.
//
// Mobile: the same decades as a deck of full-screen pages under one pinned compact plane —
// vertical swipe moves through time, horizontal swipe moves through a decade's songs. The stacked
// desktop layout asked a 700px phone screen to hold the plane, a player AND a caption, and the
// caption was what fell off the bottom; giving each decade its own screen is what makes room.
//
// Both shapes keep the `.step[data-step]` contract: useActiveStep's observer, the decade arrows
// and check-scroll all address a decade through it.
export default function Journey({ decades, tracks, journey }) {
  const mobile = useIsMobile()
  const [active, setRef] = useActiveStep(decades.length)
  // Plane + captions follow scroll instantly; the visible embed swaps once scrolling
  // settles, so a fast scroll doesn't thrash which players are shown.
  const settled = useDebounced(active)
  // Desktop: the player stack's height as --embed-h, which lets the captions centre on the plane
  // rather than the viewport (see .step-inner in index.css).
  const stackRef = useSizeVar('--embed-h', '.journey')
  // Mobile: the pinned plane's height as --plane-h, which is how far each page pads its top to
  // clear it. Measured for the same reason --embed-h is — it moves with the viewport.
  const planeRef = useSizeVar('--plane-h', '.journey')

  const plane = (compact) => (
    <MoodSpace
      decades={decades}
      active={active}
      xKey={journey.x}
      yKey={journey.y}
      xLabel={VAR_INFO[journey.x].axis}
      yLabel={VAR_INFO[journey.y].axis}
      flipY={journey.flipY}
      accent={VAR_INFO[journey.y].color}
      compact={compact}
    />
  )
  const songs = (i) => tracks[journey.id]?.[String(decades[i].decade)]
  const caption = (d, i) => (
    <div className={`step-inner ${i === active ? 'active' : ''}`}>
      <div className="step-decade">{d.decade}s</div>
      <p>{journey.captions[d.decade]}</p>
    </div>
  )

  if (mobile) {
    return (
      <section className="journey deck" aria-label="The journey through the decades">
        <div className="deck-plane" ref={planeRef}>{plane(true)}</div>
        {decades.map((d, i) => (
          <div className="step deck-page" key={d.decade} data-step={i} ref={setRef(i)}>
            {caption(d, i)}
            {/* The same ±1 window desktop uses, and for the same reason: an iframe that mounts as
                you arrive is a blank rectangle for as long as Spotify takes to answer, and you
                watch it happen. Neighbours are off-screen on their own pages, so they cost nothing
                to show — they are just already loaded when you get there. Off the debounced
                `settled` rather than `active`, so a swipe that enters the next page's band and
                snaps back does not tear down and rebuild six cross-origin iframes for a gesture
                that went nowhere; 140ms is well inside the snap, and the page you land on was
                already in the window. The slot holds their height regardless, so nothing
                reflows on arrival. */}
            <div className="embed-slot">
              {Math.abs(i - settled) <= 1 && (
                <TrackEmbed tracks={songs(i)} decade={d.decade} active carousel />
              )}
            </div>
          </div>
        ))}
      </section>
    )
  }

  // Mount the settled decade's players alongside its neighbours. All stay loaded and painted
  // (the .embed-stack cross-fade only toggles opacity), so neighbours preload while you read
  // and the next decade's players are already there when you scroll in. Window stays ≤3 decades.
  const windowIdx = [settled - 1, settled, settled + 1].filter((i) => i >= 0 && i < decades.length)

  return (
    <section className="journey" aria-label="The journey through the decades">
      {/* Fixed-position, so not a grid item — it adds no column and no gutter. First in the DOM so
          a keyboard reader meets the step-a-section control before the column it navigates.
          Desktop only: on the deck a swipe is the pager, and the arrows' right gutter cost ~54px
          of a 375px screen. */}
      <DecadeArrows count={decades.length} active={active} />

      <div className="journey-graphic">
        {plane(false)}
        <div className="embed-stack" ref={stackRef}>
          {windowIdx.map((i) => (
            <TrackEmbed
              key={i}
              tracks={songs(i)}
              decade={decades[i].decade}
              active={i === settled}
            />
          ))}
        </div>
      </div>

      <div className="journey-steps">
        {decades.map((d, i) => (
          <div className="step" key={d.decade} data-step={i} ref={setRef(i)}>
            {caption(d, i)}
          </div>
        ))}
      </div>
    </section>
  )
}
