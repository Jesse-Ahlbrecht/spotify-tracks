import { useEffect, useRef, useState } from 'react'

const BASE = import.meta.env.BASE_URL

// ---- data loading ---------------------------------------------------------
export function useData() {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let alive = true
    setError(null)
    Promise.all(['timeline', 'tracks', 'world'].map(async (name) => {
      const response = await fetch(`${BASE}data/${name}.json`, { signal: controller.signal })
      if (!response.ok) throw new Error(`Unable to load ${name} (${response.status})`)
      return response.json()
    })).then(([timeline, tracks, world]) => {
      if (alive) setData({ timeline, tracks, world })
    }).catch(() => {
      if (alive) setError('The music data could not be loaded. Check your connection and try again.')
    })
    return () => {
      alive = false
      controller.abort()
    }
  }, [attempt])
  return { data, error, retry: () => { setError(null); setAttempt((n) => n + 1) } }
}

// ---- breakpoints -----------------------------------------------------------
// Composed from two arms so the compositions below cannot drift from their parts. Width alone is
// not enough for MOBILE: a phone in landscape is 932×430, WIDER than 900, and used to get the
// desktop two-column tree in a 430px-tall window — plane clipped, players below the fold. SHORT is
// bounded by width so a short-but-wide desktop window keeps the desktop layout.
// index.css restates these; there is no build-time sharing in plain CSS, so keep the two in step.
const NARROW = '(max-width: 900px)'
const SHORT = '(max-height: 500px) and (max-width: 1200px)'
const MOBILE = `${NARROW}, ${SHORT}`
// Where the plane gets a full-height slot to fill rather than a leftover: a tall portrait phone,
// and landscape, where it has a column of its own beside each page's text. Its height is otherwise bound
// by viewBox aspect against available WIDTH, so on a tall screen the leftover is dead space that
// grows with the screen — measured, 18% of an iPhone SE and 40% of a Pro Max.
const ROOMY = `(min-height: 780px) and ${NARROW}, ${SHORT}`

const BAND = 6 // half-height of the active band, in % of viewport
const LINE = 0.5 // the reading line: where a decade comes to rest, as a fraction of the viewport.
// Was 0.81 on mobile, to clear the sticky plane the stacked layout parked over the captions. A deck
// page is exactly one viewport tall, so centring it is the same as aligning its top — one number
// now serves both layouts, and CSS never needs to know it.
const STEP_BAND = `-${LINE * 100 - BAND}% 0px -${100 - LINE * 100 - BAND}% 0px`

// For the components that render a different TREE either side of a breakpoint rather than just
// different CSS. Re-renders on rotation, which can cross either query on a phone.
function useMediaQuery(query) {
  const [on, setOn] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const sync = () => setOn(mql.matches)
    sync()
    mql.addEventListener('change', sync)
    return () => mql.removeEventListener('change', sync)
  }, [query])
  return on
}

export const useIsMobile = () => useMediaQuery(MOBILE)
export const usePlaneRoomy = () => useMediaQuery(ROOMY)

// Where `el` must sit for its midline to land on the reading line.
const readingLineY = (el) => {
  const r = el.getBoundingClientRect()
  return Math.round(r.top + window.scrollY + r.height / 2 - window.innerHeight * LINE)
}

// A deliberate jump outranks a settle in progress. useSettleToStep listens for this the same way it
// listens for wheel and touchstart — a glide rewrites the scroll position every frame from a `start`
// captured before the jump, so left alone it would silently drag the page back off it.
export const SETTLE_CANCEL = 'settle-cancel'
const cancelSettle = () => dispatchEvent(new Event(SETTLE_CANCEL))

// ---- the page's jumps -----------------------------------------------------
// All three live here so the cancel-a-settle rule is a property of jumping, not something each
// caller has to remember. Most omit `behavior` on purpose: that defers to CSS scroll-behavior,
// which the prefers-reduced-motion query already flips to `auto` for us.

// Scroll the first `sel` onto the reading line. Computing the target beats
// `scrollIntoView({block:'center'})`, which only ever centres — matching it on mobile used to take
// a document-wide `scroll-padding-top`, and every non-decade scroll target then had to cancel it.
export function scrollToReadingLine(sel) {
  const el = document.querySelector(sel)
  if (!el) return
  cancelSettle()
  window.scrollTo({ top: readingLineY(el) })
}

