import { scrollToIntro, scrollToReadingLine, scrollToTop, useSectionAtLine } from '../lib.js'

// Two strokes, no box. Drawn rather than typed: the ↑ / ↓ glyphs carry a font's own weight and
// terminals, so they never quite match at this size, and a chevron is the lighter mark anyway.
const Chevron = ({ dir }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d={dir === 'up' ? 'M5 15 12 8l7 7' : 'M5 9l7 7 7-7'} />
  </svg>
)

// The landmarks the arrows step between, in document order. The first two are whole screens, the
// third stands in for its eleven decades — hence LADDER below.
const SECTIONS = '.hero, .journey-intro, .journey'
const [HERO, INTRO, JOURNEY] = [0, 1, 2]

// A step-a-section pair, fixed to the right edge — an alternative to scrolling for anyone whose
// wheel or trackpad fights them. It flattens the page into one ladder: landing, explainer, then a
// rung per decade, so holding ↑ walks all the way back out to the top rather than dead-ending on
// the first decade.
// It only ever SCROLLS: the decade rungs come from useActiveStep's observer, so the arrows, the
// plane and the captions cannot disagree about where the reader is. Targets are addressed by
// `data-step`, the same index channel that observer reads back.
// Fixed position keeps it out of the journey grid — it is not a grid item, so it adds no column
// and cannot disturb --embed-h.
export default function DecadeArrows({ count, active }) {
  const section = useSectionAtLine(SECTIONS)
  const rung = section === JOURNEY ? JOURNEY + active : section
  const last = JOURNEY + count - 1

  const go = (r) => {
    if (r === HERO) scrollToTop()
    else if (r === INTRO) scrollToIntro()
    else scrollToReadingLine(`.step[data-step="${r - JOURNEY}"]`)
  }

  // Hidden on the landing screen (it is the terminus, and it has its own cue) and past the end of
  // the journey (where "jump to top" takes over) — so `show` is not simply `rung >= 0`.
  const show = rung >= INTRO && rung <= last
  const atTop = rung <= HERO
  const atEnd = rung >= last

  // aria-disabled, NOT the `disabled` attribute, and this is load-bearing rather than a style
  // preference: a press starts a smooth scroll, the rung changes as the page travels, and setting
  // `disabled` on the button the reader actually clicked cancels that scroll dead — measured, the
  // climb to the landing screen stopped at 371px instead of 0. (Setting it on a programmatically
  // focused button does not, which is what made this look innocent at first.) aria-disabled says
  // the same thing to assistive tech without ever taking focus away mid-jump.
  return (
    <nav className={`decade-arrows ${show ? 'show' : ''}`} aria-label="Step through the story">
      <button
        className="decade-arrow"
        aria-label="Previous step"
        aria-disabled={atTop || undefined}
        onClick={() => !atTop && go(rung - 1)}
      >
        <Chevron dir="up" />
      </button>
      <button
        className="decade-arrow"
        aria-label="Next step"
        aria-disabled={atEnd || undefined}
        onClick={() => !atEnd && go(rung + 1)}
      >
        <Chevron dir="down" />
      </button>
    </nav>
  )
}
