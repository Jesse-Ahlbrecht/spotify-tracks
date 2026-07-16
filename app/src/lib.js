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

// ---- helpers --------------------------------------------------------------
export const pct = (v) => `${Math.round(v * 100)}%`
export const dec2 = (v) => v.toFixed(2)

// The four "dials" that travel with the journey, in fixed order.
export const DIALS = [
  { key: 'valence', label: 'Valence', sub: 'positivity', color: 'var(--c-valence)', fmt: dec2 },
  { key: 'energy', label: 'Energy', sub: 'intensity', color: 'var(--c-energy)', fmt: dec2 },
  { key: 'danceability', label: 'Danceability', sub: 'groove', color: 'var(--c-dance)', fmt: dec2 },
  { key: 'minor_share', label: 'Minor key', sub: 'tonal “sadness”', color: 'var(--c-minor)', fmt: pct },
]

// One short caption per decade for the journey steps.
export const DECADE_CAPTIONS = {
  1920: 'Where it begins. Bright and gentle — high valence, low energy, almost entirely acoustic. About three in four songs are in a major key — the “brighter” tonality Western ears tend to hear as upbeat.',
  1930: 'The Depression era. Still soft and largely acoustic, valence dips a touch from the twenties’ high.',
  1940: 'Wartime. Valence and danceability slump toward the century’s floor — the least upbeat stretch of the hundred years.',
  1950: 'The record era proper. Valence actually bottoms out here — its century low — even as energy just begins to stir; production is still almost entirely acoustic.',
  1960: 'Amplification arrives. Energy climbs sharply as electric instruments take over — and valence rebounds from the fifties’ low.',
  1970: 'The electrification is in full swing: louder, more energetic, more danceable. The arc bends up and stays up.',
  1980: 'Synths and studio polish. Energy and danceability keep rising, and minor-key writing ticks up — about a third of songs now lean on the darker, more ambiguous tonality Western ears read as less upbeat, part of a slow century-long drift toward it.',
  1990: 'Peak variety. High energy, steady valence — but the tonal “darkening” is quietly gathering.',
  2000: 'The loudness war peaks. Energy near its maximum; valence begins its real decline.',
  2010: 'The streaming turn. Valence drops hard, minor keys surge, and the “sad banger” becomes a third of all tracks.',
  2020: 'Today. Nearly half of songs are in a minor key — the most in a century. The darker, less-upbeat tonality is now almost as common as the bright major one, even as energy finally plateaus.',
}