// Let CSS choose smooth scrolling, including its reduced-motion override — except on the deck.
// There the page snaps mandatorily, and iOS Safari snapped the page straight back to the decade it
// had left (seen: scrollY 3349 → 0 → 3349 within half a second), so the jump did nothing. Snapping
// is lifted while the page lands at the top, instantly, then restored.
export function scrollToTop() {
  cancelSettle()
  const html = document.documentElement
  if (getComputedStyle(html).scrollSnapType === 'none') return window.scrollTo({ top: 0 })
  html.style.scrollSnapType = 'none'
  window.scrollTo({ top: 0, behavior: 'instant' })
  setTimeout(() => { html.style.scrollSnapType = '' }, 300)
}

// The selected story's explainer. Its top edge, not its middle: it is a screen, not a decade.
export function scrollToIntro() {
  cancelSettle()
  document.querySelector('.journey-intro')?.scrollIntoView({ block: 'start' })
}

export function useActiveStep(count) {
  const [active, setActive] = useState(0)
  const refs = useRef([])
  useEffect(() => {
    const mql = window.matchMedia(MOBILE)
    let obs
    const observe = () => {
      obs?.disconnect()
      obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) setActive(Number(e.target.dataset.step))
          })
        },
        { rootMargin: STEP_BAND, threshold: 0 },
      )
      refs.current.forEach((el) => el && obs.observe(el))
    }
    observe()
    // Crossing MOBILE swaps the whole Journey subtree, so the observer would be left watching
    // detached nodes; re-running observe() re-attaches it to the tree that replaced them.
    mql.addEventListener('change', observe)
    return () => {
      mql.removeEventListener('change', observe)
      obs.disconnect()
    }
  }, [count])
  return [active, (i) => (el) => (refs.current[i] = el)]
}

// ---- which landmark is at the reading line? -------------------------------
// Returns an index into `selector`'s matches, or -1 when none of them is — which is what tells the
// page arrows to stand down past the end of the journey. Same band as useActiveStep, so "the
// section you are reading" means one thing on this page.
// Selector-based rather than ref-based (the choice useInView makes) because the landmarks are owned
// by three different components — the hero by App, the explainer by JourneyIntro, the journey by
// Journey — and threading refs out of all three to a control none of them owns is worse than one
// query. Overlap at a boundary resolves to the earlier match, so a section stays current until it
// has fully left the band.
export function useSectionAtLine(selector) {
  const [at, setAt] = useState(-1)
  useEffect(() => {
    const mql = window.matchMedia(MOBILE)
    const on = new Set()
    let obs
    const observe = () => {
      obs?.disconnect()
      on.clear()
      const els = [...document.querySelectorAll(selector)]
      obs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            const i = els.indexOf(e.target)
            if (e.isIntersecting) on.add(i)
            else on.delete(i)
          })
          setAt(on.size ? Math.min(...on) : -1)
        },
        { rootMargin: STEP_BAND, threshold: 0 },
      )
      els.forEach((el) => obs.observe(el))
    }
    observe()
    mql.addEventListener('change', observe)
    return () => {
      mql.removeEventListener('change', observe)
      obs.disconnect()
    }
  }, [selector])
  return at
}

// ---- settle onto a decade once scrolling stops ----------------------------
// Deliberately NOT a wheel hijacker: every listener is passive and nothing calls preventDefault,
// so input is never intercepted and momentum is never swallowed. It wakes only once scrolling has
// gone quiet, then glides to a decade; fresh input cancels it. Why not CSS scroll-snap, and why
// the direction-of-travel rule: docs/design-notes.md, "Scrolling".
const IDLE = 100 // ...but only 40ms once the page is already crawling: the momentum is spent by
const IDLE_CRAWL = 40 // then, so waiting out a delay sized for a fast flick just reads as lag.
const CRAWL = 9 // px per scroll event that counts as "momentum is spent"
const PARKED = 12 // within this of a decade counts as already sitting on it
const MIN_TRAVEL = 70 // a gesture smaller than this, while parked, is a nudge — leave it be
const MAX_JUMP = 1.15 // steps are min-height, so a long caption can stretch one past the norm
const EDGE = 60 // slack past the first/last decade, after which scrolling is fully native

// Quadratic, not cubic: cubic's ease-in is so slow that the opening frames move sub-pixel, which
// reads as dead time. Not `behavior: 'smooth'` either — its curve starts at full speed, so coming
// off a standstill it lurches.
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

