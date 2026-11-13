import { useEffect, useRef, useState } from 'react'
import { JOURNEYS, pauseAllBut, pauseAllSongs, playSong, useAutoplay, useIsMobile, usePlayedTracks } from '../lib.js'
import Player from './Player.jsx'
import './QuickFeed.css'

// The quick way through a story, beside the full journey. One full-screen vertical feed, one card
// per screen, the decade's song playing as each lands; nothing advances by itself. Phone: swipe, or
// the Next button at the bottom of each card. Desktop: scroll, the ↑ ↓ buttons, the decade timeline
// or the arrow keys.
//
// Cards: a start card, one per decade, and an end card. Each decade card says how the music feels
// then — a headline and one line of story (journey.quick, in lib.js) — with one song. Words and a
// song only: the charts and their numbers are the full journey's.

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
)
const Speaker = ({ on }) => (
  <Icon>
    <path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor" />
    {on ? <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
  </Icon>
)

export default function QuickFeed({ journey, decades, tracks, onClose, onFullJourney, onSwitch }) {
  const mobile = useIsMobile()
  const feedRef = useRef(null)
  const cardRefs = useRef([])
  const [active, setActive] = useState(0)
  const [sound, setSound] = useState(true)
  const played = usePlayedTracks() // played embeds stay mounted — removing one stalls the rest
  const count = decades.length + 2 // start + decades + end
  const isDecade = (c) => c > 0 && c < count - 1
  const next = JOURNEYS[(JOURNEYS.findIndex((j) => j.id === journey.id) + 1) % JOURNEYS.length]
  const frame = (card) => cardRefs.current[card]?.querySelector('iframe')?.contentWindow

  // The page behind does not scroll while this is open.
  useEffect(() => {
    const html = document.documentElement
    const was = html.style.overflow
    html.style.overflow = 'hidden'
    return () => { html.style.overflow = was }
  }, [])

  // Which card fills the screen is read from the scroll.
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) setActive(Number(e.target.dataset.card))
    }), { root: feedRef.current, threshold: 0.6 })
    cardRefs.current.forEach((el) => el && io.observe(el))
    return () => io.disconnect()
  }, [journey.id, mobile])

  // Back to the start card when the story changes.
  useEffect(() => { feedRef.current?.scrollTo({ top: 0 }); setActive(0) }, [journey.id])

  // Play the landing card's song, however the reader got there. (Starting one pauses the others —
  // useOnePlayerAtATime, mounted by the full journey, sees these embeds too.)
  useAutoplay(sound && isDecade(active) ? `.qf-card[data-card="${active}"] iframe` : null)
  // ...and silence any other card's song once this one is in front, however it got there. After a
  // swipe on iOS that leaves silence and "Tap to play", not the last decade playing on.
  useEffect(() => pauseAllBut(frame(active)), [active])

  const go = (card) => {
    const c = Math.max(0, Math.min(count - 1, card))
    cardRefs.current[c]?.scrollIntoView({ behavior: 'smooth' })
    return c
  }
  // A tap, click or key press: move, and start the landing card's song inside the handler — the
  // only way iOS Safari starts it (playSong). A swipe is not such a gesture; "Tap to play" covers it.
  const jump = (card) => {
    const c = go(card)
    if (sound) playSong(frame(c))
  }
  const step = (d) => jump(active + d)

  // Desktop: one wheel gesture = one card. Mandatory snapping alone pulls a wheel tick (~100px)
  // back to the full-screen card it came from, so the wheel steps the feed itself. A trackpad
  // flick is a burst of events with inertia, so after a step the rest of the burst is ignored
  // until the wheel has been quiet for a moment.
  useEffect(() => {
    const feed = feedRef.current
    if (mobile || !feed) return
    let quiet, locked = false
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return
      e.preventDefault()
      clearTimeout(quiet)
      quiet = setTimeout(() => (locked = false), 250)
      if (locked || Math.abs(e.deltaY) < 4) return
      locked = true
      go(Math.round(feed.scrollTop / feed.clientHeight) + Math.sign(e.deltaY))
    }
    const frame = feed.parentElement // the buttons and top bar too, not only the cards
    frame.addEventListener('wheel', onWheel, { passive: false })
    return () => { frame.removeEventListener('wheel', onWheel); clearTimeout(quiet) }
  }, [mobile])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') return onClose()
      const fwd = ['ArrowDown', 'ArrowRight', 'PageDown'].includes(e.key)
      const back = ['ArrowUp', 'ArrowLeft', 'PageUp'].includes(e.key)
      if (fwd || back) { e.preventDefault(); step(fwd ? 1 : -1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const toggleSound = () => {
    if (sound) pauseAllSongs() // whichever is playing, a song a tap has just asked for included
    else playSong(frame(active))
    setSound((s) => !s)
  }
  const cardProps = (card, cls) => ({ 'data-card': card, ref: (el) => (cardRefs.current[card] = el), className: `qf-card ${cls}` })

  return (
    <div className={`qf ${mobile ? 'phone' : 'desk'}`} role="dialog" aria-modal="true"
      aria-label={`${journey.tab}, quick version`} style={{ '--accent': journey.accent }}>
      <div className="qf-frame">
        <header className="qf-bar">
          <button className="qf-icon" onClick={onClose} aria-label="Close the quick version">✕</button>
          <span className="qf-where">{journey.tab}{isDecade(active) ? ` · ${decades[active - 1].decade}s` : ''}</span>
          <div className="qf-tools">
            <button className="qf-icon" onClick={toggleSound} aria-label={sound ? 'Sound off' : 'Sound on'}><Speaker on={sound} /></button>
          </div>
        </header>

        <div className="qf-feed" ref={feedRef}>
          <section {...cardProps(0, 'qf-start')}>
            <div className="kicker">Quick version · {journey.tab}</div>
            <h2>{journey.intro.title}</h2>
            <p>{journey.intro.hook}</p>
            <p className="qf-meta">
              {decades.length} decades · about a minute · {mobile ? 'tap Next or swipe up' : 'scroll or click through them'} · sound on
            </p>
            <button className="qf-go" onClick={() => jump(1)}>Start ↓</button>
          </section>

          {decades.map((d, i) => {
            const card = i + 1
            const [head, story] = journey.quick[d.decade]
            const song = tracks[journey.id]?.[String(d.decade)]?.[0]
            return (
              <section key={d.decade} {...cardProps(card, 'qf-decade-card')}>
                <div className="qf-decade">{d.decade}s</div>
                <h3 className="qf-head">{head}</h3>
                <p className="qf-story">{story}</p>
                <div className="qf-song">
                  {song && (Math.abs(card - active) <= 1 || played.has(song.id)) && (
                    <Player track={song} armed={sound && card === active && !played.has(song.id)} />
                  )}
                </div>
                {mobile && (
                  <button className="next-btn qf-next" onClick={() => jump(card + 1)}>
                    Next: {i + 1 < decades.length ? `${decades[i + 1].decade}s` : 'the whole century'} <span aria-hidden="true">↓</span>
                  </button>
                )}
              </section>
            )
          })}

          <section {...cardProps(count - 1, 'qf-end')}>
            <div className="qf-decade">A century of {journey.tab.toLowerCase()}</div>
            <h3 className="qf-head">{journey.quick.end[0]}</h3>
            <p className="qf-story">{journey.quick.end[1]}</p>
            <button className="qf-go" onClick={() => onSwitch(next.id)}>Next story: {next.tab} →</button>
            <button className="qf-deep" onClick={onFullJourney}>Take the full journey instead</button>
          </section>
        </div>

        {/* Phone: where you are in the century, one dot per decade down the right edge. Decorative —
            the top bar names the decade. */}
        {mobile && (
          <div className="qf-dots" aria-hidden="true">
            {decades.map((d, i) => <span key={d.decade} className={i + 1 === active ? 'on' : i + 1 < active ? 'past' : ''} />)}
          </div>
        )}

        {/* Desktop: previous at the top, next at the bottom — where the cards come from and go —
            and the decades as a timeline down the right edge, each one a place to jump to. */}
        {!mobile && (
          <>
            <button className="qf-nav prev" onClick={() => step(-1)} disabled={active === 0} aria-label="Previous">↑</button>
            <button className="qf-nav next" onClick={() => step(1)} disabled={active === count - 1} aria-label="Next">↓</button>
            <nav className="qf-timeline" aria-label="Decades">
              {decades.map((d, i) => (
                <button key={d.decade} className={i + 1 === active ? 'on' : i + 1 < active ? 'past' : ''}
                  aria-current={i + 1 === active ? 'step' : undefined}
                  onClick={() => jump(i + 1)}>
                  <span className="qf-tl-dot" />{d.decade}s
                </button>
              ))}
            </nav>
          </>
        )}
      </div>
    </div>
  )
}
