import { useEffect, useRef, useState } from 'react'
import { JOURNEYS, useIsMobile } from '../lib.js'
import ShareBars from './ShareBars.jsx'
import './QuickFeed.css'

// PROTOTYPE — the quick way through a story. The full journey stays as it is; this is the other
// option. One full-screen vertical feed, one card per screen, the decade's song playing as each
// lands; nothing advances by itself. Phone: swipe. Desktop: scroll, the ↑ ↓ buttons or the arrow
// keys — and each card is laid out for the wide screen (claim, caption and song on the left, the
// bar charts large on the right), not a phone column in the middle of it.
//
// Cards: a start card, one per decade, and an end card. Each decade card says how the music feels
// then — a headline and one line of story (journey.quick, in lib.js) — beside both bar charts as the
// full journey shows them, with one song. The words carry the vibe; the chart carries the numbers.

const SPOTIFY = 'https://open.spotify.com'

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
  const frames = useRef({}) // card index → iframe
  const [active, setActive] = useState(0)
  const [sound, setSound] = useState(true)
  const started = useRef(false) // a click or tap has happened, so the browser lets songs play
  const count = decades.length + 2 // start + decades + end
  const isDecade = (c) => c > 0 && c < count - 1
  const next = JOURNEYS[(JOURNEYS.findIndex((j) => j.id === journey.id) + 1) % JOURNEYS.length]

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

  // Play the landing card's song; one still loading plays once it says it is ready. (Starting one
  // pauses the others — useOnePlayerAtATime, mounted by the full journey, sees these embeds too.)
  useEffect(() => {
    const play = (w) => w?.postMessage({ command: 'play' }, SPOTIFY)
    if (!sound || !started.current) return
    play(frames.current[active]?.contentWindow)
    const onReady = (e) => {
      if (e.origin === SPOTIFY && e.data?.type === 'ready' && e.source === frames.current[active]?.contentWindow) play(e.source)
    }
    window.addEventListener('message', onReady)
    return () => window.removeEventListener('message', onReady)
  }, [active, sound])

  const go = (card) => cardRefs.current[Math.max(0, Math.min(count - 1, card))]?.scrollIntoView({ behavior: 'smooth' })
  const step = (d) => { started.current = true; go(active + d) }

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

  const start = () => { started.current = true; go(1) }
  const toggleSound = () => {
    if (sound) frames.current[active]?.contentWindow?.postMessage({ command: 'pause' }, SPOTIFY)
    started.current = true
    setSound((s) => !s)
  }
  const cardProps = (card, cls) => ({ 'data-card': card, ref: (el) => (cardRefs.current[card] = el), className: `qf-card ${cls}` })

  return (
    <div className={`qf ${mobile ? 'phone' : 'desk'}`} role="dialog" aria-modal="true"
      aria-label={`${journey.tab}, quick version`} style={{ '--accent': journey.accent }}>
      <div className="qf-frame">
        <header className="qf-bar">
          <div className="qf-progress" aria-hidden="true">
            {Array.from({ length: count }, (_, i) => <span key={i} className={i <= active ? 'done' : ''} />)}
          </div>
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
              {decades.length} decades · about a minute · {mobile ? 'swipe up through them' : 'scroll or click through them'} · sound on
            </p>
            <button className="qf-go" onClick={start}>{mobile ? 'Start ↑' : 'Start ↓'}</button>
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
                <div className="qf-chart">
                  <ShareBars decades={decades} active={i} measures={journey.measures} compact={mobile} />
                </div>
                <div className="qf-song">
                  {song && Math.abs(card - active) <= 1 && (
                    <iframe
                      ref={(el) => { if (el) frames.current[card] = el; else delete frames.current[card] }}
                      title={`${song.name} — ${song.artist}`}
                      src={`${SPOTIFY}/embed/track/${song.id}?theme=0`}
                      width="100%"
                      frameBorder="0"
                      allow="autoplay; encrypted-media; clipboard-write"
                    />
                  )}
                </div>
                <button className="qf-deep" onClick={() => onFullJourney(i)}>Full journey at the {d.decade}s →</button>
                {card === 1 && <div className="qf-hint" aria-hidden="true">{mobile ? 'swipe up ↑' : 'scroll ↓'}</div>}
              </section>
            )
          })}

          <section {...cardProps(count - 1, 'qf-end')}>
            <div className="qf-decade">A century of {journey.tab.toLowerCase()}</div>
            <h3 className="qf-head">{journey.quick.end[0]}</h3>
            <p className="qf-story">{journey.quick.end[1]}</p>
            <div className="qf-chart">
              <ShareBars decades={decades} active={decades.length - 1} measures={journey.measures} compact={mobile} />
            </div>
            <button className="qf-go" onClick={() => onSwitch(next.id)}>Next story: {next.tab} →</button>
            <button className="qf-deep" onClick={() => onFullJourney(0)}>Take the full journey instead</button>
          </section>
        </div>

        {!mobile && (
          <>
            <button className="qf-nav prev" onClick={() => step(-1)} disabled={active === 0} aria-label="Previous">↑</button>
            <button className="qf-nav next" onClick={() => step(1)} disabled={active === count - 1} aria-label="Next">↓</button>
          </>
        )}
      </div>
    </div>
  )
}