// `selector` null switches it off — the mobile deck passes null, because full-screen pages settle
// themselves with CSS scroll-snap and a JS glide on top would be two things steering one scroll.
export function useSettleToStep(selector) {
  useEffect(() => {
    if (!selector) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let timer = null
    let raf = null // non-null iff a glide is in flight
    let lastY = window.scrollY
    let from = null // scroll position where the current gesture began

    // Eased glide to an absolute Y. Writes with behavior:'instant' so each frame lands exactly
    // where asked — the global `scroll-behavior: smooth` would re-animate every frame otherwise.
    const glide = (to) => {
      const start = window.scrollY
      const dist = to - start
      if (Math.abs(dist) < 2) return
      // Short corrections stay brisk, long ones get room to breathe.
      const dur = Math.min(520, Math.max(200, Math.abs(dist) * 0.66))
      let t0 = null
      const frame = (ts) => {
        if (t0 === null) t0 = ts
        const p = Math.min(1, (ts - t0) / dur)
        window.scrollTo({ top: start + dist * easeInOut(p), behavior: 'instant' })
        raf = p < 1 ? requestAnimationFrame(frame) : null
      }
      raf = requestAnimationFrame(frame)
    }

    // Fresh input outranks a glide in flight. Chrome cancels its own smooth scrolls on user input,
    // but a rAF loop has to be stopped by hand or it would fight the reader.
    const stop = () => {
      cancelAnimationFrame(raf)
      raf = null
    }

    // Abandon the whole settle cycle, not just the glide: a deliberate jump teleports the page, so
    // a timer still armed from before it would wake up and reason about a `from`/`y` pair that
    // straddles the jump. Stopping the rAF alone would leave that to be caught downstream by
    // glide()'s 2px early-out, which is a guard, not an intention.
    const abort = () => {
      clearTimeout(timer)
      stop()
      from = null
    }

    // Scroll positions at which each step sits on the reading line. Re-queried per settle rather
    // than cached: step geometry moves on resize, breakpoint cross, font load and journey switch,
    // and this only runs when the page is already quiescent.
    const targets = () => [...document.querySelectorAll(selector)].map(readingLineY)

    const settle = () => {
      const T = targets()
      if (T.length < 2) return
      const y = window.scrollY
      // Outside the journey — the hero and the explainer above, the coda and footer below —
      // scrolling is left alone. The top edge is the step column's own box, NOT T[0]: a reading-line
      // position sits up to a viewport away from the block it belongs to, so on mobile (line 0.81,
      // no column padding) T[0] - EDGE landed inside the explainer and armed the settle while the
      // reader was still on it. The bottom edge stays T[n] — the column's trailing padding runs a
      // viewport past the last decade, and arming that far down would snap the coda back.
      const column = document.querySelector(selector)?.parentElement
      if (!column) return
      const columnTop = column.getBoundingClientRect().top + y
      if (y < columnTop - EDGE || y > T[T.length - 1] + EDGE) return

      const travelled = y - from
      const nearest = T.reduce((a, t) => (Math.abs(t - y) < Math.abs(a - y) ? t : a))

      // "Leave a small nudge alone" keys off whether the reader is parked on a decade, not off how
      // far they travelled — a distance test strands anyone who interrupts a glide.
      if (Math.abs(nearest - y) < PARKED && Math.abs(travelled) < MIN_TRAVEL) return

      let best
      if (Math.abs(travelled) < 4) {
        best = nearest // stranded with no direction to infer — just tidy up
      } else {
        // Direction of travel only. Rounding to the plain nearest decade is a trap: one mouse
        // notch is ~100px against ~589px spacing, so "nearest" is always the one you just left.
        const ahead = T.filter((t) => (travelled > 0 ? t > from + 4 : t < from - 4))
        if (!ahead.length) return // nothing further that way — let the reader out
        best = ahead.reduce((a, t) => (Math.abs(t - y) < Math.abs(a - y) ? t : a))
      }
      if (Math.abs(best - y) > Math.abs(T[1] - T[0]) * MAX_JUMP) return

      glide(best)
    }

    const onIdle = () => {
      settle()
      from = null
    }

    const onScroll = () => {
      const y = window.scrollY
      if (raf !== null) {
        lastY = y // a glide is driving; don't treat its own scrolling as a gesture
        return
      }
      const speed = Math.abs(y - lastY)
      if (from === null) from = lastY // lastY still holds the pre-gesture position
      lastY = y
      clearTimeout(timer)
      timer = setTimeout(onIdle, speed < CRAWL ? IDLE_CRAWL : IDLE)
    }

    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('wheel', stop, { passive: true })
    addEventListener('touchstart', stop, { passive: true })
    addEventListener(SETTLE_CANCEL, abort)
    return () => {
      abort()
      removeEventListener('scroll', onScroll)
      removeEventListener('wheel', stop)
      removeEventListener('touchstart', stop)
      removeEventListener(SETTLE_CANCEL, abort)
    }
  }, [selector])
}

