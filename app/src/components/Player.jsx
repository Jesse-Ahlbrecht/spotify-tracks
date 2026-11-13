import { useEffect, useRef, useState } from 'react'
import { playSong } from '../lib.js'

const VERB = window.matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click'

// One Spotify preview player, used by both journeys. The slot is dark in the embed's own colour and
// the iframe stays invisible until it has loaded, so loading reads as a dark card, not a white box.
//
// `armed`: this is the song that should be playing now and has not played yet. If it has not
// started 1.2s after loading, the browser has refused to start it on its own (see playSong), so a
// button of our own offers it — a tap on it is a gesture the browser accepts.
export default function Player({ track, lazy, armed }) {
  const ref = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [late, setLate] = useState(false)
  const waiting = armed && loaded
  useEffect(() => {
    setLate(false)
    if (!waiting) return
    const t = setTimeout(() => setLate(true), 1200)
    return () => clearTimeout(t)
  }, [waiting])

  return (
    <div className={`player ${loaded ? 'loaded' : ''}`}>
      <iframe
        ref={ref}
        title={`${track.name} — ${track.artist}`}
        // theme=0 is Spotify's neutral embed. Without it each player takes a background
        // sampled from its album art, so a row of three is three unrelated colours fighting
        // the page — and the accent that means "this journey" stops meaning anything.
        src={`https://open.spotify.com/embed/track/${track.id}?theme=0`}
        frameBorder="0"
        loading={lazy ? 'lazy' : undefined}
        allow="autoplay; encrypted-media; clipboard-write"
        onLoad={() => setLoaded(true)}
      />
      {waiting && late && (
        <button className="tap-play" onClick={() => playSong(ref.current?.contentWindow)}>
          <span>▶ {VERB} to play</span>
        </button>
      )}
    </div>
  )
}
