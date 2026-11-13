import { useLayoutEffect, useRef, useState } from 'react'
import Player from './Player.jsx'

// The active decade's three representative tracks as compact Spotify players
// (popular, and typical of the decade on the journey's two measures). Keyed by id so they reload on change.
//
// `carousel` is the mobile deck's shape: the three players sit in one horizontally snapping
// track you swipe between, with dots for position. The stacked layout used to show only the
// first and hide the other two, which is two thirds of the decade's music unreachable.
//
// `step` marks the group for playDecade (lib.js); `armed` is passed to the first player only — it
// is the song that starts on arrival. That one is never lazy: a tap that leads to the next decade
// can only start its song if that player has already loaded, a page away.
export default function TrackEmbed({ tracks, decade, step, active, carousel, armed }) {
  const [at, setAt] = useState(0)
  const groupRef = useRef(null)
  useLayoutEffect(() => {
    // Inert prevents new focus, but an already focused cross-origin frame can retain it.
    if (!active && groupRef.current?.contains(document.activeElement)) {
      const visiblePlayer = groupRef.current.closest('.embed-stack')?.querySelector('.embed.show iframe')
      if (visiblePlayer) visiblePlayer.focus()
      else document.activeElement?.blur()
    }
  }, [active])
  if (!tracks || tracks.length === 0) return null
  const list = tracks.slice(0, 3)

  // Which player is centred, from the scroll offset — no drag library, the browser's own
  // horizontal snap does the moving and this only reads the result back.
  const onScroll = (e) => {
    const el = e.currentTarget
    const i = Math.round(el.scrollLeft / el.clientWidth)
    if (i !== at) setAt(i)
  }

  return (
    <div ref={groupRef} data-songs={step} inert={!active} aria-hidden={active ? undefined : true} className={`embed ${active ? 'show' : ''} ${carousel ? 'embed-plain' : ''}`}>
      {/* No caption on the carousel: the decade heading sits directly above it on a deck page, so
          "Sounds like the 1920s" says the decade twice. The dots cover the rest — they already
          show there are three and which one you are on. */}
      {!carousel && (
        <div className="embed-caption">
          Sounds like the <b>{decade}s</b> · 3 songs typical of the decade
        </div>
      )}
      <div className="embed-list" onScroll={carousel ? onScroll : undefined}>
        {list.map((t, i) => (
          <Player key={t.id} track={t} lazy={i > 0} armed={armed && i === 0} />
        ))}
      </div>
      {carousel && list.length > 1 && (
        // Decorative: the players themselves are the content, and each is reachable by swiping.
        <div className="embed-dots" aria-hidden="true">
          {list.map((t, i) => (
            <span key={t.id} className={`embed-dot ${i === at ? 'on' : ''}`} />
          ))}
        </div>
      )}
    </div>
  )
}