// ---- publish an element's live height to CSS as a custom property ----------
// The captions are centred against the PLANE, not the viewport: the sticky column centres
// (plane + gap + players) as a group, so the plane's midline sits above the viewport's by half of
// whatever hangs below it. Measuring is what lets CSS apply that offset — hardcoding it would
// drift the moment the embed markup or track count changes.
// Writes the property straight onto the host element instead of going through React state: only
// CSS consumes it, and routing it through a render would rebuild the whole journey (d3 plane
// included) on every sub-pixel ResizeObserver tick during a window drag.
export function useSizeVar(prop, hostSelector, layoutKey) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const host = el?.closest(hostSelector)
    if (!el || !host) return
    // Border box, not contentRect: consumers use this to clear the measured element, so its own
    // padding and border have to be in the number. The deck's plane has both, and measuring the
    // content box alone left the decade heading tucked 19px behind it.
    const ro = new ResizeObserver(([e]) => {
      const h = e.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight
      host.style.setProperty(prop, `${Math.round(h)}px`)
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      host.style.removeProperty(prop)
    }
  }, [prop, hostSelector, layoutKey])
  return ref
}

// ---- debounce a fast-changing value (used to hold off reloading the Spotify
//      embeds until scrolling settles, without lagging the plane/captions) ----
export function useDebounced(value, delay = 140) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return settled
}

// ---- one Spotify preview at a time ------------------------------------------
// Up to nine players are mounted at once (three per decade, ±1 decade), and each is its own
// Spotify iframe, so nothing stopped two playing over each other. Spotify's embeds post their state
// to the parent page (`playback_update`, the messages its iFrame API is built on) and accept
// `{ command: 'pause' }` back, so: when one goes from paused to playing, pause every other. Only on
// that transition — a playing embed keeps sending position ticks, and those must not re-broadcast.
// Moving to another decade pauses everything: the player that was playing has just left the screen.
// Only embeds known to be playing are sent a pause: one that has not played yet answers it with an
// uncaught PlaybackError ("no list was loaded"), which check-scroll reports as a page error.
const SPOTIFY = 'https://open.spotify.com'
const pause = (windows) => windows.forEach((w) => w.postMessage({ command: 'pause' }, SPOTIFY))
const playing = new Set() // the embeds' windows that are playing right now (useOnePlayerAtATime)
// Only those: an embed told to pause before it has loaded a track throws inside its own frame.
export const pauseAllSongs = () => pause(playing)

// Start an embed's song. iOS Safari starts an embed that has never played only for a `play` posted
// synchronously inside a tap, click or key handler of this page; a later one (from an effect, a
// timer, or the embed's `ready`) is ignored until it has played once. So every navigation a tap
// causes starts its song right in the handler, and the effects that also start songs on arrival
// cover the browsers that allow it. `dedupe` is for those effects: they skip an embed a handler
// has just asked, which may still be buffering — a second `play` would restart it from 0.
// Never sent to one already playing, for the same reason.
// Only embeds that have said `ready` are asked: like `pause`, a `play` before then throws inside the
// embed ("no list was loaded"). useAutoplay plays one that becomes ready while it is wanted.
const asked = new WeakMap() // embed window → when it was last asked to play
const JUST_ASKED = 4000
export const justAsked = (w) => performance.now() - (asked.get(w) ?? -Infinity) < JUST_ASKED
const ready = new WeakSet()
addEventListener('message', (e) => {
  if (e.origin === SPOTIFY && e.data?.type === 'ready') ready.add(e.source)
})
export const isReady = (w) => ready.has(w)

// Whether a song that has never played starts only from a tap, so "Tap to play" (Player.jsx) can
// show the moment a swipe lands instead of after waiting for an autoplay that will not come. Known up
// front on iOS and iPadOS, where every browser is WebKit (iPadOS calls itself a Mac with a touch
// screen; a Chrome that does is desktop Chrome emulating touch); elsewhere learned the first time a
// song does not start although the reader has already tapped or clicked on the page.
const UA = navigator.userAgent
let tapNeeded = /iP(hone|ad|od)/.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1 && !/Chrome/.test(UA))
export const needsTap = () => tapNeeded
export const noteNeedsTap = () => { tapNeeded = true }
export function playSong(w, dedupe = false) {
  if (!w || !ready.has(w) || playing.has(w) || (dedupe && justAsked(w))) return
  asked.set(w, performance.now())
  w.postMessage({ command: 'play' }, SPOTIFY)
}
// Pause everything playing except `keep` and a song a tap has just asked for, which may not have
// reported playing yet — for whenever the reader moves on from a song.
export const pauseAllBut = (keep) => pause([...playing].filter((w) => w !== keep && !justAsked(w)))
// The first song of the full journey's decade `i` (TrackEmbed marks its group with data-songs).
export const playDecade = (i) =>
  playSong(document.querySelector(`.journey [data-songs="${i}"] iframe`)?.contentWindow)

