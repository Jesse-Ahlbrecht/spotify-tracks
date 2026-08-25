import { useState } from 'react'

// The active decade's three representative tracks as compact Spotify players
// (most popular, nearest the decade's mood centre). Keyed by id so they reload on change.
//
// `carousel` is the mobile deck's shape: the three players sit in one horizontally snapping
// track you swipe between, with dots for position. The stacked layout used to show only the
// first and hide the other two, which is two thirds of the decade's music unreachable.
export default function TrackEmbed({ tracks, decade, active, carousel }) {
  const [at, setAt] = useState(0)
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
    <div className={`embed ${active ? 'show' : ''} ${carousel ? 'embed-plain' : ''}`}>
      {/* No caption on the carousel: the decade heading sits directly above it on a deck page, so
          "Sounds like the 1920s" says the decade twice. The dots cover the rest — they already
          show there are three and which one you are on. */}
      {!carousel && (
        <div className="embed-caption">
          Sounds like the <b>{decade}s</b> · 3 tracks nearest its centre
        </div>
      )}
      <div className="embed-list" onScroll={carousel ? onScroll : undefined}>
        {list.map((t) => (
          <iframe
            key={t.id}
            title={`${t.name} — ${t.artist}`}
            // theme=0 is Spotify's neutral embed. Without it each player takes a background
            // sampled from its album art, so a row of three is three unrelated colours fighting
            // the page — and the accent that means "this journey" stops meaning anything.
            src={`https://open.spotify.com/embed/track/${t.id}?theme=0`}
            width="100%"
            frameBorder="0"
            loading="lazy"
            allow="encrypted-media; clipboard-write"
          />
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
