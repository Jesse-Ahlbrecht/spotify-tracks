import { useEffect, useRef, useState } from 'react'

const BASE = import.meta.env.BASE_URL

// ---- data loading ---------------------------------------------------------
export function useData() {
  const [data, setData] = useState(null)
  useEffect(() => {
    let alive = true
    Promise.all([
      fetch(`${BASE}data/timeline.json`).then((r) => r.json()),
      fetch(`${BASE}data/tracks.json`).then((r) => r.json()),
      fetch(`${BASE}data/world.json`).then((r) => r.json()),
    ]).then(([timeline, tracks, world]) => {
      if (alive) setData({ timeline, tracks, world })
    })
    return () => {
      alive = false
    }
  }, [])
  return data
}

// ---- scrollytelling: which step is at the "reading line" ------------------
// The reading line is where a decade comes to rest, as a fraction of viewport height: centred on
// desktop, lower on mobile where the sticky plane covers the top of the screen. Both consumers
// derive from it — the observer band below, and the settle target in useSettleToStep — so they
// cannot drift apart. CSS needs the same number: `scroll-padding-top` in the <900px query is
// `2 * line - 100`, which is where 62dvh comes from.
const MOBILE = '(max-width: 900px)' // must match the layout switch in index.css
const BAND = 6 // half-height of the active band, in % of viewport
const readingLine = (mobile) => (mobile ? 0.81 : 0.5)
const stepBand = (mobile) => {
  const line = readingLine(mobile) * 100
  return `-${line - BAND}% 0px -${100 - line - BAND}% 0px`
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
        { rootMargin: stepBand(mql.matches), threshold: 0 },
      )
      refs.current.forEach((el) => el && obs.observe(el))
    }
    observe()
    mql.addEventListener('change', observe) // rotating a phone can cross the breakpoint
    return () => {
      mql.removeEventListener('change', observe)
      obs.disconnect()
    }
  }, [count])
  return [active, (i) => (el) => (refs.current[i] = el)]
}

// ---- settle onto a decade once scrolling stops ----------------------------
// Deliberately NOT a wheel hijacker: every listener is passive and nothing calls preventDefault,
// so input is never intercepted and momentum is never swallowed. It wakes only once scrolling has
// gone quiet, then glides to a decade; fresh input cancels it. Why not CSS scroll-snap, and why
// the direction-of-travel rule: docs/decisions.md, 2026-08-23.
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

export function useSettleToStep(selector) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const mql = window.matchMedia(MOBILE)
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

    // Scroll positions at which each step sits on the reading line. Re-queried per settle rather
    // than cached: step geometry moves on resize, breakpoint cross, font load and journey switch,
    // and this only runs when the page is already quiescent.
    const targets = () => {
      const line = window.innerHeight * readingLine(mql.matches)
      const y = window.scrollY
      return [...document.querySelectorAll(selector)].map((el) => {
        const r = el.getBoundingClientRect()
        return Math.round(r.top + y + r.height / 2 - line)
      })
    }

    const settle = () => {
      const T = targets()
      if (T.length < 2) return
      const y = window.scrollY
      // Outside the journey (hero above, coda/footer below) scrolling is left alone.
      if (y < T[0] - EDGE || y > T[T.length - 1] + EDGE) return

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
    return () => {
      clearTimeout(timer)
      stop()
      removeEventListener('scroll', onScroll)
      removeEventListener('wheel', stop)
      removeEventListener('touchstart', stop)
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
export function useSizeVar(prop, hostSelector) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    const host = el?.closest(hostSelector)
    if (!el || !host) return
    const ro = new ResizeObserver(([e]) =>
      host.style.setProperty(prop, `${Math.round(e.contentRect.height)}px`),
    )
    ro.observe(el)
    return () => ro.disconnect()
  }, [prop, hostSelector])
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

// ---- reveal-on-scroll for the standalone beats ----------------------------
export function useInView(options = { rootMargin: '-15% 0px -15% 0px' }) {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setSeen(true)
        obs.disconnect()
      }
    }, options)
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return [ref, seen]
}

// One short caption per decade for the mood journey's steps — valence × energy only.
export const DECADE_CAPTIONS = {
  1920: 'Where it begins, in the calm-and-bright corner: valence at its century high, energy near its floor. Positive, but gentle.',
  1930: 'The Depression era. Valence dips a touch from the twenties’ high while energy barely moves — still calm, a little less bright.',
  1940: 'Wartime. Energy hits its century floor while valence sinks toward its own low — the calmest stretch of the hundred years.',
  1950: 'The vinyl era begins. Valence bottoms out here — its century low — even as energy just begins to stir.',
  1960: 'The turn upward. Energy climbs sharply for the first time, and valence rebounds from the fifties’ low.',
  1970: 'Energy keeps surging while valence holds high — music drifts toward the bright, intense corner.',
  1980: 'Energy keeps rising and valence stays high; the bright-and-intense quadrant fills in.',
  1990: 'Peak variety. Energy is high and still climbing, valence steady.',
  2000: 'Energy pushes toward its maximum, and valence begins its real decline — the bright corner starts to empty.',
  2010: 'Energy peaks while valence drops hard — music lands in the intense-but-downcast corner.',
  2020: 'Today. Valence sits near its modern low and energy finally plateaus: high-intensity, low-positivity — the far corner from where we began.',
}