export function useOnePlayerAtATime(decade) {
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== SPOTIFY || e.data?.type !== 'playback_update') return
      if (e.data.payload?.isPaused !== false) playing.delete(e.source)
      else if (!playing.has(e.source)) {
        pause(playing)
        playing.add(e.source)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  // Not the song a tap has just started for the decade being arrived at: this runs as the scroll
  // lands, by which time that song may already be playing.
  useEffect(() => pauseAllBut(null), [decade])
}

// Play the Spotify embed matching `selector` (null: nothing) on arrival. One that is still loading
// plays once it says it is ready — an embed that was not ready cannot have taken an earlier `play`,
// so that one is not deduplicated. Where the browser refuses (see playSong), the reader gets a
// "Tap to play" button instead (Player.jsx).
export function useAutoplay(selector) {
  useEffect(() => {
    if (!selector) return
    const frame = () => document.querySelector(selector)?.contentWindow
    playSong(frame(), true)
    const onReady = (e) => {
      if (e.origin === SPOTIFY && e.data?.type === 'ready' && e.source === frame()) playSong(e.source)
    }
    window.addEventListener('message', onReady)
    return () => window.removeEventListener('message', onReady)
  }, [selector])
}

// The ids of tracks whose embed has started playing. Spotify's embeds share one playback session:
// once an embed that has played is removed from the page, every embed played after that hangs on
// "buffering" at 0:00. Seen in Chromium: stepping through the quick version, the third song
// onward stalled; with the players kept mounted, six in a row played. Removing embeds that never
// played is harmless, so the mount windows stay — a player that has played is just never unmounted.
export function usePlayedTracks() {
  const [played, setPlayed] = useState(() => new Set())
  useEffect(() => {
    const onMessage = (e) => {
      if (e.origin !== SPOTIFY || e.data?.type !== 'playback_update' || e.data.payload?.isPaused !== false) return
      const id = e.data.payload.playingURI?.split(':').pop()
      if (id) setPlayed((s) => (s.has(id) ? s : new Set(s).add(id)))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])
  return played
}

// ---- is the referenced element on screen? ---------------------------------
// `once: true` (the default) is the reveal the standalone beats use: latch on first sight, then stop
// observing. `once: false` keeps toggling, for chrome that may float over only one section.
export function useInView({ once = true, ...io } = { rootMargin: '-15% 0px -15% 0px' }) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => {
      setSeen(e.isIntersecting)
      if (e.isIntersecting && once) obs.disconnect()
    }, io)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, seen]
}

// One short caption per decade for the mood journey's steps — valence × energy only.
export const DECADE_CAPTIONS = {
  1920: 'Where it begins: calm and bright. Valence at its century high, energy near its floor. Positive, but gentle.',
  1930: 'The Depression era. Valence dips a touch from the twenties’ high while energy barely moves — still calm, a little less bright.',
  1940: 'Wartime. Energy hits its century floor while valence sinks toward its own low — the calmest stretch of the hundred years.',
  1950: 'The vinyl era begins. Valence bottoms out here — its century low — even as energy just begins to stir.',
  1960: 'The turn upward. Energy climbs sharply for the first time, and valence rebounds from the fifties’ low.',
  1970: 'Energy keeps surging while valence holds high — music turns bright and intense.',
  1980: 'Energy keeps rising and valence stays high; bright, intense songs become the norm.',
  1990: 'Peak variety. Energy is high and still climbing, valence steady.',
  2000: 'Energy pushes toward its maximum, and valence begins its real decline — happy-sounding songs start to thin out.',
  2010: 'Energy peaks while valence drops hard — music turns intense but downcast.',
  2020: 'Today. Valence sits near its modern low and energy finally plateaus: high-intensity, low-positivity — the opposite of where we began.',
}

// The beat: energy × danceability.
const BEAT_CAPTIONS = {
  1920: 'The Jazz Age. Danceability actually starts high — the Charleston and foxtrot move — while energy sits near its century floor: lively rhythm, low intensity.',
  1930: 'Danceability slips from the twenties’ high as swing turns lush and orchestral, and energy still barely stirs.',
  1940: 'The mid-century dip. Danceability slumps toward its low as ballads and wartime crooners dominate; energy is still muted.',
  1950: 'Rock ’n’ roll’s first spark. Energy just begins to climb while the groove is still finding its feet.',
  1960: 'Amplification hits the rhythm section. Energy jumps as electric bands take over, and the beat starts pulling back up.',
  1970: 'Disco and funk. Both rise together — this is the decade the floor never empties.',
  1980: 'Drum machines lock the grid. Danceability and energy keep climbing on programmed, four-on-the-floor precision.',
  1990: 'High energy, steady groove. Rock and hip-hop keep the intensity up while danceability holds.',
  2000: 'The loudness war peaks — energy near its maximum — and dance-pop pushes the beat higher still.',
  2010: 'Streaming rewards the hook. Danceability climbs back to Jazz-Age heights as EDM and trap dominate playlists.',
  2020: 'Peak groove, plateaued intensity. Danceability is at a century high while energy finally levels off.',
}

