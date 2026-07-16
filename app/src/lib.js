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

// ---- scrollytelling: which step is at the viewport centre -----------------
export function useActiveStep(count) {
  const [active, setActive] = useState(0)
  const refs = useRef([])
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActive(Number(e.target.dataset.step))
        })
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    )
    refs.current.forEach((el) => el && obs.observe(el))
    return () => obs.disconnect()
  }, [count])
  return [active, (i) => (el) => (refs.current[i] = el)]
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

// One decade hop lasts DURATION ms; the hero → first-decade glide is deliberately slower.
const DURATION = 150
const HERO_DURATION = 450
const COOLDOWN = 80

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3) // moves at once, then settles

// Document-absolute scroll position that vertically centres `el` in the viewport.
function centerTargetY(el) {
  const rect = el.getBoundingClientRect()
  const off = Math.max(0, (window.innerHeight - rect.height) / 2)
  return Math.max(0, Math.round(rect.top + window.scrollY - off))
}

// Eased rAF scroll to an absolute Y over `dur` ms; runs `onDone` when it lands.
// No-op for tiny hops. Returns a handle whose `.raf` the caller can cancel.
function glide(scroller, targetY, dur, onDone) {
  const startY = window.scrollY
  const dist = targetY - startY
  if (Math.abs(dist) < 4) return null
  const handle = { raf: null }
  let start = null
  const frame = (ts) => {
    if (start === null) start = ts
    const p = Math.min(1, (ts - start) / dur)
    scroller.scrollTop = startY + dist * easeOutCubic(p) // scrollTop = instant per frame
    if (p < 1) handle.raf = requestAnimationFrame(frame)
    else onDone?.()
  }
  handle.raf = requestAnimationFrame(frame)
  return handle
}

// ---- wheel-guided section scroll: one wheel gesture glides you to the next
//      section over ~0.6s (eased). Immediate (no debounce), locked during the
//      glide so momentum doesn't stack. Only guides within `selector` (hero +
//      journey); past the last target it lets the page scroll natively. Disabled
//      for touch (native) and reduced-motion. ----------------------------------
export function useSectionScroll(selector) {
  useEffect(() => {
    if (prefersReducedMotion()) return
    const scroller = document.scrollingElement || document.documentElement
    let handle = null
    let animating = false
    let cooldownUntil = 0

    // Section centre targets, sorted top-to-bottom. Scroll-invariant (absolute doc
    // positions), so measure once and refresh only on resize — not per wheel event.
    // The sections mount after data loads, so (re)measure lazily until they exist.
    let T = []
    const measure = () => {
      T = Array.from(document.querySelectorAll(selector)).map(centerTargetY).sort((a, b) => a - b)
    }

    const glideTo = (targetY, dur) => {
      handle = glide(scroller, targetY, dur, () => {
        animating = false
        cooldownUntil = performance.now() + COOLDOWN
      })
      animating = handle !== null
    }

    const onWheel = (e) => {
      if (e.ctrlKey) return // pinch-zoom — leave it alone
      if (T.length < 2) measure()
      if (T.length < 2) return
      // Below the journey (coda/footer): scroll natively.
      if (window.scrollY > T[T.length - 1] + window.innerHeight * 0.4) return
      const dir = e.deltaY > 0 ? 1 : e.deltaY < 0 ? -1 : 0
      if (dir === 0) return
      const y = window.scrollY
      let idx = 0
      let best = Infinity
      T.forEach((t, i) => {
        const d = Math.abs(t - y)
        if (d < best) {
          best = d
          idx = i
        }
      })
      const next = idx + dir
      if (next < 0 || next >= T.length) return // at an end → native scroll
      e.preventDefault()
      if (animating || performance.now() < cooldownUntil) return
      // One decade hop = DURATION. Scale by distance so every transition moves at the
      // SAME velocity — so the bigger jump up to the hero glides like decade scrolling,
      // not an instant teleport. Only the downward hero -> first-decade glide is slow.
      const stepRef = T.length > 2 ? Math.abs(T[2] - T[1]) : Math.abs(T[1] - T[0])
      const dur =
        idx === 0 && next === 1
          ? HERO_DURATION
          : Math.round(DURATION * (Math.abs(T[next] - T[idx]) / stepRef))
      glideTo(T[next], dur)
    }

    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('resize', measure)
      if (handle?.raf) cancelAnimationFrame(handle.raf)
    }
  }, [selector])
}

// Smoothly scroll an element to the vertical centre of the viewport over `duration`
// ms (eased). Used for one-off programmatic scrolls (e.g. the toggle) that want a
// controllable speed instead of the browser's fixed-speed scrollIntoView.
export function scrollToCenter(el, duration = 550) {
  if (!el) return
  const scroller = document.scrollingElement || document.documentElement
  const targetY = centerTargetY(el)
  if (prefersReducedMotion()) {
    scroller.scrollTop = targetY
    return
  }
  glide(scroller, targetY, duration)
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
