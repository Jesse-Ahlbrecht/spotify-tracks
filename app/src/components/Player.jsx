import { useEffect, useRef, useState } from 'react'
import { isReady, justAsked, needsTap, noteNeedsTap, playSong } from '../lib.js'

const VERB = window.matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click'

// One Spotify preview player, used by both journeys. The slot is dark in the embed's own colour and
// the iframe stays invisible until it has loaded, so loading reads as a dark card, not a white box.
//
// `armed`: this is the song that should be playing now. Until this player has played once, the
// browser may refuse to start it without a tap (see playSong). Where only a tap can start it
// (needsTap in lib.js), a button of our own offers it as soon as the embed takes commands — a tap on
// it is a gesture the browser accepts. Elsewhere the button waits 1.2s for the browser to start the
// song by itself, and so does it after a tap that has just asked for this song.
export default function Player({ track, lazy, armed }) {
  const ref = useRef(null)
  const [loaded, setLoaded] = useState(false)
  const [ready, setReady] = useState(false) // a `play` before the embed's `ready` does nothing
  const [played, setPlayed] = useState(false) // from then on it starts without a tap
  const [late, setLate] = useState(false)
  useEffect(() => {
    const onMessage = (e) => {
      if (e.source !== ref.current?.contentWindow) return
      if (isReady(e.source)) setReady(true)
      if (e.data?.type === 'playback_update' && e.data.payload?.isPaused === false) setPlayed(true)
    }
    addEventListener('message', onMessage)
    return () => removeEventListener('message', onMessage)
  }, [])
  const waiting = armed && ready && !played
  useEffect(() => {
    setLate(false)
    if (!waiting) return
    const asked = justAsked(ref.current?.contentWindow)
    const t = setTimeout(() => {
      setLate(true)
      // Not started although the page has had a tap or click: this browser needs one per song.
      if (!asked && navigator.userActivation?.hasBeenActive) noteNeedsTap()
    }, needsTap() && !asked ? 0 : 1200)
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
        onLoad={() => {
          setLoaded(true)
          if (isReady(ref.current?.contentWindow)) setReady(true)
        }}
      />
      {waiting && late && (
        <button className="tap-play" onClick={() => playSong(ref.current?.contentWindow)}>
          <span>▶ {VERB} to play</span>
        </button>
      )}
    </div>
  )
}