// Two kinds of sad: valence (mood) × minor-key share (tonality).
const SAD_CAPTIONS = {
  1920: 'Bright and major. High valence, and roughly three in four songs in a major key — the least “sad” the century gets, by either measure.',
  1930: 'Valence dips with the Depression, but tonality stays overwhelmingly major — sadness, so far, is only in the mood.',
  1940: 'Wartime pulls valence toward its floor. Minor-key writing is still rare; the sadness is emotional, not yet tonal.',
  1950: 'Valence bottoms out at its century low — yet major keys still rule. Two kinds of sad, and only one is moving.',
  1960: 'Valence rebounds as pop brightens, while the slow drift toward minor keys quietly continues.',
  1970: 'Positivity holds while the tonal drift continues — minor keys keep gaining ground beneath the surface.',
  1980: 'About a third of songs now lean minor. The tonal “darkening” becomes a real trend even as valence stays up.',
  1990: 'Steady valence, gathering minor keys. The two kinds of sad start to pull apart in earnest.',
  2000: 'Valence begins its real decline just as minor-key writing accelerates — for the first time both sadnesses climb together.',
  2010: 'The “sad banger” era. Valence drops hard and minor keys surge — melancholy you can dance to becomes two songs in five.',
  2020: 'Nearly half of songs are now minor — the most in a century — while valence sits near its modern low. Both kinds of sad, at once.',
}

// Why so intense: energy × acousticness (the electrification story).
const INTENSITY_CAPTIONS = {
  1920: 'Almost entirely acoustic, and almost entirely calm. Energy is low because the wiring simply isn’t there yet.',
  1930: 'Still acoustic, still gentle. Recording is live-to-disc; intensity has nowhere to come from.',
  1940: 'Big bands add players, not power. Acousticness stays near the top and energy stays low.',
  1950: 'The first electric guitars appear, but the catalog is still overwhelmingly acoustic — energy barely stirs.',
  1960: 'Electrification arrives. As acousticness starts to fall, energy climbs in near-perfect lockstep.',
  1970: 'Amps, effects, multitrack studios. Acousticness drops sharply and energy climbs and stays up.',
  1980: 'Synths and drum machines. The acoustic share keeps collapsing; energy rides it higher.',
  1990: 'Digital production is the norm. Acousticness is low, energy high — the mirror is almost exact.',
  2000: 'The loudness war. Energy pushes toward its ceiling while acoustic textures keep receding.',
  2010: 'Fully in-the-box production. Energy holds near its peak; the sound is electric by default.',
  2020: 'Energy finally plateaus even as acousticness stays low — the electrification that drove intensity has largely run its course.',
}

