import { useEffect } from 'react'
import { pauseAllBut, playDecade, useActiveStep, useAutoplay, useDebounced, useIsMobile, useOnePlayerAtATime, usePlayedTracks, useSectionAtLine, useSizeVar } from '../lib.js'
import DecadeArrows from './DecadeArrows.jsx'
import ShareBars from './ShareBars.jsx'
import TrackEmbed from './TrackEmbed.jsx'

// The journey, in two shapes. The active `journey` (chosen by the toggle in the hero) swaps the
// bar chart, the tracks and the captions in both; what the bars count comes from the journey's
// `measures`.
//
// Desktop: a sticky bar-chart graphic beside a scrolling column of per-decade steps.
//
// Mobile: the same decades as a deck of full-screen pages, each one whole — its own compact chart,
// the decade, the caption, the songs and a Next button — moving as one card. Vertical swipe moves
// through time, horizontal swipe moves through a decade's songs.
//
// Both shapes keep the `.step[data-step]` contract: useActiveStep's observer, the decade arrows
// and check-scroll all address a decade through it.
export default function Journey({ decades, tracks, journey }) {
  const mobile = useIsMobile()
  const [active, setRef] = useActiveStep(decades.length)
  // Plane + captions follow scroll instantly; the visible embed swaps once scrolling
  // settles, so a fast scroll doesn't thrash which players are shown.
  const settled = useDebounced(active)
  // Starting one song preview pauses whichever other one is playing, and settling on another
  // decade pauses them all. Off `settled`, so a scroll that snaps back does not stop the music.
  useOnePlayerAtATime(settled)
  const played = usePlayedTracks()
  // Desktop: the player stack's height as --embed-h, which lets the captions centre on the plane
  // rather than the viewport (see .step-inner in index.css).
  const stackRef = useSizeVar('--embed-h', '.journey', mobile)

  const songs = (i) => tracks[journey.id]?.[String(decades[i].decade)]
  // Arriving at a decade plays its first song, as the quick version does. Off the reading line
  // rather than `settled` — which is 0 before the journey is even reached, so the 1920s would start
  // from the hero — and debounced the same way, so scrolling past a decade does not start it.
  const here = useDebounced(useSectionAtLine('.journey .step'))
  const first = here >= 0 ? songs(here)?.[0] : null
  useAutoplay(first ? `.journey iframe[src*="/track/${first.id}"]` : null)
  // Off the journey (hero, explainer, coda, footer) no player is in view, so nothing plays on —
  // unless the quick version is open on top, whose songs are its own.
  useEffect(() => {
    if (here < 0 && !document.querySelector('.qf')) pauseAllBut(null)
  }, [here])
  // The decade being read: its first song is what "Tap to play" may offer. Whether that player has
  // played is Player's to know — the same song played in the quick version is another player.
  const armed = (i) => i === here && i === settled && !!songs(i)?.[0]
  // A decade whose players have been played stays mounted outside the window: removing a played
  // Spotify embed stalls every one played after it (usePlayedTracks).
  const inWindow = (i) => Math.abs(i - settled) <= 1 || !!songs(i)?.slice(0, 3).some((t) => played.has(t.id))
  const caption = (d, i) => (
    <div className={`step-inner ${i === active ? 'active' : ''}`}>
      <div className="step-decade">{d.decade}s</div>
      <p>{journey.captions[d.decade]}</p>
    </div>
  )

  if (mobile) {
    // One page on, and that page's song started inside the tap — the only way iOS lets it start
    // (playSong). After the last decade, on to whatever follows the deck.
    const next = (i) => {
      const to = i + 1 < decades.length
        ? document.querySelector(`.journey .step[data-step="${i + 1}"]`)
        : document.querySelector('.journey ~ .beat, .journey ~ .footer')
      to?.scrollIntoView({ block: 'start' })
      playDecade(i + 1)
    }
    return (
      <section className="journey deck" aria-label="The journey through the decades">
        {decades.map((d, i) => (
          <div className="step deck-page" key={d.decade} data-step={i} ref={setRef(i)}>
            <ShareBars decades={decades} active={i} measures={journey.measures} compact />
            {caption(d, i)}
            {/* The same ±1 window desktop uses, and for the same reason: an iframe that mounts as
                you arrive is a blank rectangle for as long as Spotify takes to answer, and you
                watch it happen. Neighbours are off-screen on their own pages, so they cost nothing
                to show — they are just already loaded when you get there, and a Next tap can start
                them. Off the debounced `settled` rather than `active`, so a swipe that enters the
                next page's band and snaps back does not tear down and rebuild six cross-origin
                iframes for a gesture that went nowhere. The slot holds their height regardless, so
                nothing reflows on arrival. */}
            <div className="embed-slot">
              {inWindow(i) && (
                <TrackEmbed tracks={songs(i)} decade={d.decade} step={i} active carousel armed={armed(i)} />
              )}
            </div>
            <button className="next-btn deck-next" onClick={() => next(i)}>
              {i + 1 < decades.length ? `Next: ${decades[i + 1].decade}s` : 'Keep going'} <span aria-hidden="true">↓</span>
            </button>
          </div>
        ))}
      </section>
    )
  }

  // Mount the settled decade's players alongside its neighbours. All stay loaded and painted
  // (the .embed-stack cross-fade only toggles opacity), so neighbours preload while you read
  // and the next decade's players are already there when you scroll in. Window stays ≤3 decades,
  // plus any decade whose players have been played.
  const windowIdx = decades.map((_, i) => i).filter(inWindow)

  return (
    <section className="journey" aria-label="The journey through the decades">
      {/* Fixed-position, so not a grid item — it adds no column and no gutter. First in the DOM so
          a keyboard reader meets the step-a-section control before the column it navigates.
          Desktop only: on the deck a swipe is the pager, and the arrows' right gutter cost ~54px
          of a 375px screen. */}
      <DecadeArrows count={decades.length} active={active} />

      <div className="journey-graphic">
        <ShareBars decades={decades} active={active} measures={journey.measures} />
        <div className="embed-stack" ref={stackRef}>
          {windowIdx.map((i) => (
            <TrackEmbed
              key={i}
              tracks={songs(i)}
              decade={decades[i].decade}
              step={i}
              active={i === settled}
              armed={armed(i)}
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