// The beat: energy × danceability.
const BEAT_CAPTIONS = {
  1920: 'The Jazz Age. Danceability actually starts high — the Charleston and foxtrot move — while energy sits near its century floor: lively rhythm, low intensity.',
  1930: 'Danceability slips from the twenties’ high as swing turns lush and orchestral, and energy still barely stirs.',
  1940: 'The mid-century dip. Danceability slumps toward its low as ballads and wartime crooners dominate; energy is still muted.',
  1950: 'Rock ’n’ roll’s first spark. Energy just begins to climb while the groove is still finding its feet.',
  1960: 'Amplification hits the rhythm section. Energy jumps as electric bands take over, and the beat starts pulling back up.',
  1970: 'Disco and funk. Both dials rise together — this is the decade the floor never empties.',
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
  2010: 'The “sad banger” era. Valence drops hard and minor keys surge — melancholy you can dance to becomes a third of all tracks.',
  2020: 'Nearly half of songs are now minor — the most in a century — while valence sits near its modern low. Both kinds of sad, at once.',
}

// Why so intense: energy × acousticness (the electrification story).
const INTENSITY_CAPTIONS = {
  1920: 'Almost entirely acoustic, and almost entirely calm. Energy is low because the wiring simply isn’t there yet.',
  1930: 'Still acoustic, still gentle. Recording is live-to-disc; intensity has nowhere to come from.',
  1940: 'Big bands add players, not power. Acousticness stays near the top and energy stays low.',
  1950: 'The first electric guitars appear, but the catalog is still overwhelmingly acoustic — energy barely stirs.',
  1960: 'Electrification arrives. As acousticness starts to fall, energy climbs in near-perfect lockstep.',
  1970: 'Amps, effects, multitrack studios. Acousticness drops sharply and the energy curve bends up and stays up.',
  1980: 'Synths and drum machines. The acoustic share keeps collapsing; energy rides it higher.',
  1990: 'Digital production is the norm. Acousticness is low, energy high — the mirror is almost exact.',
  2000: 'The loudness war. Energy pushes toward its ceiling while acoustic textures keep receding.',
  2010: 'Fully in-the-box production. Energy holds near its peak; the sound is electric by default.',
  2020: 'Energy finally plateaus even as acousticness stays low — the electrification that drove intensity has largely run its course.',
}

// The single source of per-metric truth: label + one-line gloss (shown under the toggle), the axis
// colour, and the "← low   name   high →" axis string the plane draws. Everything metric-specific
// keys off this table so nothing is duplicated across the config.
export const VAR_INFO = {
  valence: { label: 'Valence', desc: 'how positive a song sounds', color: 'var(--c-valence)', axis: '← sadder   valence   happier →' },
  energy: { label: 'Energy', desc: 'how intense and driving it feels', color: 'var(--c-energy)', axis: '← calmer   energy   more intense →' },
  danceability: { label: 'Danceability', desc: 'how steady and moving the beat is', color: 'var(--c-dance)', axis: '← stiller   danceability   more danceable →' },
  minor_share: { label: 'Minor key', desc: 'a darker, more ambiguous tonality', color: 'var(--c-minor)', axis: '← brighter (major)   minor-key share   darker (minor) →' },
  acousticness: { label: 'Acousticness', desc: 'how acoustic vs. electric / digital', color: 'var(--c-acoustic)', axis: '← electric / digital   acousticness   acoustic →' },
}

// The four decade-journeys the tabbed switcher offers. Each plots two metrics (`x`/`y` are keys
// into VAR_INFO, which supplies each axis's label and colour); its representative tracks
// (tracks.json[id]) are the songs nearest that plane's per-decade centroid. The journey's accent
// colour is derived at use as VAR_INFO[y].color. `coda: true` appends the year-based
// "Does music mirror the world?" closing chart after that journey.
export const JOURNEYS = [
  { id: 'mood', tab: 'Mood', x: 'valence', y: 'energy', sizeKey: 'minor_share', captions: DECADE_CAPTIONS, coda: true },
  { id: 'beat', tab: 'The beat', x: 'energy', y: 'danceability', sizeKey: 'minor_share', captions: BEAT_CAPTIONS },
  { id: 'sad', tab: 'Two kinds of sad', x: 'valence', y: 'minor_share', sizeKey: 'sad_banger', captions: SAD_CAPTIONS },
  { id: 'intensity', tab: 'Why so intense', x: 'energy', y: 'acousticness', sizeKey: 'minor_share', captions: INTENSITY_CAPTIONS },
]