// The quick version's words: per decade, a headline for how the music *feels* and one line of
// story — the vibe the bars show, not the bars read aloud (the chart beside them prints the shares).
// `end` closes the story. Checked against timeline.json's shares; where a line says "lowest" or
// "most", it is.
const QUICK = {
  mood: {
    1920: ['Bright and easy.', 'The Jazz Age sounds sunny and gentle: cheerful songs, almost none of them loud.'],
    1930: ['A little less sunny.', 'The Depression takes some shine off, but the music stays soft and unhurried.'],
    1940: ['Quiet and subdued.', 'Wartime crooners and ballads. The cheer fades, and the music has almost no drive at all.'],
    1950: ['The gloomiest it gets — and still calm.', 'Cheer hits its century low, while the energy is only just waking up.'],
    1960: ['Things wake up.', 'Electric bands arrive, and songs get louder and brighter at the same time.'],
    1970: ['Loud and happy.', 'Disco, rock and soul: upbeat and full of drive.'],
    1980: ['Big, bright and bold.', 'Intense, upbeat songs become the everyday sound of pop.'],
    1990: ['Still riding high.', 'The energy keeps building, and the good mood mostly holds.'],
    2000: ['Louder, a shade less cheerful.', 'Intensity pushes toward its peak, and the happy songs start to thin out.'],
    2010: ['Intense, but downcast.', 'The energy stays maxed out while the cheer drops hard: big songs, heavy hearts.'],
    2020: ['The opposite of where we started.', 'Loud and driving, and only half the songs sound happy — a world away from the bright, calm 1920s.'],
    end: ['From bright and calm to intense and downcast.', 'Songs got more intense almost every decade. Their cheer wandered — and ends lower than it began.'],
  },
  beat: {
    1920: ['Made for dancing.', 'Charleston and foxtrot: a bouncy beat, played soft.'],
    1930: ['Smoother, less bounce.', 'Swing turns lush and orchestral; the beat relaxes and the volume stays low.'],
    1940: ['The groove goes missing.', 'Ballads and crooners take over, and most songs no longer make you move.'],
    1950: ['A spark of rock ’n’ roll.', 'A little drive creeps in, but the dance floor is still finding its feet.'],
    1960: ['Plugged in.', 'Electric bands double the drive, and the beat starts pulling back up.'],
    1970: ['The floor fills up.', 'Disco and funk: songs get more danceable and more driving at once.'],
    1980: ['Locked to the grid.', 'Drum machines keep everything tight, punchy and made to move.'],
    1990: ['Hard and steady.', 'Rock and hip-hop keep the intensity climbing while the groove holds firm.'],
    2000: ['Louder and bouncier.', 'The loudness war meets dance-pop: more drive, more beat.'],
    2010: ['The Jazz Age groove is back.', 'Streaming rewards the hook. As danceable as the 1920s — but far, far louder.'],
    2020: ['Peak groove.', 'More danceable than ever, while the intensity finally levels off.'],
    end: ['The groove came back. The volume never left.', 'The beat started strong, lost its step mid-century, then climbed past where it began — while songs got louder almost every decade.'],
  },
  sad: {
    1920: ['Sunny, in a major key.', 'Few songs sound sad, and most are written bright: the least melancholy decade either way.'],
    1930: ['A sadder mood creeps in.', 'The Depression darkens the feel, but the songs are still written in bright major keys.'],
    1940: ['Sad on the surface.', 'Wartime: songs sound far more downbeat, yet minor keys are still rare.'],
    1950: ['The saddest-sounding decade.', 'Half the songs sound sad — but they are still written in major keys.'],
    1960: ['Cheer returns.', 'Pop brightens up, and the keys barely change.'],
    1970: ['Bright on top, darker underneath.', 'The mood stays upbeat while minor keys start to creep in.'],
    1980: ['One song in three in minor.', 'Songs still sound fairly cheerful, but the writing is slowly darkening.'],
    1990: ['The two kinds of sad drift apart.', 'The mood holds steady while minor keys keep spreading.'],
    2000: ['Darker, both ways.', 'For the first time, both kinds of sad start rising together.'],
    2010: ['The sad banger.', 'A gloomy feel and minor keys surge at once: melancholy you can dance to.'],
    2020: ['Sad, both ways.', 'Half the songs sound sad, and minor keys are at their century high.'],
    end: ['Sad by design.', 'How sad songs sound came and went. How they are written only went one way: toward minor keys.'],
  },
  intensity: {
    1920: ['Unplugged and calm.', 'Almost every song is acoustic, and almost none of them are loud.'],
    1930: ['Still unplugged.', 'Recorded live to disc: the music has nowhere to get loud from.'],
    1940: ['More players, not more power.', 'Big bands get bigger, but it is all acoustic and still gentle.'],
    1950: ['The first guitars plug in.', 'Electric guitars show up, but the sound is still overwhelmingly acoustic and soft.'],
    1960: ['Switched on.', 'Electric instruments spread fast, and the music gets louder with them.'],
    1970: ['Amps up.', 'Amps, effects and studio tricks: half the songs now sound electric, and as many are high-energy.'],
    1980: ['Synths everywhere.', 'Synths and drum machines push the acoustic sound out, and the intensity rises with them.'],
    1990: ['Digital by default.', 'Most songs are electric now, and most are high-energy.'],
    2000: ['The loudness war.', 'Records are made louder and louder, and acoustic textures keep receding.'],
    2010: ['Made on a laptop.', 'Production lives in the computer; the sound is electric and intense by default.'],
    2020: ['The ceiling.', 'Nearly everything is electric, and the intensity has finally stopped climbing.'],
    end: ['Plug it in, turn it up.', 'As music went electric, it got intense right alongside — the clearest trend of the century.'],
  },
}

// What the journey's bars count: the share of a decade's songs that pass one plain test. `field`
// is the timeline.json key (computed in scripts/export_app_data.py); 0.5 is the middle of
// Spotify's 0–1 scale, and minor key is already a yes/no. `says` finishes "% of songs that …" (the
// chart's title) and "Songs that …" (the intro card's); `rule` is how the intro explains it.
export const MEASURES = {
  happy: { field: 'happy', says: 'sound happy', color: 'var(--c-valence)', rule: 'Valence — how positive a song sounds — in the upper half of its scale.' },
  sad: { field: 'sad', says: 'sound sad', color: 'var(--c-valence)', rule: 'Valence — how positive a song sounds — in the lower half of its scale.' },
  energetic: { field: 'energetic', says: 'are high-energy', color: 'var(--c-energy)', rule: 'Energy — how intense and driving a song feels — in the upper half of its scale.' },
  danceable: { field: 'danceable', says: 'are danceable', color: 'var(--c-dance)', rule: 'Danceability — how steady and moving the beat is — in the upper half of its scale.' },
  minor: { field: 'minor_share', says: 'are in a minor key', color: 'var(--c-minor)', rule: 'Written in a minor key rather than a major one: a darker, more ambiguous tonality.' },
  electric: { field: 'electric', says: 'sound electric', color: 'var(--c-acoustic)', rule: 'Acousticness in the lower half of its scale: made with electric or digital instruments, not acoustic ones.' },
}

// Each journey opens on an explainer screen: the arc in one line, before the two dials that draw
// it. Deliberately no raw feature values — valence 0.6 means nothing to a reader, and the bars
// two screens down print the shares anyway. Shape and direction only; where a proportion of
// songs says it better than an adjective ("one in four"), that is plain enough to keep.
const INTROS = {
  mood: {
    title: 'Happy, or hard?',
    hook: 'Music’s intensity more than doubled over a century. Positivity took a wilder route — bright in the Jazz Age, lowest in the fifties, back up by the seventies, falling ever since. Two dials that refuse to move together.',
  },
  beat: {
    title: 'Did we lose the groove?',
    hook: 'Danceability starts high in the Jazz Age, slumps through the war years, then climbs past where it began. Energy bottoms out in those same years, then rises for seventy straight. The beat came back; the intensity kept going.',
  },
  sad: {
    title: 'Two kinds of sad',
    hook: 'A song can sound sad, or be written sad. Minor keys climb decade after decade, from roughly one song in four to nearly one in two. Mood has no such direction — it dips, rebounds, then dips again. Only one kind of sad is really a trend.',
  },
  intensity: {
    title: 'Why so intense?',
    hook: 'Music begins almost entirely acoustic and ends almost entirely electric, as amps, synths and studios take over — and its intensity rises in near-perfect mirror image. The clearest single trend in a hundred years.',
  },
}

// The four decade-journeys the tabbed switcher offers. Each shows exactly two `measures` (keys into
// MEASURES), one bar chart each; its representative tracks (tracks.json[id]) are the songs nearest
// the decade's centroid in the two metrics behind those measures. `accent` is the journey's colour
// in the tabs and copy; `quick` holds the quick version's words. `coda: true` appends the year-based "Does music mirror the world?" closing
// chart after it.
export const JOURNEYS = [
  { id: 'mood', tab: 'Mood', measures: ['happy', 'energetic'], accent: 'var(--c-energy)', captions: DECADE_CAPTIONS, quick: QUICK.mood, intro: INTROS.mood, coda: true },
  { id: 'beat', tab: 'The beat', measures: ['energetic', 'danceable'], accent: 'var(--c-dance)', captions: BEAT_CAPTIONS, quick: QUICK.beat, intro: INTROS.beat },
  { id: 'sad', tab: 'Two kinds of sad', measures: ['sad', 'minor'], accent: 'var(--c-minor)', captions: SAD_CAPTIONS, quick: QUICK.sad, intro: INTROS.sad },
  { id: 'intensity', tab: 'Why so intense', measures: ['electric', 'energetic'], accent: 'var(--c-acoustic)', captions: INTENSITY_CAPTIONS, quick: QUICK.intensity, intro: INTROS.intensity },
]

// Where the reader is, kept in the address so a refresh comes back to it: the story (when it is not
// the first) and, while the quick version is open, its card (`?story=beat&quick=3`). replaceState,
// so moving around adds no history entries. Without it a refresh fell back to the first story with
// the quick version closed, while the browser restored the long page's scroll position.
export function readPlace() {
  const q = new URLSearchParams(location.search)
  const story = JOURNEYS.some((j) => j.id === q.get('story')) ? q.get('story') : JOURNEYS[0].id
  const card = q.has('quick') ? Math.max(0, parseInt(q.get('quick'), 10) || 0) : null
  return { story, card }
}
export function writePlace(story, card) {
  const q = new URLSearchParams()
  if (story !== JOURNEYS[0].id) q.set('story', story)
  if (card != null) q.set('quick', card)
  const search = q.toString()
  history.replaceState(history.state, '', `${location.pathname}${search ? `?${search}` : ''}${location.hash}`)
}
